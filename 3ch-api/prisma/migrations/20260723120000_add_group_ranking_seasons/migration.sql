CREATE TABLE "group_ranking_seasons" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "group_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "auto_renew" BOOLEAN NOT NULL DEFAULT false,
  "created_by_id" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "group_ranking_seasons_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "group_ranking_seasons_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "group_ranking_seasons_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "group_ranking_seasons_date_check" CHECK ("end_date" >= "start_date")
);

CREATE INDEX "group_ranking_seasons_group_id_start_date_end_date_idx"
  ON "group_ranking_seasons"("group_id", "start_date", "end_date");
