const pool = require("../db/pool");

const FEATURES = Object.freeze({
  CLUB_CREATE: "CLUB_CREATE",
  CLUB_JOIN: "CLUB_JOIN",
  LEAGUE_CREATE: "LEAGUE_CREATE",
  EVENT_CREATE: "LEAGUE_CREATE",
  TOURNAMENT_CREATE: "TOURNAMENT_CREATE",
  EVENT_JOIN: "EVENT_JOIN",
  VISION_SCAN: "VISION_SCAN",
  DRAW_CREATE: "DRAW_CREATE",
  PREMIUM_PROMOTION: "PREMIUM_PROMOTION",
});

const PLAN_LIMITS = Object.freeze({
  starter: {
    [FEATURES.CLUB_CREATE]: null, [FEATURES.CLUB_JOIN]: null,
    [FEATURES.LEAGUE_CREATE]: 1, [FEATURES.TOURNAMENT_CREATE]: 0,
    [FEATURES.EVENT_JOIN]: null, [FEATURES.VISION_SCAN]: 0, [FEATURES.DRAW_CREATE]: 1,
    [FEATURES.PREMIUM_PROMOTION]: 0,
  },
  basic: {
    [FEATURES.CLUB_CREATE]: null, [FEATURES.CLUB_JOIN]: null,
    [FEATURES.LEAGUE_CREATE]: 3, [FEATURES.TOURNAMENT_CREATE]: 0,
    [FEATURES.EVENT_JOIN]: null, [FEATURES.VISION_SCAN]: 3, [FEATURES.DRAW_CREATE]: 3,
    [FEATURES.PREMIUM_PROMOTION]: 0,
  },
  pro: {
    [FEATURES.CLUB_CREATE]: null, [FEATURES.CLUB_JOIN]: null,
    [FEATURES.LEAGUE_CREATE]: null, [FEATURES.TOURNAMENT_CREATE]: 0,
    [FEATURES.EVENT_JOIN]: null, [FEATURES.VISION_SCAN]: 20, [FEATURES.DRAW_CREATE]: null,
    [FEATURES.PREMIUM_PROMOTION]: 0,
  },
  premium: {
    [FEATURES.CLUB_CREATE]: null, [FEATURES.CLUB_JOIN]: null,
    [FEATURES.LEAGUE_CREATE]: null, [FEATURES.TOURNAMENT_CREATE]: null,
    [FEATURES.EVENT_JOIN]: null, [FEATURES.VISION_SCAN]: null, [FEATURES.DRAW_CREATE]: null,
    [FEATURES.PREMIUM_PROMOTION]: null,
  },
});

const FEATURE_LIMIT_KEYS = Object.freeze({
  [FEATURES.CLUB_CREATE]: "club_create",
  [FEATURES.CLUB_JOIN]: "club_join",
  [FEATURES.LEAGUE_CREATE]: "league_create",
  [FEATURES.TOURNAMENT_CREATE]: "tournament_create",
  [FEATURES.EVENT_JOIN]: "event_join",
  [FEATURES.VISION_SCAN]: "vision_scan",
  [FEATURES.DRAW_CREATE]: "draw_create",
  [FEATURES.PREMIUM_PROMOTION]: "premium_promotion",
});

function normalizePlan(plan) {
  return String(plan || "starter").trim().toLowerCase();
}

