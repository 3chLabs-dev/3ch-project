UPDATE "users"
SET "system_role" = 'MASTER'
WHERE LOWER("email") = 'admin@3ch.com'
  AND "deleted_at" IS NULL;
