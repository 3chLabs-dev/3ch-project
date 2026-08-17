const express = require('express');
const bcrypt = require('bcrypt');
const { z } = require('zod');
const { randomUUID } = require('crypto');
const pool = require('../db/pool');
const { requireAdmin } = require('../middlewares/auth');
const { signToken } = require('../utils/authUtils');
const { generateMemberCode } = require('../utils/memberCodeUtils');
const { generateClubCode } = require('../utils/clubCodeUtils');
const { getPointRanking } = require('../services/pointRanking');
const { getGroupRanking } = require('../services/groupRanking');
const { getSportRanking } = require('../services/sportRanking');

const router = express.Router();

const QUOTA_FEATURES = new Set([
  "CLUB_CREATE",
  "CLUB_JOIN",
  "LEAGUE_CREATE",
  "TOURNAMENT_CREATE",
  "EVENT_JOIN",
  "VISION_SCAN",
  "DRAW_CREATE",
  "PREMIUM_PROMOTION",
]);
const PRICING_FEATURE_KEYS = [
  "club_create",
  "club_join",
  "league_create",
  "tournament_create",
  "event_join",
  "vision_scan",
  "draw_create",
  "premium_promotion",
];

async function assertMaster(req, res) {
  const result = await pool.query(
    "SELECT email, is_admin, system_role FROM users WHERE id = $1 AND deleted_at IS NULL",
    [Number(req.user.sub)],
  );
  const user = result.rows[0];
  const email = String(user?.email || "").trim().toLowerCase();
  const isMasterAccount = user?.system_role === "MASTER"
    || (user?.is_admin && ["admin@3ch.com", "3chlabs@gmail.com"].includes(email));
  if (!isMasterAccount) {
    res.status(403).json({ ok: false, error: "MASTER_REQUIRED" });
    return false;
  }
  return true;
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * @openapi
 * /api/admin/login:
 *   post:
 *     summary: 관리자 로그인
 *     tags: [관리자]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: 로그인 성공, JWT 토큰 반환
 *       400:
 *         description: 유효성 검사 실패
 *       401:
 *         description: 잘못된 자격증명
 *       403:
 *         description: 관리자 권한 없음
 */
// POST /admin/login
router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR' });
  }

  const { email, password } = parsed.data;

  try {
    const result = await pool.query(
      'SELECT id, email, password_hash, name, is_admin, system_role FROM users WHERE email = $1',
      [email],
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ ok: false, error: 'INVALID_CREDENTIALS' });
    }

    const user = result.rows[0];

    if (!user.is_admin) {
      return res.status(403).json({ ok: false, error: 'NOT_ADMIN' });
    }

    if (!user.password_hash) {
      return res.status(401).json({ ok: false, error: 'NO_LOCAL_PASSWORD' });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ ok: false, error: 'INVALID_CREDENTIALS' });
    }

    const token = signToken({ id: user.id, email: user.email });

    return res.json({ ok: true, token, user: { id: user.id, email: user.email, name: user.name, system_role: user.system_role } });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

/**
 * @openapi
 * /api/admin/stats:
 *   get:
 *     summary: 대시보드 통계 조회
 *     tags: [관리자]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 전체 통계(회원수, 리그수 등) 및 최근 8주 주간 추세 반환
 *       401:
 *         description: 인증 실패
 */
// GET /admin/stats - 대시보드 통계
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const [totalsResult, trendResult] = await Promise.all([
      pool.query(`
        SELECT
          (SELECT COUNT(*) FROM users WHERE is_admin = false AND deleted_at IS NULL)::int     AS member_count,
          (SELECT COUNT(*) FROM users WHERE is_admin = false AND deleted_at IS NOT NULL)::int AS withdrawn_count,
          (SELECT COUNT(*) FROM leagues)::int                       AS league_count,
          (SELECT COUNT(*) FROM groups)::int                        AS group_count,
          0::int                                                    AS match_count,
          (SELECT COUNT(*) FROM draws)::int                         AS draw_count,
          0::int                                                    AS payment_count
      `),
      pool.query(`
        WITH weeks AS (
          SELECT generate_series(
            date_trunc('week', CURRENT_DATE) - INTERVAL '7 weeks',
            date_trunc('week', CURRENT_DATE),
            '1 week'
          )::date AS week_start
        )
        SELECT
          w.week_start::text,
          COALESCE((SELECT COUNT(*) FROM users   WHERE is_admin = false AND created_at >= w.week_start AND created_at < w.week_start + INTERVAL '7 days'), 0)::int AS member_cnt,
          COALESCE((SELECT COUNT(*) FROM users   WHERE is_admin = false AND deleted_at  >= w.week_start AND deleted_at  < w.week_start + INTERVAL '7 days'), 0)::int AS withdrawn_cnt,
          COALESCE((SELECT COUNT(*) FROM leagues WHERE created_at >= w.week_start AND created_at < w.week_start + INTERVAL '7 days'), 0)::int AS league_cnt,
          COALESCE((SELECT COUNT(*) FROM groups  WHERE created_at >= w.week_start AND created_at < w.week_start + INTERVAL '7 days'), 0)::int AS group_cnt,
          COALESCE((SELECT COUNT(*) FROM draws   WHERE created_at >= w.week_start AND created_at < w.week_start + INTERVAL '7 days'), 0)::int AS draw_cnt
        FROM weeks w
        ORDER BY w.week_start
      `),
    ]);
    return res.json({ ok: true, stats: totalsResult.rows[0], trend: trendResult.rows });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

/**
 * @openapi
 * /api/admin/members:
 *   get:
 *     summary: 회원 목록 조회 (필터 + 페이지네이션)
 *     tags: [관리자]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: name
 *         schema: { type: string }
 *       - in: query
 *         name: email
 *         schema: { type: string }
 *       - in: query
 *         name: code
 *         schema: { type: integer }
 *         description: 회원 ID
 *       - in: query
 *         name: sport
 *         schema: { type: string }
 *       - in: query
 *         name: club
 *         schema: { type: string }
 *       - in: query
 *         name: role
 *         schema: { type: string }
 *       - in: query
 *         name: grade
 *         schema: { type: string }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, withdrawn] }
 *     responses:
 *       200:
 *         description: 회원 목록 및 페이지 정보 반환
 *       401:
 *         description: 인증 실패
 */
