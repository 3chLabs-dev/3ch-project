const test = require("node:test");
const assert = require("node:assert/strict");
const { createAccountLookup } = require("../src/utils/accountLookup");

async function lookup(body, query) {
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
  await createAccountLookup({ query })({ body }, res);
  return res;
}

test("invalid input never queries the database", async () => {
  for (const body of [{}, { name: " ", email: "a@example.com" }, { name: "Kim", email: "invalid" }]) {
    const res = await lookup(body, () => { assert.fail("unexpected query"); });
    assert.equal(res.statusCode, 400);
  }
});

test("lookup matches both fields, excludes deleted accounts and only reads provider", async () => {
  const res = await lookup({ name: " Kim ", email: " Person@Example.com " }, async (sql, params) => {
    assert.deepEqual(params, ["Kim", "Person@Example.com"]);
    assert.match(sql, /btrim\(name\) = \$1 and lower\(email\) = lower\(\$2\)/);
    assert.match(sql, /deleted_at is null/);
    assert.match(sql.trim(), /^select auth_provider from users/);
    return { rows: [] };
  });
  assert.deepEqual(res.body, { ok: true, found: false, providers: [] });
});

for (const provider of ["local", "google", "kakao", "naver"]) {
  test(`${provider} account returns only its signup method`, async () => {
    const res = await lookup({ name: "Kim", email: "a@example.com" }, async () => ({
      rows: [{ auth_provider: provider, id: 123, password_hash: "secret" }],
    }));
    assert.deepEqual(res.body, { ok: true, found: true, providers: [provider] });
  });
}

test("unknown providers are not incorrectly described as email signup", async () => {
  const res = await lookup({ name: "Kim", email: "a@example.com" }, async () => ({ rows: [{ auth_provider: null }] }));
  assert.deepEqual(res.body.providers, ["unknown"]);
});

test("database errors do not expose internal details", async () => {
  const res = await lookup({ name: "Kim", email: "a@example.com" }, async () => { throw new Error("private database detail"); });
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { ok: false, error: "ACCOUNT_LOOKUP_FAILED" });
});
