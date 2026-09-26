const express = require('express');
const { z } = require('zod');
const pool = require('../db/pool');
const { requireAuth, optionalAuth } = require('../middlewares/auth');
const { canChangeTournamentCompetitionSettings } = require('../utils/tournamentDivisionPolicy');

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

const createSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().nullable().optional(),
  sport: z.string().trim().min(1).max(40).default('탁구'),
  venue_name: z.string().trim().max(120).nullable().optional(),
  venue_address: z.string().trim().nullable().optional(),
  notice: z.string().trim().nullable().optional(),
  starts_at: z.iso.datetime({ offset: true }),
  ends_at: z.iso.datetime({ offset: true }).nullable().optional(),
  host_group_id: z.string().uuid(),
  premium_visible: z.boolean().default(false),
  divisions: z.array(z.object({
    name: z.string().trim().min(1).max(80),
    league_type: z.enum(['SINGLES', 'DOUBLES', 'TEAM']),
    format: z.enum(['LEAGUE', 'GROUP', 'TOURNAMENT', 'GROUP_TOURNAMENT']),
    rules: z.record(z.string(), z.unknown()).default({}),
    recruit_count: z.number().int().positive().nullable().optional(),
  })).min(1),
}).refine((value) => !value.ends_at || value.ends_at >= value.starts_at, { path: ['ends_at'] })
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
         (title, description, sport, venue_name, venue_address, notice, starts_at, ends_at,
          host_group_id, created_by_id, premium_visible)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [data.title, data.description ?? null, data.sport, data.venue_name ?? null,
        data.venue_address ?? null, data.notice ?? null, data.starts_at, data.ends_at ?? null,
        data.host_group_id, userId, data.premium_visible],
    );
    for (const [index, division] of data.divisions.entries()) {
      await client.query(
        `INSERT INTO tournament_divisions (tournament_id, name, sort_order, league_type, format, rules, recruit_count)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
        [created.rows[0].id, division.name, index, division.league_type, division.format,
          JSON.stringify(division.rules), division.recruit_count ?? null],
      );
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
              t.status, t.premium_visible, t.host_group_id
         FROM tournaments t
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
      `SELECT DISTINCT t.*
         FROM tournaments t
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
    return res.json({ tournament: { ...tournament.rows[0], divisions: divisions.rows } });
  } catch (error) {
    console.error('Tournament detail error:', error);
    return res.status(500).json({ message: '대회를 불러올 수 없습니다.' });
  }
});

router.patch('/tournaments/:id/divisions/:divisionId', requireAuth, async (req, res) => {
  const ids = z.object({ id: z.string().uuid(), divisionId: z.string().uuid() }).safeParse(req.params);
  const body = z.object({
    name: z.string().trim().min(1).max(80).optional(),
    league_type: z.enum(['SINGLES', 'DOUBLES', 'TEAM']).optional(),
    format: z.enum(['LEAGUE', 'GROUP', 'TOURNAMENT', 'GROUP_TOURNAMENT']).optional(),
    rules: z.record(z.string(), z.unknown()).optional(),
    recruit_count: z.number().int().positive().nullable().optional(),
  }).refine((value) => Object.keys(value).length > 0).safeParse(req.body);
  if (!ids.success || !body.success) return res.status(400).json({ message: '부문 설정이 올바르지 않습니다.' });
  try {
    const existing = await pool.query(
      `SELECT d.id, t.host_group_id,
              EXISTS (SELECT 1 FROM tournament_matches m WHERE m.division_id = d.id) AS has_matches
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
    if (!canChangeTournamentCompetitionSettings({ hasMatches: existing.rows[0].has_matches, updates: body.data })) {
      return res.status(409).json({ code: 'MATCHES_ALREADY_CREATED', message: '경기가 생성된 부문의 유형·방식·규칙은 변경할 수 없습니다.' });
    }
    const entries = Object.entries(body.data);
    const values = entries.map(([, value]) => typeof value === 'object' && value !== null ? JSON.stringify(value) : value);
    const sets = entries.map(([key], index) => `${key} = $${index + 1}${key === 'rules' ? '::jsonb' : ''}`);
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

module.exports = router;
