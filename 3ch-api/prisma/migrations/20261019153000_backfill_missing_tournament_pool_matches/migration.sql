-- Repair the historical grouping bug. Add matches only; never alter any saved
-- participant, pool assignment, match, score, status, or manual order.
BEGIN;
-- Serialize against group confirmation, match creation, and participant changes.
LOCK TABLE tournaments, tournament_divisions, tournament_division_rounds,
  tournament_pools, tournament_pool_members, tournament_participants,
  tournament_matches IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE
  division_row RECORD;
  pool_row RECORD;
  rotation UUID[];
  participant_count INTEGER;
  cycle INTEGER;
  pair_index INTEGER;
  match_number INTEGER;
BEGIN
  FOR division_row IN
    SELECT d.id FROM tournament_divisions d
    JOIN tournament_division_rounds r ON r.division_id=d.id AND r.round_no=1
    WHERE d.tournament_id='3cd5278f-c2b0-416b-b543-2074e3f1601c'::uuid
      AND r.league_type='SINGLES' AND r.format IN ('GROUP','GROUP_TOURNAMENT')
      AND d.status='locked'
      AND EXISTS (SELECT 1 FROM tournament_pools po WHERE po.division_id=d.id AND po.round_no=1)
      -- Any existing match, even a pending or historical unassigned match, blocks repair.
      AND NOT EXISTS (SELECT 1 FROM tournament_matches m WHERE m.division_id=d.id)
      -- Ambiguous or changed rosters must not be repaired automatically.
      AND NOT EXISTS (
        SELECT 1 FROM tournament_pools po
        JOIN tournament_pool_members pm ON pm.pool_id=po.id
        JOIN tournament_participants p ON p.id=pm.participant_id
        WHERE po.division_id=d.id AND po.round_no=1
          AND (p.division_id<>d.id OR p.status<>'confirmed'))
      AND NOT EXISTS (
        SELECT pm.participant_id FROM tournament_pools po
        JOIN tournament_pool_members pm ON pm.pool_id=po.id
        WHERE po.division_id=d.id AND po.round_no=1
        GROUP BY pm.participant_id HAVING COUNT(*)>1)
    ORDER BY d.id
  LOOP
    match_number := 0;
    FOR pool_row IN
      SELECT po.id,po.pool_no FROM tournament_pools po
      WHERE po.division_id=division_row.id AND po.round_no=1 ORDER BY po.pool_no
    LOOP
      SELECT array_agg(pm.participant_id ORDER BY pm.slot_no) INTO rotation
        FROM tournament_pool_members pm WHERE pm.pool_id=pool_row.id;
      participant_count := COALESCE(array_length(rotation,1),0);
      IF participant_count<2 THEN CONTINUE; END IF;
      IF participant_count%2=1 THEN
        rotation := array_append(rotation,NULL::uuid);
        participant_count := participant_count+1;
      END IF;
      FOR cycle IN 1..participant_count-1 LOOP
        FOR pair_index IN 1..participant_count/2 LOOP
          IF rotation[pair_index] IS NOT NULL AND rotation[participant_count+1-pair_index] IS NOT NULL THEN
            match_number := match_number+1;
            INSERT INTO tournament_matches
              (division_id,program_round,phase,pool_name,round_no,match_order,participant_a_id,participant_b_id)
            VALUES (division_row.id,1,'GROUP',pool_row.pool_no::text,1,match_number,
              rotation[pair_index],rotation[participant_count+1-pair_index]);
          END IF;
        END LOOP;
        rotation := ARRAY[rotation[1],rotation[participant_count]] || rotation[2:participant_count-1];
      END LOOP;
    END LOOP;
  END LOOP;
END $$;
COMMIT;
