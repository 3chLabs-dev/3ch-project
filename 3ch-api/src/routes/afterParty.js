const express = require('express');
const multer = require('multer');
const { randomUUID } = require('crypto');
const { z } = require('zod');
const pool = require('../db/pool');
const { requireAuth, optionalAuth } = require('../middlewares/auth');
const { calculate } = require('../services/afterPartyCalculation');
const { buildSummary } = require('../services/afterPartySummary');
const { normalizeParticipants } = require('../services/afterPartyParticipants');
const { scanReceiptWithOpenAIVision } = require('../services/receiptVisionScanner');
const { defaultAlcoholKeywords, defaultBeverageKeywords, classifyReceiptItem } = require('../services/receiptClassification');
const { FEATURES, consumeFeatureCredit, refundFeatureCredit } = require('../services/featureUsageService');

const router = express.Router();
const receiptUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024, files: 10 } });
const uuid = z.string().uuid();
const leagueCode = z.string().min(1).max(100);

// 화면 URL의 리그 코드와 내부 ID를 동일하게 처리한다.
router.param('leagueId', async (req, _res, next, value) => {
  const raw = String(value ?? '').trim();
  const normalized = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (/^[A-Z]{3}\d{8}$/.test(normalized)) {
    try {
      const result = await pool.query(
        `SELECT id FROM leagues WHERE league_code=$1 OR regexp_replace(upper(coalesce(league_code,'')), '[^A-Z0-9]', '', 'g')=$2 LIMIT 1`,
        [raw, normalized],
      );
      if (result.rowCount) req.params.leagueId = result.rows[0].id;
    } catch (error) { return next(error); }
  }
  next();
});
const person = z.object({ id: uuid, name: z.string().trim().min(1).max(100), division: z.string().trim().max(30).optional(), guest: z.boolean().optional(), attending: z.boolean(), drinking: z.boolean(), excluded: z.boolean() });
const item = z.object({ id: uuid, name: z.string().trim().min(1).max(100), quantity: z.number().int().min(1).max(999).optional(), amount: z.number().int().min(0).max(1000000000), category: z.enum(['common', 'alcohol', 'nonalcohol', 'specific']), personIds: z.array(uuid) });
const contribution = z.object({ id: uuid, name: z.string().trim().min(1).max(100), amount: z.number().int().min(0).max(1000000000), personId: uuid.optional() });
const bodySchema = z.object({ title: z.string().trim().min(1).max(100), participants: z.array(person).max(300), items: z.array(item).max(200), contributions: z.array(contribution).max(100), version: z.number().int().positive().optional(), receipt_thumbnails: z.array(z.string().max(30000).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/)).max(30).optional() });
const receiptResultSchema = z.object({
  merchant: z.string().max(200), purchasedAt: z.string().max(100), receiptTotal: z.number().int().min(0).max(1000000000),
  items: z.array(z.object({ name: z.string().trim().min(1).max(100), unitPrice: z.number().int().min(0).max(1000000000), quantity: z.number().int().min(1).max(999), amount: z.number().int().min(0).max(1000000000), confidence: z.number().min(0).max(1), needsReview: z.boolean() })).max(200),
});
async function access(client, leagueId, userId) {
  const result = await client.query(`SELECT l.created_by_id,l.group_id,gm.role,COALESCE((gm.management_permissions->>'settlement')::boolean,true) AS settlement_permission FROM leagues l LEFT JOIN group_members gm ON gm.group_id=l.group_id AND gm.user_id=$2 WHERE l.id=$1`, [leagueId, userId]);
  if (!result.rowCount) return { allowed: false, manage: false };
  const { created_by_id: creatorId, group_id: groupId, role, settlement_permission: settlementPermission } = result.rows[0];
  const creator = !groupId && Number(creatorId) === userId;
  return { allowed: creator || !!role, manage: creator || role === 'owner' || (role === 'admin' && settlementPermission) };
}
function unique(values) { return new Set(values).size === values.length; }
function fail(res, status, message) { return res.status(status).json({ message }); }
const visibleRounds = 'archived_at IS NULL';
async function paymentStatus(client, leagueId, summary) {
  const rows = await client.query('SELECT participant_id,paid_amount FROM after_party_payments WHERE league_id=$1', [leagueId]);
  const amounts = new Map(rows.rows.map((row) => [row.participant_id, row.paid_amount]));
  return Object.fromEntries(summary.people.map((person) => [person.participantId, amounts.get(person.participantId) === person.total]));
}

