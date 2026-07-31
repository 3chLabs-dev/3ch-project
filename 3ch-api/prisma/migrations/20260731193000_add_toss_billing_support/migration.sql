CREATE TABLE "billing_payment_methods" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "customer_key" VARCHAR(100) NOT NULL,
  "billing_key_encrypted" TEXT,
  "card_company" VARCHAR(50),
  "card_number" VARCHAR(50),
  "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  "authenticated_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_payment_methods_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "billing_payment_methods_user_id_key" UNIQUE ("user_id"),
  CONSTRAINT "billing_payment_methods_customer_key_key" UNIQUE ("customer_key"),
  CONSTRAINT "billing_payment_methods_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

ALTER TABLE "subscriptions"
  ADD COLUMN "billing_method_id" INTEGER,
  ADD COLUMN "is_recurring" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "canceled_at" TIMESTAMPTZ(6);

ALTER TABLE "subscriptions"
  ADD CONSTRAINT "subscriptions_billing_method_id_fkey"
  FOREIGN KEY ("billing_method_id") REFERENCES "billing_payment_methods"("id")
  ON DELETE SET NULL;

CREATE INDEX "billing_payment_methods_status_idx"
  ON "billing_payment_methods"("status");

CREATE INDEX "subscriptions_recurring_due_idx"
  ON "subscriptions"("status", "is_recurring", "cancel_at_period_end", "expires_at");
