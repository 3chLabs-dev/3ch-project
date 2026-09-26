const express = require('express');
const { z } = require('zod');
const pool = require('../db/pool');
const { requireAuth, optionalAuth } = require('../middlewares/auth');
const { canChangeTournamentCompetitionSettings } = require('../utils/tournamentDivisionPolicy');
const { createTournamentGroups, canCreateTournamentGroups } = require('../utils/tournamentGrouping');
const { matchesExistingRoster, canCancelParticipantWithResults } = require('../utils/tournamentRosterPolicy');

const router = express.Router();

async function hasPremiumSubscription(client, userId) {
  const result = await client.query(
    `SELECT 1 FROM subscriptions WHERE user_id = $1 AND LOWER(plan) = 'premium'
       AND status = 'ACTIVE' AND started_at <= NOW() AND expires_at > NOW() LIMIT 1`,
    [userId],
  );
  return result.rowCount > 0;
}

async function canManageHostGroup(client, groupId, userId) {
  const result = await client.query(
    `SELECT role, management_permissions FROM group_members
      WHERE group_id = $1 AND user_id = $2 LIMIT 1`,
    [groupId, userId],
  );
  const member = result.rows[0];
  return member?.role === 'owner' ||
    (member?.role === 'admin' && member.management_permissions?.league === true);
}

async function canViewTournament(client, tournamentId, userId) {
  const found = await client.query(
    `SELECT t.* FROM tournaments t
     WHERE t.id = $1 AND ((t.premium_visible = TRUE AND t.status <> 'draft') OR t.created_by_id = $2
       OR EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = t.host_group_id AND gm.user_id = $2)
       OR EXISTS (SELECT 1 FROM tournament_invited_groups ig JOIN group_members gm ON gm.group_id = ig.group_id WHERE ig.tournament_id = t.id AND ig.status = 'accepted' AND gm.user_id = $2))`,
    [tournamentId, userId],
  );
  return found.rows[0] ?? null;
}

async function getDivision(client, tournamentId, divisionId, lock = false) {
  const found = await client.query(`SELECT d.* FROM tournament_divisions d WHERE d.tournament_id = $1 AND d.id = $2 ${lock ? 'FOR UPDATE' : ''}`, [tournamentId, divisionId]);
  return found.rows[0] ?? null;
}

async function canSubmitTournamentApplication(client, tournament, userId, groupId) {
  const hostManager = await hasPremiumSubscription(client, userId) && await canManageHostGroup(client, tournament.host_group_id, userId);
  if (hostManager) return true;
  if (tournament.status !== 'open') return false;
  if (tournament.premium_visible) return true;
  const invited = await client.query(`SELECT 1 FROM tournament_invited_groups ig JOIN group_members gm ON gm.group_id = ig.group_id WHERE ig.tournament_id = $1 AND ig.status = 'accepted' AND gm.user_id = $2 AND ($3::text IS NULL OR ig.group_id = $3) LIMIT 1`, [tournament.id, userId, groupId]);
  return invited.rowCount > 0;
}

const createSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().nullable().optional(),
  sport: z.string().trim().min(1).max(40).default('탁구'),
  venue_name: z.string().trim().max(120).nullable().optional(),
  venue_address: z.string().trim().nullable().optional(),
  notice: z.string().trim().nullable().optional(),
  court_count: z.number().int().positive().nullable().optional(),
  recruit_count: z.number().int().positive().nullable().optional(),
  starts_at: z.iso.datetime({ offset: true }),
  ends_at: z.iso.datetime({ offset: true }).nullable().optional(),
  application_deadline_at: z.iso.datetime({ offset: true }).nullable().optional(),
  host_group_id: z.string().uuid(),
  premium_visible: z.boolean().default(false),
  divisions: z.array(z.object({
    name: z.string().trim().min(1).max(80),
    recruit_count: z.number().int().positive().nullable().optional(),
    rounds: z.array(z.object({
      league_type: z.enum(['SINGLES', 'DOUBLES', 'TEAM']),
      format: z.enum(['LEAGUE', 'GROUP', 'TOURNAMENT', 'GROUP_TOURNAMENT']),
      rules: z.record(z.string(), z.unknown()).default({}),
    })).min(1),
  })).min(1),
}).refine((value) => !value.ends_at || value.ends_at >= value.starts_at, { path: ['ends_at'] })
  .refine((value) => !value.application_deadline_at || value.application_deadline_at < value.starts_at, { path: ['application_deadline_at'] })
  .refine((value) => new Set(value.divisions.map((division) => division.name)).size === value.divisions.length,
    { path: ['divisions'], message: '부문 이름은 중복될 수 없습니다.' });

router.get('/tournaments/eligibility', requireAuth, async (req, res) => {
  try {
    return res.json({ can_create: await hasPremiumSubscription(pool, Number(req.user.sub)) });
  } catch (error) {
    console.error('Tournament eligibility error:', error);
    return res.status(500).json({ message: '이용 자격을 확인할 수 없습니다.' });
  }
});

