const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/db/pool');
const router = require('../src/routes/tournament');
const handler = router.stack.find((layer) => layer.route?.path === '/tournaments/:id/clubs/:groupId/confirm').route.stack.at(-1).handle;
const tournamentId = '6f40f553-e218-4679-a654-f8b635d28060';
const one = '1f40f553-e218-4679-a654-f8b635d28060';
const two = '2f40f553-e218-4679-a654-f8b635d28060';

async function invoke({ manager = true, competition = false, incoming = [one, two] } = {}) {
  const original = pool.connect;
  const rows = [{ id: one, status: 'applied', division_id: tournamentId }, { id: two, status: 'confirmed', division_id: tournamentId }];
  const commands = [];
  pool.connect = async () => ({
    async query(sql, values = []) {
      commands.push(sql);
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return {};
      if (sql.includes('FROM tournaments')) return { rowCount: 1, rows: [{ host_group_id: 'host' }] };
      if (sql.includes('FROM subscriptions')) return { rowCount: 1, rows: [] };
      if (sql.includes('FROM group_members')) return { rows: manager ? [{ role: 'owner' }] : [] };
      if (sql.includes('FROM tournament_divisions WHERE')) return { rows: [] };
      if (sql.includes('FROM tournament_participants')) { assert.deepEqual(values, [tournamentId, 'club']); return { rows }; }
      if (sql.includes('FROM tournament_pools')) return { rowCount: competition ? 1 : 0, rows: [] };
      if (sql.startsWith('UPDATE')) {
        assert.equal(sql, "UPDATE tournament_participants SET status = 'confirmed' WHERE id = ANY($1::uuid[]) AND status = 'applied'");
        assert.deepEqual(values, [[one]]);
        rows[0].status = 'confirmed';
        return {};
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    }, release() {},
  });
  const result = { statusCode: 200 };
  try {
    await handler({ params: { id: tournamentId, groupId: 'club' }, user: { sub: '1' }, body: { participant_ids: incoming } }, { status(code) { result.statusCode = code; return this; }, json(body) { result.body = body; return this; } });
    return { result, rows, commands };
  } finally { pool.connect = original; }
}

test('클럽 일괄 확정은 대기 참가자만 확정하고 기존 확정을 유지한다', async () => {
  const { result, rows, commands } = await invoke();
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.confirmed_count, 1);
  assert.equal(rows.every((row) => row.status === 'confirmed'), true);
  assert.equal(commands.at(-1), 'COMMIT');
});

test('권한 없음, 명단 누락, 중복 요청, 경기 생성 시 전체 확정을 거절한다', async () => {
  for (const [options, status] of [[{ manager: false }, 403], [{ incoming: [one] }, 409], [{ incoming: [one, one] }, 409], [{ competition: true }, 409]]) {
    const { result, rows, commands } = await invoke(options);
    assert.equal(result.statusCode, status);
    assert.equal(rows[0].status, 'applied');
    assert.equal(commands.at(-1), 'ROLLBACK');
    assert.equal(commands.some((sql) => sql.startsWith('UPDATE')), false);
  }
});
