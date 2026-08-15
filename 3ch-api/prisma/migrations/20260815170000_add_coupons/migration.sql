CREATE TABLE "coupons" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "code" VARCHAR(50) NOT NULL,
  "normalized_code" VARCHAR(50) NOT NULL UNIQUE, "distribution_type" VARCHAR(20) NOT NULL DEFAULT 'SINGLE',
  "max_redemptions" INTEGER,
  "name" VARCHAR(100) NOT NULL, "type" VARCHAR(30) NOT NULL, "value" INTEGER NOT NULL,
  "plan_code" VARCHAR(30), "valid_from" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "valid_until" TIMESTAMPTZ NOT NULL, "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_by_id" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "coupons_value_check" CHECK ("value" > 0),
  CONSTRAINT "coupons_type_check" CHECK ("type" IN ('FREE_MONTHS','PERCENT_DISCOUNT','LEAGUE_CREATE','VISION_SCAN','DRAW_CREATE')),
  CONSTRAINT "coupons_discount_check" CHECK ("type" <> 'PERCENT_DISCOUNT' OR "value" <= 99),
  CONSTRAINT "coupons_dates_check" CHECK ("valid_until" > "valid_from")
  ,CONSTRAINT "coupons_distribution_check" CHECK ("distribution_type" IN ('SINGLE','OPEN'))
  ,CONSTRAINT "coupons_max_redemptions_check" CHECK ("max_redemptions" IS NULL OR "max_redemptions" > 0)
);
CREATE TABLE "coupon_redemptions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "coupon_id" UUID NOT NULL REFERENCES "coupons"("id") ON DELETE RESTRICT,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "status" VARCHAR(20) NOT NULL DEFAULT 'REDEEMED', "benefit" JSONB NOT NULL DEFAULT '{}',
  "redeemed_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "applied_at" TIMESTAMPTZ
);
CREATE UNIQUE INDEX "coupon_redemptions_coupon_user_key" ON "coupon_redemptions"("coupon_id", "user_id");
CREATE INDEX "coupons_status_dates_idx" ON "coupons"("is_active", "valid_from", "valid_until");
CREATE INDEX "coupon_redemptions_user_idx" ON "coupon_redemptions"("user_id", "redeemed_at" DESC);
