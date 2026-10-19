const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/db/pool');
const drawRouter = require('../src/routes/tournamentDraw');
const settlementRouter = require('../src/routes/tournamentAfterParty');
const id = '6f40f553-e218-4679-a654-f8b635d28060';
const settlementId = '1f40f553-e218-4679-a654-f8b635d28060';

async function draw({ owner = true, confirmation = false, prize = false } = {}) {
  const originalConnect = pool.connect, originalQuery = pool.query; const commands = []; const stored = ['기존 당첨자']; let working;
  const query = async (sql) => {
    commands.push(sql);
    if (sql.includes('FROM tournaments t LEFT JOIN')) return { rows: [{ created_by_id: owner ? 1 : 2, status: 'open', role: null }] };
    if (sql.includes('FROM subscriptions')) return { rowCount: 1 };
    if (sql.includes('JOIN group_members gm ON gm.group_id=p.source_group_id')) return { rowCount: 0 };
    if (sql === 'BEGIN') { working = [...stored]; return {}; }
    if (sql === 'ROLLBACK') return {};
    if (sql === 'COMMIT') { stored.splice(0, stored.length, ...working); return {}; }
    if (sql.startsWith('SELECT') && (sql.includes('FROM tournament_draws') || sql.includes('FROM tournament_draw_prizes'))) return { rowCount: 1, rows: [{ id: 'prize' }] };
    if (sql.includes('SELECT id FROM tournament_draw_winners')) return { rowCount: 1, rows: [{ id: 'winner' }] };
    if (sql.startsWith('DELETE FROM tournament_draw_winners')) { working = []; return {}; }
    if (sql.startsWith('DELETE FROM tournament_draw_prizes')) return {};
    if (sql.includes('INSERT INTO tournament_draw_prizes')) return { rows: [{ id: 'prize' }] };
    if (sql.includes('INSERT INTO tournament_draw_winners')) { working.push('새 당첨자'); return {}; }
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  pool.query = query; pool.connect = async () => ({ query, release() {} });
  const response = { statusCode: 200 };
  const path = prize ? '/tournaments/:leagueId/draw/:drawId/prizes/:prizeId/winners' : '/tournaments/:leagueId/draw/:drawId/run';
  const body = prize ? { winners: [{ participant_name: '새 당첨자' }] } : { prizes: [{ prize_name: '경품', quantity: 1, winners: [{ participant_name: '새 당첨자' }] }] };
  if (confirmation) body.confirmation_intent = prize ? 'REPLACE_TOURNAMENT_DRAW_WINNERS' : 'REPLACE_TOURNAMENT_DRAW_RESULTS';
  try {
    const handle = drawRouter.stack.find((layer) => layer.route?.path === path).route.stack.at(-1).handle;
    await handle({ params: { leagueId: id, drawId: 'draw', prizeId: 'prize' }, user: { sub: '1' }, body }, { status(code) { response.statusCode = code; return this; }, json() { return this; } });
    return { response, commands, stored };
  } finally { pool.connect = originalConnect; pool.query = originalQuery; }
}

test('기존 경품 당첨 결과는 명시적 재추첨 확인 없이 덮어쓸 수 없다', async () => {
  for (const prize of [false, true]) {
    const result = await draw({ prize }); assert.equal(result.response.statusCode, 409); assert.deepEqual(result.stored, ['기존 당첨자']);
    assert.equal(result.commands.some((sql) => sql.startsWith('DELETE')), false); assert.equal(result.commands.at(-1), 'ROLLBACK');
    const confirmed = await draw({ prize, confirmation: true }); assert.equal(confirmed.response.statusCode, 200); assert.deepEqual(confirmed.stored, ['새 당첨자']);
  }
});
test('다른 클럽 참가자는 재추첨 확인값을 보내도 경품 결과를 수정할 수 없다', async () => {
  const result = await draw({ owner: false, confirmation: true }); assert.equal(result.response.statusCode, 403); assert.deepEqual(result.stored, ['기존 당첨자']);
});

test('대회 정산도 기존 항목 누락과 동시 수정 시 전체 저장을 거부한다', async () => {
  const original = pool.connect;
  const itemId = '2f40f553-e218-4679-a654-f8b635d28060';
  for (const version of [1, 2]) {
    const commands = [];
    pool.connect = async () => ({ async query(sql) {
      commands.push(sql);
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return {};
      if (sql.includes('FROM tournaments t LEFT JOIN')) return { rows: [{ created_by_id: 1 }] };
      if (sql.includes('FROM subscriptions')) return { rowCount: 1 };
      if (sql.includes('JOIN group_members gm ON gm.group_id=p.source_group_id')) return { rowCount: 0 };
      if (sql.includes('FROM tournament_after_party_settlements')) return { rowCount: 1, rows: [{ version: 2, participants: [], items: [{ id: itemId, name: '저장된 비용', amount: 10000 }], contributions: [] }] };
      throw new Error(`Unexpected SQL: ${sql}`);
    }, release() {} });
    try {
      const handle = settlementRouter.stack.find((layer) => layer.route?.path === '/tournaments/:leagueId/after-party/:id' && layer.route.methods.put).route.stack.at(-1).handle;
      const response = { statusCode: 200 };
      await handle({ params: { leagueId: id, id: settlementId }, user: { sub: '1' }, body: { title: '1차', participants: [], items: [], contributions: [], version } }, { status(code) { response.statusCode = code; return this; }, json() { return this; } });
      assert.equal(response.statusCode, 409); assert.equal(commands.at(-1), 'ROLLBACK'); assert.equal(commands.some((sql) => sql.startsWith('UPDATE') || sql.startsWith('DELETE')), false);
    } finally { pool.connect = original; }
  }
});
