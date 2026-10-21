-- Additive storage for the league program/formation UI. No existing record is rewritten.
ALTER TABLE tournament_divisions ADD COLUMN league_program JSONB;
ALTER TABLE tournament_matches ADD COLUMN league_data JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE tournament_competition_audit (
  id BIGSERIAL PRIMARY KEY,
  tournament_id UUID NOT NULL,
  division_id UUID NOT NULL,
  actor_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
