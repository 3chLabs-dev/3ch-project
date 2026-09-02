UPDATE "pricing_plans"
SET "feature_limits" = COALESCE("feature_limits", '{}'::jsonb)
  || jsonb_build_object(
    'ranking_season_create',
    CASE LOWER("code")
      WHEN 'starter' THEN 1
      WHEN 'basic' THEN 3
      WHEN 'pro' THEN NULL
      WHEN 'premium' THEN NULL
      ELSE 0
    END
  )
WHERE NOT COALESCE("feature_limits", '{}'::jsonb) ? 'ranking_season_create';

INSERT INTO "feature_credit_buckets" (
  "user_id", "feature", "source", "initial_amount", "remaining_amount",
  "starts_at", "expires_at", "subscription_id", "source_ref"
)
SELECT
  s."user_id",
  'RANKING_SEASON_CREATE',
  'PLAN',
  limits.amount,
  limits.amount,
  s."started_at",
  s."expires_at",
  s."id",
  'subscription:' || s."id"::text
FROM "subscriptions" s
JOIN "pricing_plans" p ON LOWER(p."code") = LOWER(s."plan")
CROSS JOIN LATERAL (
  SELECT NULLIF(p."feature_limits"->>'ranking_season_create', '')::integer AS amount
) limits
WHERE s."status" = 'ACTIVE'
  AND s."expires_at" > NOW()
ON CONFLICT ("source_ref", "feature") WHERE "source_ref" IS NOT NULL DO NOTHING;
