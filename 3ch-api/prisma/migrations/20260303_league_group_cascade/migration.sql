-- leagues.group_id FK: SET NULL → CASCADE
-- 클럽 삭제 시 해당 클럽의 리그도 함께 삭제
ALTER TABLE leagues DROP CONSTRAINT IF EXISTS leagues_group_id_fkey;
ALTER TABLE leagues
  ADD CONSTRAINT leagues_group_id_fkey
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
