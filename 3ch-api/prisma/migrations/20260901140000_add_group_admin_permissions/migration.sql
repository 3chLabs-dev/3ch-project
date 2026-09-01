ALTER TABLE "group_members"
ADD COLUMN "management_permissions" JSONB NOT NULL DEFAULT '{"members":true,"ranking":true,"league":true,"draw":true}'::jsonb;

