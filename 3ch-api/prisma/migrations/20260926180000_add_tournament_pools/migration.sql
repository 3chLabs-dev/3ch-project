CREATE TABLE tournament_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id UUID NOT NULL REFERENCES tournament_divisions(id) ON DELETE RESTRICT,
  round_no INTEGER NOT NULL CHECK (round_no > 0),
  pool_no INTEGER NOT NULL CHECK (pool_no > 0),
  bracket_slot INTEGER NOT NULL CHECK (bracket_slot > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (division_id, round_no, pool_no),
  UNIQUE (division_id, round_no, bracket_slot)
);
CREATE INDEX tournament_pools_division_round_idx ON tournament_pools(division_id, round_no);

CREATE TABLE tournament_pool_members (
  pool_id UUID NOT NULL REFERENCES tournament_pools(id) ON DELETE RESTRICT,
  participant_id UUID NOT NULL REFERENCES tournament_participants(id) ON DELETE RESTRICT,
  slot_no INTEGER NOT NULL CHECK (slot_no > 0),
  PRIMARY KEY (pool_id, participant_id),
  UNIQUE (pool_id, slot_no)
);
CREATE INDEX tournament_pool_members_participant_idx ON tournament_pool_members(participant_id);
