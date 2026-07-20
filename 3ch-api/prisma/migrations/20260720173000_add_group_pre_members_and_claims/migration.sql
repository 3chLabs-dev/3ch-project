CREATE TABLE "group_pre_members" (
  "id" UUID NOT NULL, "group_id" UUID NOT NULL, "name" TEXT NOT NULL, "division" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active', "created_by_id" INTEGER NOT NULL,
  "linked_user_id" INTEGER, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "group_pre_members_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "group_member_claims" (
  "id" UUID NOT NULL, "pre_member_id" UUID NOT NULL, "requested_by_id" INTEGER NOT NULL,
  "reviewed_by_id" INTEGER, "status" TEXT NOT NULL DEFAULT 'pending',
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "reviewed_at" TIMESTAMP(3),
  CONSTRAINT "group_member_claims_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "group_pre_members_group_id_status_idx" ON "group_pre_members"("group_id", "status");
CREATE UNIQUE INDEX "group_member_claims_pre_member_id_key" ON "group_member_claims"("pre_member_id");
CREATE INDEX "group_member_claims_requested_by_id_status_idx" ON "group_member_claims"("requested_by_id", "status");
ALTER TABLE "group_pre_members" ADD CONSTRAINT "group_pre_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "group_pre_members" ADD CONSTRAINT "group_pre_members_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "group_pre_members" ADD CONSTRAINT "group_pre_members_linked_user_id_fkey" FOREIGN KEY ("linked_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "group_member_claims" ADD CONSTRAINT "group_member_claims_pre_member_id_fkey" FOREIGN KEY ("pre_member_id") REFERENCES "group_pre_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "group_member_claims" ADD CONSTRAINT "group_member_claims_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "group_member_claims" ADD CONSTRAINT "group_member_claims_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
