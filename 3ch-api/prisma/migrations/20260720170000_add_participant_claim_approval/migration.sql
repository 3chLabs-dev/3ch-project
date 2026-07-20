ALTER TABLE "league_participant_claims"
  ADD COLUMN "requested_by_id" INTEGER,
  ADD COLUMN "reviewed_by_id" INTEGER,
  ADD COLUMN "status" VARCHAR(20),
  ADD COLUMN "requested_at" TIMESTAMP(3),
  ADD COLUMN "reviewed_at" TIMESTAMP(3);

ALTER TABLE "league_participant_claims"
  ADD CONSTRAINT "league_participant_claims_requested_by_id_fkey"
    FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE SET NULL,
  ADD CONSTRAINT "league_participant_claims_reviewed_by_id_fkey"
    FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL;

CREATE INDEX "league_participant_claims_requested_by_id_status_idx"
  ON "league_participant_claims"("requested_by_id", "status");
