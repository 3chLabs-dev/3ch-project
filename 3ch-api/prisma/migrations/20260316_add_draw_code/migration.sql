-- draws 테이블에 draw_code 컬럼 추가
-- 형식: {리그코드11자리}{순번2자리} = 13자리
ALTER TABLE draws ADD COLUMN IF NOT EXISTS draw_code VARCHAR(13) UNIQUE;
