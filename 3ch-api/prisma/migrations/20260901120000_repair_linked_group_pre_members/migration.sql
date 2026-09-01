-- 승인 완료 상태지만 실제 클럽 회원 행이 누락된 기존 데이터를 복구한다.
INSERT INTO "group_members" ("id", "group_id", "user_id", "role", "division", "joined_at")
SELECT gen_random_uuid()::text,
       pm."group_id",
       COALESCE(pm."linked_user_id", claim."requested_by_id"),
       'member',
       pm."division",
       pm."updated_at"
FROM "group_pre_members" pm
LEFT JOIN "group_member_claims" claim
  ON claim."pre_member_id" = pm."id"
 AND claim."status" = 'approved'
WHERE pm."status" = 'linked'
  AND COALESCE(pm."linked_user_id", claim."requested_by_id") IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "group_members" gm
    WHERE gm."group_id" = pm."group_id"
      AND gm."user_id" = COALESCE(pm."linked_user_id", claim."requested_by_id")
  )
ON CONFLICT ("group_id", "user_id") DO NOTHING;
