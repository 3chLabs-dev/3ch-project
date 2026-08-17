ALTER TABLE leagues
  ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'club_only',
  ADD COLUMN IF NOT EXISTS premium_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS premium_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS premium_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS venue_name VARCHAR(120),
  ADD COLUMN IF NOT EXISTS venue_address TEXT,
  ADD COLUMN IF NOT EXISTS venue_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS venue_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS venue_region_city VARCHAR(80),
  ADD COLUMN IF NOT EXISTS venue_region_district VARCHAR(80);

CREATE INDEX IF NOT EXISTS leagues_visibility_schedule_idx
  ON leagues (visibility, premium_enabled, start_date);

UPDATE pricing_plans
   SET feature_limits = COALESCE(feature_limits, '{}'::jsonb)
     || jsonb_build_object(
          'premium_promotion',
          CASE WHEN LOWER(code) = 'premium' THEN NULL ELSE 0 END
        )
 WHERE NOT COALESCE(feature_limits, '{}'::jsonb) ? 'premium_promotion';