router.post('/leagues/:leagueId/after-party/receipt-scan', requireAuth, receiptUpload.array('image', 10), async (req, res) => {
  const leagueId = req.params.leagueId;
  const userId = Number(req.user.sub);
  const scanId = randomUUID();
  const requestKey = `after-party-receipt:${leagueId}:${String(req.get('Idempotency-Key') || randomUUID()).slice(0, 64)}`;
  let usageOwnerId = null;
  let creditConsumed = false;
  let logCreated = false;
  try {
    if (!leagueCode.safeParse(leagueId).success) return fail(res, 400, '리그 ID가 올바르지 않습니다.');
    const rights = await access(pool, leagueId, userId);
    if (!rights.manage) return fail(res, 403, '영수증 인식 권한이 없습니다.');
    const images = req.files ?? [];
    if (!images.length || images.some((file) => !String(file.mimetype || '').startsWith('image/'))) return fail(res, 400, '영수증 이미지 파일이 필요합니다.');
    if (images.reduce((sum, file) => sum + file.size, 0) > 40 * 1024 * 1024) return fail(res, 400, '사진 전체 용량은 40MB 이하로 선택해 주세요.');
    const league = await pool.query('SELECT COALESCE(billing_owner_id,created_by_id) AS billing_owner_id FROM leagues WHERE id=$1', [leagueId]);
    if (!league.rowCount) return fail(res, 404, '리그를 찾을 수 없습니다.');
    usageOwnerId = Number(league.rows[0].billing_owner_id);
    const roundNo = /^\d+$/.test(String(req.body?.round_no || '')) ? Number(req.body.round_no) : null;
    await pool.query(`INSERT INTO after_party_receipt_scans(id,league_id,round_no,requested_by_id,status) VALUES($1,$2,$3,$4,'processing')`, [scanId, leagueId, roundNo, userId]);
    logCreated = true;
    const usage = await consumeFeatureCredit({ userId: usageOwnerId, feature: FEATURES.VISION_SCAN, requestKey, referenceType: 'LEAGUE', referenceId: leagueId, metadata: { requestedBy: userId, kind: 'after_party_receipt' } });
    if (!usage.allowed) {
      await pool.query(`UPDATE after_party_receipt_scans SET status='failed',error_message=$2,completed_at=NOW() WHERE id=$1`, [scanId, '사진 인식 잔여 횟수가 없습니다.']);
      return res.status(402).json({ message: '사진 인식 잔여 횟수가 없습니다.', code: 'VISION_QUOTA_EXHAUSTED', pricingPath: '/mypage/pricing' });
    }
    creditConsumed = true;
    const settingsResult = await pool.query('SELECT alcohol_keywords,beverage_keywords FROM after_party_menu_settings WHERE id=1');
    const alcoholKeywords = settingsResult.rows[0]?.alcohol_keywords ?? defaultAlcoholKeywords;
    const beverageKeywords = settingsResult.rows[0]?.beverage_keywords ?? defaultBeverageKeywords;
    const vision = await scanReceiptWithOpenAIVision({ images: images.map((file) => ({ imageBuffer: file.buffer, mimeType: file.mimetype })) });
    const parsed = receiptResultSchema.parse(vision.result);
    const items = parsed.items.map((entry) => ({ ...entry, category: classifyReceiptItem(entry.name, alcoholKeywords, beverageKeywords) }));
    const recognizedTotal = items.reduce((sum, entry) => sum + entry.amount, 0);
    const difference = recognizedTotal - parsed.receiptTotal;
    const result = { merchant: parsed.merchant, purchasedAt: parsed.purchasedAt, receiptTotal: parsed.receiptTotal, recognizedTotal, difference, items };
    await pool.query(`UPDATE after_party_receipt_scans SET status='success',engine=$2,merchant=$3,purchased_at=$4,receipt_total=$5,recognized_total=$6,difference=$7,item_count=$8,result=$9,completed_at=NOW() WHERE id=$1`, [scanId, vision.engine, parsed.merchant || null, parsed.purchasedAt || null, parsed.receiptTotal, recognizedTotal, difference, items.length, JSON.stringify(result)]);
    return res.json({ scanId, engine: vision.engine, ...result });
  } catch (error) {
    if (creditConsumed && usageOwnerId) await refundFeatureCredit({ userId: usageOwnerId, feature: FEATURES.VISION_SCAN, requestKey, reason: error?.code || 'RECEIPT_SCAN_FAILED' }).catch(() => {});
    if (logCreated) await pool.query(`UPDATE after_party_receipt_scans SET status='failed',error_message=$2,completed_at=NOW() WHERE id=$1`, [scanId, String(error.message || '영수증 인식 실패').slice(0, 1000)]).catch(() => {});
    if (error?.code === 'OPENAI_API_KEY_MISSING') return res.status(503).json({ message: error.message, code: error.code });
    if (error?.code === 'OPENAI_VISION_FAILED') return res.status(502).json({ message: error.message, code: error.code });
    console.error('After-party receipt scan failed:', error);
    return fail(res, 500, '영수증 사진 인식 중 오류가 발생했습니다.');
  }
});

