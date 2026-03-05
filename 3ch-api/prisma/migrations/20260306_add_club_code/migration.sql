-- club_code 컬럼 추가
ALTER TABLE groups ADD COLUMN IF NOT EXISTS club_code VARCHAR(13) UNIQUE;

-- 기존 클럽 백필: C + YYYYMMDD + 4자리 순번 (같은 날 생성 순서)
WITH numbered AS (
  SELECT
    id,
    'C' || TO_CHAR(created_at, 'YYYYMMDD') ||
    LPAD(
      ROW_NUMBER() OVER (
        PARTITION BY DATE(created_at)
        ORDER BY created_at, id
      )::text,
      4, '0'
    ) AS code
  FROM groups
  WHERE club_code IS NULL
)
UPDATE groups g
SET club_code = n.code
FROM numbered n
WHERE g.id = n.id;
