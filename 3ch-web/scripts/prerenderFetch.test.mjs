import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchPublicResource } from './prerenderFetch.mjs';

const url = 'https://public.example/api/guides';
const jsonResponse = () => new Response('{"guides":[{"id":1}]}', { headers: { 'content-type': 'application/json' } });
const options = { delay: async () => {}, warn: () => {} };

test('a transient network timeout retries the public GET and reads its body', async () => {
  let calls = 0;
  const waits = [], warnings = [];
  const result = await fetchPublicResource(url, { ...options,
    delay: async ms => { waits.push(ms); }, warn: message => warnings.push(message),
    fetchImpl: async (address, init) => {
      assert.equal(address, url); assert.ok(init.signal instanceof AbortSignal);
      if (++calls === 1) throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
      return jsonResponse();
    },
  });
  assert.equal(calls, 2); assert.deepEqual(waits, [1000]);
  assert.equal(result.status, 200); assert.equal(result.contentType, 'application/json');
  assert.deepEqual(JSON.parse(result.body.toString()), { guides: [{ id: 1 }] });
  assert.ok(warnings[0].includes(url));
});

test('temporary HTTP failures retry instead of becoming public snapshots', async () => {
  let calls = 0;
  const result = await fetchPublicResource(url, { ...options, fetchImpl: async () => ++calls === 1 ? new Response('unavailable', { status: 503 }) : jsonResponse() });
  assert.equal(calls, 2); assert.equal(result.status, 200);
});

test('a timeout while downloading a body is retried even after receiving successful headers', async () => {
  let calls = 0;
  const result = await fetchPublicResource(url, { ...options, fetchImpl: async () => {
    if (++calls > 1) return jsonResponse();
    return { status: 200, headers: new Headers(), arrayBuffer: async () => { throw new DOMException('body timed out', 'TimeoutError'); } };
  } });
  assert.equal(calls, 2); assert.ok(result.body.length > 0);
});

test('a permanent response is returned once for the caller to validate', async () => {
  let calls = 0;
  const result = await fetchPublicResource(url, { ...options, fetchImpl: async () => { calls++; return new Response('not found', { status: 404 }); } });
  assert.equal(calls, 1); assert.equal(result.status, 404);
});

test('exhausted retries fail with the URL and cause, never an empty fallback response', async () => {
  let calls = 0;
  await assert.rejects(fetchPublicResource(url, { ...options, fetchImpl: async () => { calls++; throw new DOMException('request timed out', 'TimeoutError'); } }), error => {
    assert.ok(error.message.includes(url)); assert.ok(error.message.includes('3 attempts'));
    assert.equal(error.cause.name, 'TimeoutError'); return true;
  });
  assert.equal(calls, 3);
});
