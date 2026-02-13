CREATE TABLE "league_participants" (
  "id" TEXT PRIMARY KEY,
  "league_id" TEXT NOT NULL REFERENCES "leagues"("id") ON DELETE CASCADE,
  "division" TEXT,
  "name" TEXT NOT NULL,
  "paid" BOOLEAN NOT NULL DEFAULT FALSE,
  "arrived" BOOLEAN NOT NULL DEFAULT FALSE,
  "foot_pool" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "league_participants_league_id_idx" ON "league_participants"("league_id");

ALTER TABLE "league_participants" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
