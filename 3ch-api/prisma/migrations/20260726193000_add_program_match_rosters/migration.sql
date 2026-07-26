ALTER TABLE league_matches
  ADD COLUMN IF NOT EXISTS participant_a_roster_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS participant_b_roster_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
