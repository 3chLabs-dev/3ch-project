CREATE TABLE "user_external_aliases" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "user_id" INTEGER NOT NULL,
  "group_id" TEXT NOT NULL,
  "alias" VARCHAR(60) NOT NULL,
  "normalized_alias" VARCHAR(60) NOT NULL,
  "source" VARCHAR(30) NOT NULL DEFAULT 'external',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_external_aliases_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_external_aliases_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "user_external_aliases_group_id_fkey"
    FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "user_external_aliases_user_group_source_name_key"
  ON "user_external_aliases"("user_id", "group_id", "source", "normalized_alias");

CREATE INDEX "user_external_aliases_group_name_idx"
  ON "user_external_aliases"("group_id", "normalized_alias");
