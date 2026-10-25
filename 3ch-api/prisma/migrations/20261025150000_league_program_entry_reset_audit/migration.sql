CREATE TABLE league_program_entry_reset_audit (
  id BIGSERIAL PRIMARY KEY,
  league_id TEXT NOT NULL,
  actor_id INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX league_program_entry_reset_audit_league_idx ON league_program_entry_reset_audit(league_id, created_at);
