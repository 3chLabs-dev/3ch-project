CREATE TABLE "pricing_plans" (
  "id" SERIAL NOT NULL,
  "code" VARCHAR(30) NOT NULL,
  "name" VARCHAR(50) NOT NULL,
  "badge_text" VARCHAR(50),
  "price" INTEGER NOT NULL DEFAULT 0,
  "original_price" INTEGER,
  "billing_cycle" VARCHAR(20) NOT NULL DEFAULT 'MONTHLY',
  "sale_start_at" TIMESTAMPTZ(6),
  "sale_end_at" TIMESTAMPTZ(6),
  "features" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "is_visible" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pricing_plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pricing_plans_code_key" ON "pricing_plans"("code");
CREATE INDEX "pricing_plans_is_visible_display_order_idx" ON "pricing_plans"("is_visible", "display_order");

INSERT INTO "pricing_plans"
  ("code", "name", "badge_text", "price", "original_price", "billing_cycle", "features", "display_order", "is_visible")
VALUES
  ('starter', 'STARTER', NULL, 0, NULL, 'MONTHLY',
   '["클럽 생성 무제한","클럽 가입 무제한","리그 생성 1회","리그·대회 참가 무제한","추첨 생성 1회","추첨 결과 확인 무제한"]'::jsonb, 1, true),
  ('basic', 'BASIC', '50% 할인', 4900, 9900, 'MONTHLY',
   '["STARTER 혜택","리그 생성 월 3회","대진표 사진 인식 월 3회","추첨 생성 월 3회"]'::jsonb, 2, true),
  ('pro', 'PRO', '인기', 9900, 14900, 'MONTHLY',
   '["BASIC 혜택","리그 생성 무제한","대진표 사진 인식 월 20회","추첨 생성 무제한"]'::jsonb, 3, true),
  ('premium', 'PREMIUM', '베스트', 19900, 24900, 'MONTHLY',
   '["PRO 혜택","대회 생성 무제한","대진표 사진 인식 월 500회","AI 추천 클럽 상단 배치"]'::jsonb, 4, true);
