const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/db/pool');
const router = require('../src/routes/tournamentExtras');
const id = '6f40f553-e218-4679-a654-f8b635d28060';
const personId = '1f40f553-e218-4679-a654-f8b635d28060';
const row = { division_id: id, name: '신규', member_division: '7' };
async function invoke({ owner = true, competition = false, body = { group_id: null, rows: [row] }, withdraw = false } = {}) {
  const original = pool.connect; const commands = []; const saved = [{ id: personId, name: '기존', member_division: '4', status: 'confirmed', member_id: null, pre_member_id: null, source_group_id: null }];
  let working;
  pool.connect = async () => ({ async query(sql, values = []) {
    commands.push(sql);
    if (sql === 'BEGIN') { working = structuredClone(saved); return {}; }
    if (sql === 'ROLLBACK') return {};
    if (sql === 'COMMIT') { saved.splice(0, saved.length, ...working); return {}; }
    if (sql.includes('FROM tournaments t LEFT JOIN')) return { rows: [{ id, created_by_id: owner ? 1 : 2, role: null, status: 'open', recruit_count: 100 }] };
    if (sql.includes('FROM subscriptions')) return { rowCount: 1, rows: [] };
    if (sql.includes('JOIN group_members gm ON gm.group_id=p.source_group_id')) return { rowCount: 0, rows: [] };
    if (sql.includes('FROM tournaments WHERE id')) return { rowCount: 1, rows: [{ id, recruit_count: 100 }] };
    if (sql.includes('SELECT id FROM tournament_divisions')) return { rows: [{ id }] };
    if (sql.includes('SELECT id FROM groups')) return { rowCount: 1, rows: [{ id: 'club' }] };
    if (sql.includes('SELECT p.* FROM tournament_participants')) return { rowCount: 1, rows: saved };
    if (sql.includes('SELECT 1 FROM tournament_pools') || sql.includes('SELECT 1 FROM tournament_pool_members')) return { rowCount: competition ? 1 : 0, rows: [] };
    if (sql.startsWith('INSERT INTO tournament_participants')) { working.push({ name: values[1], member_division: values[2], status: 'applied' }); return {}; }
    if (sql.startsWith('UPDATE tournament_participants')) { working[0].status = 'withdrawn'; return {}; }
    throw new Error(`Unexpected SQL: ${sql}`);
  }, release() {} });
  const result = { statusCode: 200 };
  const path = withdraw ? '/tournaments/:id/participants/:participantId/withdraw' : '/tournaments/:id/participants/manual';
  const handle = router.stack.find((layer) => layer.route?.path === path).route.stack.at(-1).handle;
  try {
    await handle({ params: { id, participantId: personId }, user: { sub: '1' }, body }, { status(code) { result.statusCode = code; return this; }, json(body) { result.body = body; return this; } });
    return { result, commands, saved };
  } finally { pool.connect = original; }
}
test('주최자 직접 등록은 새 참가자만 대기로 추가하고 기존 확정 상태와 부수를 보존한다', async () => {
  const { result, saved, commands } = await invoke(); assert.equal(result.statusCode, 201);
  assert.equal(saved[0].status, 'confirmed'); assert.equal(saved[0].member_division, '4'); assert.equal(saved[1].status, 'applied');
  assert.equal(commands.at(-1), 'COMMIT'); assert.equal(commands.some((sql) => sql.startsWith('DELETE')), false);
});
test('비주최자, 부수 누락, 잘못된 부문, 중복 참가자, 경기 생성된 부문 등록을 거절한다', async () => {
  for (const options of [{ owner: false }, { body: { group_id: null, rows: [{ ...row, member_division: '' }] } }, { body: { group_id: null, rows: [{ ...row, division_id: personId }] } }, { body: { group_id: null, rows: [row, row] } }, { competition: true }]) {
    const { result, saved } = await invoke(options); assert.ok(result.statusCode >= 400); assert.equal(saved.length, 1); assert.equal(saved[0].status, 'confirmed');
  }
});
test('참가 취소는 확인값을 요구하며 조 배정이나 경기가 있으면 확정 참가자를 보존한다', async () => {
  const unconfirmed = await invoke({ withdraw: true, body: {} }); assert.equal(unconfirmed.result.statusCode, 400);
  const linked = await invoke({ withdraw: true, competition: true, body: { confirmation_intent: 'WITHDRAW_TOURNAMENT_PARTICIPANT' } });
  assert.equal(linked.result.statusCode, 409); assert.equal(linked.saved[0].status, 'confirmed');
  const safe = await invoke({ withdraw: true, body: { confirmation_intent: 'WITHDRAW_TOURNAMENT_PARTICIPANT' } });
  assert.equal(safe.result.statusCode, 200); assert.equal(safe.saved[0].status, 'withdrawn');
});
