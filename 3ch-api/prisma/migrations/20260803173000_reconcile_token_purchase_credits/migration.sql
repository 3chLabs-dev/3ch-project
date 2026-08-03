-- Reconcile paid token purchases with their actual usage history.
WITH purchase_credits AS (
  SELECT
    tp."id" AS purchase_id,
    tp."user_id",
    tp."created_at" AS starts_at,
    tp."expires_at",
    CASE credit.key
      WHEN 'club_create' THEN 'CLUB_CREATE'
      WHEN 'club_join' THEN 'CLUB_JOIN'
      WHEN 'league_create' THEN 'LEAGUE_CREATE'
      WHEN 'event_create' THEN 'LEAGUE_CREATE'
      WHEN 'tournament_create' THEN 'TOURNAMENT_CREATE'
      WHEN 'event_join' THEN 'EVENT_JOIN'
      WHEN 'vision_scan' THEN 'VISION_SCAN'
      WHEN 'draw_create' THEN 'DRAW_CREATE'
    END AS feature,
    credit.value::integer AS amount,
    'token:' || tp."id"::text AS source_ref
  FROM "token_purchases" tp
  LEFT JOIN "token_packages" pkg ON pkg."id" = tp."package_id"
  CROSS JOIN LATERAL jsonb_each_text(
    COALESCE(tp."credits", '{}'::jsonb) || COALESCE(pkg."credits", '{}'::jsonb)
  ) AS credit(key, value)
  WHERE tp."status" = 'PAID'
    AND credit.key IN (
      'club_create', 'club_join', 'league_create', 'event_create',
      'tournament_create', 'event_join', 'vision_scan', 'draw_create'
    )
    AND credit.value ~ '^[0-9]+$'
    AND credit.value::integer > 0
), actual_usage AS (
  SELECT
    bucket."source_ref",
    bucket."feature",
    COALESCE(SUM(
      CASE usage."action"
        WHEN 'CONSUME' THEN usage."amount"
        WHEN 'REFUND' THEN -usage."amount"
        ELSE 0
      END
    ), 0)::integer AS consumed
  FROM "feature_credit_buckets" bucket
  LEFT JOIN "feature_usage_events" usage
    ON usage."credit_bucket_id" = bucket."id"
  WHERE bucket."source" = 'PURCHASE'
  GROUP BY bucket."source_ref", bucket."feature"
)
INSERT INTO "feature_credit_buckets" (
  "user_id", "feature", "source", "initial_amount", "remaining_amount",
  "starts_at", "expires_at", "source_ref"
)
SELECT
  purchase."user_id",
  purchase.feature,
  'PURCHASE',
  purchase.amount,
  GREATEST(purchase.amount - COALESCE(usage.consumed, 0), 0),
  purchase.starts_at,
  purchase.expires_at,
  purchase.source_ref
FROM purchase_credits purchase
LEFT JOIN actual_usage usage
  ON usage."source_ref" = purchase.source_ref
 AND usage."feature" = purchase.feature
ON CONFLICT ("source_ref", "feature") WHERE "source_ref" IS NOT NULL
DO UPDATE SET
  "initial_amount" = EXCLUDED."initial_amount",
  "remaining_amount" = EXCLUDED."remaining_amount",
  "expires_at" = EXCLUDED."expires_at",
  "updated_at" = NOW()
WHERE "feature_credit_buckets"."source" = 'PURCHASE';
