-- Match start persists 'playing'; retain every existing status and result.
ALTER TABLE tournament_matches
  DROP CONSTRAINT tournament_matches_status_check,
  ADD CONSTRAINT tournament_matches_status_check
    CHECK (status IN ('pending', 'playing', 'completed', 'cancelled'));
