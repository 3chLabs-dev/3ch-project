INSERT INTO "feature_credit_buckets" (
  "user_id", "feature", "source", "initial_amount", "remaining_amount",
  "starts_at", "expires_at", "source_ref"
)
SELECT
  tp."user_id",
  CASE credit.key
    WHEN 'club_create' THEN 'CLUB_CREATE'
    WHEN 'club_join' THEN 'CLUB_JOIN'
    WHEN 'league_create' THEN 'LEAGUE_CREATE'
    WHEN 'tournament_create' THEN 'TOURNAMENT_CREATE'
    WHEN 'event_join' THEN 'EVENT_JOIN'
    WHEN 'vision_scan' THEN 'VISION_SCAN'
    WHEN 'draw_create' THEN 'DRAW_CREATE'
  END,
  'PURCHASE',
  credit.value::integer,
  credit.value::integer,
  tp."created_at",
  tp."expires_at",
  'token:' || tp."id"::text
FROM "token_purchases" tp
CROSS JOIN LATERAL jsonb_each_text(tp."credits") AS credit(key, value)
WHERE credit.key IN (
  'club_create', 'club_join', 'league_create', 'tournament_create',
  'event_join', 'vision_scan', 'draw_create'
)
  AND credit.value ~ '^[0-9]+$'
  AND credit.value::integer > 0
ON CONFLICT ("source_ref", "feature") WHERE "source_ref" IS NOT NULL DO NOTHING;
