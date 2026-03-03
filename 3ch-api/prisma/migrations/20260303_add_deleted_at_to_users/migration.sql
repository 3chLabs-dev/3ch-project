-- 회원탈퇴용 deleted_at 컬럼 추가
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
