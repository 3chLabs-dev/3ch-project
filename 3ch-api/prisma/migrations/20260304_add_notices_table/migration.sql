CREATE TABLE notices (
  id           SERIAL PRIMARY KEY,
  title        TEXT NOT NULL,
  content      TEXT NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
