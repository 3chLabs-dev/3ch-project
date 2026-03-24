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
 * POST /api/payment/confirm
 * Toss 결제 승인 요청 후 구독 저장
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
 * GET /api/payment/subscriptions/me
 * 현재 사용자의 활성 구독 조회
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