router.get('/after-party/shared/:token', optionalAuth, async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const token = req.params.token;
    if (!uuid.safeParse(token).success) return fail(res, 400, '공유 링크가 올바르지 않습니다.');
    const found = await pool.query('SELECT l.id,l.league_code,l.name,l.start_date,l.bank_account,s.visibility,l.group_id FROM after_party_share_links s JOIN leagues l ON l.id=s.league_id WHERE s.token=$1', [token]);
    if (!found.rowCount) return fail(res, 404, '공유 링크를 찾을 수 없습니다.');
    const league = found.rows[0];
    if (league.visibility === 'club_only') {
      if (!req.user) return fail(res, 401, '클럽 회원 로그인이 필요합니다.');
      const member = await pool.query('SELECT 1 FROM group_members WHERE group_id=$1 AND user_id=$2', [league.group_id, Number(req.user.sub)]);
      if (!member.rowCount) return fail(res, 403, '클럽 회원만 볼 수 있습니다.');
    }
    const result = await pool.query(`SELECT id,round_no,title,status,version,created_at,updated_at,participants,items,contributions,calculation,receipt_thumbnails FROM after_party_settlements WHERE league_id=$1 AND ${visibleRounds} ORDER BY round_no`, [league.id]);
    const summary = buildSummary(result.rows);
    return res.json({ league: { id: league.id, league_code: league.league_code, name: league.name, start_date: league.start_date, bank_account: league.bank_account }, settlements: result.rows, summary, canManage: false, visibility: league.visibility });
  } catch (error) { console.error(error); return fail(res, 500, '공유 정산 조회에 실패했습니다.'); }
});

router.post('/leagues/:leagueId/after-party/share', requireAuth, async (req, res) => {
  try {
    const leagueId = req.params.leagueId;
    if (!leagueCode.safeParse(leagueId).success) return fail(res, 400, '리그 ID가 올바르지 않습니다.');
    const rights = await access(pool, leagueId, Number(req.user.sub));
    if (!rights.manage) return fail(res, 403, '정산 공유 권한이 없습니다.');
    const count = await pool.query(`SELECT 1 FROM after_party_settlements WHERE league_id=$1 AND ${visibleRounds} LIMIT 1`, [leagueId]);
    if (!count.rowCount) return fail(res, 400, '저장된 정산이 없습니다.');
    await pool.query('INSERT INTO after_party_share_links(league_id,token,created_by_id) VALUES($1,$2,$3) ON CONFLICT (league_id) DO NOTHING', [leagueId, randomUUID(), Number(req.user.sub)]);
    const result = await pool.query('SELECT token,visibility FROM after_party_share_links WHERE league_id=$1', [leagueId]);
    return res.json(result.rows[0]);
  } catch (error) { console.error(error); return fail(res, 500, '공유 링크 생성에 실패했습니다.'); }
});

