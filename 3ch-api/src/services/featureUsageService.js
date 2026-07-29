const pool = require("../db/pool");

const FEATURES = Object.freeze({
  EVENT_CREATE: "EVENT_CREATE",
  VISION_SCAN: "VISION_SCAN",
  DRAW_CREATE: "DRAW_CREATE",
});

const PLAN_LIMITS = Object.freeze({
  starter: { [FEATURES.EVENT_CREATE]: 1, [FEATURES.VISION_SCAN]: 0, [FEATURES.DRAW_CREATE]: 1 },
  basic: { [FEATURES.EVENT_CREATE]: 3, [FEATURES.VISION_SCAN]: 3, [FEATURES.DRAW_CREATE]: 3 },
  pro: { [FEATURES.EVENT_CREATE]: null, [FEATURES.VISION_SCAN]: 20, [FEATURES.DRAW_CREATE]: null },
  premium: { [FEATURES.EVENT_CREATE]: null, [FEATURES.VISION_SCAN]: 500, [FEATURES.DRAW_CREATE]: null },
});

function normalizePlan(plan) {
  return String(plan || "starter").trim().toLowerCase();
}

async function ensureStarterCredits(userId, client = pool) {
  const activeSubscription = await client.query(
    `SELECT 1 FROM subscriptions
      WHERE user_id = $1 AND status = 'ACTIVE' AND expires_at > NOW()
      LIMIT 1`,
    [userId],
  );
  if (activeSubscription.rowCount > 0) return;

  for (const [feature, amount] of Object.entries(PLAN_LIMITS.starter)) {
    await client.query(
      `INSERT INTO feature_credit_buckets (
         user_id, feature, source, initial_amount, remaining_amount,
         starts_at, expires_at, source_ref
       ) VALUES (
         $1, $2, 'PLAN', $3, $3,
         DATE_TRUNC('month', NOW()),
         DATE_TRUNC('month', NOW()) + INTERVAL '1 month',
         'starter:' || $1::text || ':' || TO_CHAR(NOW(), 'YYYY-MM')
       )
       ON CONFLICT (source_ref, feature) WHERE source_ref IS NOT NULL DO NOTHING`,
      [userId, feature, amount],
    );
  }
}

async function provisionSubscriptionCredits(client, { subscriptionId, userId, plan, startsAt, expiresAt }) {
  const limits = PLAN_LIMITS[normalizePlan(plan)] || PLAN_LIMITS.starter;
  for (const [feature, amount] of Object.entries(limits)) {
    await client.query(
      `INSERT INTO feature_credit_buckets (
         user_id, feature, source, initial_amount, remaining_amount,
         starts_at, expires_at, subscription_id, source_ref
       ) VALUES ($1, $2, 'PLAN', $3, $3, $4, $5, $6, $7)
       ON CONFLICT (source_ref, feature) WHERE source_ref IS NOT NULL DO NOTHING`,
      [userId, feature, amount, startsAt, expiresAt, subscriptionId, `subscription:${subscriptionId}`],
    );
  }
}

async function getFeatureBalance(userId, feature, client = pool) {
  const roleResult = await client.query(
    `SELECT system_role FROM users WHERE id = $1 AND deleted_at IS NULL`,
    [userId],
  );
  const systemRole = roleResult.rows[0]?.system_role || "USER";
  if (systemRole === "MASTER") {
    return { allowed: true, unlimited: true, remaining: null, expiresAt: null, systemRole };
  }
  await ensureStarterCredits(userId, client);

  const result = await client.query(
    `SELECT
       BOOL_OR(remaining_amount IS NULL) AS unlimited,
       COALESCE(SUM(remaining_amount) FILTER (WHERE remaining_amount IS NOT NULL), 0)::int AS remaining,
       MIN(expires_at) FILTER (
         WHERE remaining_amount IS NULL OR remaining_amount > 0
       ) AS expires_at
     FROM feature_credit_buckets
     WHERE user_id = $1
       AND feature = $2
       AND starts_at <= NOW()
       AND (expires_at IS NULL OR expires_at > NOW())`,
    [userId, feature],
  );
  const unlimited = Boolean(result.rows[0]?.unlimited);
  const remaining = Number(result.rows[0]?.remaining || 0);
  return {
    allowed: unlimited || remaining > 0,
    unlimited,
    remaining: unlimited ? null : remaining,
    expiresAt: result.rows[0]?.expires_at ?? null,
    systemRole,
  };
}

