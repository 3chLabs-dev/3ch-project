CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(160) NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'active', 'completed')),
  premium_visible BOOLEAN NOT NULL DEFAULT FALSE,
  host_group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
  created_by_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at >= starts_at)
);
CREATE INDEX tournaments_premium_visible_starts_at_idx ON tournaments(premium_visible, starts_at);
CREATE INDEX tournaments_host_group_id_starts_at_idx ON tournaments(host_group_id, starts_at);

CREATE TABLE tournament_divisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE RESTRICT,
  name VARCHAR(80) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  league_type VARCHAR(40),
  format VARCHAR(40),
  rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  recruit_count INTEGER CHECK (recruit_count IS NULL OR recruit_count > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'locked', 'active', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, name)
);
CREATE INDEX tournament_divisions_tournament_id_sort_order_idx ON tournament_divisions(tournament_id, sort_order);

CREATE TABLE tournament_invited_groups (
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE RESTRICT,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tournament_id, group_id)
);
CREATE INDEX tournament_invited_groups_group_id_status_idx ON tournament_invited_groups(group_id, status);

CREATE TABLE tournament_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id UUID NOT NULL REFERENCES tournament_divisions(id) ON DELETE RESTRICT,
  member_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
  source_group_id TEXT REFERENCES groups(id) ON DELETE RESTRICT,
  name VARCHAR(120) NOT NULL,
  member_division VARCHAR(40),
  status VARCHAR(20) NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'confirmed', 'withdrawn', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (division_id, member_id)
);
CREATE INDEX tournament_participants_division_id_status_idx ON tournament_participants(division_id, status);

CREATE TABLE tournament_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id UUID NOT NULL REFERENCES tournament_divisions(id) ON DELETE RESTRICT,
  participant_a_id UUID REFERENCES tournament_participants(id) ON DELETE RESTRICT,
  participant_b_id UUID REFERENCES tournament_participants(id) ON DELETE RESTRICT,
  phase VARCHAR(40) NOT NULL,
  pool_name VARCHAR(40),
  round_no INTEGER,
  match_order INTEGER NOT NULL,
  score_a INTEGER,
  score_b INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (participant_a_id IS NULL OR participant_b_id IS NULL OR participant_a_id <> participant_b_id)
);
CREATE INDEX tournament_matches_division_id_phase_round_no_match_order_idx ON tournament_matches(division_id, phase, round_no, match_order);

CREATE OR REPLACE FUNCTION check_tournament_match_participants() RETURNS trigger AS $$
BEGIN
  IF NEW.participant_a_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM tournament_participants WHERE id = NEW.participant_a_id AND division_id = NEW.division_id
  ) THEN RAISE EXCEPTION 'participant A belongs to another tournament division'; END IF;
  IF NEW.participant_b_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM tournament_participants WHERE id = NEW.participant_b_id AND division_id = NEW.division_id
  ) THEN RAISE EXCEPTION 'participant B belongs to another tournament division'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER tournament_match_participants_same_division
  BEFORE INSERT OR UPDATE OF division_id, participant_a_id, participant_b_id ON tournament_matches
  FOR EACH ROW EXECUTE FUNCTION check_tournament_match_participants();