router.patch('/leagues/:leagueId/after-party/share', requireAuth, async (req, res) => {
  const { leagueId } = req.params;
  const parsed = z.object({ visibility: z.enum(['public', 'club_only']) }).safeParse(req.body);
  if (!leagueCode.safeParse(leagueId).success || !parsed.success) return fail(res, 400, '공유 설정을 확인해 주세요.');
  try {
    const rights = await access(pool, leagueId, Number(req.user.sub));
    if (!rights.manage) return fail(res, 403, '정산 공유 권한이 없습니다.');
    const result = await pool.query('UPDATE after_party_share_links SET visibility=$2 WHERE league_id=$1 RETURNING token,visibility', [leagueId, parsed.data.visibility]);
    if (!result.rowCount) return fail(res, 404, '공유 링크를 먼저 생성해 주세요.');
    return res.json(result.rows[0]);
  } catch (error) { console.error(error); return fail(res, 500, '공유 설정 저장에 실패했습니다.'); }
});

router.get('/leagues/:leagueId/after-party', requireAuth, async (req, res) => {
  try {
    const leagueId = req.params.leagueId;
    if (!leagueCode.safeParse(leagueId).success) return fail(res, 400, '리그 ID가 올바르지 않습니다.');
    const rights = await access(pool, leagueId, Number(req.user.sub));
    if (!rights.allowed) return fail(res, 403, '조회 권한이 없습니다.');
    const result = await pool.query(`SELECT id,round_no,title,status,version,created_at,updated_at,participants,items,contributions,calculation,receipt_thumbnails FROM after_party_settlements WHERE league_id=$1 AND ${visibleRounds} ORDER BY round_no`, [leagueId]);
    const summary = buildSummary(result.rows);
    return res.json({ settlements: result.rows, summary, canManage: rights.manage, payments: await paymentStatus(pool, leagueId, summary) });
  } catch (error) { console.error(error); return fail(res, 500, '정산 목록 조회에 실패했습니다.'); }
});

router.get('/leagues/:leagueId/after-party/:id', requireAuth, async (req, res) => {
  try {
    const { leagueId, id } = req.params;
    if (!leagueCode.safeParse(leagueId).success || !uuid.safeParse(id).success) return fail(res, 400, 'ID가 올바르지 않습니다.');
    const rights = await access(pool, leagueId, Number(req.user.sub));
    if (!rights.allowed) return fail(res, 403, '조회 권한이 없습니다.');
    const result = await pool.query('SELECT * FROM after_party_settlements WHERE league_id=$1 AND id=$2 AND archived_at IS NULL', [leagueId, id]);
    if (!result.rowCount) return fail(res, 404, '정산을 찾을 수 없습니다.');
    return res.json({ settlement: result.rows[0], canManage: rights.manage });
  } catch (error) { console.error(error); return fail(res, 500, '정산 조회에 실패했습니다.'); }
});

