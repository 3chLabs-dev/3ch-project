CREATE TABLE IF NOT EXISTS "support_chat_rooms" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'open',
  "last_message_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "support_chat_rooms_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "support_chat_rooms_user_id_key" UNIQUE ("user_id"),
  CONSTRAINT "support_chat_rooms_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "support_chat_messages" (
  "id" SERIAL NOT NULL,
  "room_id" INTEGER NOT NULL,
  "sender_type" VARCHAR(20) NOT NULL,
  "sender_id" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "support_chat_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "support_chat_messages_sender_type_check"
    CHECK ("sender_type" IN ('user', 'admin')),
  CONSTRAINT "support_chat_messages_room_id_fkey"
    FOREIGN KEY ("room_id") REFERENCES "support_chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "support_chat_messages_sender_id_fkey"
    FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "support_chat_rooms_last_message_at_idx"
  ON "support_chat_rooms"("last_message_at" DESC);

CREATE INDEX IF NOT EXISTS "support_chat_messages_room_id_id_idx"
  ON "support_chat_messages"("room_id", "id");
