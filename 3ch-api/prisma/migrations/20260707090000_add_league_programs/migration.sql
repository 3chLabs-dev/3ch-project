CREATE TABLE "league_programs" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "league_id" TEXT NOT NULL,
  "program_data" JSONB NOT NULL,
  "created_by_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "league_programs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "league_programs_league_id_key" ON "league_programs"("league_id");

ALTER TABLE "league_programs"
  ADD CONSTRAINT "league_programs_league_id_fkey"
  FOREIGN KEY ("league_id") REFERENCES "leagues"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "league_programs"
  ADD CONSTRAINT "league_programs_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
