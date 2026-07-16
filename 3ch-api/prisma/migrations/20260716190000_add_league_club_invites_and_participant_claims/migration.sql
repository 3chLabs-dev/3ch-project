CREATE TABLE "league_invited_groups" (
  "id" UUID NOT NULL,
  "league_id" UUID NOT NULL,
  "group_id" UUID NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
  "invited_by_id" INTEGER NOT NULL,
  "accepted_by_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "responded_at" TIMESTAMP(3),
  CONSTRAINT "league_invited_groups_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "league_invited_groups_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE,
  CONSTRAINT "league_invited_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE,
  CONSTRAINT "league_invited_groups_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id"),
  CONSTRAINT "league_invited_groups_accepted_by_id_fkey" FOREIGN KEY ("accepted_by_id") REFERENCES "users"("id")
);
CREATE UNIQUE INDEX "league_invited_groups_league_id_group_id_key" ON "league_invited_groups"("league_id", "group_id");
CREATE INDEX "league_invited_groups_group_id_status_idx" ON "league_invited_groups"("group_id", "status");

CREATE TABLE "league_participant_claims" (
  "participant_id" UUID NOT NULL,
  "code_hash" VARCHAR(64),
  "guest_token_hash" VARCHAR(64),
  "claimed_by_id" INTEGER,
  "claimed_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "league_participant_claims_pkey" PRIMARY KEY ("participant_id"),
  CONSTRAINT "league_participant_claims_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "league_participants"("id") ON DELETE CASCADE,
  CONSTRAINT "league_participant_claims_claimed_by_id_fkey" FOREIGN KEY ("claimed_by_id") REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE INDEX "league_participant_claims_guest_token_hash_idx" ON "league_participant_claims"("guest_token_hash");
