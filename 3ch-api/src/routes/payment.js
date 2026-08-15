const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const pool = require("../db/pool");
const { requireAuth } = require("../middlewares/auth");
const { FEATURES, getFeatureBalance, provisionSubscriptionCredits } = require("../services/featureUsageService");
const { encryptBillingKey, decryptBillingKey } = require("../services/billingCrypto");

function tossAuthorization() {
  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) throw new Error("TOSS_SECRET_KEY is not configured");
  return `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
}

async function tossRequest(path, body, method = "POST") {
  const response = await fetch(`https://api.tosspayments.com${path}`, {
    method,
    headers: {
      Authorization: tossAuthorization(),
      "Content-Type": "application/json",
    },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || "TOSS_REQUEST_FAILED");
    error.code = data.code;
    error.status = response.status;
    throw error;
  }
  return data;
}

async function chargeBilling({ billingKey, orderId, body }) {
  try {
    return await tossRequest(`/v1/billing/${encodeURIComponent(billingKey)}`, {
      ...body,
      orderId,
    });
  } catch (error) {
    if (error.code !== "DUPLICATED_ORDER_ID") throw error;
    return tossRequest(`/v1/payments/orders/${encodeURIComponent(orderId)}`, null, "GET");
  }
}

const TOKEN_CREDIT_KEY_MAP = {
  club_create: FEATURES.CLUB_CREATE,
  club_join: FEATURES.CLUB_JOIN,
  league_create: FEATURES.LEAGUE_CREATE,
  event_create: FEATURES.LEAGUE_CREATE,
  tournament_create: FEATURES.TOURNAMENT_CREATE,
  event_join: FEATURES.EVENT_JOIN,
  vision_scan: FEATURES.VISION_SCAN,
  draw_create: FEATURES.DRAW_CREATE,
};

async function grantTokenPurchaseCredits(client, { purchaseId, userId, credits, expiresAt }) {
  const normalizedCredits = typeof credits === "string" ? JSON.parse(credits) : (credits || {});
  for (const [key, rawAmount] of Object.entries(normalizedCredits)) {
    const feature = TOKEN_CREDIT_KEY_MAP[String(key).trim().toLowerCase()];
    const creditAmount = Number.parseInt(String(rawAmount), 10);
    if (!feature || !Number.isInteger(creditAmount) || creditAmount <= 0) continue;
    await client.query(
      `INSERT INTO feature_credit_buckets
        (user_id, feature, source, initial_amount, remaining_amount,
         starts_at, expires_at, source_ref)
       VALUES ($1, $2, 'PURCHASE', $3, $3, NOW(), $4, $5)
       ON CONFLICT (source_ref, feature) WHERE source_ref IS NOT NULL
       DO UPDATE SET
         initial_amount = EXCLUDED.initial_amount,
         remaining_amount = GREATEST(
           EXCLUDED.initial_amount - COALESCE((
             SELECT SUM(
               CASE event.action
                 WHEN 'CONSUME' THEN event.amount
                 WHEN 'REFUND' THEN -event.amount
                 ELSE 0
               END
             )
             FROM feature_usage_events event
             WHERE event.credit_bucket_id = feature_credit_buckets.id
           ), 0),
           0
         ),
         expires_at = EXCLUDED.expires_at,
         updated_at = NOW()
       WHERE feature_credit_buckets.source = 'PURCHASE'`,
      [userId, feature, creditAmount, expiresAt, `token:${purchaseId}`],
    );
  }
}

function addOneMonth(date = new Date()) {
  const value = new Date(date);
  value.setUTCMonth(value.getUTCMonth() + 1);
  return value;
}

async function getPurchasablePlan(code) {
  const result = await pool.query(
    `SELECT code, name, price
       FROM pricing_plans
      WHERE code = $1 AND is_visible = true AND price > 0
        AND (sale_start_at IS NULL OR sale_start_at <= NOW())
        AND (sale_end_at IS NULL OR sale_end_at >= NOW())
      LIMIT 1`,
    [String(code || "").toLowerCase()],
  );
  return result.rows[0] || null;
}