// GET /admin/members - 회원 목록 (필터 + 페이지네이션)
router.get('/members', requireAdmin, async (req, res) => {
  const { code, sport, club, role, email, grade, name, from, to, status } = req.query;
  const page   = Math.max(1, parseInt(req.query.page  || '1',  10));
  const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
  const offset = (page - 1) * limit;

  const conditions = ['u.is_admin = false'];
  const params = [];

  if (code)  { conditions.push(`u.id = $${params.push(parseInt(code, 10))}`); }
  if (sport) { conditions.push(`g.sport ILIKE $${params.push(`%${sport}%`)}`); }
  if (club)  { conditions.push(`g.name ILIKE $${params.push(`%${club}%`)}`); }
  if (role)  { conditions.push(`gm.role = $${params.push(role)}`); }
  if (email) { conditions.push(`u.email ILIKE $${params.push(`%${email}%`)}`); }
  if (grade) { conditions.push(`gm.division ILIKE $${params.push(`%${grade}%`)}`); }
  if (name)  { conditions.push(`u.name ILIKE $${params.push(`%${name}%`)}`); }
  if (from)  { conditions.push(`u.created_at >= $${params.push(from)}`); }
  if (to)    { conditions.push(`u.created_at < ($${params.push(to)}::date + interval '1 day')`); }
  if (status === 'active')    { conditions.push('u.deleted_at IS NULL'); }
  if (status === 'withdrawn') { conditions.push('u.deleted_at IS NOT NULL'); }

  const baseFrom = `
    FROM users u
    LEFT JOIN LATERAL (
      SELECT gm2.role, gm2.division, gm2.group_id
      FROM group_members gm2
      WHERE gm2.user_id = u.id
      ORDER BY gm2.joined_at DESC
      LIMIT 1
    ) gm ON true
    LEFT JOIN groups g ON g.id = gm.group_id
    WHERE ${conditions.join(' AND ')}
  `;

  try {
    const countParams = [...params];
    const limitIdx  = params.push(limit);
    const offsetIdx = params.push(offset);

    const [dataResult, countResult] = await Promise.all([
      pool.query(
        `SELECT u.id, u.member_code, u.email, u.name, u.auth_provider, u.system_role,
                u.created_at::text, u.deleted_at::text,
                gm.role, gm.division AS grade,
                g.name AS club_name, g.sport,
                (SELECT COUNT(*)::int FROM group_members WHERE user_id = u.id) AS club_count
         ${baseFrom}
         ORDER BY u.created_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        params,
      ),
      pool.query(`SELECT COUNT(*)::int AS total ${baseFrom}`, countParams),
    ]);

    return res.json({
      ok: true,
      members: dataResult.rows,
      total: countResult.rows[0].total,
      page,
      limit,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

/**
 * @openapi
 * /api/admin/members/search:
 *   get:
 *     summary: 회원 검색 (이름/이메일)
 *     tags: [관리자]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: name
 *         schema: { type: string }
 *       - in: query
 *         name: email
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, maximum: 50 }
 *     responses:
 *       200:
 *         description: 검색된 회원 목록 반환
 *       401:
 *         description: 인증 실패
 */
// GET /admin/members/search - 회원 검색 (이름/이메일 분리, 페이지네이션)
router.get('/members/search', requireAdmin, async (req, res) => {
  const { name, email, page = '1', limit = '10' } = req.query;
  const pageNum  = Math.max(1, parseInt(page,  10) || 1);
  const limitNum = Math.min(50, parseInt(limit, 10) || 10);
  const offset   = (pageNum - 1) * limitNum;

  const conditions = ['is_admin = false', 'deleted_at IS NULL'];
  const params = [];
  if (name?.trim())  { params.push(`%${name.trim()}%`);  conditions.push(`name  ILIKE $${params.length}`); }
  if (email?.trim()) { params.push(`%${email.trim()}%`); conditions.push(`email ILIKE $${params.length}`); }

  const where = conditions.join(' AND ');
  try {
    const [dataR, countR] = await Promise.all([
      pool.query(
        `SELECT id, name, email FROM users WHERE ${where} ORDER BY name LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limitNum, offset],
      ),
      pool.query(`SELECT COUNT(*)::int AS total FROM users WHERE ${where}`, params),
    ]);
    return res.json({ ok: true, members: dataR.rows, total: countR.rows[0].total });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

/**
 * @openapi
 * /api/admin/members/{id}:
 *   get:
 *     summary: 회원 상세 조회
 *     tags: [관리자]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 회원 정보 및 소속 클럽 목록 반환
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: 회원 없음
 */
// GET /admin/members/:id - 회원 상세
router.get('/members/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const [userResult, clubsResult] = await Promise.all([
      pool.query(
        `SELECT u.id, u.member_code, u.email, u.name, u.auth_provider,
                u.created_at::text, u.deleted_at::text
         FROM users u
         WHERE u.id = $1 AND u.is_admin = false`,
        [id],
      ),
      pool.query(
        `SELECT gm.group_id::text, gm.role, gm.division AS grade,
                gm.joined_at::text,
                g.name AS club_name, g.sport
         FROM group_members gm
         JOIN groups g ON g.id = gm.group_id
         WHERE gm.user_id = $1
         ORDER BY gm.joined_at DESC`,
        [id],
      ),
    ]);
    if (userResult.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
    }
    const creditResult = await pool.query(
      `SELECT feature,
              BOOL_OR(remaining_amount IS NULL) AS unlimited,
              COALESCE(SUM(remaining_amount) FILTER (WHERE remaining_amount IS NOT NULL), 0)::int AS remaining,
              MAX(expires_at)::text AS expires_at
         FROM feature_credit_buckets
        WHERE user_id = $1
          AND starts_at <= NOW()
          AND (expires_at IS NULL OR expires_at > NOW())
        GROUP BY feature`,
      [id],
    );
    return res.json({
      ok: true,
      member: { ...userResult.rows[0], clubs: clubsResult.rows, feature_credits: creditResult.rows },
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

/**
 * @openapi
 * /api/admin/members/{id}:
 *   put:
 *     summary: 회원 정보 수정
 *     tags: [관리자]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               group_id:
 *                 type: string
 *               role:
 *                 type: string
 *               grade:
 *                 type: string
 *     responses:
 *       200:
 *         description: 수정 완료
 *       401:
 *         description: 인증 실패
 */
// PUT /admin/members/:id - 회원 정보 수정
router.put('/members/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { name, group_id, role, grade } = req.body;
  try {
    if (name !== undefined) {
      await pool.query('UPDATE users SET name = $1 WHERE id = $2', [name, id]);
    }
    if (group_id) {
      const existing = await pool.query(
        'SELECT 1 FROM group_members WHERE user_id = $1 AND group_id = $2',
        [id, group_id],
      );
      if (existing.rowCount > 0) {
        await pool.query(
          'UPDATE group_members SET role = $1, division = $2 WHERE user_id = $3 AND group_id = $4',
          [role || 'member', grade || null, id, group_id],
        );
      } else {
        await pool.query(
          `INSERT INTO group_members (group_id, user_id, role, division, joined_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          [group_id, id, role || 'member', grade || null],
        );
      }
    }
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// PUT /admin/members/:id/system-role - 마스터 전용 시스템 역할 변경
router.put('/members/:id/system-role', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const systemRole = String(req.body?.system_role || "").toUpperCase();
  if (!Number.isFinite(id) || !["USER", "MANAGER"].includes(systemRole)) {
    return res.status(400).json({ ok: false, error: "INVALID_SYSTEM_ROLE" });
  }
  try {
    if (!(await assertMaster(req, res))) return;
    const result = await pool.query(
      `UPDATE users
          SET system_role = $1
        WHERE id = $2
          AND deleted_at IS NULL
          AND system_role <> 'MASTER'
        RETURNING id, system_role`,
      [systemRole, id],
    );
    if (result.rowCount === 0) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    return res.json({ ok: true, member: result.rows[0] });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// POST /admin/members/:id/feature-grants - 마스터 전용 기능 횟수 지급
router.post('/members/:id/feature-grants', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const expiresAt = new Date(req.body?.expires_at);
  const grants = req.body?.grants;
  if (!Number.isFinite(id) || Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date() || !grants || typeof grants !== "object") {
    return res.status(400).json({ ok: false, error: "INVALID_GRANT" });
  }

  const normalized = Object.entries(grants)
    .filter(([feature]) => QUOTA_FEATURES.has(feature))
    .map(([feature, amount]) => [feature, Number(amount)])
    .filter(([, amount]) => Number.isInteger(amount) && amount > 0 && amount <= 100000);
  if (normalized.length === 0) {
    return res.status(400).json({ ok: false, error: "EMPTY_GRANT" });
  }

  const client = await pool.connect();
  try {
    if (!(await assertMaster(req, res))) return;
    await client.query("BEGIN");
    const target = await client.query(
      "SELECT system_role FROM users WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
      [id],
    );
    if (target.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }
    if (target.rows[0].system_role !== "MANAGER") {
      await client.query("ROLLBACK");
      return res.status(409).json({ ok: false, error: "MANAGER_REQUIRED" });
    }

    const batchRef = `manager-grant:${id}:${Date.now()}:${randomUUID()}`;
    for (const [feature, amount] of normalized) {
      await client.query(
        `INSERT INTO feature_credit_buckets
           (user_id, feature, source, initial_amount, remaining_amount, starts_at, expires_at, source_ref, granted_by_id)
         VALUES ($1, $2, 'MANAGER_GRANT', $3, $3, NOW(), $4, $5, $6)`,
        [id, feature, amount, expiresAt, `${batchRef}:${feature}`, Number(req.user.sub)],
      );
    }
    await client.query("COMMIT");
    return res.json({ ok: true });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  } finally {
    client.release();
  }
});

// POST /admin/members/:id/reset-password - 임시 비밀번호 발급 및 강제 재설정
router.post('/members/:id/reset-password', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ ok: false, error: 'INVALID_MEMBER_ID' });
  }

  try {
    const tempPassword = `Wr${Math.floor(100000 + Math.random() * 900000)}!`;
    const hash = await bcrypt.hash(tempPassword, 12);
    const result = await pool.query(
      `UPDATE users
          SET password_hash = $1,
              password_reset_required = true
        WHERE id = $2
          AND is_admin = false
          AND deleted_at IS NULL
          AND auth_provider = 'local'
        RETURNING id`,
      [hash, id],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
    }
    return res.json({ ok: true, tempPassword });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

/**
 * @openapi
 * /api/admin/members/{id}/club:
 *   delete:
 *     summary: 회원 클럽 강퇴
 *     tags: [관리자]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [group_id]
 *             properties:
 *               group_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: 강퇴 완료
 *       400:
 *         description: group_id 누락 또는 클럽장 강퇴 불가
 *       401:
 *         description: 인증 실패
 */
// DELETE /admin/members/:id/club - 클럽 강퇴 (클럽장은 강퇴 불가)
router.delete('/members/:id/club', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { group_id } = req.body;
  if (!group_id) return res.status(400).json({ ok: false, error: 'group_id required' });

  try {
    const roleRow = await pool.query(
      'SELECT role FROM group_members WHERE user_id = $1 AND group_id = $2',
      [id, group_id],
    );
    const role = roleRow.rows[0]?.role;

    if (role === 'owner') {
      return res.status(400).json({ ok: false, error: '클럽 리더는 강퇴가 불가합니다.' });
    }

    // 일반 강퇴 → group_members에서만 제거
    await pool.query(
      'DELETE FROM group_members WHERE user_id = $1 AND group_id = $2',
      [id, group_id],
    );

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

/**
 * @openapi
 * /api/admin/members/{id}:
 *   delete:
 *     summary: 회원 계정 삭제
 *     tags: [관리자]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 삭제 완료
 *       401:
 *         description: 인증 실패
 */
// DELETE /admin/members/:id - 계정 삭제
router.delete('/members/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  try {
    await pool.query('DELETE FROM users WHERE id = $1 AND is_admin = false', [id]);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

/**
 * @openapi
 * /api/admin/members:
 *   post:
 *     summary: 회원 신규 추가
 *     tags: [관리자]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, name]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               name:
 *                 type: string
 *               group_id:
 *                 type: string
 *               role:
 *                 type: string
 *               grade:
 *                 type: string
 *     responses:
 *       201:
 *         description: 회원 생성 완료, 임시 비밀번호 포함
 *       400:
 *         description: 필수 필드 누락
 *       401:
 *         description: 인증 실패
 *       409:
 *         description: 이메일 중복
 */
// POST /admin/members - 회원 신규 추가
router.post('/members', requireAdmin, async (req, res) => {
  const { email, name, group_id, role, grade } = req.body;
  if (!email || !name) {
    return res.status(400).json({ ok: false, error: 'MISSING_FIELDS' });
  }
  try {
    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rowCount > 0) {
      return res.status(409).json({ ok: false, error: 'EMAIL_EXISTS' });
    }
    // 임시비밀번호 자동생성: 8자리 숫자 + @
    const tempPassword = String(Math.floor(10000000 + Math.random() * 90000000)) + '@';
    const hash = await bcrypt.hash(tempPassword, 12);
    const memberCode = await generateMemberCode();

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, auth_provider, member_code)
       VALUES ($1, $2, $3, 'local', $4) RETURNING id, email, name, member_code, created_at`,
      [email, hash, name, memberCode],
    );
    const newUser = result.rows[0];

    // 클럽 선택 시 group_members에 바로 등록
    if (group_id) {
      const memberRole = role || 'member';
      await pool.query(
        `INSERT INTO group_members (group_id, user_id, role, division, joined_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (group_id, user_id) DO NOTHING`,
        [group_id, newUser.id, memberRole, grade || null],
      );
    }

    return res.status(201).json({ ok: true, member: newUser, tempPassword });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

/**
 * @openapi
 * /api/admin/clubs-list:
 *   get:
 *     summary: 클럽 드롭다운용 전체 목록
 *     tags: [관리자]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: sport
 *         schema: { type: string }
 *         description: 종목 필터
 *     responses:
 *       200:
 *         description: 클럽 id/name/sport 목록 반환
 *       401:
 *         description: 인증 실패
 */
// GET /admin/clubs-list - 클럽 드롭다운용 전체 목록
router.get('/clubs-list', requireAdmin, async (req, res) => {
  const { sport } = req.query;
  try {
    const conditions = sport ? [`g.sport ILIKE $1`] : [];
    const params = sport ? [`%${sport}%`] : [];
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT g.id, g.name, g.sport FROM groups g ${where} ORDER BY g.name`,
      params,
    );
    return res.json({ ok: true, clubs: result.rows });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

router.get('/rankings/points', requireAdmin, async (req, res) => {
  const groupId = String(req.query.group_id ?? '').trim();
  const scope = req.query.scope === 'national' ? 'national' : 'club';
  const year = req.query.year ? Number(req.query.year) : undefined;
  const seasonId = req.query.season_id ? String(req.query.season_id) : undefined;

  if (!groupId) {
    return res.status(400).json({ ok: false, error: 'GROUP_ID_REQUIRED' });
  }

  try {
    const data = await getPointRanking(groupId, year, scope, seasonId);
    if (!data) {
      return res.status(404).json({ ok: false, error: 'GROUP_NOT_FOUND' });
    }

    return res.json({
      ok: true,
      ...data,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

router.get('/rankings/ratings', requireAdmin, async (req, res) => {
  const scope = req.query.scope === 'national' ? 'national' : 'club';
  const groupId = String(req.query.group_id ?? '').trim();
  const sport = String(req.query.sport ?? '').trim();

  try {
    if (scope === 'club') {
      if (!groupId) {
        return res.status(400).json({ ok: false, error: 'GROUP_ID_REQUIRED' });
      }

      const data = await getGroupRanking(groupId);
      if (!data) {
        return res.status(404).json({ ok: false, error: 'GROUP_NOT_FOUND' });
      }

      return res.json({
        ok: true,
        scope,
        group: data.group,
        summary: data.summary,
        rankings: data.rankings,
      });
    }

    if (!sport) {
      return res.status(400).json({ ok: false, error: 'SPORT_REQUIRED' });
    }

    const data = await getSportRanking(sport, null);
    if (!data) {
      return res.status(404).json({ ok: false, error: 'SPORT_RANKING_NOT_FOUND' });
    }

    return res.json({
      ok: true,
      scope,
      sport: data.sport,
      summary: data.summary,
      rankings: data.rankings,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

/**
 * @openapi
 * /api/admin/clubs:
 *   get:
 *     summary: 클럽 목록 조회 (필터 + 페이지네이션)
 *     tags: [관리자]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: code
 *         schema: { type: string }
 *         description: 클럽 코드
 *       - in: query
 *         name: sport
 *         schema: { type: string }
 *       - in: query
 *         name: city
 *         schema: { type: string }
 *       - in: query
 *         name: district
 *         schema: { type: string }
 *       - in: query
 *         name: club
 *         schema: { type: string }
 *         description: 클럽명
 *       - in: query
 *         name: leader
 *         schema: { type: string }
 *         description: 클럽장 이름
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: 클럽 목록 및 페이지 정보 반환
 *       401:
 *         description: 인증 실패
 */
// GET /admin/clubs - 클럽 목록 (필터 + 페이지네이션)
router.get('/clubs', requireAdmin, async (req, res) => {
  const { code, sport, city, district, club, leader, from, to } = req.query;
  const page   = Math.max(1, parseInt(req.query.page  || '1',  10));
  const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];

  if (code)     { conditions.push(`g.club_code ILIKE $${params.push(`%${code}%`)}`); }
  if (sport)    { conditions.push(`g.sport ILIKE $${params.push(`%${sport}%`)}`); }
  if (city)     { conditions.push(`g.region_city ILIKE $${params.push(`%${city}%`)}`); }
  if (district) { conditions.push(`g.region_district ILIKE $${params.push(`%${district}%`)}`); }
  if (club)     { conditions.push(`g.name ILIKE $${params.push(`%${club}%`)}`); }
  if (leader)   { conditions.push(`u.name ILIKE $${params.push(`%${leader}%`)}`); }
  if (from)     { conditions.push(`g.created_at >= $${params.push(from)}`); }
  if (to)       { conditions.push(`g.created_at < ($${params.push(to)}::date + interval '1 day')`); }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const baseFrom = `
    FROM groups g
    LEFT JOIN users u ON u.id = g.created_by_id::integer
    ${whereClause}
  `;

  try {
    const countParams = [...params];
    const limitIdx  = params.push(limit);
    const offsetIdx = params.push(offset);

    const [dataResult, countResult] = await Promise.all([
      pool.query(
        `SELECT g.id, g.club_code, g.name, g.sport,
                g.region_city, g.region_district,
                g.founded_at::text,
                g.created_at::text,
                u.id AS leader_id, u.name AS leader_name
         ${baseFrom}
         ORDER BY g.created_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        params,
      ),
      pool.query(`SELECT COUNT(*)::int AS total ${baseFrom}`, countParams),
    ]);

    return res.json({
      ok: true,
      clubs: dataResult.rows,
      total: countResult.rows[0].total,
      page,
      limit,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

/**
 * @openapi
 * /api/admin/clubs/{id}:
 *   get:
 *     summary: 클럽 상세 조회
 *     tags: [관리자]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: 클럽 정보 및 멤버 목록 반환
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: 클럽 없음
 */
// GET /admin/clubs/:id - 클럽 상세
router.get('/clubs/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const [clubR, membersR, linksR] = await Promise.all([
      pool.query(
        `SELECT g.id, g.club_code, g.name, g.sport,
                g.region_city, g.region_district,
                g.founded_at::text, g.address, g.address_detail, g.description,
                g.created_at::text,
                u.id AS leader_id, u.name AS leader_name, u.email AS leader_email
         FROM groups g
         LEFT JOIN users u ON u.id = g.created_by_id::integer
         WHERE g.id = $1`,
        [id],
      ),
      pool.query(
        `SELECT gm.user_id, gm.role, gm.joined_at::text,
                u.name, u.email, u.member_code
         FROM group_members gm
         JOIN users u ON u.id = gm.user_id
         WHERE gm.group_id = $1
         ORDER BY CASE gm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, u.name`,
        [id],
      ),

      pool.query(
        `SELECT id, group_id, label, url, sort_order, created_at::text, updated_at::text
         FROM group_links
         WHERE group_id = $1
         ORDER BY sort_order ASC, created_at ASC`,
        [id],
      ),
    ]);
    if (!clubR.rows[0]) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
    return res.json({ ok: true, club: clubR.rows[0], members: membersR.rows, links: linksR.rows, });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

/**
 * @openapi
 * /api/admin/clubs/{id}:
 *   put:
 *     summary: 클럽 정보 수정
 *     tags: [관리자]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *               sport:
 *                 type: string
 *               region_city:
 *                 type: string
 *               region_district:
 *                 type: string
 *               founded_at:
 *                 type: string
 *                 format: date
 *               address:
 *                 type: string
 *               address_detail:
 *                 type: string
 *               description:
 *                 type: string
 *               owner_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: 수정 완료
 *       400:
 *         description: 클럽명 필수
 *       401:
 *         description: 인증 실패
 *       409:
 *         description: 클럽명 중복
 */
// PUT /admin/clubs/:id - 클럽 수정
router.put('/clubs/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, sport, region_city, region_district, founded_at, address, address_detail, description, owner_id, links, } = req.body;
  if (!name?.trim()) return res.status(400).json({ ok: false, error: '클럽명은 필수입니다.' });

  const hasLinks = Array.isArray(links);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE groups SET name = $1, sport = $2, region_city = $3, region_district = $4, founded_at = $5,
              address = $6, address_detail = $7, description = $8
       WHERE id = $9`,
      [name.trim(), sport?.trim() || null, region_city?.trim() || null, region_district?.trim() || null, founded_at || null,
       address?.trim() || null, address_detail?.trim() || null, description?.trim() || null, id],
    );

    if (owner_id) {
      const newOwnerId = Number(owner_id);
      // 기존 owner → member 강등
      await client.query(
        `UPDATE group_members SET role = 'member' WHERE group_id = $1 AND role = 'owner'`,
        [id],
      );
      // 신규 owner 업서트
      await client.query(
        `INSERT INTO group_members (id, group_id, user_id, role)
         VALUES ($1, $2, $3, 'owner')
         ON CONFLICT (group_id, user_id) DO UPDATE SET role = 'owner'`,
        [randomUUID(), id, newOwnerId],
      );
      await client.query(`UPDATE groups SET created_by_id = $1 WHERE id = $2`, [newOwnerId, id]);
    }

    // 클럽 URL 수정
    if (hasLinks) {
      await client.query(
        `DELETE FROM group_links
         WHERE group_id = $1`,
        [id],
      );

      for (const [index, link] of links.entries()) {
        if (!link.url || !link.url.trim()) continue;

        await client.query(
          `INSERT INTO group_links
           (id, group_id, label, url, sort_order)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            randomUUID(),
            id,
            link.label?.trim() || null,
            link.url.trim(),
            link.sort_order ?? index + 1,
          ],
        );
      }
    }

    await client.query('COMMIT');
    return res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.code === '23505') return res.status(409).json({ ok: false, error: '이미 사용 중인 클럽명입니다.' });
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  } finally {
    client.release();
  }
});

/**
 * @openapi
 * /api/admin/clubs/{id}:
 *   delete:
 *     summary: 클럽 강제 삭제 (관련 데이터 일괄 삭제)
 *     tags: [관리자]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: 삭제 완료
 *       401:
 *         description: 인증 실패
 */
// DELETE /admin/clubs/:id - 클럽 강제 삭제 (모든 관련 데이터 삭제)
router.delete('/clubs/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // 리그 관련 데이터 삭제
    const leagueIds = (await client.query(`SELECT id FROM leagues WHERE group_id = $1`, [id])).rows.map((r) => r.id);
    if (leagueIds.length) {
      await client.query(`DELETE FROM draws              WHERE league_id = ANY($1)`, [leagueIds]);
      await client.query(`DELETE FROM league_participants WHERE league_id = ANY($1)`, [leagueIds]);
      await client.query(`DELETE FROM league_matches     WHERE league_id = ANY($1)`, [leagueIds]);
      await client.query(`DELETE FROM leagues            WHERE id        = ANY($1)`, [leagueIds]);
    }
    await client.query(`DELETE FROM group_members WHERE group_id = $1`, [id]);
    await client.query(`DELETE FROM groups         WHERE id      = $1`, [id]);
    await client.query('COMMIT');
    return res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  } finally {
    client.release();
  }
});

