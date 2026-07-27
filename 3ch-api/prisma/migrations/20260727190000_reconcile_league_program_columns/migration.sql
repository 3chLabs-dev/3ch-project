-- Reconcile columns that were previously created at API startup.
-- Configuration and link columns remain nullable so existing rows stay valid.

ALTER TABLE "leagues"
  ADD COLUMN IF NOT EXISTS "tournament_seeding" TEXT,
  ADD COLUMN IF NOT EXISTS "tournament_advancement" TEXT,
  ADD COLUMN IF NOT EXISTS "tournament_rules" TEXT,
  ADD COLUMN IF NOT EXISTS "advance_count" INTEGER,
  ADD COLUMN IF NOT EXISTS "advance_method" TEXT,
  ADD COLUMN IF NOT EXISTS "finals_advance" INTEGER;

ALTER TABLE "league_matches"
  ADD COLUMN IF NOT EXISTS "bracket" TEXT,
  ADD COLUMN IF NOT EXISTS "round_number" INTEGER,
  ADD COLUMN IF NOT EXISTS "match_label" TEXT,
  ADD COLUMN IF NOT EXISTS "next_match_id" TEXT,
  ADD COLUMN IF NOT EXISTS "next_slot" TEXT,
  ADD COLUMN IF NOT EXISTS "loser_next_match_id" TEXT,
  ADD COLUMN IF NOT EXISTS "loser_next_slot" TEXT,
  ADD COLUMN IF NOT EXISTS "is_program" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "program_round" INTEGER,
  ADD COLUMN IF NOT EXISTS "program_block_type" TEXT;

CREATE INDEX IF NOT EXISTS "idx_league_matches_program"
  ON "league_matches" ("league_id", "is_program", "program_round");
