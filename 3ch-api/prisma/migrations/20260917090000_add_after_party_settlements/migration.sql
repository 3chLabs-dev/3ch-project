CREATE TABLE after_party_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id TEXT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  title VARCHAR(100) NOT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'final')),
  participants JSONB NOT NULL DEFAULT '[]'::jsonb,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  contributions JSONB NOT NULL DEFAULT '[]'::jsonb,
  calculation JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  created_by_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX after_party_settlements_league_id_idx ON after_party_settlements(league_id);
