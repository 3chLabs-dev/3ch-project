ALTER TABLE "group_ranking_seasons"
ADD COLUMN "is_display_default" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "group_ranking_seasons_group_display_default_key"
ON "group_ranking_seasons" ("group_id")
WHERE "is_display_default" = true;

