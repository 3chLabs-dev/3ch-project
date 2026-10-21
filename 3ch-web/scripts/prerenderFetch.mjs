import { setTimeout as sleep } from 'node:timers/promises';

// Include the response body in the timeout/retry window: the guide response can
// contain large inline images, so receiving headers alone is not a successful read.
export async function fetchPublicResource(url, {
  attempts = 3,
  timeoutMs = 60000,
  fetchImpl = fetch,
  delay = sleep,
  warn = console.warn,
} = {}) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (response.status === 408 || response.status === 429 || response.status >= 500) {
        await response.body?.cancel();
        throw new Error(`HTTP ${response.status}`);
      }
      return {
        status: response.status,
        contentType: response.headers.get('content-type') || 'application/json',
        body: Buffer.from(await response.arrayBuffer()),
      };
    } catch (error) {
      const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      if (attempt === attempts) {
        throw new Error(`[prerender] GET ${url} failed after ${attempts} attempts (${timeoutMs}ms timeout per attempt): ${reason}`, { cause: error });
      }
      warn(`[prerender] GET ${url} attempt ${attempt}/${attempts} failed: ${reason}; retrying.`);
      await delay(1000 * attempt);
    }
  }
  throw new Error('[prerender] At least one fetch attempt is required.');
}
