ALTER TABLE "group_pre_members" ADD COLUMN IF NOT EXISTS "external_aliases" JSONB NOT NULL DEFAULT '[]'::jsonb;
