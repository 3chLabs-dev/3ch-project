ALTER TABLE league_matches
  ADD COLUMN IF NOT EXISTS is_program BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS program_round INT,
  ADD COLUMN IF NOT EXISTS program_block_type TEXT;

CREATE INDEX IF NOT EXISTS idx_league_matches_program
  ON league_matches(league_id, is_program, program_round);