/**
 * @openapi
 * /api/admin/clubs/check-name:
 *   get:
 *     summary: 클럽명 중복 확인
 *     tags: [관리자]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: name
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: excludeId
 *         schema: { type: string }
 *         description: 수정 시 자기 자신 제외
 *     responses:
 *       200:
 *         description: available 여부 반환
 *       400:
 *         description: 클럽명 누락
 *       401:
 *         description: 인증 실패
 */
// GET /admin/clubs/check-name - 클럽명 중복검사 (excludeId: 수정 시 자기 자신 제외)
router.get('/clubs/check-name', requireAdmin, async (req, res) => {
  const { name, excludeId } = req.query;
  if (!name?.trim()) return res.status(400).json({ ok: false, error: '클럽명을 입력하세요.' });
  try {
    const r = excludeId
      ? await pool.query('SELECT id FROM groups WHERE name = $1 AND id <> $2', [name.trim(), excludeId])
      : await pool.query('SELECT id FROM groups WHERE name = $1', [name.trim()]);
    return res.json({ ok: true, available: r.rowCount === 0 });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

/**
 * @openapi
 * /api/admin/clubs:
 *   post:
 *     summary: 클럽 생성
 *     tags: [관리자]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *               sport:
 *                 type: string
 *               region_city:
 *                 type: string
 *               region_district:
 *                 type: string
 *               founded_at:
 *                 type: string
 *                 format: date
 *               address:
 *                 type: string
 *               address_detail:
 *                 type: string
 *               description:
 *                 type: string
 *               owner_id:
 *                 type: integer
 *     responses:
 *       201:
 *         description: 클럽 생성 완료, 클럽 id 및 club_code 반환
 *       400:
 *         description: 클럽명 필수
 *       401:
 *         description: 인증 실패
 *       409:
 *         description: 클럽명 중복
 */
// POST /admin/clubs - 클럽 생성
router.post('/clubs', requireAdmin, async (req, res) => {
  const { name, sport, region_city, region_district, founded_at, address, address_detail, description, owner_id } = req.body;
  if (!name?.trim()) return res.status(400).json({ ok: false, error: '클럽명은 필수입니다.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const ownerId = owner_id ? Number(owner_id) : null;

    const groupId = randomUUID();
    await client.query(
      `INSERT INTO groups (id, name, sport, region_city, region_district, founded_at, address, address_detail, description, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [groupId, name.trim(), sport?.trim() || null, region_city?.trim() || null, region_district?.trim() || null, founded_at || null, address?.trim() || null, address_detail?.trim() || null, description?.trim() || null, ownerId],
    );

    if (ownerId) {
      await client.query(
        `INSERT INTO group_members (id, group_id, user_id, role) VALUES ($1, $2, $3, 'owner')`,
        [randomUUID(), groupId, ownerId],
      );
    }

    const clubCode = await generateClubCode(client);
    await client.query(`UPDATE groups SET club_code = $1 WHERE id = $2`, [clubCode, groupId]);

    await client.query('COMMIT');
    return res.status(201).json({ ok: true, id: groupId, club_code: clubCode });
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.code === '23505') return res.status(409).json({ ok: false, error: '이미 사용 중인 클럽명입니다.' });
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  } finally {
    client.release();
  }
});

/**
 * @openapi
 * /api/admin/leagues:
 *   get:
 *     summary: 리그 목록 조회 (필터 + 페이지네이션)
 *     tags: [관리자]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: code
 *         schema: { type: string }
 *         description: 리그 ID
 *       - in: query
 *         name: sport
 *         schema: { type: string }
 *       - in: query
 *         name: club
 *         schema: { type: string }
 *       - in: query
 *         name: type
 *         schema: { type: string }
 *       - in: query
 *         name: creator
 *         schema: { type: string }
 *       - in: query
 *         name: league_from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: league_to
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *         description: 생성일 시작
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *         description: 생성일 종료
 *     responses:
 *       200:
 *         description: 리그 목록 및 페이지 정보 반환
 *       401:
 *         description: 인증 실패
 */
// GET /admin/leagues - 리그 목록 (필터 + 페이지네이션)
router.get('/leagues', requireAdmin, async (req, res) => {
  const { code, sport, club, type, creator, league_from, league_to, from, to } = req.query;
  const page   = Math.max(1, parseInt(req.query.page  || '1',  10));
  const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];

  if (code)        { conditions.push(`l.league_code ILIKE $${params.push(`%${code}%`)}`); }
  if (sport)       { conditions.push(`l.sport ILIKE $${params.push(`%${sport}%`)}`); }
  if (club)        { conditions.push(`g.name ILIKE $${params.push(`%${club}%`)}`); }
  if (type)        { conditions.push(`l.type = $${params.push(type)}`); }
  if (creator)     { conditions.push(`u.name ILIKE $${params.push(`%${creator}%`)}`); }
  if (league_from) { conditions.push(`l.start_date >= $${params.push(league_from)}`); }
  if (league_to)   { conditions.push(`l.start_date <= $${params.push(league_to)}`); }
  if (from)        { conditions.push(`l.created_at >= $${params.push(from)}`); }
  if (to)          { conditions.push(`l.created_at < ($${params.push(to)}::date + interval '1 day')`); }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const baseFrom = `
    FROM leagues l
    LEFT JOIN users u ON u.id = l.created_by_id
    LEFT JOIN groups g ON g.id = l.group_id
    ${whereClause}
  `;

  try {
    const countParams = [...params];
    const limitIdx  = params.push(limit);
    const offsetIdx = params.push(offset);

    const [dataResult, countResult] = await Promise.all([
      pool.query(
        `SELECT l.id, l.league_code, l.name, l.sport, l.type, l.format, l.title, l.description,
                l.start_date::text, l.end_date::text, l.court_count, l.created_at::text,
                l.venue_name, l.venue_address, l.venue_region_city, l.venue_region_district,
                l.participant_count, l.visibility, l.premium_enabled,
                l.premium_started_at::text, l.premium_expires_at::text,
                u.id AS creator_id, u.name AS creator_name,
                g.name AS club_name
         ${baseFrom}
         ORDER BY l.created_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        params,
      ),
      pool.query(`SELECT COUNT(*)::int AS total ${baseFrom}`, countParams),
    ]);

    return res.json({
      ok: true,
      leagues: dataResult.rows,
      total: countResult.rows[0].total,
      page,
      limit,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

router.patch('/leagues/:id/premium', requireAdmin, async (req, res) => {
  const parsed = z.object({ enabled: z.boolean() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR' });
  try {
    const result = await pool.query(
      `UPDATE leagues
          SET premium_enabled=$1,
              visibility=CASE WHEN $1 THEN 'public' ELSE visibility END,
              premium_started_at=CASE WHEN $1 THEN COALESCE(premium_started_at, NOW()) ELSE premium_started_at END,
              premium_expires_at=CASE WHEN $1 THEN COALESCE(end_date, start_date + INTERVAL '30 days') ELSE NOW() END,
              updated_at=NOW()
        WHERE id=$2
        RETURNING id, visibility, premium_enabled, premium_started_at, premium_expires_at`,
      [parsed.data.enabled, req.params.id],
    );
    if (!result.rowCount) return res.status(404).json({ ok: false, error: 'LEAGUE_NOT_FOUND' });
    return res.json({ ok: true, league: result.rows[0] });
  } catch (error) {
    console.error('admin league premium update error:', error);
    return res.status(500).json({ ok: false, error: 'DB_ERROR' });
  }
});

/**
 * @openapi
 * /api/admin/draws:
 *   get:
 *     summary: 추첨 목록 조회 (필터 + 페이지네이션)
 *     tags: [관리자]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: code
 *         schema: { type: string }
 *         description: 추첨 ID
 *       - in: query
 *         name: sport
 *         schema: { type: string }
 *       - in: query
 *         name: club
 *         schema: { type: string }
 *       - in: query
 *         name: creator
 *         schema: { type: string }
 *       - in: query
 *         name: league_from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: league_to
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: event_from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: event_to
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: 추첨 목록 및 페이지 정보 반환
 *       401:
 *         description: 인증 실패
 */
// GET /admin/draws - 추첨 목록 (필터 + 페이지네이션)
router.get('/draws', requireAdmin, async (req, res) => {
  const { code, sport, club, creator, league_from, league_to, event_from, event_to, from, to } = req.query;
  const page   = Math.max(1, parseInt(req.query.page  || '1',  10));
  const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];

  if (code)        { conditions.push(`d.id = $${params.push(code)}`); }
  if (sport)       { conditions.push(`l.sport ILIKE $${params.push(`%${sport}%`)}`); }
  if (club)        { conditions.push(`g.name ILIKE $${params.push(`%${club}%`)}`); }
  if (creator)     { conditions.push(`u.name ILIKE $${params.push(`%${creator}%`)}`); }
  if (league_from) { conditions.push(`l.start_date >= $${params.push(league_from)}`); }
  if (league_to)   { conditions.push(`l.start_date <= $${params.push(league_to)}`); }
  if (event_from)  { conditions.push(`d.created_at >= $${params.push(event_from)}`); }
  if (event_to)    { conditions.push(`d.created_at < ($${params.push(event_to)}::date + interval '1 day')`); }
  if (from)        { conditions.push(`d.created_at >= $${params.push(from)}`); }
  if (to)          { conditions.push(`d.created_at < ($${params.push(to)}::date + interval '1 day')`); }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const baseFrom = `
    FROM draws d
    LEFT JOIN leagues l ON l.id = d.league_id
    LEFT JOIN groups g ON g.id = l.group_id
    LEFT JOIN users u ON u.id = d.created_by_id
    ${whereClause}
  `;

  try {
    const countParams = [...params];
    const limitIdx  = params.push(limit);
    const offsetIdx = params.push(offset);

    const [dataResult, countResult] = await Promise.all([
      pool.query(
        `SELECT d.id, d.name, d.created_at::text,
                l.sport, l.start_date::text, l.title,
                g.name AS club_name,
                u.name AS creator_name,
                COUNT(DISTINCT dp.id)::int AS prize_count
         ${baseFrom}
         LEFT JOIN draw_prizes dp ON dp.draw_id = d.id
         GROUP BY d.id, d.name, d.created_at, l.sport, l.start_date, g.name, u.name, l.title
         ORDER BY d.created_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        params,
      ),
      pool.query(`SELECT COUNT(*)::int AS total ${baseFrom}`, countParams),
    ]);

    return res.json({
      ok: true,
      draws: dataResult.rows,
      total: countResult.rows[0].total,
      page,
      limit,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

/**
 * @openapi
 * /api/admin/tournaments:
 *   get:
 *     summary: 대회 목록 조회 (미구현 - placeholder)
 *     tags: [관리자]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 빈 목록 반환 (미구현)
 *       401:
 *         description: 인증 실패
 */
// GET /admin/tournaments - 대회 목록 (미구현 - placeholder)
router.get('/tournaments', requireAdmin, async (_req, res) => {
  return res.json({ ok: true, tournaments: [], total: 0, page: 1, limit: 20 });
});

/**
 * @openapi
 * /api/admin/me:
 *   get:
 *     summary: 관리자 본인 정보 확인
 *     tags: [관리자]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 관리자 사용자 정보 반환
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: 사용자 없음
 */
// GET /admin/me - 어드민 본인 확인
router.get('/me', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, is_admin, system_role FROM users WHERE id = $1',
      [Number(req.user.sub)],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'USER_NOT_FOUND' });
    }
    return res.json({ ok: true, user: result.rows[0] });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});


const pricingPlanSchema = z.object({
  code: z.string().trim().min(1).max(30).transform((value) => value.toLowerCase()),
  name: z.string().trim().min(1).max(50),
  badge_text: z.string().trim().max(50).nullable().optional(),
  price: z.coerce.number().int().min(0).max(100000000),
  original_price: z.coerce.number().int().min(0).max(100000000).nullable().optional(),
  billing_cycle: z.enum(["MONTHLY", "YEARLY"]),
  sale_start_at: z.string().datetime().nullable().optional(),
  sale_end_at: z.string().datetime().nullable().optional(),
  features: z.array(z.string().trim().min(1).max(200)).max(50),
  feature_limits: z.object(Object.fromEntries(
    PRICING_FEATURE_KEYS.map((key) => [key, z.number().int().min(0).max(100000).nullable()]),
  )),
  display_order: z.coerce.number().int().min(0).max(9999),
  is_visible: z.boolean(),
});

const tokenPackageSchema = z.object({
  code: z.string().trim().max(40).transform((value) => value.toLowerCase()).optional(),
  name: z.string().trim().min(1).max(80),
  price: z.coerce.number().int().min(1).max(100000000),
  credits: z.object(Object.fromEntries(
    PRICING_FEATURE_KEYS.map((key) => [key, z.coerce.number().int().min(0).max(100000).optional()]),
  )),
  display_order: z.coerce.number().int().min(0).max(9999),
  is_visible: z.boolean(),
});

router.get('/token-packages', requireAdmin, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM token_packages ORDER BY display_order ASC, id ASC`,
    );
    return res.json({ ok: true, packages: result.rows });
  } catch (error) {
    console.error('admin token packages lookup error:', error);
    return res.status(500).json({ ok: false, error: 'DB_ERROR' });
  }
});

router.post('/token-packages', requireAdmin, async (req, res) => {
  if (!(await assertMaster(req, res))) return;
  const parsed = tokenPackageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
  }
  const value = parsed.data;
  const packageCode = value.code || `token_${Date.now()}_${randomUUID().slice(0, 8)}`;
  try {
    const result = await pool.query(
      `INSERT INTO token_packages (code, name, price, credits, display_order, is_visible)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6)
       RETURNING *`,
      [packageCode, value.name, value.price, JSON.stringify(value.credits),
       value.display_order, value.is_visible],
    );
    return res.status(201).json({ ok: true, package: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ ok: false, error: 'DUPLICATE_PACKAGE_CODE' });
    console.error('admin token package insert error:', error);
    return res.status(500).json({ ok: false, error: 'DB_ERROR' });
  }
});

router.put('/token-packages/:id', requireAdmin, async (req, res) => {
  if (!(await assertMaster(req, res))) return;
  const parsed = tokenPackageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
  }
  const value = parsed.data;
  try {
    const result = await pool.query(
      `UPDATE token_packages
          SET code=$1, name=$2, price=$3, credits=$4::jsonb,
              display_order=$5, is_visible=$6, updated_at=NOW()
        WHERE id=$7 RETURNING *`,
      [value.code, value.name, value.price, JSON.stringify(value.credits),
       value.display_order, value.is_visible, Number(req.params.id)],
    );
    if (!result.rowCount) return res.status(404).json({ ok: false, error: 'TOKEN_PACKAGE_NOT_FOUND' });
    return res.json({ ok: true, package: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ ok: false, error: 'DUPLICATE_PACKAGE_CODE' });
    console.error('admin token package update error:', error);
    return res.status(500).json({ ok: false, error: 'DB_ERROR' });
  }
});

router.delete('/token-packages/:id', requireAdmin, async (req, res) => {
  if (!(await assertMaster(req, res))) return;
  try {
    const result = await pool.query(
      `UPDATE token_packages SET is_visible=false, updated_at=NOW()
        WHERE id=$1 RETURNING id`,
      [Number(req.params.id)],
    );
    if (!result.rowCount) return res.status(404).json({ ok: false, error: 'TOKEN_PACKAGE_NOT_FOUND' });
    return res.json({ ok: true });
  } catch (error) {
    console.error('admin token package delete error:', error);
    return res.status(500).json({ ok: false, error: 'DB_ERROR' });
  }
});

router.get('/pricing-plans', requireAdmin, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM pricing_plans ORDER BY display_order ASC, id ASC`,
    );
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    return res.json({ ok: true, plans: result.rows });
  } catch (error) {
    console.error('admin pricing plans lookup error:', error);
    return res.status(500).json({ ok: false, error: 'DB_ERROR' });
  }
});

router.post('/pricing-plans', requireAdmin, async (req, res) => {
  if (!(await assertMaster(req, res))) return;
  const parsed = pricingPlanSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
  const value = parsed.data;
  if (value.sale_start_at && value.sale_end_at && new Date(value.sale_start_at) > new Date(value.sale_end_at)) {
    return res.status(400).json({ ok: false, error: 'INVALID_SALE_PERIOD' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO pricing_plans
        (code, name, badge_text, price, original_price, billing_cycle, sale_start_at, sale_end_at, features, feature_limits, display_order, is_visible)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12)
       RETURNING *`,
      [value.code, value.name, value.badge_text || null, value.price, value.original_price ?? null,
       value.billing_cycle, value.sale_start_at ?? null, value.sale_end_at ?? null,
       JSON.stringify(value.features), JSON.stringify(value.feature_limits), value.display_order, value.is_visible],
    );
    return res.status(201).json({ ok: true, plan: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ ok: false, error: 'DUPLICATE_PLAN_CODE' });
    console.error('admin pricing plan insert error:', error);
    return res.status(500).json({ ok: false, error: 'DB_ERROR' });
  }
});

router.put('/pricing-plans/:id', requireAdmin, async (req, res) => {
  if (!(await assertMaster(req, res))) return;
  const parsed = pricingPlanSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
  const value = parsed.data;
  if (value.sale_start_at && value.sale_end_at && new Date(value.sale_start_at) > new Date(value.sale_end_at)) {
    return res.status(400).json({ ok: false, error: 'INVALID_SALE_PERIOD' });
  }
  try {
    const result = await pool.query(
      `UPDATE pricing_plans SET
        code=$1, name=$2, badge_text=$3, price=$4, original_price=$5, billing_cycle=$6,
        sale_start_at=$7, sale_end_at=$8, features=$9::jsonb, feature_limits=$10::jsonb,
        display_order=$11, is_visible=$12, updated_at=NOW()
       WHERE id=$13 RETURNING *`,
      [value.code, value.name, value.badge_text || null, value.price, value.original_price ?? null,
       value.billing_cycle, value.sale_start_at ?? null, value.sale_end_at ?? null,
       JSON.stringify(value.features), JSON.stringify(value.feature_limits),
       value.display_order, value.is_visible, Number(req.params.id)],
    );
    if (!result.rowCount) return res.status(404).json({ ok: false, error: 'PLAN_NOT_FOUND' });
    return res.json({ ok: true, plan: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ ok: false, error: 'DUPLICATE_PLAN_CODE' });
    console.error('admin pricing plan update error:', error);
    return res.status(500).json({ ok: false, error: 'DB_ERROR' });
  }
});

router.delete('/pricing-plans/:id', requireAdmin, async (req, res) => {
  if (!(await assertMaster(req, res))) return;
  try {
    const result = await pool.query('DELETE FROM pricing_plans WHERE id = $1 RETURNING id', [Number(req.params.id)]);
    if (!result.rowCount) return res.status(404).json({ ok: false, error: 'PLAN_NOT_FOUND' });
    return res.json({ ok: true });
  } catch (error) {
    console.error('admin pricing plan delete error:', error);
    return res.status(500).json({ ok: false, error: 'DB_ERROR' });
  }
});

// GET /admin/payments - subscription and token payment history
router.get('/payments', requireAdmin, async (req, res) => {
  const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit || '20'), 10) || 20));
  const offset = (page - 1) * limit;
  const search = String(req.query.search || '').trim();
  const status = String(req.query.status || '').trim().toUpperCase();
  const conditions = [];
  const params = [];
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(p.name ILIKE $${params.length} OR p.email ILIKE $${params.length} OR p.order_id ILIKE $${params.length})`);
  }
  if (status) {
    params.push(status);
    conditions.push(`p.status = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const paymentSource = `
    SELECT s.id::text AS id, s.plan, s.order_id, s.amount, s.status,
           s.started_at AS starts_at, s.expires_at, s.created_at,
           u.id AS user_id, u.name, u.email, 'SUBSCRIPTION'::text AS purchase_type
      FROM subscriptions s
      JOIN users u ON u.id = s.user_id
    UNION ALL
    SELECT tp.id::text AS id, pkg.name AS plan, tp.order_id, tp.amount, tp.status,
           tp.created_at AS starts_at, tp.expires_at, tp.created_at,
           u.id AS user_id, u.name, u.email, 'TOKEN'::text AS purchase_type
      FROM token_purchases tp
      JOIN token_packages pkg ON pkg.id = tp.package_id
      JOIN users u ON u.id = tp.user_id`;
  try {
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM (${paymentSource}) p
       ${where}`,
      params,
    );
    const rowsResult = await pool.query(
      `SELECT p.*
       FROM (${paymentSource}) p
       ${where}
       ORDER BY p.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );
    return res.json({
      ok: true,
      payments: rowsResult.rows,
      total: countResult.rows[0]?.total ?? 0,
      pagination: { page, limit, total: countResult.rows[0]?.total ?? 0 },
    });
  } catch (error) {
    console.error('admin payment history lookup error:', error);
    return res.status(500).json({ ok: false, error: 'DB_ERROR' });
  }
});

