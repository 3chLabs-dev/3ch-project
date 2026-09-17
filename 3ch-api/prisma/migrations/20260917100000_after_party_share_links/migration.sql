CREATE TABLE after_party_share_links (
  league_id TEXT PRIMARY KEY REFERENCES leagues(id) ON DELETE CASCADE,
  token UUID NOT NULL UNIQUE,
  created_by_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
