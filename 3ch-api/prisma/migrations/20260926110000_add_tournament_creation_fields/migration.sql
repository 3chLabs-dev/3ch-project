ALTER TABLE tournaments
  ADD COLUMN sport VARCHAR(40) NOT NULL DEFAULT '탁구',
  ADD COLUMN venue_name VARCHAR(120),
  ADD COLUMN venue_address TEXT,
  ADD COLUMN notice TEXT;

UPDATE tournament_divisions
   SET league_type = COALESCE(league_type, 'SINGLES'),
       format = COALESCE(format, 'GROUP_TOURNAMENT')
 WHERE league_type IS NULL OR format IS NULL;

ALTER TABLE tournament_divisions
  ALTER COLUMN league_type SET NOT NULL,
  ALTER COLUMN format SET NOT NULL;
