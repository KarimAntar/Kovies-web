import test from 'node:test';
import assert from 'node:assert/strict';
import { rankSources, loadSources, clearSourceCache } from '../src/lib/sourceCache.ts';
import type { StreamingSource } from '../src/api/types.ts';

const src = (quality: string, url: string) => ({ provider: 'p', server: 's', type: 'hls', url, quality }) as unknown as StreamingSource;

test('rankSources puts the highest quality first and keeps order for ties', () => {
  const ranked = rankSources([src('480p', 'a'), src('', 'b'), src('1080p', 'c'), src('4K', 'd'), src('720p', 'e'), src('1080', 'f')]);
  assert.deepEqual(ranked.map((s) => s.url), ['d', 'c', 'f', 'e', 'a', 'b']);
});

test('loadSources shares one in-flight request between details prefetch and the player', async () => {
  clearSourceCache();
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ sources: [src('720p', 'x'), src('1080p', 'y')] }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  };
  try {
    const [a, b] = await Promise.all([loadSources(42, 'movie'), loadSources(42, 'movie')]);
    assert.equal(calls, 1);
    assert.equal(a, b);
    assert.deepEqual(a.sources.map((s) => s.url), ['y', 'x']);
    await loadSources(42, 'tv', 1, 2);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('loadSources does not cache failures', async () => {
  clearSourceCache();
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ error: 'boom' }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    await assert.rejects(loadSources(7, 'movie'));
    await assert.rejects(loadSources(7, 'movie'));
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
