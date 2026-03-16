-- leagues 테이블에 league_code 컬럼 추가
-- 형식: {클럽코드3자리}{YYMMDD}{순번2자리} = 11자리
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS league_code VARCHAR(11) UNIQUE;
