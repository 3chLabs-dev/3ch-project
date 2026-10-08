const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

async function run({ apply = false, duplicate = false } = {}) {
  const queries = [];
  const output = [];
  const errors = [];
  const processMock = { argv: apply ? ['node', 'script', '--apply'] : ['node', 'script'], exitCode: 0 };
  let finished;
  const done = new Promise(resolve => { finished = resolve; });
  const options = {};
  Object.defineProperty(options, 'password', { value: 'test-only-secret', enumerable: false });
  const pool = {
    options,
    connect: async () => {
      assert.equal(options.password, 'test-only-secret');
      return {
        query: async (sql, params) => {
          queries.push({ sql, params });
          if (sql.startsWith('SELECT')) return { rows: [
            { id: 1, email: 'admin@3ch.com', is_admin: true, system_role: 'MASTER', deleted_at: null },
            ...(duplicate ? [{ id: 2, email: 'admin@threech.com' }] : []),
          ] };
          if (sql.startsWith('UPDATE')) return { rowCount: 1, rows: [{ id: 1, email: 'admin@threech.com', system_role: 'MASTER' }] };
          return {};
        },
        release() {},
      };
    },
    end: async () => {},
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../scripts/renameAdminEmail.js'), 'utf8'), {
    require(name) { assert.equal(name, '../src/db/pool'); return pool; },
    process: processMock,
    console: { log: value => output.push(JSON.parse(value)), error: value => errors.push(value) },
    setTimeout: () => 1,
    clearTimeout: () => finished(),
  });
  await done;
  return { queries, output, errors, processMock };
}

test('uses the existing pool with its hidden password and dry run does not write', async () => {
  const result = await run();
  assert.equal(result.output[0].ready, true);
  assert.ok(!result.queries.some(query => query.sql.startsWith('UPDATE')));
  assert.equal(result.queries.at(-1).sql, 'ROLLBACK');
});
test('apply changes only the verified administrator email and commits', async () => {
  const result = await run({ apply: true });
  const update = result.queries.find(query => query.sql.startsWith('UPDATE'));
  assert.deepEqual(Array.from(update.params), ['admin@threech.com', 1, 'admin@3ch.com']);
  assert.match(update.sql, /SET email=\$1,updated_at=NOW\(\)/);
  assert.equal(result.queries.at(-1).sql, 'COMMIT');
  assert.equal(result.output[0].changed.email, 'admin@threech.com');
});
test('duplicate destination email rolls back without modifying any account', async () => {
  const result = await run({ apply: true, duplicate: true });
  assert.ok(!result.queries.some(query => query.sql.startsWith('UPDATE')));
  assert.equal(result.queries.at(-1).sql, 'ROLLBACK');
  assert.equal(result.processMock.exitCode, 1);
  assert.equal(result.errors[0], 'DESTINATION_EMAIL_ALREADY_EXISTS');
});
