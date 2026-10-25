const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { leagueProgramEntryReset } = require('../src/services/leagueProgramEntryReset');

test('confirmed entry reset is atomic, backed up and rejects stale or incomplete completed-match snapshots', { skip: !process.env.TOURNAMENT_PGLITE_MODULE, timeout: 90000 }, async () => {
  const { PGlite } = require(process.env.TOURNAMENT_PGLITE_MODULE);
  const db = new PGlite();
  await db.exec(`CREATE TABLE leagues(id text PRIMARY KEY,group_id text);
    CREATE TABLE group_members(group_id text,user_id int,role text,management_permissions jsonb);
    CREATE TABLE league_programs(league_id text UNIQUE,program_data jsonb,created_by_id int,updated_at timestamptz DEFAULT NOW());
    CREATE TABLE league_matches(id text PRIMARY KEY,league_id text,is_program boolean,program_round int,participant_a_id text,participant_b_id text,score_a int,score_b int,status text,court text,match_order int);
    CREATE TABLE league_participants(id text PRIMARY KEY,league_id text,name text);
    INSERT INTO leagues VALUES('league','group'); INSERT INTO group_members VALUES('group',1,'owner','{}');
    INSERT INTO league_programs(league_id,program_data,created_by_id) VALUES('league','{"blocks":[{"format":"TOURNAMENT","tournamentStartSize":16}]}',1);
    INSERT INTO league_participants VALUES('a','league','A'),('b','league','B');
    INSERT INTO league_matches VALUES('game','league',true,1,'a','b',3,1,'done','1',2),('other','other-league',true,1,'x','y',2,1,'done','2',1);`);
  await db.exec(readFileSync(path.join(__dirname, '../prisma/migrations/20261025150000_league_program_entry_reset_audit/migration.sql'), 'utf8'));
  let failSave = false;
  const pool = { connect: async () => ({ query: async (sql, values) => {
    if (failSave && sql.includes('INSERT INTO league_programs')) throw Error('injected final save failure');
    const result = await db.query(sql, values);
    return { ...result, rowCount: result.rows.length };
  }, release() {} }) };
  const handler = leagueProgramEntryReset(pool);
  const matches = (await db.query("SELECT * FROM league_matches WHERE league_id='league'")).rows;
  const revision = new Date((await db.query("SELECT updated_at FROM league_programs WHERE league_id='league'")).rows[0].updated_at).toISOString();
  const body = { confirmation_intent: 'RESET_LEAGUE_PROGRAM_FOR_EDIT', expected_matches: matches, expected_program_updated_at: revision, program_data: { blocks: [{ type: 'SINGLES', format: 'TOURNAMENT', tournamentStartSize: 8 }] } };
  const invoke = async (patch = {}, user = '1') => {
    const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await handler({ params: { id: 'league' }, user: { sub: user }, body: { ...body, ...patch } }, res);
    return res;
  };
  try {
    for (const patch of [{ confirmation_intent: undefined }, { expected_matches: [] }, { expected_program_updated_at: 'old' }, { expected_matches: [{ ...matches[0], score_a: 2 }] }]) {
      assert.ok((await invoke(patch)).code >= 400);
      assert.deepEqual((await db.query("SELECT * FROM league_matches WHERE league_id='league'")).rows, matches);
    }
    assert.equal((await invoke({}, '2')).code, 403);
    failSave = true;
    assert.equal((await invoke()).code, 500);
    assert.deepEqual((await db.query("SELECT * FROM league_matches WHERE league_id='league'")).rows, matches);
    assert.equal((await db.query('SELECT * FROM league_program_entry_reset_audit')).rows.length, 0);
    failSave = false;
    assert.equal((await invoke()).code, 200);
    assert.equal((await db.query("SELECT * FROM league_matches WHERE league_id='league'")).rows.length, 0);
    assert.equal((await db.query("SELECT score_a FROM league_matches WHERE id='other'")).rows[0].score_a, 2);
    assert.equal((await db.query('SELECT * FROM league_participants')).rows.length, 2);
    const backup = (await db.query('SELECT snapshot FROM league_program_entry_reset_audit')).rows[0].snapshot;
    assert.equal(backup.matches[0].score_a, 3);
    assert.equal(backup.program[0].program_data.blocks[0].tournamentStartSize, 16);
  } finally { await db.close(); }
});
