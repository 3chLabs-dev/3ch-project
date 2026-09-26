ALTER TABLE tournaments
  ADD COLUMN court_count INTEGER CHECK (court_count IS NULL OR court_count > 0),
  ADD COLUMN recruit_count INTEGER CHECK (recruit_count IS NULL OR recruit_count > 0);
