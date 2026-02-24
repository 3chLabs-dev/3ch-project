-- 추첨 테이블
CREATE TABLE IF NOT EXISTS draws (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  league_id TEXT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  created_by_id INT NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 경품 테이블
CREATE TABLE IF NOT EXISTS draw_prizes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  draw_id TEXT NOT NULL REFERENCES draws(id) ON DELETE CASCADE,
  prize_name VARCHAR NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  display_order INT DEFAULT 0
);

-- 당첨자 테이블
CREATE TABLE IF NOT EXISTS draw_winners (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  draw_id TEXT NOT NULL REFERENCES draws(id) ON DELETE CASCADE,
  prize_id TEXT NOT NULL REFERENCES draw_prizes(id) ON DELETE CASCADE,
  participant_name VARCHAR NOT NULL,
  participant_division VARCHAR,
  display_order INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_draws_league_id ON draws(league_id);
CREATE INDEX IF NOT EXISTS idx_draw_prizes_draw_id ON draw_prizes(draw_id);
CREATE INDEX IF NOT EXISTS idx_draw_winners_draw_id ON draw_winners(draw_id);
CREATE INDEX IF NOT EXISTS idx_draw_winners_prize_id ON draw_winners(prize_id);
