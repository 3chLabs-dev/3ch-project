const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/db/pool');
const router = require('../src/routes/tournament');

const tournamentId = '6f40f553-e218-4679-a654-f8b635d28060';
const participantId = '1f40f553-e218-4679-a654-f8b635d28060';
const handler = (path, method = 'patch') => router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]).route.stack.at(-1).handle;

async function update(body, { manager = true, premium = true, previous = '4', participantExists = true } = {}) {
  const original = pool.connect;
  const commands = [];
  const participant = { id: participantId, member_division: previous, name: '참가자', status: 'confirmed', division_id: 'existing-category', source_group_id: 'other-club' };
  const competition = { pool: 'locked-pool', slot: 3, score_a: 3, score_b: 1, status: 'completed', qualified: true };
  const before = structuredClone(competition);
  let released = false;
  pool.connect = async () => ({
    async query(sql, values = []) {
      commands.push(sql);
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return {};
      if (sql.includes('FROM tournaments')) return { rowCount: 1, rows: [{ host_group_id: 'host', starts_at: '2020-01-01', status: 'completed' }] };
      if (sql.includes('FROM subscriptions')) return { rowCount: premium ? 1 : 0, rows: [] };
      if (sql.includes('FROM group_members')) return { rows: manager ? [{ role: 'owner' }] : [] };
      if (sql.includes('FROM tournament_participants')) return { rowCount: participantExists ? 1 : 0, rows: participantExists ? [participant] : [] };
      if (sql === 'UPDATE tournament_participants SET member_division = $1 WHERE id = $2') { participant.member_division = values[0]; return {}; }
      throw new Error(`Unexpected mutation/query: ${sql}`);
    },
    release() { released = true; },
  });
  const response = { statusCode: 200 };
  const res = { status(code) { response.statusCode = code; return this; }, json(body) { response.body = body; return this; } };
  try {
    await handler('/tournaments/:id/participants/:participantId/division')({ user: { sub: '1' }, params: { id: tournamentId, participantId }, body }, res);
    assert.deepEqual(competition, before);
    return { response, commands, participant, released };
  } finally { pool.connect = original; }
}

test('주최자는 다른 클럽의 부수를 확정된 조와 완료 경기 이후에도 수정하며 상태와 연결을 보존한다', async () => {
  const result = await update({ member_division: ' 7 ', previous_member_division: '4' });
  assert.equal(result.response.statusCode, 200);
  assert.deepEqual(result.participant, { id: participantId, member_division: '7', name: '참가자', status: 'confirmed', division_id: 'existing-category', source_group_id: 'other-club' });
  assert.equal(result.commands.at(-1), 'COMMIT');
  assert.equal(result.released, true);
});

test('일반 참가자와 프리미엄 권한이 없는 계정은 부수 수정이 거절된다', async () => {
  for (const options of [{ manager: false }, { premium: false }]) {
    const result = await update({ member_division: '7', previous_member_division: '4' }, options);
    assert.equal(result.response.statusCode, 403);
    assert.equal(result.participant.member_division, '4');
    assert.equal(result.commands.at(-1), 'ROLLBACK');
  }
});

test('동시 수정 충돌과 다른 대회 참가자 요청을 거절한다', async () => {
  const conflict = await update({ member_division: '7', previous_member_division: '3' });
  assert.equal(conflict.response.statusCode, 409);
  assert.equal(conflict.commands.at(-1), 'ROLLBACK');
  const missing = await update({ member_division: '7', previous_member_division: '4' }, { participantExists: false });
  assert.equal(missing.response.statusCode, 404);
  assert.equal(missing.commands.at(-1), 'ROLLBACK');
});

test('빈 부수와 이름 변경 요청은 DB에 접근하기 전에 거절한다', async () => {
  for (const body of [{ member_division: ' ', previous_member_division: '4' }, { member_division: '7', previous_member_division: '4', name: '변경' }]) {
    const result = await update(body);
    assert.equal(result.response.statusCode, 400);
    assert.equal(result.commands.length, 0);
  }
});

test('일반 명단 저장과 이전 개별/단체 신청 API도 누락된 대회 부수를 거절한다', async () => {
  for (const [path, params, body] of [
    ['/tournaments/:id/applications/roster', { id: tournamentId }, { group_id: null, rows: [{ name: '참가자', division_id: participantId, member_division: null }] }],
    ['/tournaments/:id/divisions/:divisionId/applications', { id: tournamentId, divisionId: participantId }, { kind: 'individual' }],
    ['/tournaments/:id/divisions/:divisionId/applications', { id: tournamentId, divisionId: participantId }, { kind: 'club', group_id: 'club', members: [{ member_id: 1 }] }],
  ]) {
    const response = { statusCode: 200 };
    await handler(path, path.endsWith('/roster') ? 'put' : 'post')({ params, body, user: { sub: '1' } }, { status(code) { response.statusCode = code; return this; }, json() { return this; } });
    assert.equal(response.statusCode, 400);
  }
});

async function saveRoster({ previous = '4', pooled = false, omit = false } = {}) {
  const original = pool.connect;
  const commands = [];
  const saved = { id: participantId, division_id: tournamentId, name: '참가자', member_division: '4', member_id: 1, pre_member_id: null, status: 'confirmed' };
  pool.connect = async () => ({
    async query(sql, values = []) {
      commands.push({ sql, values });
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return {};
      if (sql.includes('FROM tournaments')) return { rowCount: 1, rows: [{ starts_at: '2099-01-01', status: 'open', host_group_id: 'host' }] };
      if (sql.includes('FROM subscriptions')) return { rowCount: 0, rows: [] };
      if (sql.includes('FROM tournament_divisions WHERE')) return { rows: [{ id: tournamentId }] };
      if (sql.includes('SELECT p.*')) return { rowCount: 1, rows: [saved] };
      if (sql.includes('FROM tournament_pools')) return { rows: pooled ? [{ division_id: tournamentId }] : [] };
      if (sql.includes('FROM tournament_matches') || sql.includes('FROM tournament_participants')) return { rows: [], rowCount: 0 };
      if (sql.startsWith('UPDATE tournament_participants')) { assert.equal(values[3], 'confirmed'); return {}; }
      throw new Error(`Unexpected SQL: ${sql}`);
    }, release() {},
  });
  const response = { statusCode: 200 };
  try {
    await handler('/tournaments/:id/applications/roster', 'put')({ user: { sub: '1' }, params: { id: tournamentId }, body: { group_id: null, rows: [{ ...(omit ? {} : { id: participantId }), division_id: tournamentId, name: '참가자', member_division: '7', previous_member_division: previous, member_id: 1, pre_member_id: null }] } }, { status(code) { response.statusCode = code; return this; }, json() { return this; } });
    return { response, commands };
  } finally { pool.connect = original; }
}

test('신청자가 부수만 바꾸면 조 편성 전후 모두 확정 상태를 보존한다', async () => {
  for (const pooled of [false, true]) {
    const result = await saveRoster({ pooled });
    assert.equal(result.response.statusCode, 200);
    assert.equal(result.commands.at(-1).sql, 'COMMIT');
  }
});

test('신청 명단도 오래된 부수로 덮어쓰거나 기존 참가자를 누락하면 수정 없이 롤백한다', async () => {
  for (const options of [{ previous: '3' }, { omit: true }]) {
    const result = await saveRoster(options);
    assert.equal(result.response.statusCode, 409);
    assert.equal(result.commands.at(-1).sql, 'ROLLBACK');
    assert.equal(result.commands.some(({ sql }) => sql.startsWith('UPDATE')), false);
  }
});
