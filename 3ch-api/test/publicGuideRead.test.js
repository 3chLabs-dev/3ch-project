const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');

function harness(result = { rows: [], rowCount: 0 }) {
  const routes = new Map(), queries = [];
  const router = { get: (path, handler) => routes.set(path, handler) };
  vm.runInNewContext(readFileSync(resolve(__dirname, '../src/routes/notice.js'), 'utf8'), {
    module: { exports: {} },
    require: (name) => {
      if (name === 'express') return { Router: () => router };
      if (name === '../db/pool') return { query: async (sql, params) => { queries.push({ sql, params }); return result; } };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  const res = { statusCode: 200, headers: {}, body: undefined,
    set(name, value) { this.headers[name] = value; return this; },
    status(status) { this.statusCode = status; return this; },
    json(body) { this.body = body; return this; },
    end() { return this; },
  };
  return { routes, queries, res };
}

test('legacy guide reads retain content and parameterized tab filtering', async () => {
  const guide = { id: 3, content: '<p>existing guide</p>' };
  const { routes, queries, res } = harness({ rows: [guide], rowCount: 1 });
  await routes.get('/guides')({ method: 'GET', query: { tab: 'leader' } }, res);
  assert.match(queries[0].sql, /SELECT id, tab, section, content, display_order/);
  assert.equal(queries[0].params[0], 'leader');
  assert.equal(res.body.guides[0].content, guide.content);
});

test('summary reads exclude the large content column without changing stored rows', async () => {
  const { routes, queries, res } = harness({ rows: [{ id: 3 }], rowCount: 1 });
  await routes.get('/guides')({ method: 'GET', query: { summary: '1' } }, res);
  assert.match(queries[0].sql, /SELECT id, tab, section, display_order/);
  assert.doesNotMatch(queries[0].sql, /\bcontent\b|\bUPDATE\b|\bDELETE\b|\bINSERT\b/);
  assert.equal(res.headers['X-Guides-Index-Version'], '1');
});

test('deployment readiness HEAD requests do not fetch or serialize any guide bodies', async () => {
  const { routes, queries, res } = harness();
  await routes.get('/guides')({ method: 'HEAD', query: { summary: '1' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['X-Guides-Index-Version'], '1');
  assert.equal(queries.length, 0);
  assert.equal(res.body, undefined);
});

test('individual guide reads preserve content and bind the requested ID', async () => {
  const guide = { id: 3, content: '<img src="data:image/png;base64,original">' };
  const { routes, queries, res } = harness({ rows: [guide], rowCount: 1 });
  await routes.get('/guides/:id')({ params: { id: '3' } }, res);
  assert.match(queries[0].sql, /^SELECT .* FROM guides WHERE id = \$1$/);
  assert.equal(queries[0].params[0], '3');
  assert.equal(res.body.guide, guide);
});

test('invalid or missing guide IDs never produce a successful empty snapshot', async () => {
  for (const id of ['0', '-1', '1 OR 1=1', '9007199254740992']) {
    const { routes, queries, res } = harness();
    await routes.get('/guides/:id')({ params: { id } }, res);
    assert.equal(res.statusCode, 400); assert.equal(queries.length, 0);
  }
  const { routes, res } = harness();
  await routes.get('/guides/:id')({ params: { id: '3' } }, res);
  assert.equal(res.statusCode, 404);
});