router.post('/leagues/:leagueId/after-party', requireAuth, async (req, res) => {
  const { leagueId } = req.params;
  if (!leagueCode.safeParse(leagueId).success) return fail(res, 400, '리그 ID가 올바르지 않습니다.');
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success || !parsed.data.items.length) return fail(res, 400, '메뉴와 정산 내용을 입력해 주세요.');
  const body = parsed.data;
  if (!unique(body.participants.map((p) => p.id)) || !unique(body.items.map((i) => i.id)) || !unique(body.contributions.map((c) => c.id))) return fail(res, 400, '중복된 항목 ID가 있습니다.');
  if (body.items.some((entry) => entry.category === 'specific')) return fail(res, 400, '메뉴 구분을 확인해 주세요.');
  const personIds = new Set(body.participants.map((p) => p.id));
  if (body.items.some((entry) => entry.personIds.some((personId) => !personIds.has(personId))) || body.contributions.some((entry) => entry.personId && !personIds.has(entry.personId))) return fail(res, 400, '부담 대상 또는 연결된 찬조자가 참가자 명단에 없습니다.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const rights = await access(client, leagueId, Number(req.user.sub));
    if (!rights.manage) { await client.query('ROLLBACK'); return fail(res, 403, '정산 생성 권한이 없습니다.'); }
    await client.query('SELECT id FROM leagues WHERE id=$1 FOR UPDATE', [leagueId]);
    const serverPeople = await client.query('SELECT id,name,division FROM league_participants WHERE league_id=$1 AND is_bot=false', [leagueId]);
    const savedRounds = await client.query('SELECT participants FROM after_party_settlements WHERE league_id=$1 ORDER BY round_no', [leagueId]);
    let participants;
    try { participants = normalizeParticipants(body.participants, serverPeople.rows, savedRounds.rows); }
    catch (error) { await client.query('ROLLBACK'); return fail(res, 400, error.message); }
    const contributions = body.contributions.map((entry) => ({ ...entry, name: entry.personId ? participants.find((person) => person.id === entry.personId)?.name : entry.name }));
    let calculation;
    try { calculation = calculate(participants, body.items, contributions); }
    catch (error) { await client.query('ROLLBACK'); return fail(res, 400, error.message); }
    const id = randomUUID();
    const latest = await client.query('SELECT COALESCE(MAX(round_no),0)::int AS value FROM after_party_settlements WHERE league_id=$1', [leagueId]);
    const roundNo = latest.rows[0].value + 1;
    const result = await client.query(`INSERT INTO after_party_settlements(id,league_id,round_no,title,participants,items,contributions,calculation,version,created_by_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,2,$9) RETURNING *`, [id, leagueId, roundNo, `${roundNo}차`, JSON.stringify(participants), JSON.stringify(body.items), JSON.stringify(contributions), JSON.stringify(calculation), Number(req.user.sub)]);
    if (body.receipt_thumbnails?.length) {
      await client.query('UPDATE after_party_settlements SET receipt_thumbnails=$2::jsonb WHERE id=$1', [id, JSON.stringify(body.receipt_thumbnails)]);
      result.rows[0].receipt_thumbnails = body.receipt_thumbnails;
    }
    await client.query('COMMIT');
    return res.status(201).json({ settlement: result.rows[0] });
  } catch (error) { await client.query('ROLLBACK'); console.error(error); return fail(res, 500, '정산 생성에 실패했습니다.'); }
  finally { client.release(); }
});

