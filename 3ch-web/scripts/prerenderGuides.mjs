import { fetchPublicResource } from './prerenderFetch.mjs';

export async function loadPublicGuides(origin, { fetchResource = fetchPublicResource, log = console.log } = {}) {
  const readJson = async (path) => {
    const response = await fetchResource(`${origin}${path}`);
    if (response.status < 200 || response.status >= 300) throw new Error(`Public guide API ${path} returned ${response.status}`);
    return JSON.parse(response.body.toString('utf8'));
  };
  // The legacy /api/guides response contains every inline image in every guide.
  // Enumerate a small index, then download one guide body at a time so retries
  // are bounded by an individual document instead of the entire collection.
  const index = await readJson('/api/guides?summary=1');
  if (!Array.isArray(index.guides) || !index.guides.length) throw new Error('Public guides could not be loaded; refusing to publish an empty snapshot.');
  const ids = index.guides.map((guide) => Number(guide.id));
  if (ids.some((id) => !Number.isSafeInteger(id) || id < 1) || new Set(ids).size !== ids.length) throw new Error('Public guide index contains invalid or duplicate IDs.');
  const guides = [];
  for (const id of ids) {
    log(`[prerender] Loading guide ${id} (${guides.length + 1}/${ids.length})`);
    const { guide } = await readJson(`/api/guides/${id}`);
    if (!guide || Number(guide.id) !== id || typeof guide.content !== 'string') throw new Error(`Public guide ${id} has missing or invalid content; refusing to publish an incomplete snapshot.`);
    guides.push(guide);
  }
  return {
    guides,
    response: { status: 200, contentType: 'application/json; charset=utf-8', body: Buffer.from(JSON.stringify({ guides })) },
  };
}