async function activateRecurringSubscription({
  userId,
  plan,
  methodId,
  payment,
  chargedAmount,
  startsAt = new Date(),
}) {
  const expiresAt = addOneMonth(startsAt);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      `SELECT id, expires_at FROM subscriptions WHERE order_id = $1 AND user_id = $2`,
      [payment.orderId, userId],
    );
    if (!existing.rowCount) {
      await client.query(
        `UPDATE subscriptions
            SET status = 'EXPIRED'
          WHERE user_id = $1 AND status = 'ACTIVE'`,
        [userId],
      );
      await client.query(
        `UPDATE feature_credit_buckets
            SET expires_at = NOW(), updated_at = NOW()
          WHERE user_id = $1 AND source = 'PLAN'
            AND (expires_at IS NULL OR expires_at > NOW())`,
        [userId],
      );
      const inserted = await client.query(
        `INSERT INTO subscriptions
          (user_id, plan, order_id, payment_key, amount, expires_at,
           billing_method_id, is_recurring, cancel_at_period_end)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, false)
         RETURNING id, started_at, expires_at`,
        [userId, plan.code, payment.orderId, payment.paymentKey, chargedAmount ?? plan.price, expiresAt, methodId],
      );
      await provisionSubscriptionCredits(client, {
        subscriptionId: inserted.rows[0].id,
        userId,
        plan: plan.code,
        startsAt: inserted.rows[0].started_at,
        expiresAt: inserted.rows[0].expires_at,
      });
    }
    await client.query("COMMIT");
    return { expiresAt };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

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

