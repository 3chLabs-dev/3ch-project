ALTER TABLE "league_participants"
ADD COLUMN "source_group_id" TEXT;

ALTER TABLE "league_participants"
ADD CONSTRAINT "league_participants_source_group_id_fkey"
FOREIGN KEY ("source_group_id") REFERENCES "groups"("id")
ON DELETE SET NULL;

CREATE INDEX "league_participants_source_group_id_idx"
ON "league_participants"("source_group_id");

UPDATE "league_participants" lp
SET "source_group_id" = (
  SELECT gm."group_id"
  FROM "leagues" l
  JOIN "group_members" gm ON gm."user_id" = lp."member_id"
  LEFT JOIN "league_invited_groups" lig
    ON lig."league_id" = l."id"
   AND lig."group_id" = gm."group_id"
   AND lig."status" = 'accepted'
  WHERE l."id" = lp."league_id"
    AND (gm."group_id" = l."group_id" OR lig."id" IS NOT NULL)
  ORDER BY CASE WHEN gm."group_id" = l."group_id" THEN 0 ELSE 1 END
  LIMIT 1
)
WHERE lp."member_id" IS NOT NULL;
