import test from 'node:test';
import assert from 'node:assert/strict';
import { rankSources, loadSources, clearSourceCache, isAutoQuality, qualityLabel } from '../src/lib/sourceCache.ts';
import type { StreamingSource } from '../src/api/types.ts';

const src = (quality: string, url: string) => ({ provider: 'p', server: 's', type: 'hls', url, quality }) as unknown as StreamingSource;

test('rankSources puts the highest quality first and keeps order for ties', () => {
  const ranked = rankSources([src('480p', 'a'), src('', 'b'), src('1080p', 'c'), src('4K', 'd'), src('720p', 'e'), src('1080', 'f')]);
  assert.deepEqual(ranked.map((s) => s.url), ['d', 'c', 'f', 'e', 'a', 'b']);
});

test('rankSources puts the adaptive Auto source ahead of fixed qualities', () => {
  const ranked = rankSources([src('1080p', 'a'), src('4K', 'b'), src('Auto', 'c'), src('720p', 'd')]);
  assert.deepEqual(ranked.map((s) => s.url), ['c', 'b', 'a', 'd']);
});

test('isAutoQuality matches only the explicit Auto label', () => {
  assert.equal(isAutoQuality('Auto'), true);
  assert.equal(isAutoQuality(' auto '), true);
  assert.equal(isAutoQuality(''), false);
  assert.equal(isAutoQuality(undefined), false);
  assert.equal(isAutoQuality('1080p'), false);
});

test('qualityLabel shows the playing resolution for Auto and a neutral label when unknown', () => {
  assert.equal(qualityLabel('Auto', 1080), 'Auto · 1080p');
  assert.equal(qualityLabel('Auto', 2160), 'Auto · 4K');
  assert.equal(qualityLabel('Auto', null), 'Auto');
  assert.equal(qualityLabel('720p', 1080), '720p');
  assert.equal(qualityLabel('', null), 'Default');
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
