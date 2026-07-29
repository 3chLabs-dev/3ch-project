ALTER TABLE "users" ADD COLUMN "system_role" VARCHAR(20) NOT NULL DEFAULT 'USER';
UPDATE "users" SET "system_role" = 'MASTER' WHERE LOWER("email") = '3chlabs@gmail.com';

ALTER TABLE "leagues" ADD COLUMN "billing_owner_id" INTEGER;
UPDATE "leagues" SET "billing_owner_id" = "created_by_id" WHERE "billing_owner_id" IS NULL;
ALTER TABLE "leagues" ADD CONSTRAINT "leagues_billing_owner_id_fkey"
  FOREIGN KEY ("billing_owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "leagues_billing_owner_id_idx" ON "leagues"("billing_owner_id");

CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "plan" VARCHAR(20) NOT NULL,
  "order_id" VARCHAR(100) NOT NULL UNIQUE,
  "payment_key" VARCHAR(200) NOT NULL,
  "amount" INTEGER NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "subscriptions_user_id_status_expires_at_idx"
  ON "subscriptions"("user_id", "status", "expires_at");

CREATE TABLE "feature_credit_buckets" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "feature" VARCHAR(40) NOT NULL,
  "source" VARCHAR(20) NOT NULL,
  "initial_amount" INTEGER,
  "remaining_amount" INTEGER,
  "starts_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(6),
  "subscription_id" INTEGER REFERENCES "subscriptions"("id") ON DELETE CASCADE,
  "source_ref" VARCHAR(120),
  "granted_by_id" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "feature_credit_buckets_amount_check" CHECK (
    ("initial_amount" IS NULL AND "remaining_amount" IS NULL)
    OR ("initial_amount" >= 0 AND "remaining_amount" >= 0 AND "remaining_amount" <= "initial_amount")
  )
);
CREATE INDEX "feature_credit_buckets_user_id_feature_starts_at_expires_at_idx"
  ON "feature_credit_buckets"("user_id", "feature", "starts_at", "expires_at");
CREATE INDEX "feature_credit_buckets_subscription_id_idx"
  ON "feature_credit_buckets"("subscription_id");
CREATE UNIQUE INDEX "feature_credit_buckets_source_ref_feature_key"
  ON "feature_credit_buckets"("source_ref", "feature") WHERE "source_ref" IS NOT NULL;

CREATE TABLE "feature_usage_events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "feature" VARCHAR(40) NOT NULL,
  "action" VARCHAR(20) NOT NULL,
  "amount" INTEGER NOT NULL DEFAULT 1 CHECK ("amount" > 0),
  "request_key" VARCHAR(120),
  "credit_bucket_id" UUID REFERENCES "feature_credit_buckets"("id") ON DELETE SET NULL,
  "reference_type" VARCHAR(40),
  "reference_id" VARCHAR(120),
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "feature_usage_events_request_key_key"
  ON "feature_usage_events"("request_key") WHERE "request_key" IS NOT NULL;
CREATE INDEX "feature_usage_events_user_id_feature_created_at_idx"
  ON "feature_usage_events"("user_id", "feature", "created_at");
CREATE INDEX "feature_usage_events_reference_type_reference_id_idx"
  ON "feature_usage_events"("reference_type", "reference_id");


-- Backfill active subscriptions so current customers keep their allowance.
WITH active_subscriptions AS (
  SELECT DISTINCT ON (user_id)
    id, user_id, LOWER(plan) AS plan, started_at, expires_at
  FROM subscriptions
  WHERE status = 'ACTIVE' AND expires_at > NOW()
  ORDER BY user_id, created_at DESC
),
limits AS (
  SELECT id, user_id, started_at, expires_at, 'EVENT_CREATE'::VARCHAR(40) AS feature,
         CASE plan WHEN 'starter' THEN 1 WHEN 'basic' THEN 3 ELSE NULL END AS amount
  FROM active_subscriptions
  UNION ALL
  SELECT id, user_id, started_at, expires_at, 'VISION_SCAN',
         CASE plan WHEN 'basic' THEN 3 WHEN 'pro' THEN 20 WHEN 'premium' THEN 500 ELSE 0 END
  FROM active_subscriptions
  UNION ALL
  SELECT id, user_id, started_at, expires_at, 'DRAW_CREATE',
         CASE plan WHEN 'starter' THEN 1 WHEN 'basic' THEN 3 ELSE NULL END
  FROM active_subscriptions
)
INSERT INTO feature_credit_buckets (
  user_id, feature, source, initial_amount, remaining_amount,
  starts_at, expires_at, subscription_id, source_ref
)
SELECT user_id, feature, 'PLAN', amount, amount, started_at, expires_at, id, 'subscription:' || id
FROM limits
ON CONFLICT (source_ref, feature) WHERE source_ref IS NOT NULL DO NOTHING;