async function consumeFeatureCredit({ userId, feature, requestKey, referenceType, referenceId, metadata }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Serialize identical requests so concurrent retries cannot both consume credit.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [requestKey]);

    const duplicate = await client.query(
      `SELECT id, reference_type, reference_id, metadata
         FROM feature_usage_events
        WHERE request_key = $1 AND action = 'CONSUME'`,
      [requestKey],
    );
    if (duplicate.rowCount > 0) {
      const balance = await getFeatureBalance(userId, feature, client);
      await client.query("COMMIT");
      return {
        ...balance,
        duplicate: true,
        usageEvent: duplicate.rows[0],
      };
    }

    const roleResult = await client.query(
      `SELECT system_role FROM users WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
      [userId],
    );
    if (roleResult.rowCount === 0) {
      const error = new Error("사용자 정보를 찾을 수 없습니다.");
      error.code = "FEATURE_USER_NOT_FOUND";
      throw error;
    }
    if (roleResult.rows[0].system_role === "MASTER") {
      await client.query(
        `INSERT INTO feature_usage_events
           (user_id, feature, action, amount, request_key, reference_type, reference_id, metadata)
         VALUES ($1, $2, 'CONSUME', 1, $3, $4, $5, $6::jsonb)`,
        [userId, feature, requestKey, referenceType, referenceId, JSON.stringify(metadata || {})],
      );
      await client.query("COMMIT");
      return { allowed: true, unlimited: true, remaining: null, expiresAt: null, systemRole: "MASTER" };
    }
    await ensureStarterCredits(userId, client);

    const bucketResult = await client.query(
      `SELECT id, remaining_amount
       FROM feature_credit_buckets
       WHERE user_id = $1
         AND feature = $2
         AND starts_at <= NOW()
         AND (expires_at IS NULL OR expires_at > NOW())
         AND (remaining_amount IS NULL OR remaining_amount > 0)
       ORDER BY
         CASE WHEN expires_at IS NULL THEN 1 ELSE 0 END,
         expires_at ASC NULLS LAST,
         created_at ASC
       LIMIT 1
       FOR UPDATE`,
      [userId, feature],
    );
    if (bucketResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return {
        allowed: false,
        unlimited: false,
        remaining: 0,
        expiresAt: null,
        systemRole: roleResult.rows[0].system_role,
      };
    }

    const bucket = bucketResult.rows[0];
    if (bucket.remaining_amount !== null) {
      await client.query(
        `UPDATE feature_credit_buckets
         SET remaining_amount = remaining_amount - 1, updated_at = NOW()
         WHERE id = $1`,
        [bucket.id],
      );
    }
    await client.query(
      `INSERT INTO feature_usage_events
         (user_id, feature, action, amount, request_key, credit_bucket_id, reference_type, reference_id, metadata)
       VALUES ($1, $2, 'CONSUME', 1, $3, $4, $5, $6, $7::jsonb)`,
      [userId, feature, requestKey, bucket.id, referenceType, referenceId, JSON.stringify(metadata || {})],
    );

    const balance = await getFeatureBalance(userId, feature, client);
    await client.query("COMMIT");
    return balance;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function refundFeatureCredit({ userId, feature, requestKey, reason }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const consumed = await client.query(
      `SELECT id, credit_bucket_id
       FROM feature_usage_events
       WHERE request_key = $1 AND user_id = $2 AND feature = $3 AND action = 'CONSUME'
       FOR UPDATE`,
      [requestKey, userId, feature],
    );
    if (consumed.rowCount === 0 || !consumed.rows[0].credit_bucket_id) {
      await client.query("COMMIT");
      return;
    }
    const refundKey = `${requestKey}:refund`;
    const refund = await client.query(
      `INSERT INTO feature_usage_events
         (user_id, feature, action, amount, request_key, credit_bucket_id, metadata)
       VALUES ($1, $2, 'REFUND', 1, $3, $4, $5::jsonb)
       ON CONFLICT (request_key) DO NOTHING
       RETURNING id`,
      [userId, feature, refundKey, consumed.rows[0].credit_bucket_id, JSON.stringify({ reason })],
    );
    if (refund.rowCount > 0) {
      await client.query(
        `UPDATE feature_credit_buckets
         SET remaining_amount = LEAST(initial_amount, remaining_amount + 1), updated_at = NOW()
         WHERE id = $1 AND remaining_amount IS NOT NULL`,
        [consumed.rows[0].credit_bucket_id],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  FEATURES,
  PLAN_LIMITS,
  getFeatureBalance,
  consumeFeatureCredit,
  refundFeatureCredit,
  provisionSubscriptionCredits,
};
