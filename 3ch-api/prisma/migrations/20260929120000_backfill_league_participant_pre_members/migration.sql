WITH historical_participants AS (
  SELECT DISTINCT ON (l.group_id, BTRIM(lp.name))
         l.group_id,
         BTRIM(lp.name) AS name,
         NULLIF(BTRIM(lp.division), '') AS division,
         l.created_by_id
    FROM league_participants lp
    JOIN leagues l ON l.id = lp.league_id
    LEFT JOIN group_members gm
      ON gm.group_id = l.group_id
     AND gm.user_id = lp.member_id
   WHERE l.group_id IS NOT NULL
     AND lp.status = 'active'
     AND COALESCE(lp.is_bot, FALSE) = FALSE
     AND BTRIM(COALESCE(lp.name, '')) <> ''
     AND gm.user_id IS NULL
   ORDER BY l.group_id, BTRIM(lp.name), l.start_date ASC, lp.created_at ASC
)
INSERT INTO group_pre_members
  (id, group_id, name, division, status, created_by_id, created_at, updated_at)
SELECT gen_random_uuid()::text,
       candidate.group_id,
       candidate.name,
       candidate.division,
       'active',
       candidate.created_by_id,
       NOW(),
       NOW()
  FROM historical_participants candidate
 WHERE NOT EXISTS (
   SELECT 1
     FROM group_pre_members pm
    WHERE pm.group_id = candidate.group_id
      AND pm.status IN ('active', 'linked')
      AND (
        BTRIM(pm.name) = candidate.name
        OR EXISTS (
          SELECT 1
            FROM jsonb_array_elements_text(COALESCE(pm.external_aliases, '[]'::jsonb)) alias_name
           WHERE BTRIM(alias_name) = candidate.name
        )
      )
 );

UPDATE group_ranking_settings
   SET rating_version = 2,
       updated_at = NOW();
