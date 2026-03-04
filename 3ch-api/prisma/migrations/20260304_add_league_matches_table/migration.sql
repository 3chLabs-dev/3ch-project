CREATE TABLE IF NOT EXISTS league_matches (
  id               UUID        PRIMARY KEY,
  league_id        UUID        NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  match_order      INT         NOT NULL,
  participant_a_id UUID        REFERENCES league_participants(id) ON DELETE SET NULL,
  participant_b_id UUID        REFERENCES league_participants(id) ON DELETE SET NULL,
  score_a          INT,
  score_b          INT,
  court            TEXT,
  status           TEXT        NOT NULL DEFAULT 'pending',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_league_matches_league_id ON league_matches(league_id);
