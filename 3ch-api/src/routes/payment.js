const express = require("express");
const router = express.Router();
const pool = require("../db/pool");
const { requireAuth } = require("../middlewares/auth");

// ── DB 마이그레이션 (subscriptions 테이블) ────────────────────────────────────
;(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id          SERIAL PRIMARY KEY,
        user_id     INT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plan        VARCHAR(20)  NOT NULL,
        order_id    VARCHAR(100) NOT NULL UNIQUE,
        payment_key VARCHAR(200) NOT NULL,
        amount      INT          NOT NULL,
        status      VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
        started_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        expires_at  TIMESTAMPTZ  NOT NULL,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
  } catch (e) {
    console.error("subscriptions migration error:", e.message);
  }
})();

// orderId 예) ORDER_basic_42_abc123def456 → plan 추출
function extractPlan(orderId = "") {
  const parts = orderId.split("_");
  // ORDER_{plan}_{userId}_{random}
  return parts[1] ?? "unknown";
}

/**
 * @openapi
 * /payment/confirm:
 *   post:
 *     summary: Toss 결제 승인
 *     description: Toss Payments 결제 승인을 요청하고, 성공 시 구독 정보를 저장합니다. orderId 형식은 ORDER_{plan}_{userId}_{random} 이어야 합니다.
 *     tags: [결제]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [paymentKey, orderId, amount]
 *             properties:
 *               paymentKey:
 *                 type: string
 *                 description: Toss에서 발급한 결제 키
 *               orderId:
 *                 type: string
 *                 description: 주문 ID (형식 ORDER_{plan}_{userId}_{random})
 *               amount:
 *                 type: integer
 *                 description: 결제 금액 (원)
 *     responses:
 *       200:
 *         description: 결제 승인 및 구독 저장 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 plan:
 *                   type: string
 *                   description: 구독 플랜명 (orderId에서 추출)
 *                   example: basic
 *                 expiresAt:
 *                   type: string
 *                   format: date-time
 *                   description: 구독 만료 일시 (결제 시점으로부터 1개월 후)
 *       400:
 *         description: 필수 파라미터 누락 또는 Toss 결제 승인 실패
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: MISSING_PARAMS
 *       401:
 *         description: 인증 필요
 *       500:
 *         description: Toss 요청 실패 또는 DB 오류
 */
router.post("/payment/confirm", requireAuth, async (req, res) => {
  const { paymentKey, orderId, amount } = req.body;
  const userId = Number(req.user.sub);

  if (!paymentKey || !orderId || !amount) {
    return res.status(400).json({ ok: false, error: "MISSING_PARAMS" });
  }

  // 1. Toss 결제 승인
  const secretKey = process.env.TOSS_SECRET_KEY;
  const encoded   = Buffer.from(`${secretKey}:`).toString("base64");

  let tossData;
  try {
    const tossRes = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: {
        Authorization: `Basic ${encoded}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });
    tossData = await tossRes.json();
    if (!tossRes.ok) {
      return res.status(400).json({ ok: false, error: tossData.message ?? "TOSS_ERROR" });
    }
  } catch (e) {
    return res.status(500).json({ ok: false, error: "TOSS_REQUEST_FAILED" });
  }

  // 2. 구독 저장 (1개월 후 만료)
  const plan      = extractPlan(orderId);
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 1);

  try {
    await pool.query(
      `INSERT INTO subscriptions (user_id, plan, order_id, payment_key, amount, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (order_id) DO NOTHING`,
      [userId, plan, orderId, paymentKey, amount, expiresAt],
    );
  } catch (e) {
    console.error("subscription insert error:", e.message);
    return res.status(500).json({ ok: false, error: "DB_ERROR" });
  }

  return res.json({ ok: true, plan, expiresAt });
});

/**
 * @openapi
 * /payment/subscriptions/me:
 *   get:
 *     summary: 현재 사용자 구독 정보 조회
 *     description: 로그인한 사용자의 활성 구독 정보를 반환합니다. 활성 구독이 없으면 subscription은 null입니다.
 *     tags: [결제]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 구독 정보 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 subscription:
 *                   description: 활성 구독 정보. 구독이 없을 경우 null
 *                   oneOf:
 *                     - type: "null"
 *                     - type: object
 *                       properties:
 *                         plan:
 *                           type: string
 *                           description: 구독 플랜명
 *                           example: basic
 *                         amount:
 *                           type: integer
 *                           description: 결제 금액 (원)
 *                         started_at:
 *                           type: string
 *                           format: date-time
 *                           description: 구독 시작 일시
 *                         expires_at:
 *                           type: string
 *                           format: date-time
 *                           description: 구독 만료 일시
 *       401:
 *         description: 인증 필요
 *       500:
 *         description: DB 오류
 */
router.get("/payment/subscriptions/me", requireAuth, async (req, res) => {
  const userId = Number(req.user.sub);
  try {
    const result = await pool.query(
      `SELECT plan, amount, started_at, expires_at
       FROM subscriptions
       WHERE user_id = $1 AND status = 'ACTIVE' AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [userId],
    );
    return res.json({ ok: true, subscription: result.rows[0] ?? null });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "DB_ERROR" });
  }
});

module.exports = router;
