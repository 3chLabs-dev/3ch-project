ALTER TABLE "groups"
ADD COLUMN "activity_venues" JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE "groups"
SET "activity_venues" = jsonb_build_array(jsonb_build_object(
  'id', gen_random_uuid()::text,
  'name', COALESCE(NULLIF(address_detail, ''), '기본 활동 장소'),
  'address', address,
  'address_detail', COALESCE(address_detail, ''),
  'lat', lat,
  'lng', lng,
  'region_city', region_city,
  'region_district', region_district,
  'is_default', true
))
WHERE NULLIF(address, '') IS NOT NULL;
