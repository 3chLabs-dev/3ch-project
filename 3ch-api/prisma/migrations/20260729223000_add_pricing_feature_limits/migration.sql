ALTER TABLE "pricing_plans"
ADD COLUMN IF NOT EXISTS "feature_limits" JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE "pricing_plans"
SET "feature_limits" = CASE LOWER("code")
  WHEN 'starter' THEN '{"club_create":null,"club_join":null,"league_create":1,"tournament_create":0,"event_join":null,"vision_scan":0,"draw_create":1}'::jsonb
  WHEN 'basic' THEN '{"club_create":null,"club_join":null,"league_create":3,"tournament_create":0,"event_join":null,"vision_scan":3,"draw_create":3}'::jsonb
  WHEN 'pro' THEN '{"club_create":null,"club_join":null,"league_create":null,"tournament_create":0,"event_join":null,"vision_scan":20,"draw_create":null}'::jsonb
  WHEN 'premium' THEN '{"club_create":null,"club_join":null,"league_create":null,"tournament_create":null,"event_join":null,"vision_scan":null,"draw_create":null}'::jsonb
  ELSE '{}'::jsonb
END;

UPDATE "feature_credit_buckets"
SET "feature" = 'LEAGUE_CREATE'
WHERE "feature" = 'EVENT_CREATE';

UPDATE "feature_usage_events"
SET "feature" = 'LEAGUE_CREATE'
WHERE "feature" = 'EVENT_CREATE';

INSERT INTO "feature_credit_buckets"
  ("id", "user_id", "feature", "source", "source_ref", "initial_amount",
   "remaining_amount", "starts_at", "expires_at", "created_at", "updated_at")
SELECT
  gen_random_uuid(),
  s."user_id",
  feature_row.feature,
  'PLAN',
  'subscription:' || s."id"::text,
  feature_row.amount,
  feature_row.amount,
  s."started_at",
  s."expires_at",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "subscriptions" s
JOIN "pricing_plans" p ON LOWER(p."code") = LOWER(s."plan")
CROSS JOIN LATERAL (
  VALUES
    ('CLUB_CREATE',       NULLIF(p."feature_limits"->>'club_create', '')::integer),
    ('CLUB_JOIN',         NULLIF(p."feature_limits"->>'club_join', '')::integer),
    ('LEAGUE_CREATE',     NULLIF(p."feature_limits"->>'league_create', '')::integer),
    ('TOURNAMENT_CREATE', NULLIF(p."feature_limits"->>'tournament_create', '')::integer),
    ('EVENT_JOIN',        NULLIF(p."feature_limits"->>'event_join', '')::integer),
    ('VISION_SCAN',       NULLIF(p."feature_limits"->>'vision_scan', '')::integer),
    ('DRAW_CREATE',       NULLIF(p."feature_limits"->>'draw_create', '')::integer)
) AS feature_row(feature, amount)
WHERE s."status" = 'ACTIVE'
  AND (s."expires_at" IS NULL OR s."expires_at" > CURRENT_TIMESTAMP)
ON CONFLICT ("source_ref", "feature") WHERE "source_ref" IS NOT NULL DO NOTHING;
