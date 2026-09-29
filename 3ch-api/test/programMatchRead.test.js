const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/db/pool');
const router = require('../src/routes/league');

const matchesRoute = router.stack.find((layer) => layer.route?.path === '/league/:id/matches');
const matchesHandler = matchesRoute.route.stack.at(-1).handle;

async function invokeMatches(match) {
  const originalQuery = pool.query;
  const queries = [];
  pool.query = async (sql, values = []) => {
    queries.push({ sql, values });
    if (sql.includes('SELECT join_permission FROM leagues')) {
      return { rowCount: 1, rows: [{ join_permission: 'public' }] };
    }
    if (sql.includes('FROM league_matches m')) {
      return { rowCount: 1, rows: [match] };
    }
    if (sql.includes('FROM league_participants')) {
      return {
        rowCount: 4,
        rows: ['player-a', 'player-b', 'player-c', 'player-d'].map((id, index) => ({
          id,
          name: `선수 ${index + 1}`,
          division: String(index + 1),
        })),
      };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const response = { statusCode: 200, body: null };
  const req = { params: { id: 'league-1' }, user: null };
  const res = {
    status(code) { response.statusCode = code; return this; },
    json(body) { response.body = body; return this; },
  };

  try {
    await matchesHandler(req, res);
    return { response, queries };
  } finally {
    pool.query = originalQuery;
  }
}

test('복식과 단체전 명단은 TEXT 참가자 ID로 조회하고 경기 목록을 반환한다', async () => {
  for (const programBlockType of ['DOUBLES', 'TEAM']) {
    const { response, queries } = await invokeMatches({
      id: `${programBlockType.toLowerCase()}-match`,
      match_order: 1,
      status: 'done',
      score_a: 3,
      score_b: 1,
      participant_a_id: null,
      participant_b_id: null,
      participant_a_roster_ids: ['player-a', 'player-b'],
      participant_b_roster_ids: ['player-c', 'player-d'],
      is_program: true,
      program_round: 1,
      program_block_type: programBlockType,
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.matches[0].participant_a_id, 'player-a+player-b');
    assert.equal(response.body.matches[0].participant_b_id, 'player-c+player-d');
    assert.deepEqual(response.body.matches[0].participant_a_roster, ['선수 1', '선수 2']);
    const rosterQuery = queries.find(({ sql }) => sql.includes('FROM league_participants'));
    assert.match(rosterQuery.sql, /ANY\(\$2::text\[\]\)/);
    assert.doesNotMatch(rosterQuery.sql, /uuid\[\]/);
  }
});
