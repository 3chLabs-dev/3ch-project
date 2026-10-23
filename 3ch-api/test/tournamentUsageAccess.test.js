const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/db/pool');
const usage = require('../src/services/featureUsageService');
const receipt = require('../src/services/receiptVisionScanner');
const credits = [], refunds = [];
let funded = true, scanFails = false;
usage.consumeFeatureCredit = async args => { credits.push(args); return { allowed: funded }; };
usage.refundFeatureCredit = async args => { refunds.push(args); };
receipt.scanReceiptWithOpenAIVision = async () => {
  if (scanFails) throw Error('scan failed');
  return { engine: 'test', result: { merchant: '', purchasedAt: '', receiptTotal: 0, items: [] } };
};
const settlement = require('../src/routes/tournamentAfterParty');
const draw = require('../src/routes/tournamentDraw');
const tournament = require('../src/routes/tournament');
const { tournamentAccess } = require('../src/utils/tournamentAccess');
const id = '11111111-1111-4111-8111-111111111111';
const itemId = '22222222-2222-4222-8222-222222222222';
const handler = (router, path, method = 'post') => router.stack.find(l => l.route?.path === path && l.route.methods[method]).route.stack.at(-1).handle;
const req = { params: { leagueId: id, id }, user: { sub: '7' }, get: () => 'same-request', body: {} };

async function execute(run, { role = 'owner', permissions = {}, funded: available = true, failure = false } = {}) {
  const oldQuery = pool.query, oldConnect = pool.connect;
  const commands = [];
  credits.length = refunds.length = 0; funded = available; scanFails = failure;
  const query = async (sql, values) => {
    commands.push(sql);
    if (sql.includes('FROM subscriptions')) return { rowCount: 0, rows: [] };
    if (sql.includes('FROM tournaments t LEFT JOIN')) return { rows: [{ created_by_id: 99, role, management_permissions: permissions, status: 'open' }] };
    if (sql.includes('JOIN group_members gm ON gm.group_id=p.source_group_id')) return { rowCount: 0 };
    if (sql.includes('SELECT COALESCE(MAX(round_no)')) return { rows: [{ value: 0 }] };
    if (sql.includes('INSERT INTO tournament_after_party_settlements')) return { rows: [{ id, created_by_id: values.at(-1) }] };
    if (sql.includes('INSERT INTO tournament_draws')) return { rows: [{ id }] };
    if (sql.includes('INSERT INTO tournament_draw_prizes')) return { rows: [{ id: itemId }] };
    if (/^(BEGIN|COMMIT|ROLLBACK|INSERT|UPDATE)/.test(sql)) return { rows: [], rowCount: 0 };
    if (sql.includes('FROM tournament_event_context')) return { rowCount: 1, rows: [{ billing_owner_id: 99 }] };
    if (sql.includes('FROM tournament_event_participants') || sql.includes('FROM tournament_after_party_settlements') || sql.includes('FROM tournament_draws')) return { rows: [], rowCount: 0 };
    if (sql.includes('FROM after_party_menu_settings')) return { rows: [] };
    throw Error(`Unexpected SQL: ${sql}`);
  };
  pool.query = query; pool.connect = async () => ({ query, release() {} });
  const res = { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } };
  try { await run(res); return { res, commands, credits: [...credits], refunds: [...refunds] }; }
  finally { pool.query = oldQuery; pool.connect = oldConnect; }
}

test('nonpremium host owner and permitted admins manage events; unrelated clubs and denied admins cannot', async () => {
  for (const role of ['owner', 'admin', 'member', null]) {
    for (const permission of ['league', 'draw', 'settlement']) {
      await execute(async () => {
        const access = await tournamentAccess(pool, id, 7, permission);
        assert.equal(access.manage, role === 'owner' || role === 'admin');
      }, { role, permissions: { league: true, draw: true, settlement: true } });
    }
  }
  await execute(async () => assert.equal((await tournamentAccess(pool, id, 7, 'settlement')).manage, false), { role: 'admin', permissions: { settlement: false } });
});

test('nonpremium host leader adds settlement manually without consuming a token', async () => {
  const result = await execute(res => handler(settlement, '/tournaments/:leagueId/after-party')({ ...req, body: { title: '1', participants: [{ id, name: 'guest', guest: true, attending: true, drinking: false, excluded: false }], items: [{ id: itemId, name: 'cost', amount: 100, category: 'common', personIds: [] }], contributions: [] } }, res));
  assert.equal(result.res.statusCode, 201);
  assert.equal(result.res.body.settlement.created_by_id, 7);
  assert.equal(result.credits.length, 0);
});

test('receipt scan consumes and refunds the requesting leader credits, never the creator credits', async () => {
  const scan = res => handler(settlement, '/tournaments/:leagueId/after-party/receipt-scan')({ ...req, files: [{ mimetype: 'image/png', buffer: Buffer.from('test'), size: 4 }] }, res);
  const success = await execute(scan);
  assert.equal(success.res.statusCode, 200);
  assert.equal(success.credits[0].userId, 7);
  assert.match(success.credits[0].requestKey, /:7:/);
  const empty = await execute(scan, { funded: false });
  assert.equal(empty.res.statusCode, 402);
  const failed = await execute(scan, { failure: true });
  assert.equal(failed.refunds[0].userId, 7);
  const denied = await execute(scan, { role: 'member' });
  assert.equal(denied.res.statusCode, 403);
  assert.equal(denied.credits.length, 0);
});

test('draw creation uses caller tokens and rejects insufficient balance before creating records', async () => {
  const create = res => handler(draw, '/tournaments/:leagueId/draw')({ ...req, body: { name: 'draw', prizes: [{ prize_name: 'prize', quantity: 1 }] } }, res);
  const success = await execute(create);
  assert.equal(success.res.statusCode, 201);
  assert.equal(success.credits[0].userId, 7);
  const empty = await execute(create, { funded: false });
  assert.equal(empty.res.statusCode, 402);
  assert.equal(empty.commands.some(sql => sql.startsWith('INSERT')), false);
});

test('new tournament creation still requires premium before any tournament write', async () => {
  const result = await execute(res => handler(tournament, '/tournaments')({ ...req, body: { title: 'test', starts_at: '2099-01-01T00:00:00Z', host_group_id: id, divisions: [{ name: '3', rounds: [{ league_type: 'SINGLES', format: 'LEAGUE' }] }] } }, res));
  assert.equal(result.res.statusCode, 403);
  assert.equal(result.res.body.code, 'PREMIUM_REQUIRED');
  assert.equal(result.commands.some(sql => sql.startsWith('INSERT')), false);
});
