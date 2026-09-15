-- Reconcile only legacy-backfilled default venues. Those rows used the old
-- address_detail value as both the venue name and address_detail.
UPDATE "groups" AS g
SET "activity_venues" = (
  SELECT jsonb_agg(
    CASE
      WHEN venue->>'is_default' = 'true'
       AND venue->>'name' = venue->>'address_detail'
       AND NULLIF(g.address_detail, '') IS NOT NULL
       AND venue->>'address_detail' IS DISTINCT FROM g.address_detail
      THEN venue || jsonb_build_object(
        'name', g.address_detail,
        'address', COALESCE(g.address, ''),
        'address_detail', g.address_detail
      )
      ELSE venue
    END
    ORDER BY ordinal
  )
  FROM jsonb_array_elements(g.activity_venues) WITH ORDINALITY AS items(venue, ordinal)
)
WHERE jsonb_typeof(g.activity_venues) = 'array'
  AND jsonb_array_length(g.activity_venues) > 0
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(g.activity_venues) AS legacy(venue)
    WHERE legacy.venue->>'is_default' = 'true'
      AND legacy.venue->>'name' = legacy.venue->>'address_detail'
      AND NULLIF(g.address_detail, '') IS NOT NULL
      AND legacy.venue->>'address_detail' IS DISTINCT FROM g.address_detail
  );