async function ensurePurchaseCredits(userId, client = pool) {
  await client.query(
    `INSERT INTO feature_credit_buckets (
       user_id, feature, source, initial_amount, remaining_amount,
       starts_at, expires_at, source_ref
     )
     SELECT
       purchase.user_id,
       CASE credit.key
         WHEN 'club_create' THEN 'CLUB_CREATE'
         WHEN 'club_join' THEN 'CLUB_JOIN'
         WHEN 'league_create' THEN 'LEAGUE_CREATE'
         WHEN 'event_create' THEN 'LEAGUE_CREATE'
         WHEN 'tournament_create' THEN 'TOURNAMENT_CREATE'
         WHEN 'event_join' THEN 'EVENT_JOIN'
         WHEN 'vision_scan' THEN 'VISION_SCAN'
         WHEN 'draw_create' THEN 'DRAW_CREATE'
         WHEN 'premium_promotion' THEN 'PREMIUM_PROMOTION'
       END,
       'PURCHASE',
       credit.value::integer,
       credit.value::integer,
       purchase.created_at,
       purchase.expires_at,
       'token:' || purchase.id::text
     FROM token_purchases purchase
     LEFT JOIN token_packages package ON package.id = purchase.package_id
     CROSS JOIN LATERAL jsonb_each_text(
       COALESCE(purchase.credits, '{}'::jsonb) || COALESCE(package.credits, '{}'::jsonb)
     ) AS credit(key, value)
     WHERE purchase.user_id = $1
       AND purchase.status = 'PAID'
       AND purchase.expires_at > NOW()
       AND credit.key IN (
         'club_create', 'club_join', 'league_create', 'event_create',
         'tournament_create', 'event_join', 'vision_scan', 'draw_create',
         'premium_promotion'
       )
       AND credit.value ~ '^[0-9]+$'
       AND credit.value::integer > 0
     ON CONFLICT (source_ref, feature) WHERE source_ref IS NOT NULL DO NOTHING`,
    [userId],
  );
}

async function getPlanLimits(plan, client = pool) {
  const normalizedPlan = normalizePlan(plan);
  const fallback = PLAN_LIMITS[normalizedPlan] || PLAN_LIMITS.starter;
  const result = await client.query(
    `SELECT feature_limits FROM pricing_plans WHERE code = $1 LIMIT 1`,
    [normalizedPlan],
  );
  const configured = result.rows[0]?.feature_limits;
  if (!configured || typeof configured !== "object" || Array.isArray(configured)) return fallback;

  return Object.fromEntries(
    Object.entries(FEATURE_LIMIT_KEYS).map(([feature, key]) => {
      if (!Object.prototype.hasOwnProperty.call(configured, key)) return [feature, fallback[feature]];
      const value = configured[key];
      return [feature, value === null ? null : Math.max(0, Number.parseInt(String(value), 10) || 0)];
    }),
  );
}

async function ensureStarterCredits(userId, client = pool) {
  const activeSubscription = await client.query(
    `SELECT id, plan, started_at, expires_at
       FROM subscriptions
      WHERE user_id = $1 AND status = 'ACTIVE' AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1`,
    [userId],
  );
  if (activeSubscription.rowCount > 0) {
    const subscription = activeSubscription.rows[0];
    await provisionSubscriptionCredits(client, {
      subscriptionId: subscription.id,
      userId,
      plan: subscription.plan,
      startsAt: subscription.started_at,
      expiresAt: subscription.expires_at,
    });
    return;
  }

  const starterLimits = await getPlanLimits("starter", client);
  for (const [feature, amount] of Object.entries(starterLimits)) {
    await client.query(
      `INSERT INTO feature_credit_buckets (
         user_id, feature, source, initial_amount, remaining_amount,
         starts_at, expires_at, source_ref
       ) VALUES (
         $1::integer, $2, 'PLAN', $3, $3,
         DATE_TRUNC('month', NOW()),
         DATE_TRUNC('month', NOW()) + INTERVAL '1 month',
         'starter:' || ($1::integer)::text || ':' || TO_CHAR(NOW(), 'YYYY-MM')
       )
       ON CONFLICT (source_ref, feature) WHERE source_ref IS NOT NULL DO NOTHING`,
      [userId, feature, amount],
    );
  }
}

async function provisionSubscriptionCredits(client, { subscriptionId, userId, plan, startsAt, expiresAt }) {
  const limits = await getPlanLimits(plan, client);
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
  await ensurePurchaseCredits(userId, client);

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
    await ensurePurchaseCredits(userId, client);

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
    return {
      ...balance,
      allowed: true,
      consumed: true,
    };
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
