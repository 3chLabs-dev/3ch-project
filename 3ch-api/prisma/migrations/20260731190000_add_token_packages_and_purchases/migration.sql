CREATE TABLE "token_packages" (
  "id" SERIAL NOT NULL,
  "code" VARCHAR(40) NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "price" INTEGER NOT NULL,
  "credits" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "is_visible" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "token_packages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "token_packages_code_key" UNIQUE ("code"),
  CONSTRAINT "token_packages_price_check" CHECK ("price" > 0)
);

CREATE INDEX "token_packages_visible_order_idx"
  ON "token_packages" ("is_visible", "display_order");

CREATE TABLE "token_purchases" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" INTEGER NOT NULL,
  "package_id" INTEGER NOT NULL,
  "order_id" VARCHAR(100) NOT NULL,
  "payment_key" VARCHAR(200) NOT NULL,
  "amount" INTEGER NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'PAID',
  "credits" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "token_purchases_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "token_purchases_order_id_key" UNIQUE ("order_id"),
  CONSTRAINT "token_purchases_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "token_purchases_package_id_fkey"
    FOREIGN KEY ("package_id") REFERENCES "token_packages"("id") ON DELETE RESTRICT
);

CREATE INDEX "token_purchases_user_created_idx"
  ON "token_purchases" ("user_id", "created_at");
