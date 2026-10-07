const test = require('node:test');
const assert = require('node:assert/strict');
const { parseApplication } = require('../src/utils/resultApplication');
const pool = require('../src/db/pool');
const router = require('../src/routes/resultApplication');
const { requireAuth, requireAdmin } = require('../src/middlewares/auth');
const input = { registered: true, account_email: 'member@example.com', club_created: true, club_name: '테스트 클럽', season_configured: true, photo_url: 'https://example.com/photos', contact: '', preferred_at: '' };

test('validates required answers, dates and safe URL protocols', () => {
  assert.equal(parseApplication(input).club_name, '테스트 클럽');
  for (const patch of [{ registered: false }, { account_email: 'invalid' }, { club_created: 'true' }, { club_name: '' }, { season_configured: null }, { photo_url: 'javascript:alert(1)' }, { preferred_at: '2026-02-30T12:00' }, { contact: {} }])
    assert.throws(() => parseApplication({ ...input, ...patch }));
  assert.equal(parseApplication({ ...input, preferred_at: '2026-10-07T12:30' }).preferred_at, '2026-10-07T12:30');
});
test('skipped branch answers are not retained', () => {
  const result = parseApplication({ ...input, club_created: false });
  assert.equal(result.club_name, '');
  assert.equal(result.season_configured, null);
  assert.equal(result.photo_url, '');
  assert.equal(parseApplication({ ...input, season_configured: false }).photo_url, '');
});
test('all application routes enforce user or administrator authentication', () => {
  for (const layer of router.stack.filter(layer => layer.route)) {
    assert.equal(layer.route.stack[0].handle, layer.route.path.startsWith('/admin/') ? requireAdmin : requireAuth);
  }
  assert.ok(router.stack.filter(layer => layer.route).every(layer => !layer.route.methods.delete));
});
async function invoke(path, method, req, rows) {
  const original = pool.query;
  const queries = [];
  pool.query = async (sql, params) => { queries.push({ sql, params }); return { rows, rowCount: rows.length }; };
  const response = { code: 200, body: null };
  const res = { status(code) { response.code = code; return this; }, json(body) { response.body = body; return this; } };
  try {
    const route = router.stack.find(layer => layer.route?.path === path && layer.route.methods[method]);
    await route.route.stack.at(-1).handle(req, res, error => { throw error; });
    return { response, queries };
  } finally { pool.query = original; }
}
test('another user cannot retrieve application content or reply', async () => {
  const { response, queries } = await invoke('/result-applications/my/:id', 'get', { params: { id: '10' }, user: { sub: 22 } }, []);
  assert.equal(response.code, 404);
  assert.match(queries[0].sql, /id = \$1 AND user_id = \$2/);
  assert.deepEqual(queries[0].params, ['10', 22]);
});
test('my list is scoped to the authenticated user', async () => {
  const { queries } = await invoke('/result-applications/my', 'get', { user: { sub: 22 } }, []);
  assert.match(queries[0].sql, /WHERE user_id = \$1/);
  assert.deepEqual(queries[0].params, [22]);
});
test('the owner can view submitted answers and the persisted administrator reply', async () => {
  const answers = parseApplication(input);
  const { response } = await invoke('/result-applications/my/:id', 'get', { params: { id: '10' }, user: { sub: 22 } }, [{ id: 10, answers, status: 'answered', reply: '등록 요청을 확인했습니다.' }]);
  assert.equal(response.code, 200);
  assert.deepEqual(response.body.answers, answers);
  assert.equal(response.body.reply, '등록 요청을 확인했습니다.');
  assert.match(response.body.content, /테스트 클럽/);
});
test('creation persists only application data with server-owned author and status', async () => {
  const { queries, response } = await invoke('/result-applications', 'post', { body: { ...input, user_id: 99, status: 'answered', reply: 'fake' }, user: { sub: 22 } }, [{ id: 1 }]);
  assert.equal(response.code, 201);
  assert.match(queries[0].sql, /INSERT INTO result_applications/);
  assert.equal(queries[0].params[0], 22);
  assert.equal(JSON.parse(queries[0].params[2]).status, undefined);
  assert.equal(queries.length, 1);
});
test('administrator reply changes only reply metadata and preserves submitted answers', async () => {
  const { queries, response } = await invoke('/admin/board/result-applications/:id/reply', 'patch', { params: { id: '10' }, body: { reply: ' 확인했습니다. ' } }, [{ id: 10, status: 'answered' }]);
  assert.equal(response.code, 200);
  assert.match(queries[0].sql, /UPDATE result_applications SET reply/);
  assert.doesNotMatch(queries[0].sql, /SET answers|DELETE|league_matches|rankings/);
  assert.deepEqual(queries[0].params, ['10', '확인했습니다.']);
});
