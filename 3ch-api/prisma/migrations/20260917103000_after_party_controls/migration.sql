ALTER TABLE after_party_share_links
  ADD COLUMN visibility VARCHAR(12) NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'club_only'));

ALTER TABLE after_party_settlements
  ADD COLUMN archived_at TIMESTAMPTZ,
  ADD COLUMN archived_by_id INTEGER REFERENCES users(id);

CREATE TABLE after_party_payments (
  league_id TEXT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL,
  paid_amount INTEGER CHECK (paid_amount IS NULL OR paid_amount >= 0),
  updated_by_id INTEGER NOT NULL REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (league_id, participant_id)
);
