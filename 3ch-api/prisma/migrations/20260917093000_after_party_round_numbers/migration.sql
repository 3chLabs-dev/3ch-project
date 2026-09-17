ALTER TABLE after_party_settlements ADD COLUMN round_no INTEGER;

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY league_id ORDER BY created_at, id)::integer AS value
  FROM after_party_settlements
)
UPDATE after_party_settlements AS settlement
SET round_no = numbered.value
FROM numbered
WHERE settlement.id = numbered.id;

ALTER TABLE after_party_settlements ALTER COLUMN round_no SET NOT NULL;
CREATE UNIQUE INDEX after_party_settlements_league_round_idx ON after_party_settlements(league_id, round_no);
