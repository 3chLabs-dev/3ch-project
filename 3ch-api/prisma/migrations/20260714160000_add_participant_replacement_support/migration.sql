ALTER TABLE league_participants
ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active',
ADD COLUMN withdrawn_at TIMESTAMP(3);

CREATE TABLE league_participant_replacements (
  id UUID PRIMARY KEY,
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES league_participants(id) ON DELETE CASCADE,
  previous_member_id INTEGER,
  previous_name VARCHAR(255) NOT NULL,
  previous_division VARCHAR(50),
  replacement_member_id INTEGER,
  replacement_name VARCHAR(255) NOT NULL,
  replacement_division VARCHAR(50),
  replaced_by_id INTEGER NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX league_participant_replacements_league_participant_idx
ON league_participant_replacements(league_id, participant_id);
