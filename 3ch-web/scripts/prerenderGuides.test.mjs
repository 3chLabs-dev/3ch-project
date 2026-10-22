import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPublicGuides } from './prerenderGuides.mjs';

const origin = 'https://public.example';
const response = (value, status = 200) => ({ status, body: Buffer.from(JSON.stringify(value)) });
const index = [{ id: 2, tab: 'leader', section: '클럽' }, { id: 7, tab: 'member', section: '경기' }];
const log = () => {};

test('loads a content-free index and individual documents, preserving all public content and order', async () => {
  const calls = [];
  const documents = index.map((item) => ({ ...item, content: `<p>${item.section}</p><img src="data:image/png;base64,original">` }));
  const result = await loadPublicGuides(origin, { log, fetchResource: async (url) => {
    calls.push(url);
    if (url.endsWith('?summary=1')) return response({ guides: index });
    return response({ guide: documents.find((item) => url.endsWith(`/${item.id}`)) });
  } });
  assert.deepEqual(calls, [`${origin}/api/guides?summary=1`, `${origin}/api/guides/2`, `${origin}/api/guides/7`]);
  assert.deepEqual(result.guides, documents);
  assert.deepEqual(JSON.parse(result.response.body.toString()), { guides: documents });
});

test('empty, duplicate or invalid guide indexes cannot become empty public snapshots', async () => {
  for (const guides of [[], [{ id: 2 }, { id: 2 }], [{ id: '../secret' }], [{ id: 0 }]]) {
    await assert.rejects(loadPublicGuides(origin, { log, fetchResource: async () => response({ guides }) }));
  }
});

test('a failed individual document aborts the entire snapshot instead of omitting that guide', async () => {
  for (const failure of [response({}, 503), response({}, 404), response({ guide: { id: 2 } }), response({ guide: { id: 99, content: 'wrong document' } })]) {
    await assert.rejects(loadPublicGuides(origin, { log, fetchResource: async (url) => url.endsWith('?summary=1') ? response({ guides: index }) : failure }));
  }
});

test('network timeouts remain failures, never substituted with missing content', async () => {
  await assert.rejects(loadPublicGuides(origin, { log, fetchResource: async (url) => {
    if (url.endsWith('?summary=1')) return response({ guides: index });
    throw new DOMException('request timed out', 'TimeoutError');
  } }), { name: 'TimeoutError' });
});