router.put('/leagues/:leagueId/after-party/:id', requireAuth, async (req, res) => {
  const { leagueId, id } = req.params;
  if (!leagueCode.safeParse(leagueId).success || !uuid.safeParse(id).success) return fail(res, 400, 'ID가 올바르지 않습니다.');
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, '정산 입력값을 확인해 주세요.');
  const body = parsed.data;
  if (!unique(body.participants.map((p) => p.id)) || !unique(body.items.map((i) => i.id)) || !unique(body.contributions.map((c) => c.id))) return fail(res, 400, '중복된 항목 ID가 있습니다.');
  const personIds = new Set(body.participants.map((p) => p.id));
  if (body.items.some((i) => i.personIds.some((personId) => !personIds.has(personId)))) return fail(res, 400, '항목의 부담 대상이 참석자 명단에 없습니다.');
  if (body.contributions.some((entry) => entry.personId && !personIds.has(entry.personId))) return fail(res, 400, '찬조자가 참가자 명단에 없습니다.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const rights = await access(client, leagueId, Number(req.user.sub));
    if (!rights.manage) { await client.query('ROLLBACK'); return fail(res, 403, '정산 수정 권한이 없습니다.'); }
    const existing = await client.query('SELECT * FROM after_party_settlements WHERE league_id=$1 AND id=$2 AND archived_at IS NULL FOR UPDATE', [leagueId, id]);
    if (!existing.rowCount) { await client.query('ROLLBACK'); return fail(res, 404, '정산을 찾을 수 없습니다.'); }
    const current = existing.rows[0];
    if (current.version !== body.version) { await client.query('ROLLBACK'); return fail(res, 409, '다른 곳에서 정산을 수정했습니다. 새로고침 후 다시 확인해 주세요.'); }
    for (const key of ['participants', 'items', 'contributions']) {
      const nextIds = new Set(body[key].map((entry) => entry.id));
      if (current[key].some((entry) => !nextIds.has(entry.id))) { await client.query('ROLLBACK'); return fail(res, 409, '저장된 참석자·항목·찬조금은 일반 저장에서 삭제할 수 없습니다.'); }
    }
    if (body.items.some((entry) => entry.category === 'specific' && !current.items.some((old) => old.id === entry.id && old.category === 'specific'))) { await client.query('ROLLBACK'); return fail(res, 400, '메뉴는 음식·주류·비주류 중 하나로 구분해 주세요.'); }
    const serverPeople = await client.query('SELECT id,name,division FROM league_participants WHERE league_id=$1 AND is_bot=false', [leagueId]);
    const savedRounds = await client.query('SELECT participants FROM after_party_settlements WHERE league_id=$1 ORDER BY round_no', [leagueId]);
    let participants;
    try { participants = normalizeParticipants(body.participants, serverPeople.rows, savedRounds.rows, current.participants); }
    catch (error) { await client.query('ROLLBACK'); return fail(res, 400, error.message); }
    const contributions = body.contributions.map((entry) => ({ ...entry, name: entry.personId ? participants.find((person) => person.id === entry.personId)?.name : entry.name }));
    let calculation;
    try { calculation = calculate(participants, body.items, contributions); }
    catch (error) { await client.query('ROLLBACK'); return fail(res, 400, error.message); }
    const updated = await client.query(`UPDATE after_party_settlements SET title=$3,participants=$4,items=$5,contributions=$6,calculation=$7,version=version+1,updated_at=now() WHERE league_id=$1 AND id=$2 RETURNING *`, [leagueId,id,body.title,JSON.stringify(participants),JSON.stringify(body.items),JSON.stringify(contributions),JSON.stringify(calculation)]);
    if (body.receipt_thumbnails?.length) {
      const thumbnails = [...new Set([...(current.receipt_thumbnails ?? []), ...body.receipt_thumbnails])];
      if (thumbnails.length > 30) { await client.query('ROLLBACK'); return fail(res, 400, '영수증 사진은 차수당 최대 30장까지 저장할 수 있습니다.'); }
      await client.query('UPDATE after_party_settlements SET receipt_thumbnails=$2::jsonb WHERE id=$1', [id, JSON.stringify(thumbnails)]);
      updated.rows[0].receipt_thumbnails = thumbnails;
    }
    await client.query('COMMIT');
    return res.json({ settlement: updated.rows[0] });
  } catch (error) { await client.query('ROLLBACK'); console.error(error); return fail(res, 500, '정산 저장에 실패했습니다.'); }
  finally { client.release(); }
});

router.post('/leagues/:leagueId/after-party/:id/remove-entry', requireAuth, async (req, res) => {
  const { leagueId, id } = req.params;
  const request = z.object({ kind: z.enum(['items', 'contributions']), entryId: uuid, version: z.number().int().positive(), confirmationIntent: z.literal('REMOVE_AFTER_PARTY_ENTRY') }).safeParse(req.body);
  if (!leagueCode.safeParse(leagueId).success || !uuid.safeParse(id).success || !request.success) return fail(res, 400, '삭제 요청을 확인해 주세요.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const rights = await access(client, leagueId, Number(req.user.sub));
    if (!rights.manage) { await client.query('ROLLBACK'); return fail(res, 403, '항목 삭제 권한이 없습니다.'); }
    const found = await client.query('SELECT * FROM after_party_settlements WHERE league_id=$1 AND id=$2 AND archived_at IS NULL FOR UPDATE', [leagueId, id]);
    if (!found.rowCount) { await client.query('ROLLBACK'); return fail(res, 404, '정산을 찾을 수 없습니다.'); }
    const row = found.rows[0];
    if (row.version !== request.data.version) { await client.query('ROLLBACK'); return fail(res, 409, '최신 정산만 수정할 수 있습니다.'); }
    const entries = row[request.data.kind].filter((entry) => entry.id !== request.data.entryId);
    if (entries.length === row[request.data.kind].length) { await client.query('ROLLBACK'); return fail(res, 404, '항목을 찾을 수 없습니다.'); }
    const items = request.data.kind === 'items' ? entries : row.items;
    const contributions = request.data.kind === 'contributions' ? entries : row.contributions;
    const calculation = calculate(row.participants, items, contributions);
    const saved = await client.query(`UPDATE after_party_settlements SET items=$3,contributions=$4,calculation=$5,version=version+1,updated_at=now() WHERE league_id=$1 AND id=$2 RETURNING *`, [leagueId,id,JSON.stringify(items),JSON.stringify(contributions),JSON.stringify(calculation)]);
    await client.query('COMMIT');
    return res.json({ settlement: saved.rows[0] });
  } catch (error) { await client.query('ROLLBACK'); console.error(error); return fail(res, 500, '항목 삭제에 실패했습니다.'); }
  finally { client.release(); }
});

