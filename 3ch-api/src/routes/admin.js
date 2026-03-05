const express = require('express');
const bcrypt = require('bcrypt');
const { z } = require('zod');
const { randomUUID } = require('crypto');
const pool = require('../db/pool');
const { requireAdmin } = require('../middlewares/auth');
const { signToken } = require('../utils/authUtils');
const { generateMemberCode } = require('../utils/memberCodeUtils');

const router = express.Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /admin/login
router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR' });
  }

  const { email, password } = parsed.data;

  try {
    const result = await pool.query(
      'SELECT id, email, password_hash, name, is_admin FROM users WHERE email = $1',
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

    return res.json({ ok: true, token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

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
        `SELECT u.id, u.member_code, u.email, u.name, u.auth_provider,
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
    return res.json({ ok: true, member: { ...userResult.rows[0], clubs: clubsResult.rows } });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

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

// GET /admin/clubs/:id - 클럽 상세
router.get('/clubs/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const [clubR, membersR] = await Promise.all([
      pool.query(
        `SELECT g.id, g.club_code, g.name, g.sport,
                g.region_city, g.region_district,
                g.founded_at::text, g.address, g.address_detail,
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
    ]);
    if (!clubR.rows[0]) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
    return res.json({ ok: true, club: clubR.rows[0], members: membersR.rows });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// PUT /admin/clubs/:id - 클럽 수정
router.put('/clubs/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, sport, region_city, region_district, founded_at, owner_id } = req.body;
  if (!name?.trim()) return res.status(400).json({ ok: false, error: '클럽명은 필수입니다.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE groups SET name = $1, sport = $2, region_city = $3, region_district = $4, founded_at = $5
       WHERE id = $6`,
      [name.trim(), sport?.trim() || null, region_city?.trim() || null, region_district?.trim() || null, founded_at || null, id],
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

// POST /admin/clubs - 클럽 생성
router.post('/clubs', requireAdmin, async (req, res) => {
  const { name, sport, region_city, region_district, founded_at, address, address_detail, owner_id } = req.body;
  if (!name?.trim()) return res.status(400).json({ ok: false, error: '클럽명은 필수입니다.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const ownerId = owner_id ? Number(owner_id) : null;

    const groupId = randomUUID();
    await client.query(
      `INSERT INTO groups (id, name, sport, region_city, region_district, founded_at, address, address_detail, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [groupId, name.trim(), sport?.trim() || null, region_city?.trim() || null, region_district?.trim() || null, founded_at || null, address?.trim() || null, address_detail?.trim() || null, ownerId],
    );

    if (ownerId) {
      await client.query(
        `INSERT INTO group_members (id, group_id, user_id, role) VALUES ($1, $2, $3, 'owner')`,
        [randomUUID(), groupId, ownerId],
      );
    }

    // club_code 생성: C + YYYYMMDD + 4자리 당일 순번
    const codeResult = await client.query(
      `WITH ranked AS (
         SELECT id,
           'C' || TO_CHAR(created_at, 'YYYYMMDD') ||
           LPAD(ROW_NUMBER() OVER (PARTITION BY DATE(created_at) ORDER BY created_at, id)::text, 4, '0') AS new_code
         FROM groups WHERE DATE(created_at) = CURRENT_DATE
       )
       UPDATE groups SET club_code = r.new_code FROM ranked r
       WHERE groups.id = r.id AND groups.id = $1
       RETURNING club_code`,
      [groupId],
    );
    const clubCode = codeResult.rows[0]?.club_code;

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

// GET /admin/leagues - 리그 목록 (필터 + 페이지네이션)
router.get('/leagues', requireAdmin, async (req, res) => {
  const { code, sport, club, type, creator, league_from, league_to, from, to } = req.query;
  const page   = Math.max(1, parseInt(req.query.page  || '1',  10));
  const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];

  if (code)        { conditions.push(`l.id = $${params.push(code)}`); }
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
        `SELECT l.id, l.name, l.sport, l.type, l.format,
                l.start_date::text, l.created_at::text,
                l.participant_count,
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
                l.sport, l.start_date::text,
                g.name AS club_name,
                u.name AS creator_name,
                COUNT(DISTINCT dp.id)::int AS prize_count
         ${baseFrom}
         LEFT JOIN draw_prizes dp ON dp.draw_id = d.id
         GROUP BY d.id, d.name, d.created_at, l.sport, l.start_date, g.name, u.name
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

// GET /admin/tournaments - 대회 목록 (미구현 - placeholder)
router.get('/tournaments', requireAdmin, async (_req, res) => {
  return res.json({ ok: true, tournaments: [], total: 0, page: 1, limit: 20 });
});

// GET /admin/me - 어드민 본인 확인
router.get('/me', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, is_admin FROM users WHERE id = $1',
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

module.exports = router;
