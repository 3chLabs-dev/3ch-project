ALTER TABLE "support_chat_rooms"
  ALTER COLUMN "user_id" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "guest_name" VARCHAR(40),
  ADD COLUMN IF NOT EXISTS "guest_token_hash" TEXT;

ALTER TABLE "support_chat_messages"
  ALTER COLUMN "sender_id" DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "support_chat_rooms_guest_token_hash_key"
  ON "support_chat_rooms"("guest_token_hash");

ALTER TABLE "support_chat_rooms"
  ADD CONSTRAINT "support_chat_rooms_identity_check"
  CHECK (
    ("user_id" IS NOT NULL AND "guest_token_hash" IS NULL)
    OR
    ("user_id" IS NULL AND "guest_token_hash" IS NOT NULL AND "guest_name" IS NOT NULL)
  );