// GET /admin/feature-usage - master-only quota balances and audit history
router.get('/feature-usage', requireAdmin, async (req, res) => {
  if (!(await assertMaster(req, res))) return;

  const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit || '20'), 10) || 20));
  const offset = (page - 1) * limit;
  const search = String(req.query.search || '').trim();
  const feature = String(req.query.feature || '').trim().toUpperCase();
  const action = String(req.query.action || '').trim().toUpperCase();

  if (feature && !QUOTA_FEATURES.has(feature)) {
    return res.status(400).json({ ok: false, error: 'INVALID_FEATURE' });
  }

  const conditions = [];
  const params = [];
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
  }
  if (feature) {
    params.push(feature);
    conditions.push(`e.feature = $${params.length}`);
  }
  if (action) {
    params.push(action);
    conditions.push(`e.action = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const countParams = [...params];
    const limitIndex = params.push(limit);
    const offsetIndex = params.push(offset);
    const [eventsResult, countResult, bucketsResult, monthlySummaryResult] = await Promise.all([
      pool.query(
        `SELECT e.id, e.user_id, e.feature, e.action, e.amount,
                e.reference_type, e.reference_id, e.metadata, e.created_at::text,
                u.name, u.email, u.system_role,
                b.source AS bucket_source
           FROM feature_usage_events e
           JOIN users u ON u.id = e.user_id
           LEFT JOIN feature_credit_buckets b ON b.id = e.credit_bucket_id
           ${where}
          ORDER BY e.created_at DESC
          LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
        params,
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total
           FROM feature_usage_events e
           JOIN users u ON u.id = e.user_id
           ${where}`,
        countParams,
      ),
      pool.query(
        `SELECT b.id, b.user_id, b.feature, b.source, b.initial_amount,
                b.remaining_amount, b.starts_at::text, b.expires_at::text,
                b.created_at::text, u.name, u.email, u.system_role,
                granter.name AS granted_by_name
           FROM feature_credit_buckets b
           JOIN users u ON u.id = b.user_id
           LEFT JOIN users granter ON granter.id = b.granted_by_id
          WHERE b.starts_at <= NOW()
            AND (b.expires_at IS NULL OR b.expires_at > NOW())
            AND (b.remaining_amount IS NULL OR b.remaining_amount > 0)
            AND ($1::text = '' OR u.name ILIKE ('%' || $1 || '%') OR u.email ILIKE ('%' || $1 || '%'))
            AND ($2::text = '' OR b.feature = $2)
          ORDER BY b.expires_at ASC NULLS LAST, b.created_at DESC
          LIMIT 500`,
        [search, feature],
      ),
      pool.query(
        `SELECT feature,
                COALESCE(SUM(amount) FILTER (WHERE action = 'CONSUME'), 0)::int AS consumed,
                COALESCE(SUM(amount) FILTER (WHERE action = 'REFUND'), 0)::int AS refunded,
                (
                  COALESCE(SUM(amount) FILTER (WHERE action = 'CONSUME'), 0)
                  - COALESCE(SUM(amount) FILTER (WHERE action = 'REFUND'), 0)
                )::int AS net_used
           FROM feature_usage_events
          WHERE created_at >= DATE_TRUNC('month', NOW())
            AND created_at < DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
          GROUP BY feature`,
      ),
    ]);

    return res.json({
      ok: true,
      events: eventsResult.rows,
      buckets: bucketsResult.rows,
      monthly_summary: monthlySummaryResult.rows,
      total: countResult.rows[0]?.total || 0,
      page,
      limit,
    });
  } catch (error) {
    console.error('admin feature usage list error:', error);
    return res.status(500).json({ ok: false, error: 'DB_ERROR' });
  }
});

// POST /admin/members/:id/feature-adjustments - master-only manual credit grant
router.post('/members/:id/feature-adjustments', requireAdmin, async (req, res) => {
  if (!(await assertMaster(req, res))) return;

  const userId = Number(req.params.id);
  const feature = String(req.body?.feature || '').toUpperCase();
  const amount = Number(req.body?.amount);
  const expiresAt = new Date(req.body?.expires_at);
  const reason = String(req.body?.reason || '').trim().slice(0, 200);
  if (
    !Number.isInteger(userId) ||
    !QUOTA_FEATURES.has(feature) ||
    !Number.isInteger(amount) ||
    amount < 1 ||
    amount > 100000 ||
    Number.isNaN(expiresAt.getTime()) ||
    expiresAt <= new Date()
  ) {
    return res.status(400).json({ ok: false, error: 'INVALID_ADJUSTMENT' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const target = await client.query(
      `SELECT id, system_role
         FROM users
        WHERE id = $1 AND deleted_at IS NULL
        FOR UPDATE`,
      [userId],
    );
    if (!target.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
    }
    if (target.rows[0].system_role === 'MASTER') {
      await client.query('ROLLBACK');
      return res.status(409).json({ ok: false, error: 'MASTER_UNLIMITED' });
    }

    const sourceRef = `manual-grant:${userId}:${Date.now()}:${randomUUID()}`;
    const bucketResult = await client.query(
      `INSERT INTO feature_credit_buckets
         (user_id, feature, source, initial_amount, remaining_amount,
          starts_at, expires_at, source_ref, granted_by_id)
       VALUES ($1, $2, 'MANUAL', $3, $3, NOW(), $4, $5, $6)
       RETURNING id`,
      [userId, feature, amount, expiresAt, sourceRef, Number(req.user.sub)],
    );
    await client.query(
      `INSERT INTO feature_usage_events
         (user_id, feature, action, amount, credit_bucket_id, reference_type, reference_id, metadata)
       VALUES ($1, $2, 'GRANT', $3, $4, 'ADMIN_ADJUSTMENT', $5, $6::jsonb)`,
      [userId, feature, amount, bucketResult.rows[0].id, sourceRef, JSON.stringify({ reason: reason || null })],
    );
    await client.query('COMMIT');
    return res.json({ ok: true, bucket_id: bucketResult.rows[0].id });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('admin feature credit grant error:', error);
    return res.status(500).json({ ok: false, error: 'DB_ERROR' });
  } finally {
    client.release();
  }
});

// POST /admin/feature-credit-buckets/:id/revoke - revoke only unused balance
router.post('/feature-credit-buckets/:id/revoke', requireAdmin, async (req, res) => {
  if (!(await assertMaster(req, res))) return;

  const bucketId = String(req.params.id || '');
  const reason = String(req.body?.reason || '').trim().slice(0, 200);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query(
      `SELECT id, user_id, feature, remaining_amount
         FROM feature_credit_buckets
        WHERE id = $1
        FOR UPDATE`,
      [bucketId],
    );
    if (!current.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, error: 'BUCKET_NOT_FOUND' });
    }
    const bucket = current.rows[0];
    if (bucket.remaining_amount === null) {
      await client.query('ROLLBACK');
      return res.status(409).json({ ok: false, error: 'UNLIMITED_BUCKET' });
    }
    const revokedAmount = Number(bucket.remaining_amount);
    if (revokedAmount <= 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ ok: false, error: 'NO_REMAINING_CREDIT' });
    }

    await client.query(
      `UPDATE feature_credit_buckets
          SET remaining_amount = 0, updated_at = NOW()
        WHERE id = $1`,
      [bucketId],
    );
    await client.query(
      `INSERT INTO feature_usage_events
         (user_id, feature, action, amount, credit_bucket_id, reference_type, reference_id, metadata)
       VALUES ($1, $2, 'REVOKE', $3, $4, 'ADMIN_ADJUSTMENT', $4, $5::jsonb)`,
      [
        bucket.user_id,
        bucket.feature,
        revokedAmount,
        bucketId,
        JSON.stringify({ reason: reason || null, revoked_by: Number(req.user.sub) }),
      ],
    );
    await client.query('COMMIT');
    return res.json({ ok: true, revoked_amount: revokedAmount });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('admin feature credit revoke error:', error);
    return res.status(500).json({ ok: false, error: 'DB_ERROR' });
  } finally {
    client.release();
  }
});

module.exports = router;
