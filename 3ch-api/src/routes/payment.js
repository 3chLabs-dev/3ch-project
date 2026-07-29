const express = require("express");
const router = express.Router();
const pool = require("../db/pool");
const { requireAuth } = require("../middlewares/auth");
const { FEATURES, getFeatureBalance, provisionSubscriptionCredits } = require("../services/featureUsageService");

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
router.get("/payment/plans", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, code, name, badge_text, price, original_price, billing_cycle,
              sale_start_at, sale_end_at, features, feature_limits, display_order
         FROM pricing_plans
        WHERE is_visible = true
          AND (sale_start_at IS NULL OR sale_start_at <= NOW())
          AND (sale_end_at IS NULL OR sale_end_at >= NOW())
        ORDER BY display_order ASC, id ASC`,
    );
    return res.json({ ok: true, plans: result.rows });
  } catch (error) {
    console.error("public pricing plans lookup error:", error);
    return res.status(500).json({ ok: false, error: "DB_ERROR" });
  }
});

router.post("/payment/confirm", requireAuth, async (req, res) => {
  const { paymentKey, orderId, amount } = req.body;
  const userId = Number(req.user.sub);

  if (!paymentKey || !orderId || !amount) {
    return res.status(400).json({ ok: false, error: "MISSING_PARAMS" });
  }

  const plan = extractPlan(orderId).toLowerCase();
  try {
    const pricingResult = await pool.query(
      `SELECT price FROM pricing_plans
        WHERE code = $1 AND is_visible = true
          AND (sale_start_at IS NULL OR sale_start_at <= NOW())
          AND (sale_end_at IS NULL OR sale_end_at >= NOW())
        LIMIT 1`,
      [plan],
    );
    if (!pricingResult.rowCount) return res.status(400).json({ ok: false, error: "INVALID_PLAN" });
    if (Number(amount) !== Number(pricingResult.rows[0].price)) {
      return res.status(400).json({ ok: false, error: "AMOUNT_MISMATCH" });
    }
  } catch (error) {
    console.error("pricing validation error:", error);
    return res.status(500).json({ ok: false, error: "DB_ERROR" });
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
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 1);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existingOrder = await client.query(
      `SELECT id, plan, expires_at FROM subscriptions WHERE order_id = $1 AND user_id = $2`,
      [orderId, userId],
    );
    if (existingOrder.rowCount === 0) {
      await client.query(
        `UPDATE subscriptions
            SET status = 'EXPIRED'
          WHERE user_id = $1 AND status = 'ACTIVE'`,
        [userId],
      );
      await client.query(
        `UPDATE feature_credit_buckets
            SET expires_at = NOW(), updated_at = NOW()
          WHERE user_id = $1
            AND source = 'PLAN'
            AND (expires_at IS NULL OR expires_at > NOW())`,
        [userId],
      );
      const subscriptionResult = await client.query(
        `INSERT INTO subscriptions (user_id, plan, order_id, payment_key, amount, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, started_at, expires_at`,
        [userId, plan, orderId, paymentKey, amount, expiresAt],
      );
      const subscription = subscriptionResult.rows[0];
      await provisionSubscriptionCredits(client, {
        subscriptionId: subscription.id,
        userId,
        plan,
        startsAt: subscription.started_at,
        expiresAt: subscription.expires_at,
      });
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("subscription insert error:", e.message);
    return res.status(500).json({ ok: false, error: "DB_ERROR" });
  } finally {
    client.release();
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

router.get("/payment/usage/me", requireAuth, async (req, res) => {
  const userId = Number(req.user.sub);
  try {
    const featureEntries = [
      ["club_create", FEATURES.CLUB_CREATE],
      ["club_join", FEATURES.CLUB_JOIN],
      ["league_create", FEATURES.LEAGUE_CREATE],
      ["tournament_create", FEATURES.TOURNAMENT_CREATE],
      ["event_join", FEATURES.EVENT_JOIN],
      ["vision_scan", FEATURES.VISION_SCAN],
      ["draw_create", FEATURES.DRAW_CREATE],
    ];
    const balances = await Promise.all(
      featureEntries.map(([, feature]) => getFeatureBalance(userId, feature)),
    );
    return res.json({
      ok: true,
      usage: Object.fromEntries(
        featureEntries.map(([key], index) => [key, balances[index]]),
      ),
    });
  } catch (error) {
    console.error("feature balance lookup error:", error);
    return res.status(500).json({ ok: false, error: "DB_ERROR" });
  }
});

module.exports = router;
