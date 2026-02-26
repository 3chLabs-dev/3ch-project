const express = require('express');
const bcrypt = require('bcrypt');
const { z } = require('zod');
const pool = require('../db/pool');
const { requireAdmin } = require('../middlewares/auth');
const { signToken } = require('../utils/authUtils');

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
          (SELECT COUNT(*) FROM users WHERE is_admin = false)::int AS member_count,
          0::int                                                    AS withdrawn_count,
          (SELECT COUNT(*) FROM leagues)::int                       AS league_count,
          (SELECT COUNT(*) FROM groups)::int                        AS group_count,
          0::int                                                    AS match_count,
          (SELECT COUNT(*) FROM draws)::int                         AS draw_count,
          0::int                                                    AS payment_count
      `),
      pool.query(`
        WITH dates AS (
          SELECT generate_series(
            CURRENT_DATE - INTERVAL '6 days',
            CURRENT_DATE,
            '1 day'
          )::date AS day
        )
        SELECT
          d.day::text,
          COALESCE((SELECT COUNT(*) FROM users   WHERE is_admin = false AND DATE(created_at) = d.day), 0)::int AS member_cnt,
          COALESCE((SELECT COUNT(*) FROM leagues WHERE DATE(created_at) = d.day), 0)::int AS league_cnt,
          COALESCE((SELECT COUNT(*) FROM groups  WHERE DATE(created_at) = d.day), 0)::int AS group_cnt,
          COALESCE((SELECT COUNT(*) FROM draws   WHERE DATE(created_at) = d.day), 0)::int AS draw_cnt
        FROM dates d
        ORDER BY d.day
      `),
    ]);
    return res.json({ ok: true, stats: totalsResult.rows[0], trend: trendResult.rows });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
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
