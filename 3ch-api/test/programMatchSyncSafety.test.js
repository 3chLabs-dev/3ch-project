const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/db/pool');
const router = require('../src/routes/league');

const syncRoute = router.stack.find((layer) => layer.route?.path === '/league/:id/program/matches/sync');
const syncHandler = syncRoute.route.stack.at(-1).handle;

const existingMatch = () => ({
  id: 'old-match', participant_a_id: 'player-a', participant_b_id: 'player-b',
  participant_a_roster_ids: [], participant_b_roster_ids: [],
  bracket: null, round_number: null, program_round: 1, program_block_type: 'SINGLES',
  score_a: 3, score_b: 1, court: '1', status: 'done', match_rule: 'BEST_OF_5',
});
const incomingMatch = (id = 'old-match') => ({
  id, participant_a_id: 'player-a', participant_b_id: 'player-b',
  program_round: 1, program_block_type: 'SINGLES', match_order: 1,
});

async function invokeSync({ initial = [], matches = [], reset = false, confirmation, failInsert = false } = {}) {
  const originalQuery = pool.query;
  const originalConnect = pool.connect;
  const persisted = new Map(initial.map((match) => [match.id, { ...match }]));
  let working;
  const commands = [];
  let released = false;
  pool.query = async (sql) => {
    if (sql.includes('FROM leagues l') && sql.includes('group_members')) return { rowCount: 1, rows: [{ id: 'league-1' }] };
    if (sql.includes('FROM league_participants')) return { rows: [{ id: 'player-a' }, { id: 'player-b' }, { id: 'player-c' }] };
    return { rowCount: 0, rows: [] };
  };
  pool.connect = async () => ({
    query: async (sql, values = []) => {
      const command = sql.trim().split(/\s+/)[0].toUpperCase();
      commands.push(command);
      if (command === 'BEGIN') { working = new Map([...persisted].map(([id, row]) => [id, { ...row }])); return {}; }
      if (command === 'COMMIT') { persisted.clear(); for (const [id, row] of working) persisted.set(id, row); return {}; }
      if (command === 'ROLLBACK') return {};
      if (command === 'SELECT' && sql.includes('FOR UPDATE')) return { rows: [{ id: 'league-1' }] };
      if (command === 'SELECT') return { rows: [...working.values()] };
      if (command === 'DELETE') { for (const [id, row] of working) if (row.program_round === 1) working.delete(id); return {}; }
      if (command === 'INSERT') {
        if (failInsert) throw new Error('simulated insert failure');
        for (let offset = 0; offset < values.length; offset += 23) {
          const row = values.slice(offset, offset + 23);
          working.set(row[0], {
            id: row[0], participant_a_id: row[3], participant_b_id: row[4],
            score_a: row[12], score_b: row[13], court: row[14], status: row[15],
            program_round: row[16], program_block_type: row[17],
          });
        }
        return {};
      }
      if (command === 'UPDATE') return {};
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release: () => { released = true; },
  });

  const req = {
    user: { sub: '1' }, params: { id: 'league-1' },
    body: { matches, reset_results: reset, reset_confirmation: confirmation },
  };
  const response = { statusCode: 200, body: null };
  const res = {
    status(code) { response.statusCode = code; return this; },
    json(body) { response.body = body; return this; },
  };
  try {
    await syncHandler(req, res);
    return { response, persisted, commands, released };
  } finally {
    pool.query = originalQuery;
    pool.connect = originalConnect;
  }
}

test('완료된 경기 결과는 일반 동기화와 경기 ID 변경 뒤에도 유지된다', async () => {
  const { response, persisted, commands, released } = await invokeSync({
    initial: [existingMatch()], matches: [incomingMatch('new-match')],
  });
  assert.equal(response.statusCode, 200);
  assert.equal(persisted.get('new-match').score_a, 3);
  assert.equal(persisted.get('new-match').score_b, 1);
  assert.equal(persisted.get('new-match').status, 'done');
  assert.deepEqual(commands.at(-1), 'COMMIT');
  assert.equal(released, true);
});

test('완료된 경기가 누락되면 전체 동기화를 거부하고 같은 연결에서 롤백한다', async () => {
  const { response, persisted, commands, released } = await invokeSync({
    initial: [existingMatch()],
    matches: [{ ...incomingMatch('other-match'), participant_b_id: 'player-c' }],
  });
  assert.equal(response.statusCode, 409);
  assert.equal(response.body.code, 'PROGRAM_SYNC_WOULD_DELETE_RESULTS');
  assert.equal(persisted.get('old-match').score_a, 3);
  assert.equal(commands.includes('DELETE'), false);
  assert.equal(commands.at(-1), 'ROLLBACK');
  assert.equal(released, true);
});

test('초기화 확인값이 없으면 완료 경기 결과를 변경하지 않는다', async () => {
  const { response, persisted, commands } = await invokeSync({
    initial: [existingMatch()], matches: [incomingMatch()], reset: true,
  });
  assert.equal(response.statusCode, 400);
  assert.equal(persisted.get('old-match').score_a, 3);
  assert.equal(commands.length, 0);
});

test('명시적으로 확인한 초기화만 점수와 상태를 초기값으로 되돌린다', async () => {
  const { response, persisted, commands } = await invokeSync({
    initial: [existingMatch()], matches: [incomingMatch()], reset: true,
    confirmation: 'RESET_PROGRAM_RESULTS',
  });
  assert.equal(response.statusCode, 200);
  assert.equal(persisted.get('old-match').score_a, null);
  assert.equal(persisted.get('old-match').score_b, null);
  assert.equal(persisted.get('old-match').status, 'pending');
  assert.equal(commands.at(-1), 'COMMIT');
});

test('삭제 뒤 INSERT가 실패해도 완료 결과가 롤백으로 복원된다', async () => {
  const { response, persisted, commands, released } = await invokeSync({
    initial: [existingMatch()], matches: [incomingMatch()], failInsert: true,
  });
  assert.equal(response.statusCode, 500);
  assert.equal(persisted.get('old-match').score_a, 3);
  assert.equal(persisted.get('old-match').status, 'done');
  assert.ok(commands.includes('DELETE'));
  assert.equal(commands.at(-1), 'ROLLBACK');
  assert.equal(released, true);
});
