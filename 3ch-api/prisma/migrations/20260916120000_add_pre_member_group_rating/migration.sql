ALTER TABLE "group_ranking_settings"
  ADD COLUMN IF NOT EXISTS "rating_version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "group_rankings"
  ALTER COLUMN "member_id" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "pre_member_id" TEXT;

ALTER TABLE "group_ranking_events"
  ALTER COLUMN "member_id" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "pre_member_id" TEXT,
  ADD COLUMN IF NOT EXISTS "opponent_pre_member_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "group_rankings_group_id_pre_member_id_key"
  ON "group_rankings"("group_id", "pre_member_id");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_rankings_pre_member_id_fkey') THEN
    ALTER TABLE "group_rankings"
      ADD CONSTRAINT "group_rankings_pre_member_id_fkey"
      FOREIGN KEY ("pre_member_id") REFERENCES "group_pre_members"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_ranking_events_pre_member_id_fkey') THEN
    ALTER TABLE "group_ranking_events"
      ADD CONSTRAINT "group_ranking_events_pre_member_id_fkey"
      FOREIGN KEY ("pre_member_id") REFERENCES "group_pre_members"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_ranking_events_opponent_pre_member_id_fkey') THEN
    ALTER TABLE "group_ranking_events"
      ADD CONSTRAINT "group_ranking_events_opponent_pre_member_id_fkey"
      FOREIGN KEY ("opponent_pre_member_id") REFERENCES "group_pre_members"("id") ON DELETE SET NULL;
  END IF;
END $$;
