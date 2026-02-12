-- Remove end_date column from leagues table
ALTER TABLE "leagues" DROP COLUMN IF EXISTS "end_date";
