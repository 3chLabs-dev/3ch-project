CREATE TABLE group_links (
  id text PRIMARY KEY,
  group_id text NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  label text,
  url text NOT NULL,
  sort_order int4 NOT NULL DEFAULT 0,
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);