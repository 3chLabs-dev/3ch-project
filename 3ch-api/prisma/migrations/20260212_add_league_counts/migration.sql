-- Add recruit_count and participant_count columns to leagues table
ALTER TABLE "leagues" ADD COLUMN "recruit_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "leagues" ADD COLUMN "participant_count" INTEGER NOT NULL DEFAULT 0;