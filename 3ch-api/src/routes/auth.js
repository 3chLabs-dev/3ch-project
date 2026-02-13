const express = require("express");
const bcrypt = require("bcrypt");
const { z } = require("zod");
const pool = require("../db/pool");
const { requireAuth } = require("../middlewares/auth");
const passport = require("passport"); // Import passport

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

const verifyPasswordSchema = z.object({
  password: z.string().min(1),
});

const { signToken, signSignupTicket, verifyToken } = require("../utils/authUtils");

/**
 * @openapi
 * tags:
 *   name: Auth
 *   description: 인증 및 회원 관리 API - 회원가입, 로그인, 소셜 로그인 등
 */

// Google Social Login
/**
 * @openapi
 * /auth/google:
 *   get:
 *     summary: Google 소셜 로그인 시작
 *     description: Google 계정을 사용하여 로그인 또는 회원가입을 시작합니다.
 *     tags: [Auth]
 *     responses:
 *       302:
 *         description: Google 인증 페이지로 리디렉션.
 *       500:
 *         description: 서버 오류.
 */
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  }),
);

/**
 * @openapi
 * /auth/google/callback:
 *   get:
 *     summary: Google 소셜 로그인 콜백
 *     description: Google 인증 후 콜백을 처리하고 JWT를 발급합니다.
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         required: true
 *         description: Google 인증 코드.
 *     responses:
 *       302:
 *         description: JWT 토큰을 포함하여 프론트엔드로 리디렉션합니다.
 *         headers:
 *           Location:
 *             schema:
 *               type: string
 *               example: http://localhost:3000/auth/success?token=your.jwt.token
 *       401:
 *         description: 인증 실패.
 *       500:
 *         description: 서버 오류.
 */
router.get("/google/callback", (req, res, next) => {
  passport.authenticate("google", { session: false }, (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      const reason = info?.message || "LOGIN_FAILED";
      return res.redirect(
        `${process.env.FRONTEND_URL}/auth/fail?reason=${encodeURIComponent(reason)}`,
      );
    }
    if (!user.name) {
      const ticket = signSignupTicket({ id: user.id, email: user.email });
      return res.redirect(
        `${process.env.FRONTEND_URL}/auth/success?signup=1&ticket=${ticket}`,
      );
    }
    const token = signToken({
      id: user.id,
      email: user.email,
    });

    return res.redirect(
      `${process.env.FRONTEND_URL}/auth/success?token=${token}`,
    );
  })(req, res, next);
});

// Kakao Social Login
/**
 * @openapi
 * /auth/kakao:
 *   get:
 *     summary: Kakao 소셜 로그인 시작
 *     description: Kakao 계정을 사용하여 로그인 또는 회원가입을 시작합니다.
 *     tags: [Auth]
 *     responses:
 *       302:
 *         description: Kakao 인증 페이지로 리디렉션.
 *       500:
 *         description: 서버 오류.
 */
router.get("/kakao", passport.authenticate("kakao", { session: false }));

/**
 * @openapi
 * /auth/kakao/callback:
 *   get:
 *     summary: Kakao 소셜 로그인 콜백
 *     description: Kakao 인증 후 콜백을 처리하고 JWT를 발급합니다.
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         required: true
 *         description: Kakao 인증 코드.
 *     responses:
 *       302:
 *         description: JWT 토큰을 포함하여 프론트엔드로 리디렉션합니다.
 *         headers:
 *           Location:
 *             schema:
 *               type: string
 *               example: http://localhost:3000/auth/success?token=your.jwt.token
 *       401:
 *         description: 인증 실패.
 *       500:
 *         description: 서버 오류.
 */
router.get("/kakao/callback", (req, res, next) => {
  passport.authenticate("kakao", { session: false }, (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      const reason = info?.message || "LOGIN_FAILED";
      return res.redirect(
        `${process.env.FRONTEND_URL}/auth/fail?reason=${encodeURIComponent(reason)}`,
      );
    }
    if (!user.name) {
      const ticket = signSignupTicket({ id: user.id, email: user.email });
      return res.redirect(
        `${process.env.FRONTEND_URL}/auth/success?signup=1&ticket=${ticket}`,
      );
    }
    const token = signToken({
      id: user.id,
      email: user.email,
    });

    return res.redirect(
      `${process.env.FRONTEND_URL}/auth/success?token=${token}`,
    );
  })(req, res, next);
});

// Naver Social Login
/**
 * @openapi
 * /auth/naver:
 *   get:
 *     summary: Naver 소셜 로그인 시작
 *     description: Naver 계정을 사용하여 로그인 또는 회원가입을 시작합니다.
 *     tags: [Auth]
 *     responses:
 *       302:
 *         description: Naver 인증 페이지로 리디렉션.
 *       500:
 *         description: 서버 오류.
 */