router.post('/leagues/:leagueId/after-party/:id/archive', requireAuth, async (req, res) => {
  const { leagueId, id } = req.params;
  const parsed = z.object({ version: z.number().int().positive(), confirmationIntent: z.literal('ARCHIVE_AFTER_PARTY_ROUND') }).safeParse(req.body);
  if (!leagueCode.safeParse(leagueId).success || !uuid.safeParse(id).success || !parsed.success) return fail(res, 400, '정산 삭제 확인이 필요합니다.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const rights = await access(client, leagueId, Number(req.user.sub));
    if (!rights.manage) { await client.query('ROLLBACK'); return fail(res, 403, '정산 삭제 권한이 없습니다.'); }
    const found = await client.query('SELECT id,version,round_no FROM after_party_settlements WHERE league_id=$1 AND id=$2 AND archived_at IS NULL FOR UPDATE', [leagueId, id]);
    if (!found.rowCount) { await client.query('ROLLBACK'); return fail(res, 404, '정산을 찾을 수 없습니다.'); }
    if (found.rows[0].version !== parsed.data.version) { await client.query('ROLLBACK'); return fail(res, 409, '정산이 변경됐습니다. 목록을 새로고침해 주세요.'); }
    await client.query('UPDATE after_party_settlements SET archived_at=now(),archived_by_id=$3,updated_at=now() WHERE league_id=$1 AND id=$2', [leagueId, id, Number(req.user.sub)]);
    await client.query('COMMIT');
    return res.json({ archived: true, round_no: found.rows[0].round_no });
  } catch (error) { await client.query('ROLLBACK'); console.error(error); return fail(res, 500, '정산 삭제에 실패했습니다.'); }
  finally { client.release(); }
});

router.put('/leagues/:leagueId/after-party/payments/:participantId', requireAuth, async (req, res) => {
  const { leagueId, participantId } = req.params;
  const parsed = z.object({ paid: z.boolean() }).safeParse(req.body);
  if (!leagueCode.safeParse(leagueId).success || !uuid.safeParse(participantId).success || !parsed.success) return fail(res, 400, '입금 확인값을 확인해 주세요.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const rights = await access(client, leagueId, Number(req.user.sub));
    if (!rights.manage) { await client.query('ROLLBACK'); return fail(res, 403, '입금 확인 권한이 없습니다.'); }
    await client.query('SELECT id FROM leagues WHERE id=$1 FOR UPDATE', [leagueId]);
    const rows = await client.query('SELECT participants,calculation,round_no FROM after_party_settlements WHERE league_id=$1 AND archived_at IS NULL ORDER BY round_no', [leagueId]);
    const person = buildSummary(rows.rows).people.find((entry) => entry.participantId === participantId);
    if (!person || person.total <= 0) { await client.query('ROLLBACK'); return fail(res, 404, '청구 대상자를 찾을 수 없습니다.'); }
    const paidAmount = parsed.data.paid ? person.total : null;
    await client.query('INSERT INTO after_party_payments(league_id,participant_id,paid_amount,updated_by_id) VALUES($1,$2,$3,$4) ON CONFLICT (league_id,participant_id) DO UPDATE SET paid_amount=EXCLUDED.paid_amount,updated_by_id=EXCLUDED.updated_by_id,updated_at=now()', [leagueId, participantId, paidAmount, Number(req.user.sub)]);
    await client.query('COMMIT');
    return res.json({ participantId, paid: parsed.data.paid, amount: person.total });
  } catch (error) { await client.query('ROLLBACK'); console.error(error); return fail(res, 500, '입금 확인 저장에 실패했습니다.'); }
  finally { client.release(); }
});

module.exports = router;
