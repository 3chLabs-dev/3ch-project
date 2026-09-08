CREATE TABLE "league_point_ranking_overrides" (
  "league_id" TEXT NOT NULL, "season_id" TEXT NOT NULL, "enabled" BOOLEAN NOT NULL DEFAULT false,
  "point_rules" JSONB, "updated_by_id" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("league_id", "season_id"),
  FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE,
  FOREIGN KEY ("season_id") REFERENCES "group_ranking_seasons"("id") ON DELETE CASCADE,
  FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT
);
CREATE TABLE "league_point_ranking_adjustments" (
  "league_id" TEXT NOT NULL, "season_id" TEXT NOT NULL, "participant_id" TEXT NOT NULL,
  "league_points" NUMERIC(10,1) NOT NULL DEFAULT 0, "tournament_points" NUMERIC(10,1) NOT NULL DEFAULT 0,
  "championships" INTEGER NOT NULL DEFAULT 0, "updated_by_id" INTEGER NOT NULL, "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("league_id", "season_id", "participant_id"),
  FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE,
  FOREIGN KEY ("season_id") REFERENCES "group_ranking_seasons"("id") ON DELETE CASCADE,
  FOREIGN KEY ("participant_id") REFERENCES "league_participants"("id") ON DELETE CASCADE,
  FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT
);
