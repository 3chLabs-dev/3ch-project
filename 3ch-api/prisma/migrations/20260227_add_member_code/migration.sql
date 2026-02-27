-- member_code 컬럼 추가
ALTER TABLE users ADD COLUMN IF NOT EXISTS member_code VARCHAR(13) UNIQUE;

-- 기존 유저 백필: M + YYYYMMDD + 4자리 순번 (같은 날 가입 순서)
WITH numbered AS (
  SELECT
    id,
    'M' || TO_CHAR(created_at, 'YYYYMMDD') ||
    LPAD(
      ROW_NUMBER() OVER (
        PARTITION BY DATE(created_at)
        ORDER BY created_at, id
      )::text,
      4, '0'
    ) AS code
  FROM users
  WHERE member_code IS NULL
    AND is_admin = false
)
UPDATE users u
SET member_code = n.code
FROM numbered n
WHERE u.id = n.id;
