ALTER TABLE "coupon_redemptions" ADD COLUMN "applied_order_id" VARCHAR(100);
CREATE UNIQUE INDEX "coupon_redemptions_applied_order_id_key" ON "coupon_redemptions"("applied_order_id") WHERE "applied_order_id" IS NOT NULL;