router.get("/naver", passport.authenticate("naver", { session: false }));

/**
 * @openapi
 * /auth/naver/callback:
 *   get:
 *     summary: Naver 소셜 로그인 콜백
 *     description: Naver 인증 후 콜백을 처리하고 JWT를 발급합니다.
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         required: true
 *         description: Naver 인증 코드.
 *     responses:
 *       302:
 *         description: JWT 토큰을 포함하여 프론트엔드로 리디렉션합니다.
 *         headers:
 *           Location:
 *             schema:
 *               type: string
 *               example: http://localhost:3000/auth/success?token=your.jwt.token
 *       401:
 *         description: 인증 실패.
 *       500:
 *         description: 서버 오류.
 */
router.get("/naver/callback", (req, res, next) => {
  passport.authenticate("naver", { session: false }, (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      const reason = info?.message || "LOGIN_FAILED";
      return res.redirect(
        `${process.env.FRONTEND_URL}/auth/fail?reason=${encodeURIComponent(reason)}`,
      );
    }
    if (!user.name) {
      const ticket = signSignupTicket({ id: user.id, email: user.email });
      return res.redirect(
        `${process.env.FRONTEND_URL}/auth/success?signup=1&ticket=${ticket}`,
      );
    }
    const token = signToken({
      id: user.id,
      email: user.email,
    });

    return res.redirect(
      `${process.env.FRONTEND_URL}/auth/success?token=${token}`,
    );
  })(req, res, next);
});

// Local Register
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
    return res.status(400).json({
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

// Local Login
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
    return res.status(400).json({
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

// Get Current User Info
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

//비밀번호 확인
router.post("/member/verify-password", requireAuth, async(req, res) => {
    const parsed = verifyPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: "VALIDATION_ERROR",
      details: parsed.error.issues,
    });
  }
  const userId = Number(req.user.sub);
  if (!Number.isFinite(userId)) {
    return res.status(401).json({ ok: false, error: "BAD_TOKEN_SUB" });
  }

  const { password } = req.body || {};
  if (typeof password !== "string" || password.length === 0) {
    return res.status(400).json({ ok: false, error: "PASSWORD_REQUIRED" });
  }

  try {
    const result = await pool.query(
      "select password_hash from users where id = $1",
      [userId],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });
    }

    const user = result.rows[0];

    if (!user.password_hash) {
      return res.status(500).json({ ok: false, error: "NO_PASSWORD_HASH" });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ ok: false, error: "INVALID_CREDENTIALS" });
    }

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

//회원정보 수정
router.put("/member", requireAuth, async (req, res) => {
  const userId = Number(req.user.sub);
  const { name, password } = req.body || {};

  if (!name && !password) {
    return res.status(400).json({ ok: false, error: "NOTHING_TO_UPDATE" });
  }

  try {
    const userResult = await pool.query(
      "select auth_provider from users where id = $1",
      [userId]
    );

    const user = userResult.rows[0];

    if (user.auth_provider !== "local" && password) {
      return res.status(403).json({ ok: false, error: "SOCIAL_USER" });
    }

    if (name && password) {
      const hashed = await bcrypt.hash(password, 10);

      await pool.query(
        "update users set name = $1, password_hash = $2 where id = $3",
        [name, hashed, userId]
      );
    } else if (name) {
      await pool.query(
        "update users set name = $1 where id = $2",
        [name, userId]
      );
    } else if (password) {
      const hashed = await bcrypt.hash(password, 10);

      await pool.query(
        "update users set password_hash = $1 where id = $2",
        [hashed, userId]
      );
    }

    return res.json({ ok: true });

  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

//임시 토큰 검증후 이름설정
router.post("/social/complete", async (req, res) => {
  const schema = z.object({
    ticket: z.string().min(1),
    name: z.string().min(1).max(50),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({
        ok: false,
        error: "VALIDATION_ERROR",
        details: parsed.error.issues,
      });
  }

  const { ticket, name } = parsed.data;

  let decoded;
  try {
    decoded = verifyToken(ticket);
  } catch (e) {
    return res.status(401).json({ ok: false, error: "BAD_TICKET" });
  }

  if (decoded.purpose !== "signup") {
    return res.status(401).json({ ok: false, error: "NOT_SIGNUP_TICKET" });
  }

  const userId = Number(decoded.sub);
  if (!Number.isFinite(userId)) {
    return res.status(401).json({ ok: false, error: "BAD_TICKET_SUB" });
  }

  try {
    const result = await pool.query(
      "update users set name = $1 where id = $2 returning id, email, name",
      [name, userId],
    );

    const updatedUser = result.rows[0];
    const token = signToken({ id: updatedUser.id, email: updatedUser.email });

    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });
    }

    return res.json({ ok: true, token, user: updatedUser });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

module.exports = router;