router.post('/tournaments', requireAuth, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: '대회 정보가 올바르지 않습니다.', issues: parsed.error.issues });
  const data = parsed.data;
  const userId = Number(req.user.sub);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (!await hasPremiumSubscription(client, userId)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ code: 'PREMIUM_REQUIRED', message: '프리미엄 구독이 필요합니다.' });
    }
    if (!await canManageHostGroup(client, data.host_group_id, userId)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: '주최 클럽 관리 권한이 필요합니다.' });
    }
    const created = await client.query(
      `INSERT INTO tournaments
         (title, description, sport, venue_name, venue_address, notice, court_count, recruit_count,
          starts_at, ends_at, application_deadline_at, host_group_id, created_by_id, premium_visible)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [data.title, data.description ?? null, data.sport, data.venue_name ?? null,
        data.venue_address ?? null, data.notice ?? null, data.court_count ?? null, data.recruit_count ?? null,
        data.starts_at, data.ends_at ?? null, data.application_deadline_at ?? null,
        data.host_group_id, userId, data.premium_visible],
    );
    for (const [index, division] of data.divisions.entries()) {
      const firstRound = division.rounds[0];
      const createdDivision = await client.query(
        `INSERT INTO tournament_divisions (tournament_id, name, sort_order, league_type, format, rules, recruit_count)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7) RETURNING id`,
        [created.rows[0].id, division.name, index, firstRound.league_type, firstRound.format,
          JSON.stringify(firstRound.rules), division.recruit_count ?? null],
      );
      for (const [roundIndex, round] of division.rounds.entries()) {
        await client.query(
          `INSERT INTO tournament_division_rounds (division_id, round_no, league_type, format, rules)
           VALUES ($1, $2, $3, $4, $5::jsonb)`,
          [createdDivision.rows[0].id, roundIndex + 1, round.league_type, round.format, JSON.stringify(round.rules)],
        );
      }
    }
    await client.query('COMMIT');
    return res.status(201).json({ tournament: created.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Tournament creation error:', error);
    return res.status(500).json({ message: '대회를 생성할 수 없습니다.' });
  } finally { client.release(); }
});

router.get('/tournaments', optionalAuth, async (req, res) => {
  try {
    const userId = req.user ? Number(req.user.sub) : null;
    const result = await pool.query(
      `SELECT DISTINCT t.id, t.title, t.description, t.starts_at, t.ends_at,
              t.status, t.premium_visible, t.host_group_id, t.recruit_count, g.name AS host_group_name
         FROM tournaments t
         JOIN groups g ON g.id = t.host_group_id
         LEFT JOIN group_members host_member ON host_member.group_id = t.host_group_id AND host_member.user_id = $1
         LEFT JOIN tournament_invited_groups invited ON invited.tournament_id = t.id AND invited.status = 'accepted'
         LEFT JOIN group_members invited_member ON invited_member.group_id = invited.group_id AND invited_member.user_id = $1
        WHERE (t.premium_visible = TRUE AND t.status <> 'draft') OR t.created_by_id = $1
           OR host_member.user_id IS NOT NULL OR invited_member.user_id IS NOT NULL
        ORDER BY t.starts_at ASC`,
      [userId],
    );
    return res.json({ tournaments: result.rows });
  } catch (error) {
    console.error('Tournament listing error:', error);
    return res.status(500).json({ message: '대회 목록을 불러올 수 없습니다.' });
  }
});

router.get('/tournaments/:id', optionalAuth, async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ message: '대회 ID가 올바르지 않습니다.' });
  try {
    const userId = req.user ? Number(req.user.sub) : null;
    const tournament = await pool.query(
      `SELECT DISTINCT t.*, g.name AS host_group_name
         FROM tournaments t
         JOIN groups g ON g.id = t.host_group_id
         LEFT JOIN group_members host_member ON host_member.group_id = t.host_group_id AND host_member.user_id = $2
         LEFT JOIN tournament_invited_groups invited ON invited.tournament_id = t.id AND invited.status = 'accepted'
         LEFT JOIN group_members invited_member ON invited_member.group_id = invited.group_id AND invited_member.user_id = $2
        WHERE t.id = $1 AND ((t.premium_visible = TRUE AND t.status <> 'draft') OR t.created_by_id = $2
          OR host_member.user_id IS NOT NULL OR invited_member.user_id IS NOT NULL)`,
      [id.data, userId],
    );
    if (!tournament.rowCount) return res.status(404).json({ message: '대회를 찾을 수 없습니다.' });
    const divisions = await pool.query(
      `SELECT d.*,
              COUNT(p.id) FILTER (WHERE p.status IN ('applied', 'confirmed'))::int AS applicant_count,
              COUNT(p.id) FILTER (WHERE p.status = 'confirmed')::int AS confirmed_count
         FROM tournament_divisions d
         LEFT JOIN tournament_participants p ON p.division_id = d.id
        WHERE d.tournament_id = $1 GROUP BY d.id ORDER BY d.sort_order, d.created_at`,
      [id.data],
    );
    const rounds = await pool.query(
      `SELECT r.* FROM tournament_division_rounds r
         JOIN tournament_divisions d ON d.id = r.division_id
        WHERE d.tournament_id = $1 ORDER BY d.sort_order, r.round_no`,
      [id.data],
    );
    const roundsByDivision = new Map();
    for (const round of rounds.rows) {
      const existing = roundsByDivision.get(round.division_id) ?? [];
      existing.push(round);
      roundsByDivision.set(round.division_id, existing);
    }
    const canManage = userId !== null && await hasPremiumSubscription(pool, userId) && await canManageHostGroup(pool, tournament.rows[0].host_group_id, userId);
    const canApply = tournament.rows[0].status === 'open' && new Date() < new Date(tournament.rows[0].application_deadline_at ?? tournament.rows[0].starts_at) && (tournament.rows[0].premium_visible || userId !== null && (await pool.query(`SELECT 1 FROM tournament_invited_groups ig JOIN group_members gm ON gm.group_id = ig.group_id WHERE ig.tournament_id = $1 AND ig.status = 'accepted' AND gm.user_id = $2 LIMIT 1`, [id.data, userId])).rowCount > 0);
    return res.json({ tournament: { ...tournament.rows[0], can_manage: canManage, can_apply: canApply, divisions: divisions.rows.map((division) => ({ ...division, rounds: roundsByDivision.get(division.id) ?? [] })) } });
  } catch (error) {
    console.error('Tournament detail error:', error);
    return res.status(500).json({ message: '대회를 불러올 수 없습니다.' });
  }
});

router.patch('/tournaments/:id', requireAuth, async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  const body = z.object({
    title: z.string().trim().min(1).max(160).optional(),
    venue_name: z.string().trim().max(120).nullable().optional(),
    venue_address: z.string().trim().nullable().optional(),
    court_count: z.number().int().positive().nullable().optional(),
    recruit_count: z.number().int().positive().nullable().optional(),
    starts_at: z.iso.datetime({ offset: true }).optional(),
    ends_at: z.iso.datetime({ offset: true }).nullable().optional(),
    application_deadline_at: z.iso.datetime({ offset: true }).nullable().optional(),
  }).strict().refine((value) => Object.keys(value).length > 0).safeParse(req.body);
  if (!id.success || !body.success) return res.status(400).json({ message: '대회 정보가 올바르지 않습니다.' });
  try {
    const existing = await pool.query('SELECT host_group_id, starts_at, ends_at, application_deadline_at FROM tournaments WHERE id = $1', [id.data]);
    if (!existing.rowCount) return res.status(404).json({ message: '대회를 찾을 수 없습니다.' });
    const userId = Number(req.user.sub);
    if (!await hasPremiumSubscription(pool, userId) || !await canManageHostGroup(pool, existing.rows[0].host_group_id, userId)) return res.status(403).json({ message: '대회 관리 권한이 필요합니다.' });
    const startsAt = body.data.starts_at ?? existing.rows[0].starts_at;
    const endsAt = Object.hasOwn(body.data, 'ends_at') ? body.data.ends_at : existing.rows[0].ends_at;
    if (endsAt && new Date(endsAt) < new Date(startsAt)) return res.status(400).json({ message: '종료 시간은 시작 시간 이후여야 합니다.' });
    const deadlineAt = Object.hasOwn(body.data, 'application_deadline_at') ? body.data.application_deadline_at : existing.rows[0].application_deadline_at;
    if (deadlineAt && new Date(deadlineAt) >= new Date(startsAt)) return res.status(400).json({ message: '참가 신청 마감은 대회 시작 전이어야 합니다.' });
    const entries = Object.entries(body.data);
    const values = entries.map(([, value]) => value);
    const sets = entries.map(([key], index) => `${key} = $${index + 1}`);
    values.push(id.data);
    const updated = await pool.query(`UPDATE tournaments SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`, values);
    return res.json({ tournament: updated.rows[0] });
  } catch (error) {
    console.error('Tournament update error:', error);
    return res.status(500).json({ message: '대회 정보를 변경할 수 없습니다.' });
  }
});

router.post('/tournaments/:id/divisions/:divisionId/rounds', requireAuth, async (req, res) => {
  const ids = z.object({ id: z.string().uuid(), divisionId: z.string().uuid() }).safeParse(req.params);
  const body = z.object({ league_type: z.enum(['SINGLES', 'DOUBLES', 'TEAM']), format: z.enum(['LEAGUE', 'GROUP', 'TOURNAMENT', 'GROUP_TOURNAMENT']), rules: z.record(z.string(), z.unknown()) }).strict().safeParse(req.body);
  if (!ids.success || !body.success) return res.status(400).json({ message: '라운드 설정이 올바르지 않습니다.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query(`SELECT d.id, t.host_group_id FROM tournament_divisions d JOIN tournaments t ON t.id = d.tournament_id WHERE t.id = $1 AND d.id = $2 FOR UPDATE OF d`, [ids.data.id, ids.data.divisionId]);
    if (!found.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ message: '부문을 찾을 수 없습니다.' }); }
    const userId = Number(req.user.sub);
    if (!await hasPremiumSubscription(client, userId) || !await canManageHostGroup(client, found.rows[0].host_group_id, userId)) { await client.query('ROLLBACK'); return res.status(403).json({ message: '대회 관리 권한이 필요합니다.' }); }
    const matches = await client.query('SELECT 1 FROM tournament_matches WHERE division_id = $1 LIMIT 1', [ids.data.divisionId]);
    const pools = await client.query('SELECT 1 FROM tournament_pools WHERE division_id = $1 LIMIT 1', [ids.data.divisionId]);
    if (matches.rowCount || pools.rowCount) { await client.query('ROLLBACK'); return res.status(409).json({ code: 'COMPETITION_ALREADY_CREATED', message: '조 또는 경기가 생성된 부문에는 라운드를 추가할 수 없습니다.' }); }
    const created = await client.query(`INSERT INTO tournament_division_rounds (division_id, round_no, league_type, format, rules) SELECT $1, COALESCE(MAX(round_no), 0) + 1, $2, $3, $4::jsonb FROM tournament_division_rounds WHERE division_id = $1 RETURNING *`, [ids.data.divisionId, body.data.league_type, body.data.format, JSON.stringify(body.data.rules)]);
    await client.query('COMMIT');
    return res.status(201).json({ round: created.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Tournament round add error:', error);
    return res.status(500).json({ message: '라운드를 추가할 수 없습니다.' });
  } finally { client.release(); }
});

router.put('/tournaments/:id/divisions/:divisionId/program', requireAuth, async (req, res) => {
  const ids = z.object({ id: z.string().uuid(), divisionId: z.string().uuid() }).safeParse(req.params);
  const body = z.object({
    name: z.string().trim().min(1).max(80),
    recruit_count: z.number().int().positive().nullable(),
    rounds: z.array(z.object({
      id: z.string().uuid().optional(),
      league_type: z.enum(['SINGLES', 'DOUBLES', 'TEAM']),
      format: z.enum(['LEAGUE', 'GROUP', 'TOURNAMENT', 'GROUP_TOURNAMENT']),
      rules: z.record(z.string(), z.unknown()),
    }).strict()).min(1),
  }).strict().safeParse(req.body);
  if (!ids.success || !body.success) return res.status(400).json({ message: '프로그램 설정이 올바르지 않습니다.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query(`SELECT d.*, t.host_group_id FROM tournament_divisions d JOIN tournaments t ON t.id = d.tournament_id WHERE t.id = $1 AND d.id = $2 FOR UPDATE OF d`, [ids.data.id, ids.data.divisionId]);
    if (!found.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ message: '부문을 찾을 수 없습니다.' }); }
    const userId = Number(req.user.sub);
    if (!await hasPremiumSubscription(client, userId) || !await canManageHostGroup(client, found.rows[0].host_group_id, userId)) { await client.query('ROLLBACK'); return res.status(403).json({ message: '대회 관리 권한이 필요합니다.' }); }
    const current = await client.query('SELECT * FROM tournament_division_rounds WHERE division_id = $1 ORDER BY round_no FOR UPDATE', [ids.data.divisionId]);
    const incomingExisting = body.data.rounds.filter((round) => round.id);
    if (incomingExisting.length !== current.rowCount || incomingExisting.some((round, index) => round.id !== current.rows[index].id)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: '프로그램이 변경되었습니다. 새로고침 후 다시 수정해주세요.' });
    }
    const roundsChanged = body.data.rounds.length !== current.rowCount || incomingExisting.some((round, index) =>
      round.league_type !== current.rows[index].league_type || round.format !== current.rows[index].format || JSON.stringify(round.rules) !== JSON.stringify(current.rows[index].rules));
    if (roundsChanged) {
      const matches = await client.query('SELECT 1 FROM tournament_matches WHERE division_id = $1 LIMIT 1', [ids.data.divisionId]);
      const pools = await client.query('SELECT 1 FROM tournament_pools WHERE division_id = $1 LIMIT 1', [ids.data.divisionId]);
      if (matches.rowCount || pools.rowCount) { await client.query('ROLLBACK'); return res.status(409).json({ code: 'COMPETITION_ALREADY_CREATED', message: '조 또는 경기가 생성된 부문의 프로그램은 변경할 수 없습니다.' }); }
    }
    await client.query('UPDATE tournament_divisions SET name = $1, recruit_count = $2, updated_at = NOW() WHERE id = $3', [body.data.name, body.data.recruit_count, ids.data.divisionId]);
    for (const [index, round] of body.data.rounds.entries()) {
      if (round.id) {
        await client.query('UPDATE tournament_division_rounds SET league_type = $1, format = $2, rules = $3::jsonb, updated_at = NOW() WHERE id = $4', [round.league_type, round.format, JSON.stringify(round.rules), round.id]);
      } else {
        await client.query('INSERT INTO tournament_division_rounds (division_id, round_no, league_type, format, rules) VALUES ($1, $2, $3, $4, $5::jsonb)', [ids.data.divisionId, index + 1, round.league_type, round.format, JSON.stringify(round.rules)]);
      }
    }
    const first = body.data.rounds[0];
    await client.query('UPDATE tournament_divisions SET league_type = $1, format = $2, rules = $3::jsonb WHERE id = $4', [first.league_type, first.format, JSON.stringify(first.rules), ids.data.divisionId]);
    await client.query('COMMIT');
    return res.json({ message: '프로그램을 저장했습니다.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Tournament program update error:', error);
    return res.status(500).json({ message: '프로그램을 저장할 수 없습니다.' });
  } finally { client.release(); }
});

router.patch('/tournaments/:id/divisions/:divisionId', requireAuth, async (req, res) => {
  const ids = z.object({ id: z.string().uuid(), divisionId: z.string().uuid() }).safeParse(req.params);
  const body = z.object({
    name: z.string().trim().min(1).max(80).optional(),
    recruit_count: z.number().int().positive().nullable().optional(),
  }).strict().refine((value) => Object.keys(value).length > 0).safeParse(req.body);
  if (!ids.success || !body.success) return res.status(400).json({ message: '부문 설정이 올바르지 않습니다.' });
  try {
    const existing = await pool.query(
      `SELECT d.id, t.host_group_id
         FROM tournament_divisions d JOIN tournaments t ON t.id = d.tournament_id
        WHERE d.id = $1 AND t.id = $2`,
      [ids.data.divisionId, ids.data.id],
    );
    if (!existing.rowCount) return res.status(404).json({ message: '대회 부문을 찾을 수 없습니다.' });
    const userId = Number(req.user.sub);
    if (!await hasPremiumSubscription(pool, userId)) {
      return res.status(403).json({ code: 'PREMIUM_REQUIRED', message: '프리미엄 구독이 필요합니다.' });
    }
    if (!await canManageHostGroup(pool, existing.rows[0].host_group_id, userId)) {
      return res.status(403).json({ message: '주최 클럽 관리 권한이 필요합니다.' });
    }
    const entries = Object.entries(body.data);
    const values = entries.map(([, value]) => value);
    const sets = entries.map(([key], index) => `${key} = $${index + 1}`);
    values.push(ids.data.divisionId);
    const updated = await pool.query(
      `UPDATE tournament_divisions SET ${sets.join(', ')}, updated_at = NOW()
        WHERE id = $${values.length} RETURNING *`,
      values,
    );
    return res.json({ division: updated.rows[0] });
  } catch (error) {
    console.error('Tournament division update error:', error);
    return res.status(500).json({ message: '부문 설정을 변경할 수 없습니다.' });
  }
});

router.patch('/tournaments/:id/divisions/:divisionId/rounds/:roundId', requireAuth, async (req, res) => {
  const ids = z.object({ id: z.string().uuid(), divisionId: z.string().uuid(), roundId: z.string().uuid() }).safeParse(req.params);
  const body = z.object({
    league_type: z.enum(['SINGLES', 'DOUBLES', 'TEAM']).optional(),
    format: z.enum(['LEAGUE', 'GROUP', 'TOURNAMENT', 'GROUP_TOURNAMENT']).optional(),
    rules: z.record(z.string(), z.unknown()).optional(),
  }).strict().refine((value) => Object.keys(value).length > 0).safeParse(req.body);
  if (!ids.success || !body.success) return res.status(400).json({ message: '라운드 설정이 올바르지 않습니다.' });
  const userId = Number(req.user.sub);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query(
      `SELECT r.id, r.round_no, t.host_group_id,
              (EXISTS (SELECT 1 FROM tournament_matches m WHERE m.division_id = d.id) OR EXISTS (SELECT 1 FROM tournament_pools po WHERE po.division_id = d.id)) AS has_matches
         FROM tournament_divisions d
         JOIN tournaments t ON t.id = d.tournament_id
         JOIN tournament_division_rounds r ON r.division_id = d.id
        WHERE t.id = $1 AND d.id = $2 AND r.id = $3 FOR UPDATE OF d, r`,
      [ids.data.id, ids.data.divisionId, ids.data.roundId],
    );
    if (!found.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ message: '라운드를 찾을 수 없습니다.' }); }
    if (!await hasPremiumSubscription(client, userId) || !await canManageHostGroup(client, found.rows[0].host_group_id, userId)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: '대회 관리 권한이 필요합니다.' });
    }
    if (!canChangeTournamentCompetitionSettings({ hasMatches: found.rows[0].has_matches, updates: body.data })) {
      await client.query('ROLLBACK');
      return res.status(409).json({ code: 'MATCHES_ALREADY_CREATED', message: '경기가 생성된 부문의 라운드 설정은 변경할 수 없습니다.' });
    }
    const entries = Object.entries(body.data);
    const values = entries.map(([, value]) => value === null ? null : typeof value === 'object' ? JSON.stringify(value) : value);
    const sets = entries.map(([key], index) => `${key} = $${index + 1}${key === 'rules' ? '::jsonb' : ''}`);
    values.push(ids.data.roundId);
    const updated = await client.query(
      `UPDATE tournament_division_rounds SET ${sets.join(', ')}, updated_at = NOW()
        WHERE id = $${values.length} RETURNING *`,
      values,
    );
    if (found.rows[0].round_no === 1) {
      await client.query(
        `UPDATE tournament_divisions SET league_type = $1, format = $2, rules = $3::jsonb, updated_at = NOW()
          WHERE id = $4`,
        [updated.rows[0].league_type, updated.rows[0].format, JSON.stringify(updated.rows[0].rules), ids.data.divisionId],
      );
    }
    await client.query('COMMIT');
    return res.json({ round: updated.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Tournament round update error:', error);
    return res.status(500).json({ message: '라운드 설정을 변경할 수 없습니다.' });
  } finally { client.release(); }
});

router.patch('/tournaments/:id/visibility', requireAuth, async (req, res) => {
  const parsed = z.object({ premium_visible: z.boolean() }).safeParse(req.body);
  const id = z.string().uuid().safeParse(req.params.id);
  if (!parsed.success || !id.success) return res.status(400).json({ message: '노출 설정이 올바르지 않습니다.' });
  try {
    const existing = await pool.query('SELECT host_group_id FROM tournaments WHERE id = $1', [id.data]);
    if (!existing.rowCount) return res.status(404).json({ message: '대회를 찾을 수 없습니다.' });
    const userId = Number(req.user.sub);
    if (!await canManageHostGroup(pool, existing.rows[0].host_group_id, userId)) {
      return res.status(403).json({ message: '주최 클럽 관리 권한이 필요합니다.' });
    }
    if (!await hasPremiumSubscription(pool, userId)) {
      return res.status(403).json({ code: 'PREMIUM_REQUIRED', message: '프리미엄 구독이 필요합니다.' });
    }
    const updated = await pool.query(
      'UPDATE tournaments SET premium_visible = $1, updated_at = NOW() WHERE id = $2 RETURNING id, premium_visible',
      [parsed.data.premium_visible, id.data],
    );
    return res.json({ tournament: updated.rows[0] });
  } catch (error) {
    console.error('Tournament visibility error:', error);
    return res.status(500).json({ message: '노출 설정을 변경할 수 없습니다.' });
  }
});

router.patch('/tournaments/:id/status', requireAuth, async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  const body = z.object({ status: z.literal('open') }).strict().safeParse(req.body);
  if (!id.success || !body.success) return res.status(400).json({ message: '대회 상태가 올바르지 않습니다.' });
  try {
    const found = await pool.query('SELECT host_group_id, status, application_deadline_at FROM tournaments WHERE id = $1', [id.data]);
    if (!found.rowCount) return res.status(404).json({ message: '대회를 찾을 수 없습니다.' });
    const userId = Number(req.user.sub);
    if (!await hasPremiumSubscription(pool, userId) || !await canManageHostGroup(pool, found.rows[0].host_group_id, userId)) return res.status(403).json({ message: '대회 관리 권한이 필요합니다.' });
    if (found.rows[0].status !== 'draft') return res.status(409).json({ message: '초안 대회만 참가 신청을 열 수 있습니다.' });
    if (!found.rows[0].application_deadline_at || new Date(found.rows[0].application_deadline_at) <= new Date()) return res.status(409).json({ message: '미래의 참가 신청 마감을 먼저 설정해주세요.' });
    const updated = await pool.query(`UPDATE tournaments SET status = 'open', updated_at = NOW() WHERE id = $1 RETURNING id, status`, [id.data]);
    return res.json({ tournament: updated.rows[0] });
  } catch (error) { console.error('Tournament open error:', error); return res.status(500).json({ message: '참가 신청을 열 수 없습니다.' }); }
});

router.get('/tournaments/:id/participants', optionalAuth, async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ message: '대회 ID가 올바르지 않습니다.' });
  try {
    if (!await canViewTournament(pool, id.data, req.user ? Number(req.user.sub) : null)) return res.status(404).json({ message: '대회를 찾을 수 없습니다.' });
    const result = await pool.query(`SELECT p.id, p.division_id, d.name AS division_name, p.member_id, p.name, p.member_division, p.status, p.source_group_id, COALESCE(g.name, '개인') AS club_name, p.created_at
      FROM tournament_participants p JOIN tournament_divisions d ON d.id = p.division_id LEFT JOIN groups g ON g.id = p.source_group_id
      WHERE d.tournament_id = $1 AND p.status IN ('applied', 'confirmed') ORDER BY d.sort_order, CASE p.status WHEN 'confirmed' THEN 0 ELSE 1 END, p.created_at, p.id`, [id.data]);
    return res.json({ participants: result.rows });
  } catch (error) { console.error('Tournament roster overview error:', error); return res.status(500).json({ message: '참가 명단을 불러올 수 없습니다.' }); }
});

router.get('/tournaments/:id/applications/roster', requireAuth, async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  const groupId = typeof req.query.group_id === 'string' ? req.query.group_id : null;
  if (!id.success) return res.status(400).json({ message: '대회 ID가 올바르지 않습니다.' });
  const userId = Number(req.user.sub);
  try {
    const tournament = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id.data]);
    if (!tournament.rowCount) return res.status(404).json({ message: '대회를 찾을 수 없습니다.' });
    if (groupId && !await canManageHostGroup(pool, groupId, userId)) return res.status(403).json({ message: '클럽 명단 관리 권한이 필요합니다.' });
    const rows = await pool.query(`SELECT p.id, p.division_id, p.member_id, p.pre_member_id, p.name, p.member_division, p.status, p.source_group_id
      FROM tournament_participants p JOIN tournament_divisions d ON d.id = p.division_id
      WHERE d.tournament_id = $1 AND p.status IN ('applied', 'confirmed') AND
        (($2::text IS NOT NULL AND p.source_group_id = $2) OR ($2::text IS NULL AND p.source_group_id IS NULL AND p.member_id = $3))
      ORDER BY d.sort_order, p.created_at, p.id`, [id.data, groupId, userId]);
    return res.json({ participants: rows.rows });
  } catch (error) { console.error('Tournament application roster error:', error); return res.status(500).json({ message: '신청 명단을 불러올 수 없습니다.' }); }
});

router.put('/tournaments/:id/applications/roster', requireAuth, async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  const body = z.object({
    group_id: z.string().min(1).nullable(),
    rows: z.array(z.object({
      id: z.string().uuid().optional(),
      division_id: z.string().uuid(),
      name: z.string().trim().min(1).max(120),
      member_division: z.string().trim().max(40).nullable(),
      member_id: z.number().int().positive().nullable().optional(),
      pre_member_id: z.string().uuid().nullable().optional(),
      cancel: z.boolean().optional(),
    }).strict()).min(1).max(500),
    confirmation_intent: z.literal('CANCEL_TOURNAMENT_PARTICIPANTS').optional(),
  }).strict().safeParse(req.body);
  if (!id.success || !body.success) return res.status(400).json({ message: '신청 명단이 올바르지 않습니다.' });
  const userId = Number(req.user.sub);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query('SELECT * FROM tournaments WHERE id = $1 FOR UPDATE', [id.data]);
    if (!found.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ message: '대회를 찾을 수 없습니다.' }); }
    const tournament = found.rows[0];
    if (new Date() >= new Date(tournament.starts_at)) { await client.query('ROLLBACK'); return res.status(409).json({ message: '대회 시작 후에는 신청 명단을 수정할 수 없습니다.' }); }
    if (body.data.group_id && !await canManageHostGroup(client, body.data.group_id, userId)) { await client.query('ROLLBACK'); return res.status(403).json({ message: '클럽 명단 관리 권한이 필요합니다.' }); }
    const existing = await client.query(`SELECT p.* FROM tournament_participants p JOIN tournament_divisions d ON d.id = p.division_id
      WHERE d.tournament_id = $1 AND p.status IN ('applied', 'confirmed') AND
        (($2::text IS NOT NULL AND p.source_group_id = $2) OR ($2::text IS NULL AND p.source_group_id IS NULL AND p.member_id = $3))
      ORDER BY p.id FOR UPDATE OF p`, [id.data, body.data.group_id, userId]);
    const canSubmit = await canSubmitTournamentApplication(client, tournament, userId, body.data.group_id);
    if (!canSubmit && !existing.rowCount) { await client.query('ROLLBACK'); return res.status(403).json({ message: '이 대회에 신청할 권한이 없습니다.' }); }
    const incomingIds = body.data.rows.filter((row) => row.id).map((row) => row.id);
    if (!matchesExistingRoster(existing.rows, body.data.rows)) {
      await client.query('ROLLBACK'); return res.status(409).json({ message: '신청 명단이 변경되었습니다. 새로고침 후 다시 수정해주세요. 기존 참가자는 자동으로 삭제되지 않습니다.' });
    }
    if (body.data.rows.some((row) => row.cancel) && body.data.confirmation_intent !== 'CANCEL_TOURNAMENT_PARTICIPANTS') { await client.query('ROLLBACK'); return res.status(400).json({ message: '참가 취소 확인이 필요합니다.' }); }
    const divisionIds = [...new Set(body.data.rows.map((row) => row.division_id))];
    const divisions = await client.query('SELECT * FROM tournament_divisions WHERE tournament_id = $1 ORDER BY sort_order FOR UPDATE', [id.data]);
    if (divisionIds.some((divisionId) => !divisions.rows.some((division) => division.id === divisionId))) { await client.query('ROLLBACK'); return res.status(400).json({ message: '대회 부문이 올바르지 않습니다.' }); }
    const newRows = body.data.rows.filter((row) => !row.id && !row.cancel);
    if (!canSubmit && newRows.length) { await client.query('ROLLBACK'); return res.status(403).json({ message: '새 참가자를 신청할 권한이 없습니다.' }); }
    if (body.data.rows.some((row) => !row.id && row.cancel)) { await client.query('ROLLBACK'); return res.status(400).json({ message: '저장 전 행은 목록에서 제거해주세요.' }); }
    if (newRows.length && new Date() >= new Date(tournament.application_deadline_at ?? tournament.starts_at)) { await client.query('ROLLBACK'); return res.status(409).json({ message: '신청 마감 후에는 새 참가자를 추가할 수 없습니다.' }); }
    if (!body.data.group_id && (body.data.rows.length !== 1 || body.data.rows[0].cancel && !body.data.rows[0].id)) { await client.query('ROLLBACK'); return res.status(400).json({ message: '개인 신청은 본인 한 명만 등록할 수 있습니다.' }); }
    const existingById = new Map(existing.rows.map((row) => [row.id, row]));
    const poolRows = await client.query(`SELECT DISTINCT po.division_id FROM tournament_pools po JOIN tournament_divisions d ON d.id = po.division_id WHERE d.tournament_id = $1`, [id.data]);
    const pooledDivisions = new Set(poolRows.rows.map((row) => row.division_id));
    const matchRows = await client.query(`SELECT DISTINCT m.division_id FROM tournament_matches m JOIN tournament_divisions d ON d.id = m.division_id WHERE d.tournament_id = $1`, [id.data]);
    const matchedDivisions = new Set(matchRows.rows.map((row) => row.division_id));
    const otherActive = await client.query(`SELECT p.id, p.member_id, p.pre_member_id, p.division_id, p.source_group_id, p.name FROM tournament_participants p JOIN tournament_divisions d ON d.id = p.division_id WHERE d.tournament_id = $1 AND p.status IN ('applied', 'confirmed') AND NOT (p.id = ANY($2::uuid[]))`, [id.data, incomingIds]);
    for (const row of body.data.rows) {
      const saved = row.id ? existingById.get(row.id) : null;
      if (row.id && !saved) { await client.query('ROLLBACK'); return res.status(409).json({ message: '신청 명단이 변경되었습니다.' }); }
      if (!body.data.group_id) {
        if (row.member_id && row.member_id !== userId || row.pre_member_id) { await client.query('ROLLBACK'); return res.status(403).json({ message: '본인만 개인 신청할 수 있습니다.' }); }
      } else if (!saved && row.pre_member_id) {
        const member = await client.query(`SELECT linked_user_id FROM group_pre_members WHERE id = $1 AND group_id = $2 AND status = 'active'`, [row.pre_member_id, body.data.group_id]);
        if (!member.rowCount || row.member_id && member.rows[0].linked_user_id !== row.member_id) { await client.query('ROLLBACK'); return res.status(400).json({ message: '클럽 사전등록 명단이 변경되었습니다.' }); }
        row.member_id = member.rows[0].linked_user_id;
      } else if (!saved && row.member_id) {
        const member = await client.query('SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2', [body.data.group_id, row.member_id]);
        if (!member.rowCount) { await client.query('ROLLBACK'); return res.status(400).json({ message: '클럽 회원 명단이 변경되었습니다.' }); }
      }
      if (saved && ((row.member_id ?? null) !== saved.member_id || (row.pre_member_id ?? null) !== saved.pre_member_id)) { await client.query('ROLLBACK'); return res.status(400).json({ message: '기존 참가자의 연결 계정을 바꿀 수 없습니다.' }); }
      if (!saved && !row.cancel && (pooledDivisions.has(row.division_id) || matchedDivisions.has(row.division_id))) { await client.query('ROLLBACK'); return res.status(409).json({ message: '조 또는 경기가 생성된 부문에는 참가자를 추가할 수 없습니다.' }); }
      if (saved && saved.division_id !== row.division_id && (pooledDivisions.has(saved.division_id) || pooledDivisions.has(row.division_id) || matchedDivisions.has(saved.division_id) || matchedDivisions.has(row.division_id))) { await client.query('ROLLBACK'); return res.status(409).json({ message: '조 또는 경기가 생성된 참가자는 부문을 바꿀 수 없습니다.' }); }
      if (row.cancel && saved) {
        const completed = await client.query(`SELECT 1 FROM tournament_matches WHERE (participant_a_id = $1 OR participant_b_id = $1) AND (status = 'completed' OR score_a IS NOT NULL OR score_b IS NOT NULL) LIMIT 1`, [saved.id]);
        if (!canCancelParticipantWithResults(completed.rowCount > 0)) { await client.query('ROLLBACK'); return res.status(409).json({ message: '결과가 기록된 참가자는 이 화면에서 취소할 수 없습니다.' }); }
      }
    }
    const proposed = body.data.rows.filter((row) => !row.cancel);
    const canceledRows = body.data.rows.filter((row) => row.cancel && row.id);
    if (newRows.some((row) => canceledRows.some((old) => old.division_id === row.division_id && ((row.member_id && old.member_id === row.member_id) || (row.pre_member_id && old.pre_member_id === row.pre_member_id))))) { await client.query('ROLLBACK'); return res.status(409).json({ message: '같은 부문에서 참가자를 취소하고 다시 추가할 수 없습니다. 기존 행을 수정해주세요.' }); }
    const previousRows = await client.query(`SELECT p.division_id, p.member_id, p.pre_member_id FROM tournament_participants p JOIN tournament_divisions d ON d.id = p.division_id WHERE d.tournament_id = $1 AND p.status IN ('withdrawn', 'rejected')`, [id.data]);
    if (newRows.some((row) => previousRows.rows.some((saved) => saved.division_id === row.division_id && ((row.member_id && saved.member_id === row.member_id) || (row.pre_member_id && saved.pre_member_id === row.pre_member_id))))) { await client.query('ROLLBACK'); return res.status(409).json({ message: '이 부문에서 이미 처리된 신청이 있습니다. 주최자에게 문의해주세요.' }); }
    const identityKeys = proposed.map((row) => row.member_id ? `user:${row.member_id}` : row.pre_member_id ? `pre:${row.pre_member_id}` : `manual:${body.data.group_id}:${row.division_id}:${row.name}`);
    if (new Set(identityKeys).size !== identityKeys.length || proposed.some((row) => otherActive.rows.some((saved) => row.member_id ? saved.member_id === row.member_id : row.pre_member_id ? saved.pre_member_id === row.pre_member_id : saved.source_group_id === body.data.group_id && saved.division_id === row.division_id && saved.name === row.name))) { await client.query('ROLLBACK'); return res.status(409).json({ message: '중복된 참가자가 있습니다.' }); }
    const counts = new Map();
    for (const row of otherActive.rows) counts.set(row.division_id, (counts.get(row.division_id) ?? 0) + 1);
    for (const row of proposed) counts.set(row.division_id, (counts.get(row.division_id) ?? 0) + 1);
    if (tournament.recruit_count && [...counts.values()].reduce((sum, count) => sum + count, 0) > tournament.recruit_count || divisions.rows.some((division) => division.recruit_count && (counts.get(division.id) ?? 0) > division.recruit_count)) { await client.query('ROLLBACK'); return res.status(409).json({ message: '모집 인원을 초과했습니다.' }); }
    for (const row of body.data.rows) {
      const saved = row.id ? existingById.get(row.id) : null;
      if (saved && row.cancel) await client.query(`UPDATE tournament_participants SET status = 'withdrawn' WHERE id = $1`, [saved.id]);
      else if (saved && (saved.name !== row.name || saved.member_division !== row.member_division || saved.division_id !== row.division_id)) {
        const status = pooledDivisions.has(saved.division_id) ? saved.status : 'applied';
        await client.query(`UPDATE tournament_participants SET division_id = $1, name = $2, member_division = $3, status = $4 WHERE id = $5`, [row.division_id, row.name, row.member_division, status, saved.id]);
      } else if (!saved) await client.query(`INSERT INTO tournament_participants (division_id, member_id, pre_member_id, source_group_id, name, member_division, status) VALUES ($1, $2, $3, $4, $5, $6, 'applied')`, [row.division_id, body.data.group_id ? row.member_id ?? null : userId, row.pre_member_id ?? null, body.data.group_id, row.name, row.member_division]);
    }
    await client.query('COMMIT');
    return res.json({ message: '신청 명단을 저장했습니다.' });
  } catch (error) { await client.query('ROLLBACK'); console.error('Tournament application roster save error:', error); return res.status(500).json({ message: '신청 명단을 저장할 수 없습니다.' }); }
  finally { client.release(); }
});

router.get('/tournaments/:id/divisions/:divisionId/participants', optionalAuth, async (req, res) => {
  const ids = z.object({ id: z.string().uuid(), divisionId: z.string().uuid() }).safeParse(req.params);
  if (!ids.success) return res.status(400).json({ message: '대회 부문이 올바르지 않습니다.' });
  try {
    const tournament = await canViewTournament(pool, ids.data.id, req.user ? Number(req.user.sub) : null);
    if (!tournament || !await getDivision(pool, ids.data.id, ids.data.divisionId)) return res.status(404).json({ message: '대회 부문을 찾을 수 없습니다.' });
    const found = await pool.query(`SELECT p.id, p.member_id, p.name, p.member_division, p.status, p.source_group_id, COALESCE(g.name, '개인') AS club_name, p.created_at
      FROM tournament_participants p LEFT JOIN groups g ON g.id = p.source_group_id
      WHERE p.division_id = $1 AND p.status IN ('applied', 'confirmed') ORDER BY CASE p.status WHEN 'confirmed' THEN 0 ELSE 1 END, p.created_at, p.id`, [ids.data.divisionId]);
    return res.json({ participants: found.rows });
  } catch (error) { console.error('Tournament participants error:', error); return res.status(500).json({ message: '참가자를 불러올 수 없습니다.' }); }
});

router.post('/tournaments/:id/divisions/:divisionId/applications', requireAuth, async (req, res) => {
  const ids = z.object({ id: z.string().uuid(), divisionId: z.string().uuid() }).safeParse(req.params);
  const body = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('individual'), member_division: z.string().trim().max(40).nullable().optional() }).strict(),
    z.object({ kind: z.literal('club'), group_id: z.string().min(1), members: z.array(z.union([z.object({ member_id: z.number().int().positive() }).strict(), z.object({ pre_member_id: z.string().uuid() }).strict()])).min(1).max(100) }).strict(),
  ]).safeParse(req.body);
  if (!ids.success || !body.success) return res.status(400).json({ message: '참가 신청 정보가 올바르지 않습니다.' });
  const userId = Number(req.user.sub);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tournament = await client.query('SELECT * FROM tournaments WHERE id = $1 FOR UPDATE', [ids.data.id]);
    if (!tournament.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ message: '대회를 찾을 수 없습니다.' }); }
    if (new Date() >= new Date(tournament.rows[0].application_deadline_at ?? tournament.rows[0].starts_at)) { await client.query('ROLLBACK'); return res.status(409).json({ message: '참가 신청이 마감되었습니다. 기존 명단은 대회 시작 전까지 수정할 수 있습니다.' }); }
    const division = await getDivision(client, ids.data.id, ids.data.divisionId, true);
    if (!division) { await client.query('ROLLBACK'); return res.status(404).json({ message: '부문을 찾을 수 없습니다.' }); }
    const hostManager = await hasPremiumSubscription(client, userId) && await canManageHostGroup(client, tournament.rows[0].host_group_id, userId);
    const invited = await client.query(`SELECT ig.group_id FROM tournament_invited_groups ig JOIN group_members gm ON gm.group_id = ig.group_id WHERE ig.tournament_id = $1 AND ig.status = 'accepted' AND gm.user_id = $2`, [ids.data.id, userId]);
    const publicApplication = tournament.rows[0].status === 'open' && tournament.rows[0].premium_visible;
    const invitedApplication = tournament.rows[0].status === 'open' && invited.rowCount > 0;
    if (!hostManager && !publicApplication && !invitedApplication) { await client.query('ROLLBACK'); return res.status(403).json({ message: '참가 신청이 열리지 않았습니다.' }); }
    if (division.status === 'locked' || division.status === 'active' || division.status === 'completed') { await client.query('ROLLBACK'); return res.status(409).json({ message: '조 편성이 확정된 부문은 신청할 수 없습니다.' }); }
    const existingCompetition = await client.query('SELECT 1 FROM tournament_matches WHERE division_id = $1 LIMIT 1', [division.id]);
    if (existingCompetition.rowCount) { await client.query('ROLLBACK'); return res.status(409).json({ message: '경기가 생성된 부문은 신청할 수 없습니다.' }); }
    const entries = [];
    if (body.data.kind === 'individual') {
      const person = await client.query('SELECT id, COALESCE(NULLIF(name, \'\'), NULLIF(nickname, \'\')) AS name FROM users WHERE id = $1 AND deleted_at IS NULL', [userId]);
      if (!person.rows[0]?.name) { await client.query('ROLLBACK'); return res.status(400).json({ message: '회원 이름을 먼저 등록해주세요.' }); }
      entries.push({ member_id: userId, pre_member_id: null, name: person.rows[0].name, member_division: body.data.member_division ?? null, source_group_id: null });
    } else {
      if (!await canManageHostGroup(client, body.data.group_id, userId)) { await client.query('ROLLBACK'); return res.status(403).json({ message: '클럽 리더·운영진만 단체 신청할 수 있습니다.' }); }
      if (!hostManager && !publicApplication && !invited.rows.some((row) => row.group_id === body.data.group_id)) { await client.query('ROLLBACK'); return res.status(403).json({ message: '초대되지 않은 클럽은 신청할 수 없습니다.' }); }
      for (const item of body.data.members) {
        if ('member_id' in item) {
          const member = await client.query(`SELECT gm.user_id, COALESCE(NULLIF(u.name, ''), NULLIF(u.nickname, '')) AS name, gm.division FROM group_members gm JOIN users u ON u.id = gm.user_id WHERE gm.group_id = $1 AND gm.user_id = $2 AND u.deleted_at IS NULL`, [body.data.group_id, item.member_id]);
          if (!member.rows[0]?.name) { await client.query('ROLLBACK'); return res.status(400).json({ message: '클럽 회원 명단이 변경되었습니다.' }); }
          entries.push({ member_id: member.rows[0].user_id, pre_member_id: null, name: member.rows[0].name, member_division: member.rows[0].division, source_group_id: body.data.group_id });
        } else {
          const member = await client.query(`SELECT id, name, division, linked_user_id FROM group_pre_members WHERE id = $1 AND group_id = $2 AND status = 'active'`, [item.pre_member_id, body.data.group_id]);
          if (!member.rows[0]) { await client.query('ROLLBACK'); return res.status(400).json({ message: '클럽 사전등록 명단이 변경되었습니다.' }); }
          entries.push({ member_id: member.rows[0].linked_user_id, pre_member_id: member.rows[0].id, name: member.rows[0].name, member_division: member.rows[0].division, source_group_id: body.data.group_id });
        }
      }
    }
    const identifiers = entries.map((entry) => entry.member_id ? `user:${entry.member_id}` : `pre:${entry.pre_member_id}`);
    if (new Set(identifiers).size !== identifiers.length) { await client.query('ROLLBACK'); return res.status(400).json({ message: '중복된 참가자가 있습니다.' }); }
    const existing = await client.query(`SELECT p.member_id, p.pre_member_id FROM tournament_participants p JOIN tournament_divisions d ON d.id = p.division_id WHERE d.tournament_id = $1 AND p.status IN ('applied', 'confirmed')`, [ids.data.id]);
    if (entries.some((entry) => existing.rows.some((saved) => (entry.member_id && saved.member_id === entry.member_id) || (entry.pre_member_id && saved.pre_member_id === entry.pre_member_id)))) { await client.query('ROLLBACK'); return res.status(409).json({ message: '이미 신청한 참가자가 포함돼 있습니다.' }); }
    const previous = await client.query(`SELECT member_id, pre_member_id FROM tournament_participants WHERE division_id = $1 AND status IN ('withdrawn', 'rejected')`, [division.id]);
    if (entries.some((entry) => previous.rows.some((saved) => (entry.member_id && saved.member_id === entry.member_id) || (entry.pre_member_id && saved.pre_member_id === entry.pre_member_id)))) { await client.query('ROLLBACK'); return res.status(409).json({ message: '이 부문에서 이미 처리된 신청이 있습니다. 주최자에게 문의해주세요.' }); }
    const count = existing.rowCount + entries.length;
    const divisionCount = await client.query(`SELECT COUNT(*)::int AS count FROM tournament_participants WHERE division_id = $1 AND status IN ('applied', 'confirmed')`, [division.id]);
    if ((tournament.rows[0].recruit_count && count > tournament.rows[0].recruit_count) || (division.recruit_count && divisionCount.rows[0].count + entries.length > division.recruit_count)) { await client.query('ROLLBACK'); return res.status(409).json({ message: '모집 인원을 초과했습니다.' }); }
    for (const entry of entries) await client.query(`INSERT INTO tournament_participants (division_id, member_id, pre_member_id, source_group_id, name, member_division, status) VALUES ($1, $2, $3, $4, $5, $6, 'applied')`, [division.id, entry.member_id, entry.pre_member_id, entry.source_group_id, entry.name, entry.member_division]);
    await client.query('COMMIT');
    return res.status(201).json({ count: entries.length });
  } catch (error) { await client.query('ROLLBACK'); console.error('Tournament application error:', error); return res.status(500).json({ message: '참가 신청을 저장할 수 없습니다.' }); }
  finally { client.release(); }
});

router.patch('/tournaments/:id/divisions/:divisionId/applications/:participantId', requireAuth, async (req, res) => {
  const ids = z.object({ id: z.string().uuid(), divisionId: z.string().uuid(), participantId: z.string().uuid() }).safeParse(req.params);
  const body = z.object({ status: z.enum(['confirmed', 'rejected']), confirmation_intent: z.string().optional() }).strict().safeParse(req.body);
  if (!ids.success || !body.success) return res.status(400).json({ message: '참가 확정 정보가 올바르지 않습니다.' });
  if (body.data.status === 'rejected' && body.data.confirmation_intent !== 'REJECT_TOURNAMENT_APPLICATION') return res.status(400).json({ message: '신청 거절 확인이 필요합니다.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query(`SELECT p.id, p.status, t.host_group_id, d.status AS division_status FROM tournament_participants p JOIN tournament_divisions d ON d.id = p.division_id JOIN tournaments t ON t.id = d.tournament_id WHERE t.id = $1 AND d.id = $2 AND p.id = $3 FOR UPDATE OF d, p`, [ids.data.id, ids.data.divisionId, ids.data.participantId]);
    if (!found.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ message: '신청자를 찾을 수 없습니다.' }); }
    const userId = Number(req.user.sub);
    if (!await hasPremiumSubscription(client, userId) || !await canManageHostGroup(client, found.rows[0].host_group_id, userId)) { await client.query('ROLLBACK'); return res.status(403).json({ message: '대회 관리 권한이 필요합니다.' }); }
    if (found.rows[0].status !== 'applied' || found.rows[0].division_status === 'locked') { await client.query('ROLLBACK'); return res.status(409).json({ message: '변경할 수 없는 신청 상태입니다.' }); }
    const existingPools = await client.query('SELECT 1 FROM tournament_pools WHERE division_id = $1 LIMIT 1', [ids.data.divisionId]);
    const existingMatches = await client.query('SELECT 1 FROM tournament_matches WHERE division_id = $1 LIMIT 1', [ids.data.divisionId]);
    if (existingPools.rowCount || existingMatches.rowCount) { await client.query('ROLLBACK'); return res.status(409).json({ message: '조 또는 경기가 생성된 뒤에는 참가자를 변경할 수 없습니다.' }); }
    const updated = await client.query('UPDATE tournament_participants SET status = $1 WHERE id = $2 RETURNING id, status', [body.data.status, ids.data.participantId]);
    await client.query('COMMIT');
    return res.json({ participant: updated.rows[0] });
  } catch (error) { await client.query('ROLLBACK'); console.error('Tournament application review error:', error); return res.status(500).json({ message: '신청 상태를 변경할 수 없습니다.' }); }
  finally { client.release(); }
});

router.get('/tournaments/:id/divisions/:divisionId/pools', optionalAuth, async (req, res) => {
  const ids = z.object({ id: z.string().uuid(), divisionId: z.string().uuid() }).safeParse(req.params);
  if (!ids.success) return res.status(400).json({ message: '대회 부문이 올바르지 않습니다.' });
  try {
    const tournament = await canViewTournament(pool, ids.data.id, req.user ? Number(req.user.sub) : null);
    if (!tournament || !await getDivision(pool, ids.data.id, ids.data.divisionId)) return res.status(404).json({ message: '부문을 찾을 수 없습니다.' });
    const found = await pool.query(`SELECT po.id AS pool_id, po.pool_no, po.round_no, po.bracket_slot, pm.slot_no, p.id AS participant_id, p.name, p.member_division, p.status, p.source_group_id, COALESCE(g.name, '개인') AS club_name
      FROM tournament_pools po JOIN tournament_pool_members pm ON pm.pool_id = po.id JOIN tournament_participants p ON p.id = pm.participant_id LEFT JOIN groups g ON g.id = p.source_group_id
      WHERE po.division_id = $1 ORDER BY po.round_no, po.pool_no, pm.slot_no`, [ids.data.divisionId]);
    const grouped = new Map();
    for (const row of found.rows) {
      if (!grouped.has(row.pool_id)) grouped.set(row.pool_id, { id: row.pool_id, pool_no: row.pool_no, round_no: row.round_no, bracket_slot: row.bracket_slot, members: [] });
      grouped.get(row.pool_id).members.push({ id: row.participant_id, name: row.name, member_division: row.member_division, status: row.status, source_group_id: row.source_group_id, club_name: row.club_name, slot_no: row.slot_no });
    }
    return res.json({ pools: [...grouped.values()] });
  } catch (error) { console.error('Tournament pools error:', error); return res.status(500).json({ message: '조 편성을 불러올 수 없습니다.' }); }
});

router.get('/tournaments/:id/divisions/:divisionId/pools/preview', requireAuth, async (req, res) => {
  const ids = z.object({ id: z.string().uuid(), divisionId: z.string().uuid() }).safeParse(req.params);
  const count = z.coerce.number().int().positive().safeParse(req.query.group_count);
  if (!ids.success || !count.success) return res.status(400).json({ message: '조 개수가 올바르지 않습니다.' });
  try {
    const tournament = await pool.query('SELECT host_group_id FROM tournaments WHERE id = $1', [ids.data.id]);
    const division = await getDivision(pool, ids.data.id, ids.data.divisionId);
    if (!tournament.rowCount || !division) return res.status(404).json({ message: '부문을 찾을 수 없습니다.' });
    if (!['GROUP', 'GROUP_TOURNAMENT'].includes(division.format)) return res.status(409).json({ message: '1라운드가 조별리그인 부문에서만 조를 편성할 수 있습니다.' });
    const userId = Number(req.user.sub);
    if (!await hasPremiumSubscription(pool, userId) || !await canManageHostGroup(pool, tournament.rows[0].host_group_id, userId)) return res.status(403).json({ message: '대회 관리 권한이 필요합니다.' });
    const participants = await pool.query(`SELECT p.id, p.name, p.member_division, p.source_group_id, COALESCE(g.name, '개인') AS club_name FROM tournament_participants p LEFT JOIN groups g ON g.id = p.source_group_id WHERE p.division_id = $1 AND p.status = 'confirmed' ORDER BY p.id`, [ids.data.divisionId]);
    const groups = createTournamentGroups(participants.rows, count.data);
    return res.json({ participant_ids: participants.rows.map((participant) => participant.id), pools: groups });
  } catch (error) {
    if (error.message === 'INVALID_GROUP_COUNT' || error.message === 'GROUP_TOO_LARGE') return res.status(400).json({ message: '조당 2~5명이 되도록 조 개수를 설정해주세요.' });
    console.error('Tournament grouping preview error:', error);
    return res.status(500).json({ message: '조 편성 미리보기를 불러올 수 없습니다.' });
  }
});

router.post('/tournaments/:id/divisions/:divisionId/pools/generate', requireAuth, async (req, res) => {
  const ids = z.object({ id: z.string().uuid(), divisionId: z.string().uuid() }).safeParse(req.params);
  const body = z.object({ group_count: z.number().int().positive(), participant_ids: z.array(z.string().uuid()).min(2) }).strict().safeParse(req.body);
  if (!ids.success || !body.success) return res.status(400).json({ message: '조 개수가 올바르지 않습니다.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tournament = await client.query('SELECT * FROM tournaments WHERE id = $1 FOR UPDATE', [ids.data.id]);
    const division = await getDivision(client, ids.data.id, ids.data.divisionId, true);
    if (!tournament.rowCount || !division) { await client.query('ROLLBACK'); return res.status(404).json({ message: '부문을 찾을 수 없습니다.' }); }
    if (new Date() < new Date(tournament.rows[0].application_deadline_at ?? tournament.rows[0].starts_at)) { await client.query('ROLLBACK'); return res.status(409).json({ message: '참가 신청 마감 후에 조를 편성할 수 있습니다.' }); }
    if (!['GROUP', 'GROUP_TOURNAMENT'].includes(division.format)) { await client.query('ROLLBACK'); return res.status(409).json({ message: '1라운드가 조별리그인 부문에서만 조를 편성할 수 있습니다.' }); }
    const userId = Number(req.user.sub);
    if (!await hasPremiumSubscription(client, userId) || !await canManageHostGroup(client, tournament.rows[0].host_group_id, userId)) { await client.query('ROLLBACK'); return res.status(403).json({ message: '대회 관리 권한이 필요합니다.' }); }
    const existing = await client.query('SELECT 1 FROM tournament_pools WHERE division_id = $1 LIMIT 1', [division.id]);
    const matches = await client.query('SELECT 1 FROM tournament_matches WHERE division_id = $1 LIMIT 1', [division.id]);
    if (!canCreateTournamentGroups({ hasPools: existing.rowCount > 0, hasMatches: matches.rowCount > 0, divisionStatus: division.status })) { await client.query('ROLLBACK'); return res.status(409).json({ message: '이미 조나 경기가 생성된 부문입니다. 기존 조와 결과는 유지됩니다.' }); }
    const pending = await client.query(`SELECT 1 FROM tournament_participants WHERE division_id = $1 AND status = 'applied' LIMIT 1`, [division.id]);
    if (pending.rowCount) { await client.query('ROLLBACK'); return res.status(409).json({ message: '대기 중인 참가 신청을 모두 확정하거나 거절한 뒤 조를 편성해주세요.' }); }
    const participants = await client.query(`SELECT id, name, member_division, source_group_id FROM tournament_participants WHERE division_id = $1 AND status = 'confirmed' ORDER BY id FOR UPDATE`, [division.id]);
    if (participants.rowCount < 2) { await client.query('ROLLBACK'); return res.status(400).json({ message: '확정 참가자가 2명 이상 필요합니다.' }); }
    if (participants.rowCount !== body.data.participant_ids.length || participants.rows.some((participant, index) => participant.id !== body.data.participant_ids[index])) { await client.query('ROLLBACK'); return res.status(409).json({ message: '확정 참가자 명단이 변경되었습니다. 미리보기를 다시 확인해주세요.' }); }
    let groups;
    try { groups = createTournamentGroups(participants.rows, body.data.group_count); }
    catch { await client.query('ROLLBACK'); return res.status(400).json({ message: '조당 2~5명이 되도록 조 개수를 설정해주세요.' }); }
    for (const group of groups) {
      const created = await client.query('INSERT INTO tournament_pools (division_id, round_no, pool_no, bracket_slot) VALUES ($1, 1, $2, $3) RETURNING id', [division.id, group.pool_no, group.bracket_slot]);
      for (const [index, participant] of group.members.entries()) await client.query('INSERT INTO tournament_pool_members (pool_id, participant_id, slot_no) VALUES ($1, $2, $3)', [created.rows[0].id, participant.id, index + 1]);
    }
    await client.query(`UPDATE tournament_divisions SET status = 'locked', updated_at = NOW() WHERE id = $1`, [division.id]);
    await client.query('COMMIT');
    return res.status(201).json({ group_count: groups.length });
  } catch (error) { await client.query('ROLLBACK'); console.error('Tournament grouping error:', error); return res.status(500).json({ message: '조 편성을 저장할 수 없습니다.' }); }
  finally { client.release(); }
});

module.exports = router;
