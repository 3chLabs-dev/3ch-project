CREATE TABLE IF NOT EXISTS after_party_menu_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  alcohol_keywords TEXT[] NOT NULL DEFAULT ARRAY['맥주','소주','막걸리','생맥주','카스','테라','참이슬','처음처럼','진로이즈백','새로','청하'],
  beverage_keywords TEXT[] NOT NULL DEFAULT ARRAY['음료수','콜라','사이다','환타','코카콜라','펩시'],
  updated_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO after_party_menu_settings(id) VALUES(1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS after_party_receipt_scans (
  id UUID PRIMARY KEY,
  league_id TEXT NOT NULL REFERENCES leagues(id) ON DELETE RESTRICT,
  settlement_id UUID REFERENCES after_party_settlements(id) ON DELETE SET NULL,
  round_no INTEGER,
  requested_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('processing','success','failed')),
  engine VARCHAR(100), merchant VARCHAR(200), purchased_at VARCHAR(100),
  receipt_total INTEGER, recognized_total INTEGER, difference INTEGER,
  item_count INTEGER NOT NULL DEFAULT 0,
  result JSONB, error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_after_party_receipt_scans_created ON after_party_receipt_scans(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_after_party_receipt_scans_league ON after_party_receipt_scans(league_id, created_at DESC);
