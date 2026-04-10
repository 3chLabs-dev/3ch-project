const express = require('express');
const { z } = require('zod');
const { randomUUID } = require('crypto');
const pool = require('../db/pool');
const { requireAuth, optionalAuth } = require('../middlewares/auth');
const { buildLeagueCode } = require('../utils/clubCodeUtils');
const webpush = require('web-push');

webpush.setVapidDetails(
  process.env.VAPID_MAILTO,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

/** 참가자(participant_id)의 member_id로 push 발송 */
async function sendPushToParticipant(participantId, payload) {
  if (!participantId) return;
  try {
    const r = await pool.query(
      'SELECT member_id FROM league_participants WHERE id = $1',
      [participantId]
    );
    if (!r.rows[0]?.member_id) return;
    const memberId = r.rows[0].member_id;
    const subs = await pool.query(
      'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1',
      [memberId]
    );
    for (const sub of subs.rows) {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      ).catch((e) => {
        if (e.statusCode === 410) {
          // 만료된 subscription 삭제
          pool.query(
            'DELETE FROM push_subscriptions WHERE endpoint = $1',
            [sub.endpoint]
          ).catch(() => {});
        }
      });
    }
  } catch (e) {
    console.error('push 발송 실패:', e.message);
  }
}

const router = express.Router();

// 컬럼 자동 추가
pool.query(`
  ALTER TABLE leagues
    ADD COLUMN IF NOT EXISTS tournament_seeding TEXT,
    ADD COLUMN IF NOT EXISTS tournament_advancement TEXT,
    ADD COLUMN IF NOT EXISTS tournament_rules TEXT,
    ADD COLUMN IF NOT EXISTS advance_count INT,
    ADD COLUMN IF NOT EXISTS advance_method TEXT,
    ADD COLUMN IF NOT EXISTS finals_advance INT
`).catch((e) => console.error('leagues 컬럼 추가 실패:', e.message));

// 토너먼트 경기 컬럼 자동 추가
pool.query(`
  ALTER TABLE league_matches
    ADD COLUMN IF NOT EXISTS bracket TEXT,
    ADD COLUMN IF NOT EXISTS round_number INT,
    ADD COLUMN IF NOT EXISTS match_label TEXT,
    ADD COLUMN IF NOT EXISTS next_match_id TEXT,
    ADD COLUMN IF NOT EXISTS next_slot TEXT,
    ADD COLUMN IF NOT EXISTS loser_next_match_id TEXT,
    ADD COLUMN IF NOT EXISTS loser_next_slot TEXT
`).catch((e) => console.error('league_matches 컬럼 추가 실패:', e.message));

// ─── 토너먼트 브래킷 생성 유틸 ───────────────────────────────────────────────

/**
 * 표준 토너먼트 시드 배치
 * seededBracket(16) = [1,16, 8,9, 5,12, 4,13, 3,14, 6,11, 7,10, 2,15]
 * - 1 vs 2는 결승, 1-4는 준결승, 1-8은 8강에서 대결
 */
function seededBracket(n) {
  function buildPrimary(size) {
    if (size === 2) return [1];
    const prev = buildPrimary(size / 2);
    const half = size / 2;
    const result = [];
    for (let i = 0; i < prev.length; i++) {
      const s = prev[i];
      const comp = half + 1 - s;
      if (i % 2 === 0) { result.push(s, comp); }
      else             { result.push(comp, s); }
    }
    return result;
  }
  const primary = buildPrimary(n);
  const result = [];
  for (const s of primary) result.push(s, n + 1 - s);
  return result;
}

function roundName(size) {
  if (size === 2) return '결승';
  return `${size}강`;
}

function getSingleElimLabels(bracketSize) {
  const labels = [];
  for (let s = bracketSize; s >= 2; s /= 2) labels.push(roundName(s));
  return labels;
}

/**
 * 단일 토너먼트(상위만) 매치 생성
 * @returns {Array} matches (id 미포함 – 삽입 시 UUID 생성)
 */
function buildSingleElimMatches(bracketSize, participants) {
  const numRounds = Math.log2(bracketSize);
  const labels = getSingleElimLabels(bracketSize);

  // 각 라운드별 UUID 미리 생성
  const roundIds = [];
  for (let r = 0; r < numRounds; r++) {
    const cnt = bracketSize / Math.pow(2, r + 1);
    roundIds.push(Array.from({ length: cnt }, () => randomUUID()));
  }

  const slots = seededBracket(bracketSize).map((seed) => participants[seed - 1] ?? null);
  const matches = [];

  for (let r = 0; r < numRounds; r++) {
    const ids = roundIds[r];
    const nextIds = r + 1 < numRounds ? roundIds[r + 1] : null;

    for (let m = 0; m < ids.length; m++) {
      matches.push({
        id: ids[m],
        bracket: 'upper',
        round_number: r + 1,
        match_label: labels[r],
        match_order: matches.length + 1,
        participant_a_id: r === 0 ? (slots[m * 2]?.id ?? null) : null,
        participant_b_id: r === 0 ? (slots[m * 2 + 1]?.id ?? null) : null,
        next_match_id: nextIds ? nextIds[Math.floor(m / 2)] : null,
        next_slot: nextIds ? (m % 2 === 0 ? 'a' : 'b') : null,
        loser_next_match_id: null,
        loser_next_slot: null,
      });
    }
  }
  return matches;
}

/**
 * 조별 단일 토너먼트 매치 생성
 * - 같은 부수(조) 선수는 1라운드에서 만나지 않음
 * - 각 조 1위는 다음 조 2위와 대전 (ChatGPT createGroupBracket 참고)
 * @param {number} bracketSize
 * @param {Record<string, Array<{id:string}|null>>} groupedParticipants  division → [1위, 2위, ...]
 */
function buildGroupBracket(bracketSize, groupedParticipants) {
  const numRounds = Math.log2(bracketSize);
  const labels = getSingleElimLabels(bracketSize);

  const groupKeys = Object.keys(groupedParticipants).sort();
  const len = groupKeys.length;

  // R1 슬롯 구성: 조[i] 1위 vs 조[(i+1)%len] 2위
  const r1Slots = [];
  for (let i = 0; i < bracketSize / 2; i++) {
    const gIdx = i % len;
    const nextGIdx = (gIdx + 1) % len;
    r1Slots.push(
      groupedParticipants[groupKeys[gIdx]]?.[0]?.id ?? null,
      groupedParticipants[groupKeys[nextGIdx]]?.[1]?.id ?? null,
    );
  }
  while (r1Slots.length < bracketSize) r1Slots.push(null);

  const roundIds = [];
  for (let r = 0; r < numRounds; r++) {
    const cnt = bracketSize / Math.pow(2, r + 1);
    roundIds.push(Array.from({ length: cnt }, () => randomUUID()));
  }

  const matches = [];
  for (let r = 0; r < numRounds; r++) {
    const ids = roundIds[r];
    const nextIds = r + 1 < numRounds ? roundIds[r + 1] : null;
    for (let m = 0; m < ids.length; m++) {
      matches.push({
        id: ids[m],
        bracket: 'upper',
        round_number: r + 1,
        match_label: labels[r],
        match_order: matches.length + 1,
        participant_a_id: r === 0 ? r1Slots[m * 2] : null,
        participant_b_id: r === 0 ? r1Slots[m * 2 + 1] : null,
        next_match_id: nextIds ? nextIds[Math.floor(m / 2)] : null,
        next_slot: nextIds ? (m % 2 === 0 ? 'a' : 'b') : null,
        loser_next_match_id: null,
        loser_next_slot: null,
      });
    }
  }
  return matches;
}

/**
 * 상·하위 토너먼트 매치 생성
 */
