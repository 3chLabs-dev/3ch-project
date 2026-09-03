ALTER TABLE "league_matches"
  ADD COLUMN IF NOT EXISTS "participant_a_seed_label" TEXT,
  ADD COLUMN IF NOT EXISTS "participant_b_seed_label" TEXT;
