CREATE TABLE "league_program_templates" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "user_id" INTEGER NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "template_data" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "league_program_templates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "league_program_templates_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "league_program_templates_user_id_created_at_idx"
  ON "league_program_templates"("user_id", "created_at");
