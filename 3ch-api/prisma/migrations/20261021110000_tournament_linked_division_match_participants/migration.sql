-- Only replace validation functions. Existing participants, matches, results and
-- assignments are not updated, regenerated or removed by this migration.
CREATE OR REPLACE FUNCTION tournament_match_participant_allowed(target_id UUID, person_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM tournament_participants p
    JOIN tournament_divisions source ON source.id = p.division_id
    JOIN tournament_divisions target ON target.id = target_id
      AND target.tournament_id = source.tournament_id
    WHERE p.id = person_id AND (
      p.division_id = target.id OR (
        jsonb_typeof(target.rules->'entry_config'->'source_division_ids') = 'array'
        AND (target.rules->'entry_config'->'source_division_ids') ? source.id::text
        AND COALESCE(source.rules->'entry_config'->'source_division_ids', '[]'::jsonb) = '[]'::jsonb
      )
    )
  );
$$;

CREATE OR REPLACE FUNCTION check_tournament_match_participants() RETURNS trigger AS $$
BEGIN
  IF NEW.participant_a_id IS NOT NULL AND NOT tournament_match_participant_allowed(NEW.division_id, NEW.participant_a_id) THEN
    RAISE EXCEPTION 'participant A is outside the configured tournament entry divisions'
      USING ERRCODE = '23514', CONSTRAINT = 'tournament_match_participants_same_division';
  END IF;
  IF NEW.participant_b_id IS NOT NULL AND NOT tournament_match_participant_allowed(NEW.division_id, NEW.participant_b_id) THEN
    RAISE EXCEPTION 'participant B is outside the configured tournament entry divisions'
      USING ERRCODE = '23514', CONSTRAINT = 'tournament_match_participants_same_division';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
