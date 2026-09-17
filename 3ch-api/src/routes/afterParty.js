const express = require('express');
const { randomUUID } = require('crypto');
const { z } = require('zod');
const pool = require('../db/pool');
const { requireAuth } = require('../middlewares/auth');
const { calculate } = require('../services/afterPartyCalculation');
const { buildSummary } = require('../services/afterPartySummary');

const router = express.Router();
const uuid = z.string().uuid();
const person = z.object({ id: uuid, name: z.string().min(1), attending: z.boolean(), drinking: z.boolean(), excluded: z.boolean() });
const item = z.object({ id: uuid, name: z.string().trim().min(1).max(100), amount: z.number().int().min(0).max(1000000000), category: z.enum(['common', 'alcohol', 'nonalcohol', 'specific']), personIds: z.array(uuid) });
const contribution = z.object({ id: uuid, name: z.string().trim().min(1).max(100), amount: z.number().int().min(0).max(1000000000), personId: uuid.optional() });
const bodySchema = z.object({ title: z.string().trim().min(1).max(100), participants: z.array(person).max(300), items: z.array(item).max(200), contributions: z.array(contribution).max(100), version: z.number().int().positive().optional() });

async function access(client, leagueId, userId) {
  const result = await client.query(`SELECT gm.role, COALESCE((gm.management_permissions->>'draw')::boolean,false) AS draw_permission FROM leagues l JOIN group_members gm ON gm.group_id=l.group_id WHERE l.id=$1 AND gm.user_id=$2`, [leagueId, userId]);
  if (!result.rowCount) return { allowed: false, manage: false };
  const { role, draw_permission: drawPermission } = result.rows[0];
  return { allowed: true, manage: role === 'owner' || (role === 'admin' && drawPermission) };
}
function unique(values) { return new Set(values).size === values.length; }
function fail(res, status, message) { return res.status(status).json({ message }); }

router.get('/after-party/shared/:token', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const token = req.params.token;
    if (!uuid.safeParse(token).success) return fail(res, 400, '공유 링크가 올바르지 않습니다.');
    const found = await pool.query('SELECT l.id,l.name,l.bank_account FROM after_party_share_links s JOIN leagues l ON l.id=s.league_id WHERE s.token=$1', [token]);
    if (!found.rowCount) return fail(res, 404, '공유 링크를 찾을 수 없습니다.');
    const league = found.rows[0];
    const result = await pool.query('SELECT id,round_no,title,status,version,created_at,updated_at,participants,calculation FROM after_party_settlements WHERE league_id=$1 ORDER BY round_no', [league.id]);
    return res.json({ league, settlements: result.rows, summary: buildSummary(result.rows), canManage: false });
  } catch (error) { console.error(error); return fail(res, 500, '공유 정산 조회에 실패했습니다.'); }
});

router.post('/leagues/:leagueId/after-party/share', requireAuth, async (req, res) => {
  try {
    const leagueId = req.params.leagueId;
    if (!uuid.safeParse(leagueId).success) return fail(res, 400, '리그 ID가 올바르지 않습니다.');
    const rights = await access(pool, leagueId, Number(req.user.sub));
    if (!rights.manage) return fail(res, 403, '정산 공유 권한이 없습니다.');
    const count = await pool.query('SELECT 1 FROM after_party_settlements WHERE league_id=$1 LIMIT 1', [leagueId]);
    if (!count.rowCount) return fail(res, 400, '저장된 정산이 없습니다.');
    await pool.query('INSERT INTO after_party_share_links(league_id,token,created_by_id) VALUES($1,$2,$3) ON CONFLICT (league_id) DO NOTHING', [leagueId, randomUUID(), Number(req.user.sub)]);
    const result = await pool.query('SELECT token FROM after_party_share_links WHERE league_id=$1', [leagueId]);
    return res.json({ token: result.rows[0].token, visibility: 'link' });
  } catch (error) { console.error(error); return fail(res, 500, '공유 링크 생성에 실패했습니다.'); }
});

