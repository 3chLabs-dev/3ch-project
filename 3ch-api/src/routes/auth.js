const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const pool = require("../db/pool");
const { requireAuth } = require("../middlewares/auth");

const router = express.Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(50),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function signToken({ id, email }) {
  return jwt.sign({ sub: String(id), email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: 회원가입
 *     description: 이메일, 비밀번호, 이름으로 로컬 계정을 생성합니다.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: 회원가입 성공. 생성된 사용자 정보를 반환합니다.
 *       400:
 *         description: 입력값 유효성 검사 실패.
 *       409:
 *         description: 이미 존재하는 이메일.
 *       500:
 *         description: 서버 오류.
 */
router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({
        ok: false,
        error: "VALIDATION_ERROR",
        details: parsed.error.issues,
      });
  }

  const { email, password, name } = parsed.data;

  try {
    const exists = await pool.query("select id from users where email = $1", [
      email,
    ]);
    if (exists.rowCount > 0) {
      return res.status(409).json({ ok: false, error: "EMAIL_EXISTS" });
    }

    const password_hash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `insert into users (email, password_hash, name, auth_provider)
       values ($1, $2, $3, 'local')
       returning id, email, name, auth_provider, created_at`,
      [email, password_hash, name],
    );

    const user = result.rows[0];
    return res.status(201).json({ ok: true, user });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: 로그인
 *     description: 이메일과 비밀번호로 로그인하고 JWT를 발급받습니다.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: 로그인 성공. JWT와 사용자 정보를 반환합니다.
 *       400:
 *         description: 입력값 유효성 검사 실패.
 *       401:
 *         description: 잘못된 로그인 정보.
 *       500:
 *         description: 서버 오류.
 */
router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({
        ok: false,
        error: "VALIDATION_ERROR",
        details: parsed.error.issues,
      });
  }

  const { email, password } = parsed.data;

  try {
    const result = await pool.query(
      "select id, email, password_hash, nickname, name, phone, auth_provider from users where email = $1",
      [email],
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ ok: false, error: "INVALID_CREDENTIALS" });
    }

    const user = result.rows[0];

    if (!user.password_hash) {
      return res.status(401).json({ ok: false, error: "NO_LOCAL_PASSWORD" });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ ok: false, error: "INVALID_CREDENTIALS" });
    }

    const token = signToken({ id: user.id, email: user.email });

    // 비번 해시는 절대 반환 금지
    delete user.password_hash;

    return res.json({ ok: true, token, user });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: 내 정보 확인
 *     description: 현재 로그인된 사용자의 정보를 반환합니다.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공. 사용자 정보를 반환합니다.
 *       401:
 *         description: 인증 토큰이 없거나 유효하지 않음.
 *       404:
 *         description: 사용자를 찾을 수 없음.
 *       500:
 *         description: 서버 오류.
 */
router.get("/me", requireAuth, async (req, res) => {
  const userId = Number(req.user.sub);
  if (!Number.isFinite(userId)) {
    return res.status(401).json({ ok: false, error: "BAD_TOKEN_SUB" });
  }

  try {
    const result = await pool.query(
      "select id, email, nickname, name, phone, auth_provider, created_at from users where id = $1",
      [userId],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });
    }
    return res.json({ ok: true, user: result.rows[0] });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

module.exports = router;
