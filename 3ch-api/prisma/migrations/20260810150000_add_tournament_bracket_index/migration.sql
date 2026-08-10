-- Existing matches belong to the first bracket unless explicitly assigned.
ALTER TABLE "league_matches"
  ADD COLUMN IF NOT EXISTS "tournament_bracket_index" INTEGER DEFAULT 1;

UPDATE "league_matches"
SET "tournament_bracket_index" = 1
WHERE "tournament_bracket_index" IS NULL;

CREATE INDEX IF NOT EXISTS "idx_league_matches_tournament_bracket"
  ON "league_matches" ("league_id", "program_round", "tournament_bracket_index");
