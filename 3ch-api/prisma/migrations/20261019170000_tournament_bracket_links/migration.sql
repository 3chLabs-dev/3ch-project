-- Add persisted bracket topology. Historical matches and results are not rewritten.
ALTER TABLE tournament_matches
  ADD COLUMN next_match_id UUID,
  ADD COLUMN next_slot VARCHAR(1),
  ADD COLUMN loser_next_match_id UUID,
  ADD COLUMN loser_next_slot VARCHAR(1),
  ADD COLUMN bracket VARCHAR(20),
  ADD COLUMN bracket_index INTEGER,
  ADD COLUMN match_label VARCHAR(100),
  ADD COLUMN is_bye BOOLEAN NOT NULL DEFAULT FALSE,
  ADD CONSTRAINT tournament_match_next_slot CHECK (next_slot IS NULL OR next_slot IN ('a','b')),
  ADD CONSTRAINT tournament_match_loser_slot CHECK (loser_next_slot IS NULL OR loser_next_slot IN ('a','b'));
CREATE INDEX tournament_matches_next_idx ON tournament_matches(next_match_id);
CREATE INDEX tournament_matches_loser_next_idx ON tournament_matches(loser_next_match_id);
