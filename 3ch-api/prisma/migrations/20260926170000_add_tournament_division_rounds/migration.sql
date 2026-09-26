CREATE TABLE tournament_division_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id UUID NOT NULL REFERENCES tournament_divisions(id) ON DELETE RESTRICT,
  round_no INTEGER NOT NULL CHECK (round_no > 0),
  league_type VARCHAR(40) NOT NULL,
  format VARCHAR(40) NOT NULL,
  rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (division_id, round_no)
);

INSERT INTO tournament_division_rounds (division_id, round_no, league_type, format, rules)
SELECT id, 1, league_type, format, rules FROM tournament_divisions;
