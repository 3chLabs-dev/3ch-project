ALTER TABLE users
  ADD COLUMN admin_password_hash TEXT,
  ADD COLUMN admin_password_reset_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN admin_auth_version INTEGER NOT NULL DEFAULT 0;