router.get('/leagues/:leagueId/after-party', requireAuth, async (req, res) => {
  try {
    const leagueId = req.params.leagueId;
    if (!uuid.safeParse(leagueId).success) return fail(res, 400, '리그 ID가 올바르지 않습니다.');
    const rights = await access(pool, leagueId, Number(req.user.sub));
    if (!rights.allowed) return fail(res, 403, '조회 권한이 없습니다.');
    const result = await pool.query('SELECT id,round_no,title,status,version,created_at,updated_at,participants,calculation FROM after_party_settlements WHERE league_id=$1 ORDER BY round_no', [leagueId]);
    return res.json({ settlements: result.rows, summary: buildSummary(result.rows), canManage: rights.manage });
  } catch (error) { console.error(error); return fail(res, 500, '정산 목록 조회에 실패했습니다.'); }
});

router.get('/leagues/:leagueId/after-party/:id', requireAuth, async (req, res) => {
  try {
    const { leagueId, id } = req.params;
    if (!uuid.safeParse(leagueId).success || !uuid.safeParse(id).success) return fail(res, 400, 'ID가 올바르지 않습니다.');
    const rights = await access(pool, leagueId, Number(req.user.sub));
    if (!rights.allowed) return fail(res, 403, '조회 권한이 없습니다.');
    const result = await pool.query('SELECT * FROM after_party_settlements WHERE league_id=$1 AND id=$2', [leagueId, id]);
    if (!result.rowCount) return fail(res, 404, '정산을 찾을 수 없습니다.');
    return res.json({ settlement: result.rows[0], canManage: rights.manage });
  } catch (error) { console.error(error); return fail(res, 500, '정산 조회에 실패했습니다.'); }
});

router.post('/leagues/:leagueId/after-party', requireAuth, async (req, res) => {
  const { leagueId } = req.params;
  if (!uuid.safeParse(leagueId).success) return fail(res, 400, '리그 ID가 올바르지 않습니다.');
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success || !parsed.data.items.length) return fail(res, 400, '메뉴와 정산 내용을 입력해 주세요.');
  const body = parsed.data;
  if (!unique(body.participants.map((p) => p.id)) || !unique(body.items.map((i) => i.id)) || !unique(body.contributions.map((c) => c.id))) return fail(res, 400, '중복된 항목 ID가 있습니다.');
  if (body.items.some((entry) => entry.category === 'specific') || body.contributions.some((entry) => !entry.personId)) return fail(res, 400, '메뉴 구분과 찬조자를 확인해 주세요.');
  const personIds = new Set(body.participants.map((p) => p.id));
  if (body.items.some((entry) => entry.personIds.some((personId) => !personIds.has(personId))) || body.contributions.some((entry) => !personIds.has(entry.personId))) return fail(res, 400, '부담 대상 또는 찬조자가 참가자 명단에 없습니다.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const rights = await access(client, leagueId, Number(req.user.sub));
    if (!rights.manage) { await client.query('ROLLBACK'); return fail(res, 403, '정산 생성 권한이 없습니다.'); }
    await client.query('SELECT id FROM leagues WHERE id=$1 FOR UPDATE', [leagueId]);
    const serverPeople = await client.query('SELECT id,name FROM league_participants WHERE league_id=$1 AND is_bot=false', [leagueId]);
    const allowed = new Map(serverPeople.rows.map((person) => [person.id, person.name]));
    if (body.participants.some((person) => !allowed.has(person.id))) { await client.query('ROLLBACK'); return fail(res, 400, '리그 참가자 명단에 없는 사람이 포함됐습니다.'); }
    const participants = body.participants.map((person) => ({ ...person, name: allowed.get(person.id) }));
    const contributions = body.contributions.map((entry) => ({ ...entry, name: allowed.get(entry.personId) }));
    let calculation;
    try { calculation = calculate(participants, body.items, contributions); }
    catch (error) { await client.query('ROLLBACK'); return fail(res, 400, error.message); }
    const id = randomUUID();
    const latest = await client.query('SELECT COALESCE(MAX(round_no),0)::int AS value FROM after_party_settlements WHERE league_id=$1', [leagueId]);
    const roundNo = latest.rows[0].value + 1;
    const result = await client.query(`INSERT INTO after_party_settlements(id,league_id,round_no,title,participants,items,contributions,calculation,version,created_by_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,2,$9) RETURNING *`, [id, leagueId, roundNo, `${roundNo}차`, JSON.stringify(participants), JSON.stringify(body.items), JSON.stringify(contributions), JSON.stringify(calculation), Number(req.user.sub)]);
    await client.query('COMMIT');
    return res.status(201).json({ settlement: result.rows[0] });
  } catch (error) { await client.query('ROLLBACK'); console.error(error); return fail(res, 500, '정산 생성에 실패했습니다.'); }
  finally { client.release(); }
});

