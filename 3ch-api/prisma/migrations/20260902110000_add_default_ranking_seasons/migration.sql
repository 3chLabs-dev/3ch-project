ALTER TABLE "group_ranking_seasons"
ADD COLUMN "is_default" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "group_ranking_seasons_group_default_year_key"
ON "group_ranking_seasons" ("group_id", "start_date")
WHERE "is_default" = true;
