ALTER TABLE tournament_participants
  ADD COLUMN pre_member_id TEXT REFERENCES group_pre_members(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX tournament_participants_division_pre_member_idx
  ON tournament_participants(division_id, pre_member_id);
