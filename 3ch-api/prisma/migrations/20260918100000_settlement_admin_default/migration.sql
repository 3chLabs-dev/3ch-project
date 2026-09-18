-- 새 권한 도입 직후 운영진에게 저장된 false 값도 기본 허용으로 바로잡는다.
-- 이후 리더가 권한 화면에서 끄면 그 선택은 유지된다.
UPDATE group_members
SET management_permissions = jsonb_set(
  COALESCE(management_permissions, '{}'::jsonb),
  '{settlement}',
  'true'::jsonb,
  true
)
WHERE role = 'admin';
