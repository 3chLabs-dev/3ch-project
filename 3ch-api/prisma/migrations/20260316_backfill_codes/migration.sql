-- ============================================================
-- 1단계: 모든 클럽 코드를 알파벳 순차 형식으로 재할당
--        (기존 C+날짜+숫자 형식 포함, created_at 순 기준)
-- ============================================================
DO $$
DECLARE
  rec RECORD;
  idx INT := 0;
  a INT; b INT; c INT;
  new_code TEXT;
BEGIN
  -- 기존 코드 모두 초기화
  UPDATE groups SET club_code = NULL;

  -- created_at 순으로 AAA부터 재할당
  FOR rec IN
    SELECT id FROM groups
    ORDER BY created_at ASC, id ASC
  LOOP
    a := idx / 676;
    b := (idx % 676) / 26;
    c := idx % 26;

    new_code := CHR(65 + a) || CHR(65 + b) || CHR(65 + c);

    UPDATE groups SET club_code = new_code WHERE id = rec.id;

    idx := idx + 1;
  END LOOP;
END $$;

-- ============================================================
-- 2단계: 리그 코드 생성 → {클럽코드3자리}{YYMMDD}{순번2자리}
--        같은 그룹 + 같은 start_date 날짜끼리 created_at 순 순번
-- ============================================================
WITH ranked AS (
  SELECT
    l.id,
    g.club_code,
    TO_CHAR(l.start_date AT TIME ZONE 'Asia/Seoul', 'YYMMDD') AS date_str,
    ROW_NUMBER() OVER (
      PARTITION BY l.group_id, DATE(l.start_date)
      ORDER BY l.created_at ASC, l.id ASC
    ) AS seq
  FROM leagues l
  JOIN groups g ON l.group_id = g.id
  WHERE g.club_code IS NOT NULL
)
UPDATE leagues
SET league_code = r.club_code || r.date_str || LPAD(r.seq::text, 2, '0')
FROM ranked r
WHERE leagues.id = r.id;

-- ============================================================
-- 3단계: 추첨 코드 생성 → {리그코드11자리}{순번2자리}
--        같은 리그 내 created_at 순 순번
-- ============================================================
WITH ranked AS (
  SELECT
    d.id,
    l.league_code,
    ROW_NUMBER() OVER (
      PARTITION BY d.league_id
      ORDER BY d.created_at ASC, d.id ASC
    ) AS seq
  FROM draws d
  JOIN leagues l ON d.league_id = l.id
  WHERE l.league_code IS NOT NULL
)
UPDATE draws
SET draw_code = r.league_code || LPAD(r.seq::text, 2, '0')
FROM ranked r
WHERE draws.id = r.id;
