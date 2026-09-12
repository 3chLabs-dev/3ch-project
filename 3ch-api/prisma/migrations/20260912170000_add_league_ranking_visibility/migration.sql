ALTER TABLE "leagues"
  ADD COLUMN IF NOT EXISTS "ranking_visibility" TEXT NOT NULL DEFAULT 'public';