router.get("/payment/token-packages", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, code, name, price, credits, display_order
         FROM token_packages
        WHERE is_visible = true
        ORDER BY display_order ASC, id ASC`,
    );
    return res.json({ ok: true, packages: result.rows });
  } catch (error) {
    console.error("token packages lookup error:", error);
    return res.status(500).json({ ok: false, error: "DB_ERROR" });
  }
});

router.post("/payment/token/confirm", requireAuth, async (req, res) => {
  const { paymentKey, orderId, amount } = req.body;
  const userId = Number(req.user.sub);
  const orderParts = String(orderId || "").split("_");
  const packageId = Number(orderParts[1]);
  const orderUserId = Number(orderParts[2]);

  if (!paymentKey || !orderId || !Number.isFinite(Number(amount)) ||
      orderParts[0] !== "TOKEN" || !Number.isInteger(packageId) || orderUserId !== userId) {
    return res.status(400).json({ ok: false, error: "INVALID_TOKEN_ORDER" });
  }

  const packageResult = await pool.query(
    `SELECT id, code, name, price, credits
       FROM token_packages
      WHERE id = $1 AND is_visible = true
      LIMIT 1`,
    [packageId],
  );
  const tokenPackage = packageResult.rows[0];
  if (!tokenPackage) return res.status(404).json({ ok: false, error: "TOKEN_PACKAGE_NOT_FOUND" });
  if (Number(amount) !== Number(tokenPackage.price)) {
    return res.status(400).json({ ok: false, error: "AMOUNT_MISMATCH" });
  }

  const duplicate = await pool.query(
    `SELECT tp.id,
            (COALESCE(tp.credits, '{}'::jsonb) || COALESCE(pkg.credits, '{}'::jsonb)) AS credits,
            tp.expires_at
       FROM token_purchases tp
       LEFT JOIN token_packages pkg ON pkg.id = tp.package_id
      WHERE tp.order_id = $1 AND tp.user_id = $2`,
    [orderId, userId],
  );
  if (duplicate.rowCount) {
    await grantTokenPurchaseCredits(pool, {
      purchaseId: duplicate.rows[0].id,
      userId,
      credits: duplicate.rows[0].credits,
      expiresAt: duplicate.rows[0].expires_at,
    });
    return res.json({ ok: true, purchaseId: duplicate.rows[0].id, expiresAt: duplicate.rows[0].expires_at });
  }

  let tossData;
  try {
    tossData = await tossRequest("/v1/payments/confirm", {
      paymentKey,
      orderId,
      amount: Number(amount),
    });
  } catch (error) {
    if (error.code === "DUPLICATED_ORDER_ID") {
      try {
        tossData = await tossRequest(`/v1/payments/orders/${encodeURIComponent(orderId)}`, null, "GET");
      } catch (lookupError) {
        return res.status(lookupError.status === 400 ? 400 : 502).json({
          ok: false,
          error: lookupError.code || "TOSS_REQUEST_FAILED",
          message: lookupError.message,
        });
      }
    } else {
    return res.status(error.status === 400 ? 400 : 502).json({
      ok: false,
      error: error.code || "TOSS_REQUEST_FAILED",
      message: error.message,
    });
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const expiresResult = await client.query(
      `SELECT expires_at
         FROM subscriptions
        WHERE user_id = $1 AND status = 'ACTIVE' AND expires_at > NOW()
        ORDER BY expires_at DESC LIMIT 1`,
      [userId],
    );
    const expiresAt = expiresResult.rows[0]?.expires_at ||
      new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1));

    const inserted = await client.query(
      `INSERT INTO token_purchases
        (user_id, package_id, order_id, payment_key, amount, credits, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
       ON CONFLICT (order_id) DO NOTHING
       RETURNING id`,
      [userId, packageId, orderId, tossData.paymentKey || paymentKey,
       Number(amount), JSON.stringify(tokenPackage.credits || {}), expiresAt],
    );
    const purchaseId = inserted.rows[0]?.id;
    if (purchaseId) {
      await grantTokenPurchaseCredits(client, {
        purchaseId,
        userId,
        credits: tokenPackage.credits,
        expiresAt,
      });
    }
    await client.query("COMMIT");
    return res.json({ ok: true, purchaseId, expiresAt });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("token purchase insert error:", error);
    return res.status(500).json({ ok: false, error: "DB_ERROR" });
  } finally {
    client.release();
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

router.get("/payment/history/me", requireAuth, async (req, res) => {
  const userId = Number(req.user.sub);
  try {
    const result = await pool.query(
      `SELECT s.id, s.plan, s.order_id, s.amount, s.status, s.started_at,
              s.expires_at, s.is_recurring, s.cancel_at_period_end, s.canceled_at,
              bpm.card_company, bpm.card_number
         FROM subscriptions s
         LEFT JOIN billing_payment_methods bpm ON bpm.id = s.billing_method_id
        WHERE s.user_id = $1
        ORDER BY s.created_at DESC
        LIMIT 50`,
      [userId],
    );
    const tokenResult = await pool.query(
      `SELECT tp.id, 'TOKEN' AS plan, tp.order_id, tp.amount, tp.status,
              tp.created_at AS started_at, tp.expires_at, false AS is_recurring,
              false AS cancel_at_period_end, NULL::timestamptz AS canceled_at,
              NULL::varchar AS card_company, NULL::varchar AS card_number,
              pkg.name AS product_name, tp.credits, 'TOKEN' AS purchase_type
         FROM token_purchases tp
         JOIN token_packages pkg ON pkg.id = tp.package_id
        WHERE tp.user_id = $1
        ORDER BY tp.created_at DESC
        LIMIT 50`,
      [userId],
    );
    const subscriptions = result.rows.map((row) => ({
      ...row,
      purchase_type: "SUBSCRIPTION",
      product_name: row.plan,
    }));
    const purchases = [...subscriptions, ...tokenResult.rows]
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
      .slice(0, 50);
    return res.json({ ok: true, purchases });
  } catch (error) {
    console.error("payment history lookup error:", error);
    return res.status(500).json({ ok: false, error: "DB_ERROR" });
  }
});

router.get("/payment/usage/me", requireAuth, async (req, res) => {
  const userId = Number(req.user.sub);
  try {
    // Repair paid token purchases whose credit buckets were not created by an
    // interrupted or older confirmation flow. The insert is idempotent.
    const purchases = await pool.query(
      `SELECT tp.id,
              (COALESCE(tp.credits, '{}'::jsonb) || COALESCE(pkg.credits, '{}'::jsonb)) AS credits,
              tp.expires_at
         FROM token_purchases tp
         LEFT JOIN token_packages pkg ON pkg.id = tp.package_id
        WHERE tp.user_id = $1
          AND tp.status = 'PAID'
          AND tp.expires_at > NOW()`,
      [userId],
    );
    for (const purchase of purchases.rows) {
      await grantTokenPurchaseCredits(pool, {
        purchaseId: purchase.id,
        userId,
        credits: purchase.credits,
        expiresAt: purchase.expires_at,
      });
    }

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

router.get("/payment/billing/customer-key", requireAuth, async (req, res) => {
  const userId = Number(req.user.sub);
  try {
    const existing = await pool.query(
      `SELECT customer_key FROM billing_payment_methods WHERE user_id = $1`,
      [userId],
    );
    if (existing.rowCount) {
      return res.json({ ok: true, customerKey: existing.rows[0].customer_key });
    }

    const customerKey = `wc_${crypto.randomBytes(24).toString("base64url")}`;
    const inserted = await pool.query(
      `INSERT INTO billing_payment_methods (user_id, customer_key)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
       RETURNING customer_key`,
      [userId, customerKey],
    );
    return res.json({ ok: true, customerKey: inserted.rows[0].customer_key });
  } catch (error) {
    console.error("billing customer key error:", error);
    return res.status(500).json({ ok: false, error: "BILLING_CUSTOMER_KEY_FAILED" });
  }
});

router.post("/payment/billing/issue", requireAuth, async (req, res) => {
  const userId = Number(req.user.sub);
  const { authKey, customerKey, planCode } = req.body || {};
  if (!authKey || !customerKey || !planCode) {
    return res.status(400).json({ ok: false, error: "MISSING_PARAMS" });
  }

  try {
    const plan = await getPurchasablePlan(planCode);
    if (!plan) return res.status(400).json({ ok: false, error: "INVALID_PLAN" });

    const methodResult = await pool.query(
      `SELECT id, customer_key, billing_key_encrypted, status
         FROM billing_payment_methods
        WHERE user_id = $1 AND customer_key = $2
        LIMIT 1`,
      [userId, customerKey],
    );
    if (!methodResult.rowCount) {
      return res.status(400).json({ ok: false, error: "INVALID_CUSTOMER_KEY" });
    }
    const method = methodResult.rows[0];

    const current = await pool.query(
      `SELECT plan, expires_at
         FROM subscriptions
        WHERE user_id = $1 AND status = 'ACTIVE' AND is_recurring = true
          AND expires_at > NOW()
        ORDER BY created_at DESC LIMIT 1`,
      [userId],
    );
    if (method.status === "ACTIVE" && method.billing_key_encrypted && current.rowCount) {
      return res.json({
        ok: true,
        plan: current.rows[0].plan,
        expiresAt: current.rows[0].expires_at,
        alreadyProcessed: true,
      });
    }

    let billingKey;
    if (method.status === "ACTIVE" && method.billing_key_encrypted) {
      billingKey = decryptBillingKey(method.billing_key_encrypted);
    } else {
      const billingAuth = await tossRequest("/v1/billing/authorizations/issue", {
        authKey,
        customerKey,
      });
      billingKey = billingAuth.billingKey;
      if (!billingKey) throw new Error("Toss did not return billingKey");

      await pool.query(
        `UPDATE billing_payment_methods
            SET billing_key_encrypted = $1,
                card_company = $2,
                card_number = $3,
                status = 'ACTIVE',
                authenticated_at = NOW(),
                updated_at = NOW()
          WHERE id = $4`,
        [
          encryptBillingKey(billingKey),
          billingAuth.card?.company || null,
          billingAuth.card?.number || null,
          method.id,
        ],
      );
    }

    const userResult = await pool.query(
      `SELECT email, COALESCE(name, nickname) AS name FROM users WHERE id = $1`,
      [userId],
    );
    const user = userResult.rows[0] || {};
    const discountResult = await pool.query(
      `SELECT r.id,c.value FROM coupon_redemptions r JOIN coupons c ON c.id=r.coupon_id
        WHERE r.user_id=$1 AND r.status='AVAILABLE' AND c.type='PERCENT_DISCOUNT'
          AND c.is_active=true AND c.valid_until>NOW() AND (c.plan_code IS NULL OR c.plan_code=$2)
        ORDER BY r.redeemed_at ASC LIMIT 1`, [userId,plan.code],
    );
    const discount = discountResult.rows[0];
    const chargedAmount = discount
      ? Math.max(0, Math.round(Number(plan.price) * (100-Number(discount.value)) / 100))
      : Number(plan.price);
    const authFingerprint = crypto.createHash("sha256").update(authKey).digest("hex").slice(0, 18);
    const orderId = `BILL_${plan.code}_${userId}_${authFingerprint}${discount?`_${discount.id.slice(0,8)}`:""}`;
    const payment = await chargeBilling({ billingKey, orderId, body: {
      customerKey,
      amount: chargedAmount,
      orderName: `${plan.name} 월 구독`,
      customerEmail: user.email || undefined,
      customerName: user.name || undefined,
    } });
    const subscription = await activateRecurringSubscription({
      userId,
      plan,
      methodId: method.id,
      payment,
      chargedAmount,
    });
    if (discount) await pool.query(`UPDATE coupon_redemptions SET status='APPLIED',applied_at=NOW() WHERE id=$1 AND status='AVAILABLE'`,[discount.id]);
    return res.json({ ok: true, plan: plan.code, expiresAt: subscription.expiresAt });
  } catch (error) {
    console.error("billing issue error:", error);
    return res.status(error.status === 400 ? 400 : 500).json({
      ok: false,
      error: error.code || "BILLING_ISSUE_FAILED",
      message: error.message,
    });
  }
});

router.get("/payment/billing/me", requireAuth, async (req, res) => {
  const userId = Number(req.user.sub);
  try {
    const result = await pool.query(
      `SELECT s.plan, s.amount, s.started_at, s.expires_at, s.cancel_at_period_end,
              bpm.card_company, bpm.card_number, bpm.status AS billing_status
         FROM subscriptions s
         LEFT JOIN billing_payment_methods bpm ON bpm.id = s.billing_method_id
        WHERE s.user_id = $1 AND s.status = 'ACTIVE' AND s.expires_at > NOW()
        ORDER BY s.created_at DESC LIMIT 1`,
      [userId],
    );
    return res.json({ ok: true, billing: result.rows[0] || null });
  } catch (error) {
    console.error("billing lookup error:", error);
    return res.status(500).json({ ok: false, error: "DB_ERROR" });
  }
});

router.post("/payment/billing/cancel", requireAuth, async (req, res) => {
  const userId = Number(req.user.sub);
  try {
    const result = await pool.query(
      `UPDATE subscriptions
          SET cancel_at_period_end = true, canceled_at = NOW()
        WHERE id = (
          SELECT id FROM subscriptions
           WHERE user_id = $1 AND status = 'ACTIVE' AND is_recurring = true
             AND expires_at > NOW()
           ORDER BY created_at DESC LIMIT 1
        )
        RETURNING expires_at`,
      [userId],
    );
    if (!result.rowCount) {
      return res.status(404).json({ ok: false, error: "ACTIVE_SUBSCRIPTION_NOT_FOUND" });
    }
    return res.json({ ok: true, expiresAt: result.rows[0].expires_at });
  } catch (error) {
    console.error("billing cancel error:", error);
    return res.status(500).json({ ok: false, error: "DB_ERROR" });
  }
});

router.post("/payment/billing/run-renewals", async (req, res) => {
  const configuredSecret = process.env.BILLING_CRON_SECRET;
  const providedSecret = req.get("x-billing-cron-secret");
  const secretMatches = configuredSecret && providedSecret &&
    configuredSecret.length === providedSecret.length &&
    crypto.timingSafeEqual(Buffer.from(configuredSecret), Buffer.from(providedSecret));
  if (!secretMatches) {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  }

  const due = await pool.query(
    `SELECT DISTINCT ON (s.user_id)
            s.id AS current_subscription_id, s.user_id, s.plan,
            bpm.id AS method_id, bpm.customer_key,
            bpm.billing_key_encrypted, u.email, COALESCE(u.name, u.nickname) AS name
       FROM subscriptions s
       JOIN billing_payment_methods bpm ON bpm.id = s.billing_method_id
       JOIN users u ON u.id = s.user_id
      WHERE s.status = 'ACTIVE' AND s.is_recurring = true
        AND s.cancel_at_period_end = false AND s.expires_at <= NOW()
        AND bpm.status = 'ACTIVE' AND bpm.billing_key_encrypted IS NOT NULL
      ORDER BY s.user_id, s.created_at DESC`,
  );

  const results = [];
  for (const row of due.rows) {
    try {
      const plan = await getPurchasablePlan(row.plan);
      if (!plan) throw new Error("INVALID_PLAN");
      const billingKey = decryptBillingKey(row.billing_key_encrypted);
      const orderId = `RENEW_${row.current_subscription_id}`;
      const payment = await chargeBilling({ billingKey, orderId, body: {
        customerKey: row.customer_key,
        amount: Number(plan.price),
        orderName: `${plan.name} 월 구독 갱신`,
        customerEmail: row.email || undefined,
        customerName: row.name || undefined,
      } });
      await activateRecurringSubscription({
        userId: row.user_id,
        plan,
        methodId: row.method_id,
        payment,
      });
      results.push({ userId: row.user_id, ok: true });
    } catch (error) {
      console.error(`billing renewal failed for user ${row.user_id}:`, error);
      results.push({ userId: row.user_id, ok: false, error: error.code || error.message });
    }
  }
  return res.json({
    ok: results.every((item) => item.ok),
    processed: results.length,
    results,
  });
});

module.exports = router;