function buildUpperLowerMatches(bracketSize, participants) {
  const r1Count = bracketSize / 2;
  const innerRounds = Math.log2(r1Count); // rounds in upper/lower bracket

  // IDs 미리 생성
  const r1Ids = Array.from({ length: r1Count }, () => randomUUID());
  const upperRoundIds = Array.from({ length: innerRounds }, (_, r) =>
    Array.from({ length: r1Count / Math.pow(2, r + 1) }, () => randomUUID())
  );
  const lowerRoundIds = Array.from({ length: innerRounds }, (_, r) =>
    Array.from({ length: r1Count / Math.pow(2, r + 1) }, () => randomUUID())
  );

  const slots = seededBracket(bracketSize).map((seed) => participants[seed - 1] ?? null);
  const upperLabels = getSingleElimLabels(r1Count).map((l, i, arr) =>
    i === arr.length - 1 ? '상위 결승' : `상위 ${l}`
  );
  const lowerLabels = getSingleElimLabels(r1Count).map((l, i, arr) =>
    i === arr.length - 1 ? '하위 결승' : `하위 ${l}`
  );

  const matches = [];

  // R1
  for (let m = 0; m < r1Count; m++) {
    matches.push({
      id: r1Ids[m],
      bracket: 'upper',
      round_number: 1,
      match_label: roundName(bracketSize),
      match_order: matches.length + 1,
      participant_a_id: slots[m * 2]?.id ?? null,
      participant_b_id: slots[m * 2 + 1]?.id ?? null,
      next_match_id: upperRoundIds[0][Math.floor(m / 2)],
      next_slot: m % 2 === 0 ? 'a' : 'b',
      loser_next_match_id: lowerRoundIds[0][Math.floor(m / 2)],
      loser_next_slot: m % 2 === 0 ? 'a' : 'b',
    });
  }

  // Upper bracket rounds
  for (let r = 0; r < innerRounds; r++) {
    const ids = upperRoundIds[r];
    const nextIds = r + 1 < innerRounds ? upperRoundIds[r + 1] : null;
    for (let m = 0; m < ids.length; m++) {
      matches.push({
        id: ids[m],
        bracket: 'upper',
        round_number: r + 2,
        match_label: upperLabels[r],
        match_order: matches.length + 1,
        participant_a_id: null,
        participant_b_id: null,
        next_match_id: nextIds ? nextIds[Math.floor(m / 2)] : null,
        next_slot: nextIds ? (m % 2 === 0 ? 'a' : 'b') : null,
        loser_next_match_id: null,
        loser_next_slot: null,
      });
    }
  }

  // Lower bracket rounds
  for (let r = 0; r < innerRounds; r++) {
    const ids = lowerRoundIds[r];
    const nextIds = r + 1 < innerRounds ? lowerRoundIds[r + 1] : null;
    for (let m = 0; m < ids.length; m++) {
      matches.push({
        id: ids[m],
        bracket: 'lower',
        round_number: r + 1,
        match_label: lowerLabels[r],
        match_order: matches.length + 1,
        participant_a_id: null,
        participant_b_id: null,
        next_match_id: nextIds ? nextIds[Math.floor(m / 2)] : null,
        next_slot: nextIds ? (m % 2 === 0 ? 'a' : 'b') : null,
        loser_next_match_id: null,
        loser_next_slot: null,
      });
    }
  }

  return matches;
}

// league_code(AAA260316 01 형식)로 요청 시 실제 UUID로 자동 변환
router.param('id', async (req, _res, next, id) => {
  if (/^[A-Z]{3}\d{6}\d{2}$/.test(id)) {
    try {
      const result = await pool.query('SELECT id FROM leagues WHERE league_code = $1', [id]);
      if (result.rows.length > 0) req.params.id = result.rows[0].id;
    } catch (e) { /* 변환 실패 시 원본 id 유지 */ }
  }
  next();
});

router.param('leagueId', async (req, _res, next, id) => {
  if (/^[A-Z]{3}\d{6}\d{2}$/.test(id)) {
    try {
      const result = await pool.query('SELECT id FROM leagues WHERE league_code = $1', [id]);
      if (result.rows.length > 0) req.params.leagueId = result.rows[0].id;
    } catch (e) { /* 변환 실패 시 원본 id 유지 */ }
  }
  next();
});

const participantSchema = z.object({
  division: z.string().default(''),
  name: z.string().min(1, '참가자 이름은 필수입니다.'),
  member_id: z.number().int().nullable().optional(),
  paid: z.boolean().default(false),
  arrived: z.boolean().default(false),
  after: z.boolean().default(false),
});

/**
 * @openapi
 * tags:
 *   name: 리그
 *   description: 리그 생성/조회/수정 및 참가자 관리 API
 */

/**
 * @openapi
 * components:
 *   schemas:
 *     League:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         description:
 *           type: string
 *           nullable: true
 *         type:
 *           type: string
 *         format:
 *           type: string
 *           nullable: true
 *         sport:
 *           type: string
 *         start_date:
 *           type: string
 *           format: date-time
 *         status:
 *           type: string
 *           enum: [draft, active, completed]
 *         rules:
 *           type: string
 *           nullable: true
 *         notice:
 *           type: string
 *           nullable: true
 *         recruit_count:
 *           type: integer
 *         participant_count:
 *           type: integer
 *         group_id:
 *           type: string
 *           format: uuid
 *         created_at:
 *           type: string
 *           format: date-time
 *     LeagueParticipant:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         division:
 *           type: string
 *         paid:
 *           type: boolean
 *         arrived:
 *           type: boolean
 *         after:
 *           type: boolean
 *         sort_order:
 *           type: integer
 *           nullable: true
 *     LeagueMatch:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         match_order:
 *           type: integer
 *         participant_a_id:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         participant_b_id:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         participant_a_name:
 *           type: string
 *           nullable: true
 *         participant_a_division:
 *           type: string
 *           nullable: true
 *         participant_b_name:
 *           type: string
 *           nullable: true
 *         participant_b_division:
 *           type: string
 *           nullable: true
 *         score_a:
 *           type: integer
 *           nullable: true
 *         score_b:
 *           type: integer
 *           nullable: true
 *         court:
 *           type: string
 *           nullable: true
 *         status:
 *           type: string
 *           enum: [pending, playing, done]
 */

const createLeagueSchema = z.object({
  name: z.string().min(1, '리그 이름은 필수입니다.'),
  description: z.string().optional(),
  title: z.string().optional(),
  type: z.string().min(1, '리그 유형은 필수입니다.'),
  format: z.string().optional(),
  sport: z.string().min(1, '스포츠 종목은 필수입니다.'),
  start_date: z.string().datetime('시작일은 올바른 ISO 8601 형식이어야 합니다.'),
  rules: z.string().optional(),
  sort_order: z.string().optional(),
  recruit_count: z.number().int().min(0).default(0),
  participant_count: z.number().int().min(0).default(0),
  group_id: z.string().uuid('클럽 ID 형식이 올바르지 않습니다.'),
  participants: z.array(participantSchema).default([]),
  tournament_seeding: z.string().optional(),      // 'manual' | 'seed' | 'random'
  tournament_advancement: z.string().optional(),  // 'upper-only' | 'upper-lower'
  tournament_rules: z.string().optional(),        // 본선 규칙
  advance_count: z.number().int().min(1).optional(), // 진출 수
  advance_method: z.string().optional(),          // 진출 방식
  finals_advance: z.number().int().min(2).optional(), // 결승 진출
});

const updateLeagueSchema = z.object({
  name: z.string().min(1, '리그 이름은 필수입니다.').optional(),
  description: z.string().optional(),
  title: z.string().optional(),
  type: z.string().min(1, '리그 유형은 필수입니다.').optional(),
  format: z.string().optional(),
  sport: z.string().min(1, '스포츠 종목은 필수입니다.').optional(),
  start_date: z.string().datetime('시작일은 올바른 ISO 8601 형식이어야 합니다.').optional(),
  rules: z.string().optional(),
  notice: z.string().optional(),
  sort_order: z.string().optional(),
  recruit_count: z.number().int().min(1).optional(),
  status: z.enum(['draft', 'active', 'completed']).optional(),
  join_permission: z.enum(['public', 'club_only']).optional(),
  tournament_seeding: z.string().optional(),
  tournament_advancement: z.string().optional(),
  tournament_rules: z.string().optional(),
  advance_count: z.number().int().min(1).optional(),
  advance_method: z.string().optional(),
  finals_advance: z.number().int().min(2).optional(),
});

/**
 * GET /league
 * 리그 목록 조회
 */
/**
 * @openapi
 * /league:
 *   get:
 *     summary: 리그 목록 조회
 *     tags: [리그]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 페이지 번호
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: 페이지당 항목 수 (최대 50)
 *       - in: query
 *         name: sport
 *         schema:
 *           type: string
 *         description: 종목 필터
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, active, completed]
 *         description: 상태 필터
 *       - in: query
 *         name: group_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 특정 클럽의 리그만 조회
 *       - in: query
 *         name: my_groups
 *         schema:
 *           type: boolean
 *         description: user_id 기준 내가 속한 클럽의 리그만 조회
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: integer
 *         description: my_groups=true일 때 필요한 사용자 ID
 *     responses:
 *       200:
 *         description: 리그 목록 조회 성공
 *       500:
 *         description: 서버 오류
 */
