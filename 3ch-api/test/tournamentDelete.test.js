const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/db/pool');
const router = require('../src/routes/tournament');

const id = '6f40f553-e218-4679-a654-f8b635d28060';
const divisionId = '1f40f553-e218-4679-a654-f8b635d28060';
const summary = { divisions: 1, rounds: 2, participants: 3, pools: 1, matches: 2, recorded_matches: 1, invited_groups: 1 };
const route = (path, method) => router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]).route.stack.at(-1).handle;

async function invoke({ userId = 1, intent = 'DELETE_TOURNAMENT_AND_ALL_DATA', expected = summary, confirmationText = '삭제', failOn = '', preview = false } = {}) {
  const originalConnect = pool.connect;
  const originalQuery = pool.query;
  const persisted = new Set(['tournament_pool_members', 'tournament_matches', 'tournament_pools', 'tournament_participants', 'tournament_division_rounds', 'tournament_invited_groups', 'tournament_divisions', 'tournaments']);
  let working;
  const commands = [];
  const query = async (sql) => {
    commands.push(sql);
    if (sql === 'BEGIN') { working = new Set(persisted); return {}; }
    if (sql === 'COMMIT') { persisted.clear(); for (const entry of working) persisted.add(entry); return {}; }
    if (sql === 'ROLLBACK') return {};
    if (sql.startsWith('SELECT') && sql.includes('FROM tournaments WHERE id')) return { rowCount: 1, rows: [{ id, title: '가을 대회', created_by_id: 1 }] };
    if (sql.includes('FROM tournament_divisions WHERE tournament_id = $1 ORDER BY id')) return { rows: [{ id: divisionId }] };
    if (sql.includes('AS recorded_matches')) return { rows: [summary] };
    if (sql.startsWith('DELETE FROM ')) {
      const table = sql.match(/^DELETE FROM (\w+)/)[1];
      if (table === failOn) throw new Error('simulated failure');
      assert.equal(working.has(table), true);
      working.delete(table);
      return { rowCount: 1, rows: [{ id }] };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  pool.connect = async () => ({ query, release() {} });
  pool.query = query;
  const response = { statusCode: 200 };
  const res = { status(code) { response.statusCode = code; return this; }, json(body) { response.body = body; return this; } };
  try {
    if (preview) await route('/tournaments/:id/delete-preview', 'get')({ params: { id }, user: { sub: String(userId) } }, res);
    else await route('/tournaments/:id', 'delete')({ params: { id }, user: { sub: String(userId) }, body: { confirmation_intent: intent, confirmation_text: confirmationText, expected_summary: expected } }, res);
    return { response, persisted, commands };
  } finally { pool.connect = originalConnect; pool.query = originalQuery; }
}

test('삭제 미리보기는 생성자에게 완료 경기 수를 포함해 보여준다', async () => {
  const result = await invoke({ preview: true });
  assert.equal(result.response.statusCode, 200);
  assert.deepEqual(result.response.body.summary, summary);
  const denied = await invoke({ preview: true, userId: 2 });
  assert.equal(denied.response.statusCode, 403);
});

test('생성자가 삭제 문구와 명시적 확인값을 제출하면 연결 데이터를 한 트랜잭션에서 삭제한다', async () => {
  const result = await invoke();
  assert.equal(result.response.statusCode, 200);
  assert.equal(result.persisted.size, 0);
  assert.equal(result.commands.at(-1), 'COMMIT');
});

test('다른 사용자, 잘못된 확인값, 삭제 문구, 변경된 건수는 완료 결과를 포함한 전 데이터를 보존한다', async () => {
  for (const options of [{ userId: 2 }, { intent: 'DELETE' }, { confirmationText: '다른 대회' }, { expected: { ...summary, recorded_matches: 0 } }]) {
    const result = await invoke(options);
    assert.notEqual(result.response.statusCode, 200);
    assert.equal(result.persisted.size, 8);
    assert.equal(result.commands.some((sql) => sql.startsWith('DELETE FROM ')), false);
  }
});

test('삭제 도중 오류가 나면 완료 결과와 참가자를 포함해 전체 요청을 롤백한다', async () => {
  const result = await invoke({ failOn: 'tournament_participants' });
  assert.equal(result.response.statusCode, 500);
  assert.equal(result.persisted.size, 8);
  assert.equal(result.commands.at(-1), 'ROLLBACK');
});
