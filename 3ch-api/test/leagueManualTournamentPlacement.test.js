const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/db/pool');
require('../src/services/groupRanking').getGroupIdByLeagueId = async () => null;
require('../src/services/sportRanking').rebuildSportRankingByLeagueId = async () => {};
const router = require('../src/routes/league');

test('manual league placement updates only the chosen slot and preserves downstream results', async () => {
  const original = pool.query;
  const rows = [
    { id: 'source', participant_a_id: 'a', status: 'pending', score_a: null, score_b: null },
    { id: 'target', participant_a_id: null, status: 'pending', score_a: null, score_b: null },
    { id: 'later', participant_a_id: 'b', participant_b_id: 'c', status: 'done', score_a: 3, score_b: 1 },
  ];
  const before = structuredClone(rows);
  const commands = [];
  pool.query = async (sql, values) => {
    commands.push(sql);
    if (sql.includes('SELECT join_permission')) return { rowCount: 1, rows: [{ join_permission: 'public', tournament_seeding: 'manual' }] };
    if (sql.includes('SELECT 1 FROM leagues')) return { rowCount: 1, rows: [{}] };
    if (sql.startsWith('UPDATE league_matches')) {
      assert.match(sql, /SET participant_a_id = \$1 WHERE/);
      assert.deepEqual(values, ['a','target','league']);
      rows[1].participant_a_id = values[0];
      return { rowCount: 1, rows: [rows[1]] };
    }
    if (sql.includes('LEFT JOIN league_participants')) return { rowCount: 1, rows: [rows[1]] };
    throw Error(`Unexpected reconciliation or mutation: ${sql}`);
  };
  const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  try {
    const handler = router.stack.find(layer => layer.route?.path === '/league/:id/matches/:matchId' && layer.route.methods.patch).route.stack.at(-1).handle;
    await handler({ params: { id: 'league', matchId: 'target' }, user: { sub: '1' }, body: { participant_a_id: 'a' } }, res);
    assert.equal(res.code, 200);
    assert.equal(res.body.match.status, 'pending');
    assert.deepEqual(rows[0], before[0]);
    assert.deepEqual(rows[2], before[2]);
    assert.equal(commands.filter(sql => sql.startsWith('UPDATE')).length, 1);
  } finally { pool.query = original; }
});