router.get('/league', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (req.query.sport) {
      conditions.push(`l.sport = $${paramIndex++}`);
      params.push(req.query.sport);
    }
    if (req.query.status) {
      conditions.push(`l.status = $${paramIndex++}`);
      params.push(req.query.status);
    }
    if (req.query.group_id) {
      conditions.push(`l.group_id = $${paramIndex++}`);
      params.push(req.query.group_id);
    }
    if (req.query.my_groups === 'true' && req.query.user_id) {
      conditions.push(`l.group_id IN (SELECT group_id FROM group_members WHERE user_id = $${paramIndex++})`);
      params.push(parseInt(req.query.user_id, 10));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM leagues l ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const listParams = [...params, limit, offset];
    const result = await pool.query(
      `SELECT l.id, l.name, l.description, l.title, l.type, l.sport, l.start_date, l.status,
              l.recruit_count, l.participant_count, l.group_id, l.created_at, l.league_code, l.title,
              u.name AS creator_name,
              g.name AS group_name
       FROM leagues l
       LEFT JOIN users u ON l.created_by_id = u.id
       LEFT JOIN groups g ON l.group_id = g.id
       ${whereClause}
       ORDER BY l.start_date DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      listParams,
    );

    return res.status(200).json({
      leagues: result.rows,
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error('Error fetching leagues:', error);
    return res.status(500).json({ message: '리그 목록 조회 중 서버 오류' });
  }
});

/**
 * POST /league
 * 리그 생성
 * 인증 필요. 리그와 참가자 정보를 한 트랜잭션으로 저장합니다.
 */
/**
 * @openapi
 * /league:
 *   post:
 *     summary: 리그 생성
 *     tags: [리그]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, type, sport, start_date, group_id]
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               type:
 *                 type: string
 *               sport:
 *                 type: string
 *               start_date:
 *                 type: string
 *                 format: date-time
 *               rules:
 *                 type: string
 *               recruit_count:
 *                 type: integer
 *               participant_count:
 *                 type: integer
 *               group_id:
 *                 type: string
 *                 format: uuid
 *               participants:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     division:
 *                       type: string
 *                     name:
 *                       type: string
 *                     paid:
 *                       type: boolean
 *                     arrived:
 *                       type: boolean
 *                     after:
 *                       type: boolean
 *     responses:
 *       201:
 *         description: 리그 생성 성공
 *       400:
 *         description: 검증 오류
 *       403:
 *         description: 권한 없음
 *       500:
 *         description: 서버 오류
 */
router.post('/league', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      name,
      description,
      title,
      type,
      format,
      sport,
      start_date,
      rules,
      sort_order,
      recruit_count,
      participant_count,
      group_id,
      participants,
      tournament_seeding,
      tournament_advancement,
      tournament_rules,
      advance_count,
      advance_method,
      finals_advance,
    } = createLeagueSchema.parse(req.body);

    const userId = req.user.sub;

    const roleCheck = await client.query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [group_id, userId],
    );

    if (roleCheck.rows.length === 0 || !['owner', 'admin'].includes(roleCheck.rows[0].role)) {
      return res.status(403).json({ message: '리그 생성 권한이 없습니다. 리더 또는 운영진만 가능합니다.' });
    }

    const leagueId = randomUUID();

    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO leagues (id, name, description, title, type, format, sport, start_date, rules, sort_order, recruit_count, participant_count, group_id, created_by_id, tournament_seeding, tournament_advancement, tournament_rules, advance_count, advance_method, finals_advance)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
       RETURNING id, name, description, title, type, format, sport, start_date, status, rules, notice, sort_order, recruit_count, participant_count, group_id, tournament_seeding, tournament_advancement, tournament_rules, advance_count, advance_method, finals_advance, created_at, updated_at;`,
      [leagueId, name, description, title, type, format, sport, start_date, rules, sort_order ?? null, recruit_count, participant_count, group_id, userId, tournament_seeding ?? null, tournament_advancement ?? null, tournament_rules ?? null, advance_count ?? null, advance_method ?? null, finals_advance ?? null],
    );

    // 리그 코드 생성: {클럽코드}{YYMMDD}{순번2자리}
    if (group_id) {
      const groupRow = await client.query(`SELECT club_code FROM groups WHERE id = $1`, [group_id]);
      const clubCode = groupRow.rows[0]?.club_code;
      if (clubCode) {
        const seqRow = await client.query(
          `SELECT COUNT(*) AS cnt FROM leagues WHERE group_id = $1 AND DATE(start_date) = DATE($2::timestamptz)`,
          [group_id, start_date],
        );
        const seq = parseInt(seqRow.rows[0].cnt, 10); // INSERT 후라서 현재 리그 포함
        const leagueCode = buildLeagueCode(clubCode, start_date, seq);
        await client.query(`UPDATE leagues SET league_code = $1 WHERE id = $2`, [leagueCode, leagueId]);
      }
    }

    for (const p of participants) {
      await client.query(
        `INSERT INTO league_participants (id, league_id, division, name, member_id, paid, arrived, "after")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [randomUUID(), leagueId, p.division ?? '', p.name, p.member_id ?? null, p.paid ?? false, p.arrived ?? false, p.after ?? false],
      );
    }

    await client.query('COMMIT');

    return res.status(201).json({
      message: '리그가 성공적으로 생성되었습니다.',
      league: result.rows[0],
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback failure
    }

    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }

    console.error('Error creating league:', error);
    return res.status(500).json({ message: '리그 생성 중 서버 오류' });
  } finally {
    client.release();
  }
});

/**
 * GET /league/:id/participants
 * 리그 참가자 목록 조회
 * 인증 필요. 해당 리그가 속한 클럽의 멤버만 조회 가능합니다.
 */
/**
 * @openapi
 * /league/{id}/participants:
 *   get:
 *     summary: 리그 참가자 목록 조회
 *     tags: [리그]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 리그 ID
 *     responses:
 *       200:
 *         description: 참가자 목록 조회 성공
 *       403:
 *         description: 권한 없음
 *       500:
 *         description: 서버 오류
 */
router.get('/league/:id/participants', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // join_permission이 club_only이면 클럽 회원만 참가자 목록 조회 가능
    const leagueRow = await pool.query(
      `SELECT join_permission FROM leagues WHERE id = $1`,
      [id],
    );
    if (leagueRow.rowCount === 0) {
      return res.status(404).json({ message: '리그를 찾을 수 없습니다.' });
    }
    const joinPermission = leagueRow.rows[0].join_permission;

    if (joinPermission === 'club_only') {
      const userId = req.user ? Number(req.user.sub) : null;
      if (!userId) return res.status(403).json({ message: '클럽 회원만 조회할 수 있습니다.' });
      const accessCheck = await pool.query(
        `SELECT 1 FROM leagues l
         INNER JOIN group_members gm ON gm.group_id = l.group_id
         WHERE l.id = $1 AND gm.user_id = $2`,
        [id, userId],
      );
      if (accessCheck.rowCount === 0) {
        return res.status(403).json({ message: '클럽 회원만 조회할 수 있습니다.' });
      }
    }

    const result = await pool.query(
      `SELECT id, league_id, division, name, member_id, paid, arrived, "after", sort_order, created_at
       FROM league_participants
       WHERE league_id = $1
       ORDER BY sort_order ASC NULLS LAST, division ASC, created_at ASC`,
      [id],
    );

    return res.status(200).json({ participants: result.rows });
  } catch (error) {
    console.error('Error fetching league participants:', error);
    return res.status(500).json({ message: '리그 참가자 조회 중 서버 오류' });
  }
});

/**
 * POST /league/:leagueId/participants
 * 참가자 추가 (관리자용 수기입력 / 클럽 회원 불러오기)
 */
/**
 * @openapi
 * /league/{leagueId}/participants:
 *   post:
 *     summary: 참가자 추가
 *     tags: [리그]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: leagueId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 리그 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [participants]
 *             properties:
 *               participants:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [name]
 *                   properties:
 *                     division:
 *                       type: string
 *                     name:
 *                       type: string
 *     responses:
 *       201:
 *         description: 참가자 추가 성공
 *       403:
 *         description: 권한 없음
 *       500:
 *         description: 서버 오류
 */
router.post('/league/:leagueId/participants', optionalAuth, async (req, res) => {
  try {
    const { leagueId } = req.params;
    const userId = req.user ? Number(req.user.sub) : null;

    // 리그의 join_permission 확인
    const leaguePermRow = await pool.query(
      `SELECT join_permission FROM leagues WHERE id = $1`,
      [leagueId],
    );
    if (leaguePermRow.rowCount === 0) {
      return res.status(404).json({ message: '리그를 찾을 수 없습니다.' });
    }
    const joinPermission = leaguePermRow.rows[0].join_permission;

    // 클럽 회원 여부 확인 (로그인한 경우에만)
    let isAdmin = false;
    let isClubMember = false;
    if (userId) {
      const authCheck = await pool.query(
        `SELECT gm.role
         FROM leagues l
         INNER JOIN group_members gm ON gm.group_id = l.group_id
         WHERE l.id = $1 AND gm.user_id = $2`,
        [leagueId, userId],
      );
      const userRole = authCheck.rows[0]?.role ?? null;
      isAdmin = userRole === 'owner' || userRole === 'admin';
      isClubMember = authCheck.rowCount > 0;
    }

    // club_only: 로그인 + 클럽 회원만 허용
    if (joinPermission === 'club_only') {
      if (!userId) return res.status(401).json({ message: '로그인이 필요합니다.' });
      if (!isClubMember) return res.status(403).json({ message: '클럽 회원만 참가할 수 있습니다.' });
    }

    const rawParticipants = req.body.participants;
    if (!Array.isArray(rawParticipants) || rawParticipants.length === 0) {
      return res.status(400).json({ message: '참가자 목록이 비어있습니다.' });
    }
    // 관리자가 아니면 1명만 신청 가능
    if (!isAdmin && rawParticipants.length > 1) {
      return res.status(403).json({ message: '본인만 참가 신청할 수 있습니다.' });
    }

    const addSchema = z.array(z.object({
      division: z.string().default(''),
      name: z.string().min(1, '이름은 필수입니다.'),
      member_id: z.number().int().nullable().optional(),
    }));
    const participants = addSchema.parse(rawParticipants);

    // 정원 초과 체크
    const leagueInfo = await pool.query(
      `SELECT recruit_count, (SELECT COUNT(*) FROM league_participants WHERE league_id = $1) AS current_count
       FROM leagues WHERE id = $1`,
      [leagueId],
    );
    if (leagueInfo.rowCount === 0) {
      return res.status(404).json({ message: '리그를 찾을 수 없습니다.' });
    }
    const { recruit_count, current_count } = leagueInfo.rows[0];
    if (recruit_count && Number(current_count) + participants.length > recruit_count) {
      return res.status(400).json({ message: `모집 인원(${recruit_count}명)을 초과할 수 없습니다.` });
    }

    const inserted = [];
    for (const p of participants) {
      const result = await pool.query(
        `INSERT INTO league_participants (id, league_id, division, name, member_id, paid, arrived, "after")
         VALUES ($1, $2, $3, $4, $5, false, false, false)
         RETURNING id, league_id, division, name, member_id, paid, arrived, "after", created_at`,
        [randomUUID(), leagueId, p.division, p.name, p.member_id ?? null],
      );
      inserted.push(result.rows[0]);
    }

    // participant_count 실수 기반으로 갱신
    await pool.query(
      `UPDATE leagues SET participant_count = (
         SELECT COUNT(*) FROM league_participants WHERE league_id = $1
       ), updated_at = NOW() WHERE id = $1`,
      [leagueId],
    );

    return res.status(201).json({ message: '참가자가 추가되었습니다.', participants: inserted });
  } catch (error) {
    console.error('Add participants error:', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

/**
 * GET /league/:id
 * 리그 상세 조회 (참가자 목록 포함)
 */
/**
 * @openapi
 * /league/{id}:
 *   get:
 *     summary: 리그 상세 조회 (참가자 목록 포함)
 *     description: 리그의 기본 정보와 참가자 목록을 함께 조회합니다. 추첨 등에 활용할 수 있습니다.
 *     tags: [리그]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 리그 ID
 *     responses:
 *       200:
 *         description: 리그 상세 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 league:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     description:
 *                       type: string
 *                     type:
 *                       type: string
 *                     sport:
 *                       type: string
 *                     start_date:
 *                       type: string
 *                       format: date-time
 *                     rules:
 *                       type: string
 *                     status:
 *                       type: string
 *                     recruit_count:
 *                       type: integer
 *                     participant_count:
 *                       type: integer
 *                     group_id:
 *                       type: string
 *                     created_by_id:
 *                       type: integer
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *                 participants:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       league_id:
 *                         type: string
 *                       division:
 *                         type: string
 *                       name:
 *                         type: string
 *                       paid:
 *                         type: boolean
 *                       arrived:
 *                         type: boolean
 *                       after:
 *                         type: boolean
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *       404:
 *         description: 리그 없음
 *       500:
 *         description: 서버 오류
 */
router.get('/league/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // 리그 정보 조회
    const leagueResult = await pool.query(
      `SELECT id, name, description, title, type, format, sport, start_date, rules, status,
              sort_order, notice, league_code, recruit_count, participant_count, join_permission,
              group_id, created_by_id, tournament_seeding, tournament_advancement,
              tournament_rules, advance_count, advance_method, finals_advance,
              created_at, updated_at
       FROM leagues
       WHERE id = $1`,
      [id],
    );

    if (leagueResult.rows.length === 0) {
      return res.status(404).json({ message: '리그를 찾을 수 없습니다.' });
    }

    // 참가자 목록 조회
    const participantsResult = await pool.query(
      `SELECT id, league_id, division, name, paid, arrived, "after", created_at
       FROM league_participants
       WHERE league_id = $1
       ORDER BY division ASC, created_at ASC`,
      [id],
    );

    return res.status(200).json({
      league: leagueResult.rows[0],
      participants: participantsResult.rows
    });
  } catch (error) {
    console.error('Error fetching league:', error);
    return res.status(500).json({ message: '리그 조회 중 서버 오류' });
  }
});

/**
 * PUT /league/:id
 * 리그 수정
 */
/**
 * @openapi
 * /league/{id}:
 *   put:
 *     summary: 리그 수정
 *     tags: [리그]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 리그 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               type:
 *                 type: string
 *               sport:
 *                 type: string
 *               start_date:
 *                 type: string
 *                 format: date-time
 *               rules:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [draft, active, completed]
 *     responses:
 *       200:
 *         description: 리그 수정 성공
 *       400:
 *         description: 검증 오류/수정 항목 없음
 *       404:
 *         description: 리그 없음
 *       500:
 *         description: 서버 오류
 */
router.put('/league/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = updateLeagueSchema.parse(req.body);

    const fields = [];
    const values = [];
    let queryIndex = 1;

    for (const key in updates) {
      if (updates[key] !== undefined) {
        fields.push(`${key} = $${queryIndex}`);
        values.push(updates[key]);
        queryIndex++;
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: '수정할 항목이 없습니다.' });
    }

    values.push(id);
    const updateQuery = `
      UPDATE leagues
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${queryIndex}
      RETURNING id, name, description, title, type, format, sport, start_date, rules, notice, sort_order, status, recruit_count, participant_count, join_permission, created_by_id, tournament_seeding, tournament_advancement, tournament_rules, advance_count, advance_method, finals_advance, created_at, updated_at;
    `;

    const result = await pool.query(updateQuery, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: '리그를 찾을 수 없습니다.' });
    }

    return res.status(200).json({
      message: '리그가 성공적으로 수정되었습니다.',
      league: result.rows[0],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }

    console.error('Error updating league:', error);
    return res.status(500).json({ message: '리그 수정 중 서버 오류' });
  }
});

/**
 * PUT /league/:leagueId/participants/:participantId
 * 리그 참가자 정보 수정
 * 인증 필요. 해당 리그가 속한 클럽의 owner 또는 admin만 수정 가능합니다.
 */
/**
 * @openapi
 * /league/{leagueId}/participants/{participantId}:
 *   put:
 *     summary: 리그 참가자 정보 수정
 *     description: 참가자의 부수, 이름, 입금/도착/뒷풀이 상태를 수정합니다. 클럽의 owner 또는 admin만 가능합니다.
 *     tags: [리그]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: leagueId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 리그 ID
 *       - in: path
 *         name: participantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 참가자 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               division:
 *                 type: string
 *                 description: 부수
 *               name:
 *                 type: string
 *                 description: 참가자 이름
 *               paid:
 *                 type: boolean
 *                 description: 입금 완료 여부
 *               arrived:
 *                 type: boolean
 *                 description: 도착 완료 여부
 *               footPool:
 *                 type: boolean
 *                 description: 뒷풀이 참여 여부
 *     responses:
 *       200:
 *         description: 참가자 정보 수정 성공
 *       403:
 *         description: 권한 없음
 *       404:
 *         description: 참가자를 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.put('/league/:leagueId/participants/:participantId', optionalAuth, async (req, res) => {
  try {
    const { leagueId, participantId } = req.params;
    const userId = req.user ? Number(req.user.sub) : null;

    // join_permission 확인
    const leagueRow = await pool.query(`SELECT join_permission FROM leagues WHERE id = $1`, [leagueId]);
    if (leagueRow.rowCount === 0) return res.status(404).json({ message: '리그를 찾을 수 없습니다.' });
    const joinPermission = leagueRow.rows[0].join_permission;

    if (userId) {
      if (joinPermission === 'club_only') {
        const accessCheck = await pool.query(
          `SELECT 1 FROM leagues l INNER JOIN group_members gm ON gm.group_id = l.group_id WHERE l.id = $1 AND gm.user_id = $2`,
          [leagueId, userId],
        );
        if (accessCheck.rowCount === 0) {
          return res.status(403).json({ message: '클럽 회원만 수정할 수 있습니다.' });
        }
      }
    } else if (joinPermission === 'club_only') {
      return res.status(401).json({ message: '로그인이 필요합니다.' });
    }

    // 업데이트할 필드 검증
    const updateSchema = z.object({
      division: z.string().optional(),
      name: z.string().min(1, '이름은 필수입니다.').optional(),
      paid: z.boolean().optional(),
      arrived: z.boolean().optional(),
      after: z.boolean().optional(),
    });

    const updates = updateSchema.parse(req.body);

    // 클럽 불러오기 참가자(member_id 존재)는 division/name 수정 불가
    if (updates.division !== undefined || updates.name !== undefined) {
      const memberCheck = await pool.query(
        `SELECT member_id FROM league_participants WHERE id = $1 AND league_id = $2`,
        [participantId, leagueId],
      );
      if (memberCheck.rows[0]?.member_id != null) {
        return res.status(403).json({ message: '클럽에서 불러온 참가자는 부수·이름을 수정할 수 없습니다.' });
      }
    }

    const fields = [];
    const values = [];
    let queryIndex = 1;

    for (const key in updates) {
      if (updates[key] !== undefined) {
        const dbKey = key;
        fields.push(`${dbKey} = $${queryIndex}`);
        values.push(updates[key]);
        queryIndex++;
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: '수정할 항목이 없습니다.' });
    }

    values.push(participantId);
    values.push(leagueId);

    const updateQuery = `
      UPDATE league_participants
      SET ${fields.join(', ')}
      WHERE id = $${queryIndex} AND league_id = $${queryIndex + 1}
      RETURNING id, league_id, division, name, member_id, paid, arrived, "after", created_at;
    `;

    const result = await pool.query(updateQuery, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: '참가자를 찾을 수 없습니다.' });
    }

    return res.status(200).json({
      message: '참가자 정보가 수정되었습니다.',
      participant: result.rows[0],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }

    console.error('Error updating participant:', error);
    return res.status(500).json({ message: '참가자 수정 중 서버 오류' });
  }
});

/**
 * DELETE /league/:leagueId/participants/:participantId
 * 리그 참가자 삭제
 * 인증 필요. 해당 리그가 속한 클럽의 owner 또는 admin만 삭제 가능합니다.
 */
/**
 * @openapi
 * /league/{leagueId}/participants/{participantId}:
 *   delete:
 *     summary: 리그 참가자 삭제
 *     description: 리그 참가자 1명을 삭제합니다. 클럽의 owner 또는 admin만 가능합니다.
 *     tags: [리그]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: leagueId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 리그 ID
 *       - in: path
 *         name: participantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 참가자 ID
 *     responses:
 *       200:
 *         description: 참가자 삭제 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       403:
 *         description: 권한 없음
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       404:
 *         description: 참가자를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */
router.delete('/league/:leagueId/participants/:participantId', requireAuth, async (req, res) => {
  try {
    const { leagueId, participantId } = req.params;
    const userId = Number(req.user.sub);

    // 권한 확인: owner/admin은 누구든 삭제 가능, member는 본인 항목만 삭제 가능
    const accessCheck = await pool.query(
      `SELECT gm.role
      FROM leagues l
      INNER JOIN group_members gm ON gm.group_id = l.group_id
      WHERE l.id = $1 AND gm.user_id = $2`,
      [leagueId, userId],
    );

    if (accessCheck.rowCount === 0) {
      return res.status(403).json({ message: '참가자를 삭제할 권한이 없습니다.' });
    }

    const userRole = accessCheck.rows[0].role;
    const isAdmin = userRole === 'owner' || userRole === 'admin';

    if (!isAdmin) {
      // 멤버는 본인 이름과 일치하는 참가자 항목만 삭제 가능
      const memberCheck = await pool.query(
        `SELECT u.name
        FROM group_members gm
        INNER JOIN leagues l ON l.group_id = gm.group_id
        INNER JOIN users u ON u.id = gm.user_id
        WHERE l.id = $1 AND gm.user_id = $2`,
        [leagueId, userId],
      );
      const memberName = memberCheck.rows[0]?.name;
      const participantCheck = await pool.query(
        `SELECT name FROM league_participants WHERE id = $1 AND league_id = $2`,
        [participantId, leagueId],
      );
      if (participantCheck.rowCount === 0 || participantCheck.rows[0].name !== memberName) {
        return res.status(403).json({ message: '본인의 참가 신청만 취소할 수 있습니다.' });
      }
    }

    // 참가자 삭제 (리그 아이디도 추가 체크)
    const delResult = await pool.query(
      `DELETE FROM league_participants
      WHERE id = $1 AND league_id = $2
      RETURNING id, league_id, division, name, paid, arrived, "after", created_at;`,
      [participantId, leagueId],
    );

    if (delResult.rows.length === 0) {
      return res.status(404).json({ message: '참가자를 찾을 수 없습니다.' });
    }

    // participant_count 실수 기반으로 갱신
    await pool.query(
      `UPDATE leagues SET participant_count = (
         SELECT COUNT(*) FROM league_participants WHERE league_id = $1
       ), updated_at = NOW() WHERE id = $1`,
      [leagueId],
    );

    return res.status(200).json({
      message: '참가자가 삭제되었습니다.',
    });
  } catch (error) {
    console.error('Error deleting participant:', error);
    return res.status(500).json({ message: '참가자 삭제 중 서버 오류' });
  }
});

/**
 * @openapi
 * /league/{leagueId}:
 *   delete:
 *     summary: 리그 삭제
 *     tags: [리그]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: leagueId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 리그 ID
 *     responses:
 *       200:
 *         description: 리그 삭제 성공
 *       403:
 *         description: 권한 없음
 *       404:
 *         description: 리그 없음
 *       500:
 *         description: 서버 오류
 */
router.delete('/league/:leagueId', requireAuth, async (req, res) => {
  try {
    const { leagueId } = req.params;
    const userId = Number(req.user.sub);

    const accessCheck = await pool.query(
      `SELECT 1
       FROM leagues l
       INNER JOIN group_members gm ON gm.group_id = l.group_id
       WHERE l.id = $1 AND gm.user_id = $2 AND gm.role IN ('owner', 'admin')`,
      [leagueId, userId],
    );

    if (accessCheck.rowCount === 0) {
      return res.status(403).json({ message: '리그를 삭제할 권한이 없습니다.' });
    }

    const result = await pool.query(
      `DELETE FROM leagues WHERE id = $1 RETURNING id`,
      [leagueId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: '리그를 찾을 수 없습니다.' });
    }

    return res.status(200).json({ message: '리그가 삭제되었습니다.' });
  } catch (error) {
    console.error('Error deleting league:', error);
    return res.status(500).json({ message: '리그 삭제 중 서버 오류' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 경기 순서 (league_matches)
// ─────────────────────────────────────────────────────────────────────────────

function generateRoundRobin(n) {
  const games = [];
  const size = n % 2 === 0 ? n : n + 1;
  const pos = Array.from({ length: size }, (_, i) => i);
  for (let round = 0; round < size - 1; round++) {
    for (let i = 0; i < size / 2; i++) {
      const p1 = pos[i];
      const p2 = pos[size - 1 - i];
      if (p1 < n && p2 < n) games.push([p1, p2]);
    }
    const last = pos.splice(size - 1, 1)[0];
    pos.splice(1, 0, last);
  }
  return games;
}

/**
 * @openapi
 * /league/{id}/matches:
 *   get:
 *     summary: 경기 목록 조회
 *     description: 리그의 경기 순서 목록을 조회합니다. 클럽 멤버만 접근 가능합니다.
 *     tags: [리그]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 리그 ID
 *     responses:
 *       200:
 *         description: 경기 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 matches:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/LeagueMatch'
 *       403:
 *         description: 권한 없음
 *       500:
 *         description: 서버 오류
 */
// GET /league/:id/matches - 경기 목록 조회 (public 리그는 누구나, club_only는 클럽 멤버)
router.get('/league/:id/matches', optionalAuth, async (req, res) => {
  const leagueId = req.params.id;
  try {
    // join_permission 확인
    const leagueRow = await pool.query(`SELECT join_permission FROM leagues WHERE id = $1`, [leagueId]);
    if (leagueRow.rowCount === 0) return res.status(404).json({ message: '리그를 찾을 수 없습니다.' });
    const joinPermission = leagueRow.rows[0].join_permission;

    if (joinPermission === 'club_only') {
      const userId = req.user ? Number(req.user.sub) : null;
      if (!userId) return res.status(401).json({ message: '로그인이 필요합니다.' });
      const accessCheck = await pool.query(
        `SELECT 1 FROM leagues l INNER JOIN group_members gm ON gm.group_id = l.group_id WHERE l.id = $1 AND gm.user_id = $2`,
        [leagueId, userId],
      );
      if (accessCheck.rowCount === 0) return res.status(403).json({ message: '클럽 회원만 조회할 수 있습니다.' });
    }
    // public이면 누구나 통과

    const result = await pool.query(
      `SELECT
         m.id, m.match_order, m.score_a, m.score_b, m.court, m.status,
         m.participant_a_id, m.participant_b_id,
         m.bracket, m.round_number, m.match_label,
         m.next_match_id, m.next_slot, m.loser_next_match_id, m.loser_next_slot,
         pa.name AS participant_a_name, pa.division AS participant_a_division,
         pb.name AS participant_b_name, pb.division AS participant_b_division
       FROM league_matches m
       LEFT JOIN league_participants pa ON pa.id = m.participant_a_id
       LEFT JOIN league_participants pb ON pb.id = m.participant_b_id
       WHERE m.league_id = $1
       ORDER BY m.match_order ASC`,
      [leagueId],
    );
    return res.json({ matches: result.rows });
  } catch (err) {
    console.error('Error fetching matches:', err);
    return res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * @openapi
 * /league/{id}/matches:
 *   delete:
 *     summary: 전체 경기 삭제
 *     description: 해당 리그의 모든 경기를 삭제하고 리그 상태를 draft로 초기화합니다. owner/admin만 가능합니다.
 *     tags: [리그]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 리그 ID
 *     responses:
 *       200:
 *         description: 삭제 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *       401:
 *         description: 인증 필요
 *       403:
 *         description: 권한 없음 (owner/admin 아님)
 *       500:
 *         description: 서버 오류
 */
// DELETE /league/:id/matches - 전체 경기 삭제 및 리그 상태 draft로 초기화 (owner/admin)
router.delete('/league/:id/matches', requireAuth, async (req, res) => {
  const userId = Number(req.user.sub);
  const leagueId = req.params.id;
  try {
    const access = await pool.query(
      `SELECT l.id FROM leagues l
       INNER JOIN group_members gm ON gm.group_id = l.group_id
       WHERE l.id = $1 AND gm.user_id = $2 AND gm.role IN ('owner', 'admin')`,
      [leagueId, userId],
    );
    if (access.rowCount === 0) return res.status(403).json({ message: '권한이 없습니다.' });

    await pool.query(`DELETE FROM league_matches WHERE league_id = $1`, [leagueId]);
    await pool.query(`UPDATE leagues SET status = 'draft', updated_at = NOW() WHERE id = $1`, [leagueId]);
    return res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting all matches:', err);
    return res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * @openapi
 * /league/{id}/matches/init:
 *   post:
 *     summary: 라운드로빈 경기 자동 생성
 *     description: 참가자 목록을 기반으로 라운드로빈 경기를 자동 생성합니다. force=true 시 기존 경기 삭제 후 재생성합니다. owner/admin만 가능합니다.
 *     tags: [리그]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 리그 ID
 *       - in: query
 *         name: force
 *         schema:
 *           type: boolean
 *         description: true이면 기존 경기를 삭제하고 재생성
 *     responses:
 *       200:
 *         description: 경기 생성 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 matches:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/LeagueMatch'
 *       400:
 *         description: 이미 경기 존재 또는 참가자 부족
 *       403:
 *         description: 권한 없음
 *       500:
 *         description: 서버 오류
 */
// POST /league/:id/matches/init - 라운드로빈 경기 생성 (owner/admin)
router.post('/league/:id/matches/init', requireAuth, async (req, res) => {
  const userId = Number(req.user.sub);
  const leagueId = req.params.id;
  try {
    const access = await pool.query(
      `SELECT l.id FROM leagues l
       INNER JOIN group_members gm ON gm.group_id = l.group_id
       WHERE l.id = $1 AND gm.user_id = $2 AND gm.role IN ('owner', 'admin')`,
      [leagueId, userId],
    );
    if (access.rowCount === 0) return res.status(403).json({ message: '권한이 없습니다.' });

    const force = req.query.force === 'true';
    const existing = await pool.query(
      `SELECT id FROM league_matches WHERE league_id = $1 LIMIT 1`,
      [leagueId],
    );
    if (existing.rowCount > 0) {
      if (!force) return res.status(400).json({ message: '이미 경기가 생성되어 있습니다.' });
      await pool.query(`DELETE FROM league_matches WHERE league_id = $1`, [leagueId]);
    }

    const participants = await pool.query(
      `SELECT id FROM league_participants WHERE league_id = $1 ORDER BY sort_order ASC NULLS LAST, division ASC, created_at ASC`,
      [leagueId],
    );
    const ids = participants.rows.map((r) => r.id);
    if (ids.length < 2) return res.status(400).json({ message: '참가자가 2명 이상이어야 합니다.' });

    const pairs = generateRoundRobin(ids.length);
    const values = pairs.map((pair, i) => `('${randomUUID()}', '${leagueId}', ${i + 1}, '${ids[pair[0]]}', '${ids[pair[1]]}')`).join(', ');
    await pool.query(
      `INSERT INTO league_matches (id, league_id, match_order, participant_a_id, participant_b_id) VALUES ${values}`,
    );

    const result = await pool.query(
      `SELECT
         m.id, m.match_order, m.score_a, m.score_b, m.court, m.status,
         m.participant_a_id, m.participant_b_id,
         pa.name AS participant_a_name, pa.division AS participant_a_division,
         pb.name AS participant_b_name, pb.division AS participant_b_division
       FROM league_matches m
       LEFT JOIN league_participants pa ON pa.id = m.participant_a_id
       LEFT JOIN league_participants pb ON pb.id = m.participant_b_id
       WHERE m.league_id = $1
       ORDER BY m.match_order ASC`,
      [leagueId],
    );
    return res.json({ matches: result.rows });
  } catch (err) {
    console.error('Error initializing matches:', err);
    return res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * @openapi
 * /league/{id}/participants/reorder:
 *   patch:
 *     summary: 참가자 순서 변경
 *     description: 참가자 ID 배열을 새 순서로 전달하면 sort_order를 일괄 업데이트합니다. owner/admin만 가능합니다.
 *     tags: [리그]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 리그 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [order]
 *             properties:
 *               order:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: 새 순서로 정렬된 참가자 ID 배열
 *     responses:
 *       200:
 *         description: 순서 저장 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *       400:
 *         description: order 배열 누락
 *       403:
 *         description: 권한 없음 (owner/admin 아님)
 *       500:
 *         description: 서버 오류
 */
// PATCH /league/:id/participants/reorder - 씨드 순서 저장 (owner/admin)
router.patch('/league/:id/participants/reorder', requireAuth, async (req, res) => {
  const userId = Number(req.user.sub);
  const leagueId = req.params.id;
  const { order } = req.body; // string[] - participant IDs in new order
  if (!Array.isArray(order)) return res.status(400).json({ message: 'order 배열이 필요합니다.' });
  try {
    const access = await pool.query(
      `SELECT l.id FROM leagues l
       INNER JOIN group_members gm ON gm.group_id = l.group_id
       WHERE l.id = $1 AND gm.user_id = $2 AND gm.role IN ('owner', 'admin')`,
      [leagueId, userId],
    );
    if (access.rowCount === 0) return res.status(403).json({ message: '권한이 없습니다.' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (let i = 0; i < order.length; i++) {
        await client.query(
          `UPDATE league_participants SET sort_order = $1 WHERE id = $2 AND league_id = $3`,
          [i + 1, order[i], leagueId],
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('Error reordering participants:', err);
    return res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * @openapi
 * /league/{id}/matches/reorder:
 *   patch:
 *     summary: 경기 순서 변경
 *     description: 경기 ID 배열을 새 순서로 전달하면 match_order를 일괄 업데이트합니다. owner/admin만 가능합니다.
 *     tags: [리그]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 리그 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [order]
 *             properties:
 *               order:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: 새 순서로 정렬된 경기 ID 배열
 *     responses:
 *       200:
 *         description: 순서 변경 성공
 *       400:
 *         description: order 배열 누락
 *       403:
 *         description: 권한 없음
 *       500:
 *         description: 서버 오류
 */
// PATCH /league/:id/matches/reorder - 순서 변경 (owner/admin)
router.patch('/league/:id/matches/reorder', requireAuth, async (req, res) => {
  const userId = Number(req.user.sub);
  const leagueId = req.params.id;
  const { order } = req.body; // string[]
  if (!Array.isArray(order)) return res.status(400).json({ message: 'order 배열이 필요합니다.' });
  try {
    const access = await pool.query(
      `SELECT l.id FROM leagues l
       INNER JOIN group_members gm ON gm.group_id = l.group_id
       WHERE l.id = $1 AND gm.user_id = $2 AND gm.role IN ('owner', 'admin')`,
      [leagueId, userId],
    );
    if (access.rowCount === 0) return res.status(403).json({ message: '권한이 없습니다.' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (let i = 0; i < order.length; i++) {
        await client.query(
          `UPDATE league_matches SET match_order = $1 WHERE id = $2 AND league_id = $3`,
          [i + 1, order[i], leagueId],
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('Error reordering matches:', err);
    return res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * @openapi
 * /league/{id}/matches/{matchId}:
 *   patch:
 *     summary: 경기 점수/코트/상태 수정
 *     description: 경기의 점수, 코트, 상태를 부분 업데이트합니다. 클럽 멤버 전체 가능합니다.
 *     tags: [리그]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 리그 ID
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 경기 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               score_a:
 *                 type: integer
 *               score_b:
 *                 type: integer
 *               court:
 *                 type: string
 *                 nullable: true
 *               status:
 *                 type: string
 *                 enum: [pending, playing, done]
 *     responses:
 *       200:
 *         description: 수정 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 match:
 *                   $ref: '#/components/schemas/LeagueMatch'
 *       400:
 *         description: 변경 필드 없음
 *       403:
 *         description: 권한 없음
 *       404:
 *         description: 경기 없음
 *       500:
 *         description: 서버 오류
 */
// PATCH /league/:id/matches/:matchId - 점수/코트/상태/참가자 업데이트 (public 리그는 누구나, club_only는 클럽 멤버; 참가자 변경은 owner/admin만)
router.patch('/league/:id/matches/:matchId', optionalAuth, async (req, res) => {
  const { id, matchId } = req.params;
  const leagueId = id;
  const { score_a, score_b, court, status, participant_a_id, participant_b_id } = req.body;
  try {
    // join_permission 확인
    const leagueRow = await pool.query(`SELECT join_permission FROM leagues WHERE id = $1`, [leagueId]);
    if (leagueRow.rowCount === 0) return res.status(404).json({ message: '리그를 찾을 수 없습니다.' });
    const joinPermission = leagueRow.rows[0].join_permission;

    if (joinPermission === 'club_only') {
      const userId = req.user ? Number(req.user.sub) : null;
      if (!userId) return res.status(401).json({ message: '로그인이 필요합니다.' });
      const accessCheck = await pool.query(
        `SELECT 1 FROM leagues l INNER JOIN group_members gm ON gm.group_id = l.group_id WHERE l.id = $1 AND gm.user_id = $2`,
        [leagueId, userId],
      );
      if (accessCheck.rowCount === 0) return res.status(403).json({ message: '클럽 회원만 수정할 수 있습니다.' });
    }

    // 참가자 변경은 owner/admin만 가능
    if (participant_a_id !== undefined || participant_b_id !== undefined) {
      const userId = req.user ? Number(req.user.sub) : null;
      if (!userId) return res.status(401).json({ message: '로그인이 필요합니다.' });
      const ownerCheck = await pool.query(
        `SELECT 1 FROM leagues l INNER JOIN group_members gm ON gm.group_id = l.group_id WHERE l.id = $1 AND gm.user_id = $2 AND gm.role IN ('owner', 'admin')`,
        [leagueId, userId],
      );
      if (ownerCheck.rowCount === 0) return res.status(403).json({ message: '권한이 없습니다.' });
    }

    const fields = [];
    const vals = [];
    if (score_a !== undefined) { fields.push(`score_a = $${vals.length + 1}`); vals.push(score_a); }
    if (score_b !== undefined) { fields.push(`score_b = $${vals.length + 1}`); vals.push(score_b); }
    if (court !== undefined) { fields.push(`court = $${vals.length + 1}`); vals.push(court); }
    if (status !== undefined) { fields.push(`status = $${vals.length + 1}`); vals.push(status); }
    if (participant_a_id !== undefined) { fields.push(`participant_a_id = $${vals.length + 1}`); vals.push(participant_a_id); }
    if (participant_b_id !== undefined) { fields.push(`participant_b_id = $${vals.length + 1}`); vals.push(participant_b_id); }
    if (fields.length === 0) return res.status(400).json({ message: '변경할 필드가 없습니다.' });

    vals.push(matchId, leagueId);
    const result = await pool.query(
      `UPDATE league_matches SET ${fields.join(', ')} WHERE id = $${vals.length - 1} AND league_id = $${vals.length} RETURNING *`,
      vals,
    );
    if (result.rowCount === 0) return res.status(404).json({ message: '경기를 찾을 수 없습니다.' });

    // 경기 시작 알림: status가 playing이 되면 두 참가자에게 푸시 발송
    if (status === 'playing') {
      const m = result.rows[0];
      const label = m.match_label ?? `${m.match_order}번 경기`;
      const payload = { title: '내 경기가 시작됩니다!', body: `${label} 경기가 시작되었습니다.`, url: `/league/${leagueId}/tournament/matches` };
      sendPushToParticipant(m.participant_a_id, payload);
      sendPushToParticipant(m.participant_b_id, payload);
    }

    // 토너먼트 진출 처리: status가 done이 되면 승자/패자를 다음 경기에 배정
    if (status === 'done') {
      const m = result.rows[0];
      const scoreA = m.score_a ?? 0;
      const scoreB = m.score_b ?? 0;
      if (scoreA !== scoreB) {
        const winnerId = scoreA > scoreB ? m.participant_a_id : m.participant_b_id;
        const loserId  = scoreA > scoreB ? m.participant_b_id : m.participant_a_id;
        if (m.next_match_id && winnerId) {
          const col = m.next_slot === 'a' ? 'participant_a_id' : 'participant_b_id';
          await pool.query(`UPDATE league_matches SET ${col} = $1 WHERE id = $2`, [winnerId, m.next_match_id]);
        }
        if (m.loser_next_match_id && loserId) {
          const col = m.loser_next_slot === 'a' ? 'participant_a_id' : 'participant_b_id';
          await pool.query(`UPDATE league_matches SET ${col} = $1 WHERE id = $2`, [loserId, m.loser_next_match_id]);
        }
      }
    }

    return res.json({ match: result.rows[0] });
  } catch (err) {
    console.error('Error updating match:', err);
    return res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * @openapi
 * /league/{id}/matches/{matchId}:
 *   delete:
 *     summary: 경기 삭제
 *     description: 경기를 삭제하고 나머지 경기의 match_order를 재정렬합니다. owner/admin만 가능합니다.
 *     tags: [리그]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 리그 ID
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 경기 ID
 *     responses:
 *       200:
 *         description: 삭제 성공
 *       403:
 *         description: 권한 없음
 *       404:
 *         description: 경기 없음
 *       500:
 *         description: 서버 오류
 */
// DELETE /league/:id/matches/:matchId - 경기 삭제 (owner/admin)
router.delete('/league/:id/matches/:matchId', requireAuth, async (req, res) => {
  const userId = Number(req.user.sub);
  const leagueId = req.params.id;
  const matchId = req.params.matchId;
  try {
    const access = await pool.query(
      `SELECT l.id FROM leagues l
       INNER JOIN group_members gm ON gm.group_id = l.group_id
       WHERE l.id = $1 AND gm.user_id = $2 AND gm.role IN ('owner', 'admin')`,
      [leagueId, userId],
    );
    if (access.rowCount === 0) return res.status(403).json({ message: '권한이 없습니다.' });

    const del = await pool.query(
      `DELETE FROM league_matches WHERE id = $1 AND league_id = $2 RETURNING id`,
      [matchId, leagueId],
    );
    if (del.rowCount === 0) return res.status(404).json({ message: '경기를 찾을 수 없습니다.' });

    // match_order 재정렬
    await pool.query(
      `UPDATE league_matches SET match_order = sub.rn
       FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY match_order) AS rn FROM league_matches WHERE league_id = $1) sub
       WHERE league_matches.id = sub.id`,
      [leagueId],
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting match:', err);
    return res.status(500).json({ message: '서버 오류' });
  }
});

/** 경기 참가자에게 앱 푸시 알림 전송 */
router.post('/league/:id/matches/:matchId/notify', requireAuth, async (req, res) => {
  const leagueId = req.params.id;
  const matchId = req.params.matchId;
  try {
    const r = await pool.query(
      `SELECT m.match_order, m.participant_a_id, m.participant_b_id,
              pa.name AS a_name, pa.division AS a_div,
              pb.name AS b_name, pb.division AS b_div
       FROM league_matches m
       LEFT JOIN league_participants pa ON pa.id = m.participant_a_id
       LEFT JOIN league_participants pb ON pb.id = m.participant_b_id
       WHERE m.id = $1 AND m.league_id = $2`,
      [matchId, leagueId]
    );
    if (!r.rows[0]) return res.status(404).json({ ok: false });
    const m = r.rows[0];
    const aLabel = m.a_div ? `(${m.a_div})${m.a_name ?? '?'}` : (m.a_name ?? '?');
    const bLabel = m.b_div ? `(${m.b_div})${m.b_name ?? '?'}` : (m.b_name ?? '?');
    const payload = {
      title: `${m.match_order}경기`,
      body: `${aLabel} VS ${bLabel}\n곧 경기 시작! 지금 입장해 주세요`,
      url: `/league/${leagueId}/matches`,
    };
    sendPushToParticipant(m.participant_a_id, payload);
    sendPushToParticipant(m.participant_b_id, payload);
    return res.json({ ok: true });
  } catch (err) {
    console.error('Error sending match notify:', err);
    return res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * @openapi
 * /league/{id}/matches/init-tournament:
 *   post:
 *     summary: 토너먼트 대진표 자동 생성
 *     description: 참가자 목록을 기반으로 토너먼트 대진표를 자동 생성합니다. owner/admin만 가능합니다.
 *     tags: [리그]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 리그 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bracket_size]
 *             properties:
 *               bracket_size:
 *                 type: integer
 *                 enum: [4, 8, 16, 32, 64, 128]
 *               seeding:
 *                 type: string
 *                 enum: [manual, seed, random]
 *               advancement:
 *                 type: string
 *                 enum: [upper-only, upper-lower]
 *               force:
 *                 type: boolean
 *                 description: true이면 기존 경기를 삭제하고 재생성
 *     responses:
 *       200:
 *         description: 대진표 생성 성공
 *       400:
 *         description: 잘못된 bracket_size 또는 이미 경기 존재
 *       403:
 *         description: 권한 없음
 *       500:
 *         description: 서버 오류
 */
// POST /league/:id/matches/init-tournament - 토너먼트 대진표 생성 (owner/admin)
router.post('/league/:id/matches/init-tournament', requireAuth, async (req, res) => {
  const userId = Number(req.user.sub);
  const leagueId = req.params.id;
  try {
    const access = await pool.query(
      `SELECT l.tournament_seeding, l.tournament_advancement
       FROM leagues l
       INNER JOIN group_members gm ON gm.group_id = l.group_id
       WHERE l.id = $1 AND gm.user_id = $2 AND gm.role IN ('owner', 'admin')`,
      [leagueId, userId],
    );
    if (access.rowCount === 0) return res.status(403).json({ message: '권한이 없습니다.' });

    const { bracket_size, seeding: seedingOverride, advancement: advancementOverride, force } = req.body;

    const validSizes = [4, 8, 16, 32, 64, 128];
    if (!validSizes.includes(bracket_size)) {
      return res.status(400).json({ message: '유효하지 않은 참가 인원입니다. (4/8/16/32/64/128)' });
    }

    const seeding = seedingOverride ?? access.rows[0].tournament_seeding ?? 'seed';
    const advancement = advancementOverride ?? access.rows[0].tournament_advancement ?? 'upper-only';

    // 리그 포맷 확인 (단일리그+토너먼트는 리그 경기 보존)
    const leagueFormatRow = await pool.query(`SELECT format FROM leagues WHERE id = $1`, [leagueId]);
    const leagueFormat = leagueFormatRow.rows[0]?.format ?? '';
    const isLeaguePlusTournament = leagueFormat === '단일리그 + 토너먼트';

    // 기존 경기 확인 (단일리그+토너먼트: 토너먼트 경기만 확인/삭제, 리그 경기 보존)
    const existingQuery = isLeaguePlusTournament
      ? `SELECT id FROM league_matches WHERE league_id = $1 AND bracket IS NOT NULL LIMIT 1`
      : `SELECT id FROM league_matches WHERE league_id = $1 LIMIT 1`;
    const existing = await pool.query(existingQuery, [leagueId]);
    if (existing.rowCount > 0) {
      if (!force) return res.status(400).json({ message: '이미 경기가 생성되어 있습니다.' });
      const deleteQuery = isLeaguePlusTournament
        ? `DELETE FROM league_matches WHERE league_id = $1 AND bracket IS NOT NULL`
        : `DELETE FROM league_matches WHERE league_id = $1`;
      await pool.query(deleteQuery, [leagueId]);
    }

    // 참가자 로드 (편성 방식에 따라 정렬; 수동은 빈 슬롯으로 생성)
    let participants;
    let groupedParticipants = null;

    if (seeding === 'manual') {
      // 수동: 모든 슬롯을 비워서 생성 (관리자가 직접 등록)
      participants = Array.from({ length: bracket_size }, () => null);
    } else if (seeding === 'group') {
      // 조별: division 기준으로 그룹핑 (같은 조 1라운드 대전 방지)
      const pQuery = await pool.query(
        `SELECT id, division FROM league_participants WHERE league_id = $1 ORDER BY division ASC, sort_order ASC NULLS LAST, created_at ASC`,
        [leagueId],
      );
      groupedParticipants = {};
      for (const p of pQuery.rows) {
        const div = p.division || '';
        if (!groupedParticipants[div]) groupedParticipants[div] = [];
        groupedParticipants[div].push({ id: p.id });
      }
      participants = null; // group 모드는 buildGroupBracket에서 직접 처리
    } else if (seeding === 'standings') {
      // 리그 순위: 리그 단계(bracket IS NULL) 경기 결과 기준 승수 내림차순
      const pQuery = await pool.query(
        `SELECT
           p.id,
           COALESCE(SUM(CASE
             WHEN m.bracket IS NULL AND m.status = 'done' AND m.participant_a_id = p.id AND m.score_a > m.score_b THEN 1
             WHEN m.bracket IS NULL AND m.status = 'done' AND m.participant_b_id = p.id AND m.score_b > m.score_a THEN 1
             ELSE 0 END), 0) AS wins,
           COALESCE(SUM(CASE
             WHEN m.bracket IS NULL AND m.status = 'done' AND m.participant_a_id = p.id THEN m.score_a
             WHEN m.bracket IS NULL AND m.status = 'done' AND m.participant_b_id = p.id THEN m.score_b
             ELSE 0 END), 0) AS sets_won
         FROM league_participants p
         LEFT JOIN league_matches m ON m.bracket IS NULL
           AND (m.participant_a_id = p.id OR m.participant_b_id = p.id)
         WHERE p.league_id = $1
         GROUP BY p.id
         ORDER BY wins DESC, sets_won DESC`,
        [leagueId],
      );
      participants = Array.from({ length: bracket_size }, (_, i) =>
        pQuery.rows[i] ? { id: pQuery.rows[i].id } : null,
      );
    } else if (seeding === 'seed') {
      const pQuery = await pool.query(
        `SELECT id FROM league_participants WHERE league_id = $1 ORDER BY division ASC, sort_order ASC NULLS LAST, created_at ASC`,
        [leagueId],
      );
      const pRows = pQuery.rows;
      participants = Array.from({ length: bracket_size }, (_, i) =>
        pRows[i] ? { id: pRows[i].id } : null,
      );
    } else {
      // random
      const pQuery = await pool.query(
        `SELECT id FROM league_participants WHERE league_id = $1 ORDER BY RANDOM()`,
        [leagueId],
      );
      const pRows = pQuery.rows;
      participants = Array.from({ length: bracket_size }, (_, i) =>
        pRows[i] ? { id: pRows[i].id } : null,
      );
    }

    // 대진표 생성
    let matches;
    if (seeding === 'group') {
      matches = buildGroupBracket(bracket_size, groupedParticipants);
    } else if (advancement === 'upper-lower') {
      matches = buildUpperLowerMatches(bracket_size, participants);
    } else {
      matches = buildSingleElimMatches(bracket_size, participants);
    }

    // 일괄 삽입
    if (matches.length > 0) {
      const vals = matches.map((m) => [
        m.id, leagueId, m.match_order,
        m.participant_a_id, m.participant_b_id,
        m.bracket, m.round_number, m.match_label,
        m.next_match_id, m.next_slot,
        m.loser_next_match_id, m.loser_next_slot,
      ]);
      const placeholders = vals.map((_, i) => {
        const b = i * 12;
        return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},$${b+10},$${b+11},$${b+12})`;
      }).join(',');
      await pool.query(
        `INSERT INTO league_matches
           (id, league_id, match_order, participant_a_id, participant_b_id,
            bracket, round_number, match_label,
            next_match_id, next_slot, loser_next_match_id, loser_next_slot)
         VALUES ${placeholders}`,
        vals.flat(),
      );
    }

    // 리그 상태 active로 변경 + 편성 방식 저장
    await pool.query(
      `UPDATE leagues SET status = 'active', tournament_seeding = $2, tournament_advancement = $3, updated_at = NOW() WHERE id = $1`,
      [leagueId, seeding, advancement],
    );

    // 생성된 경기 반환
    const result = await pool.query(
      `SELECT
         m.id, m.match_order, m.score_a, m.score_b, m.court, m.status,
         m.participant_a_id, m.participant_b_id,
         m.bracket, m.round_number, m.match_label,
         m.next_match_id, m.next_slot, m.loser_next_match_id, m.loser_next_slot,
         pa.name AS participant_a_name, pa.division AS participant_a_division,
         pb.name AS participant_b_name, pb.division AS participant_b_division
       FROM league_matches m
       LEFT JOIN league_participants pa ON pa.id = m.participant_a_id
       LEFT JOIN league_participants pb ON pb.id = m.participant_b_id
       WHERE m.league_id = $1
       ORDER BY m.match_order ASC`,
      [leagueId],
    );
    return res.json({ matches: result.rows });
  } catch (err) {
    console.error('Error initializing tournament matches:', err);
    return res.status(500).json({ message: '서버 오류' });
  }
});

module.exports = router;
