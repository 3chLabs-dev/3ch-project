-- Refund the last participant-image credit that the old consume response
-- incorrectly reported as denied after it had already been deducted.
WITH candidates AS (
  SELECT DISTINCT ON (usage."credit_bucket_id")
    usage."user_id",
    usage."feature",
    usage."request_key",
    usage."credit_bucket_id"
  FROM "feature_usage_events" usage
  JOIN "feature_credit_buckets" bucket
    ON bucket."id" = usage."credit_bucket_id"
  WHERE usage."action" = 'CONSUME'
    AND usage."feature" = 'VISION_SCAN'
    AND usage."reference_type" = 'PARTICIPANT_IMPORT'
    AND usage."request_key" IS NOT NULL
    AND bucket."remaining_amount" = 0
    AND bucket."initial_amount" IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM "feature_usage_events" refund
      WHERE refund."request_key" = usage."request_key" || ':refund'
    )
  ORDER BY usage."credit_bucket_id", usage."created_at" DESC
), inserted_refunds AS (
  INSERT INTO "feature_usage_events" (
    "user_id", "feature", "action", "amount", "request_key",
    "credit_bucket_id", "reference_type", "metadata"
  )
  SELECT
    candidate."user_id", candidate."feature", 'REFUND', 1,
    candidate."request_key" || ':refund', candidate."credit_bucket_id",
    'PARTICIPANT_IMPORT', '{"reason":"LAST_CREDIT_FALSE_DENIAL"}'::jsonb
  FROM candidates candidate
  ON CONFLICT ("request_key") WHERE "request_key" IS NOT NULL DO NOTHING
  RETURNING "credit_bucket_id"
), refund_totals AS (
  SELECT "credit_bucket_id", COUNT(*)::integer AS amount
  FROM inserted_refunds
  GROUP BY "credit_bucket_id"
)
UPDATE "feature_credit_buckets" bucket
SET "remaining_amount" = LEAST(
      bucket."initial_amount",
      bucket."remaining_amount" + refund_totals.amount
    ),
    "updated_at" = NOW()
FROM refund_totals
WHERE bucket."id" = refund_totals."credit_bucket_id";
