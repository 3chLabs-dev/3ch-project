ALTER TABLE "groups"
ADD COLUMN IF NOT EXISTS "ranking_visibility" TEXT NOT NULL DEFAULT 'club_only';
