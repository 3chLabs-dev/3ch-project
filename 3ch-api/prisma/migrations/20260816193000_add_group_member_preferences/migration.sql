ALTER TABLE "group_members"
  ADD COLUMN "display_order" INTEGER,
  ADD COLUMN "is_primary" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "group_members_user_id_primary_key"
  ON "group_members"("user_id")
  WHERE "is_primary" = true;
