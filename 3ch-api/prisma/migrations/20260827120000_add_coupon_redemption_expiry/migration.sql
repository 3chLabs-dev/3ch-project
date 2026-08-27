ALTER TABLE "coupon_redemptions" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ;
UPDATE "coupon_redemptions" redemption
   SET "expires_at" = CASE
     WHEN coupon."type" = 'FREE_MONTHS' THEN redemption."redeemed_at" + INTERVAL '30 days'
     ELSE coupon."valid_until"
   END
  FROM "coupons" coupon
 WHERE coupon."id" = redemption."coupon_id"
   AND redemption."expires_at" IS NULL;
UPDATE "feature_credit_buckets" bucket
   SET "expires_at" = redemption."expires_at", "updated_at" = NOW()
  FROM "coupon_redemptions" redemption
 WHERE bucket."source" = 'COUPON'
   AND bucket."source_ref" = 'coupon:' || redemption."coupon_id"::text || ':' || redemption."user_id"::text;
ALTER TABLE "coupon_redemptions" ALTER COLUMN "expires_at" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "coupon_redemptions_available_expiry_idx" ON "coupon_redemptions"("user_id", "status", "expires_at");