router.put('/leagues/:leagueId/after-party/:id', requireAuth, async (req, res) => {
  const { leagueId, id } = req.params;
  if (!uuid.safeParse(leagueId).success || !uuid.safeParse(id).success) return fail(res, 400, 'ID가 올바르지 않습니다.');
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
    const existing = await client.query('SELECT * FROM after_party_settlements WHERE league_id=$1 AND id=$2 FOR UPDATE', [leagueId, id]);
    if (!existing.rowCount) { await client.query('ROLLBACK'); return fail(res, 404, '정산을 찾을 수 없습니다.'); }
    const current = existing.rows[0];
    if (current.version !== body.version) { await client.query('ROLLBACK'); return fail(res, 409, '다른 곳에서 정산을 수정했습니다. 새로고침 후 다시 확인해 주세요.'); }
    for (const key of ['participants', 'items', 'contributions']) {
      const nextIds = new Set(body[key].map((entry) => entry.id));
      if (current[key].some((entry) => !nextIds.has(entry.id))) { await client.query('ROLLBACK'); return fail(res, 409, '저장된 참석자·항목·찬조금은 일반 저장에서 삭제할 수 없습니다.'); }
    }
    if (body.items.some((entry) => entry.category === 'specific' && !current.items.some((old) => old.id === entry.id && old.category === 'specific'))) { await client.query('ROLLBACK'); return fail(res, 400, '메뉴는 음식·주류·비주류 중 하나로 구분해 주세요.'); }
    if (body.contributions.some((entry) => !entry.personId && !current.contributions.some((old) => old.id === entry.id))) { await client.query('ROLLBACK'); return fail(res, 400, '찬조자를 참가자 명단에서 선택해 주세요.'); }
    const serverPeople = await client.query('SELECT id,name FROM league_participants WHERE league_id=$1 AND is_bot=false', [leagueId]);
    const allowed = new Map(serverPeople.rows.map((p) => [p.id, p.name]));
    if (body.participants.some((p) => !allowed.has(p.id) && !current.participants.some((old) => old.id === p.id))) { await client.query('ROLLBACK'); return fail(res, 400, '리그 참가자 명단에 없는 사람이 포함됐습니다.'); }
    const participants = body.participants.map((p) => ({ ...p, name: current.participants.find((old) => old.id === p.id)?.name ?? allowed.get(p.id) }));
    const contributions = body.contributions.map((entry) => ({ ...entry, name: entry.personId ? participants.find((person) => person.id === entry.personId)?.name : entry.name }));
    let calculation;
    try { calculation = calculate(participants, body.items, contributions); }
    catch (error) { await client.query('ROLLBACK'); return fail(res, 400, error.message); }
    const updated = await client.query(`UPDATE after_party_settlements SET title=$3,participants=$4,items=$5,contributions=$6,calculation=$7,version=version+1,updated_at=now() WHERE league_id=$1 AND id=$2 RETURNING *`, [leagueId,id,body.title,JSON.stringify(participants),JSON.stringify(body.items),JSON.stringify(contributions),JSON.stringify(calculation)]);
    await client.query('COMMIT');
    return res.json({ settlement: updated.rows[0] });
  } catch (error) { await client.query('ROLLBACK'); console.error(error); return fail(res, 500, '정산 저장에 실패했습니다.'); }
  finally { client.release(); }
});

router.post('/leagues/:leagueId/after-party/:id/remove-entry', requireAuth, async (req, res) => {
  const { leagueId, id } = req.params;
  const request = z.object({ kind: z.enum(['items', 'contributions']), entryId: uuid, version: z.number().int().positive(), confirmationIntent: z.literal('REMOVE_AFTER_PARTY_ENTRY') }).safeParse(req.body);
  if (!uuid.safeParse(leagueId).success || !uuid.safeParse(id).success || !request.success) return fail(res, 400, '삭제 요청을 확인해 주세요.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const rights = await access(client, leagueId, Number(req.user.sub));
    if (!rights.manage) { await client.query('ROLLBACK'); return fail(res, 403, '항목 삭제 권한이 없습니다.'); }
    const found = await client.query('SELECT * FROM after_party_settlements WHERE league_id=$1 AND id=$2 FOR UPDATE', [leagueId, id]);
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

module.exports = router;
