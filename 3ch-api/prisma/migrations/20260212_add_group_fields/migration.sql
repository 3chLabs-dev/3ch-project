-- Add region and founded_at fields to groups
ALTER TABLE "groups" ADD COLUMN "region_city" TEXT;
ALTER TABLE "groups" ADD COLUMN "region_district" TEXT;
ALTER TABLE "groups" ADD COLUMN "founded_at" TIMESTAMP(3);

-- Add unique constraint on group name
CREATE UNIQUE INDEX "groups_name_key" ON "groups"("name");
