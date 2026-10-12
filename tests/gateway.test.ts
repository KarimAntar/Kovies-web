import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import handler from '../api/k/[...path].ts';

const originalFetch = globalThis.fetch;
const originalKey = process.env.KOVIES_API_KEY;
afterEach(() => { globalThis.fetch = originalFetch; if (originalKey) process.env.KOVIES_API_KEY = originalKey; else delete process.env.KOVIES_API_KEY; });
function response() {
  return { code: 200, body: null as unknown, headers: {} as Record<string,string>,
    setHeader(k: string, v: string) { this.headers[k.toLowerCase()] = v; return this; },
    status(n: number) { this.code = n; return this; },
    send(v: unknown) { this.body = v; return this; },
    json(v: unknown) { this.body = v; return this; },
    end() { return this; },
  };
}
async function invoke(url: string, method = 'GET', body?: string, headers = {}) {
  const req = Object.assign(Readable.from(body ? [body] : []), { url, method, headers });
  const res = response();
  await handler(req as never, res as never);
  return res;
}
test('requires server-side key and never makes a request when absent', async () => {
  delete process.env.KOVIES_API_KEY;
  globalThis.fetch = () => { throw new Error('must not fetch'); };
  const r = await invoke('/api/k/home');
  assert.equal(r.code, 500); assert.deepEqual(r.body, { error: 'Server misconfigured' });
});
test('rejects traversal, nonallowlisted paths, and forbidden methods', async () => {
  process.env.KOVIES_API_KEY = 'test-only';
  globalThis.fetch = () => { throw new Error('must not fetch'); };
  for (const path of ['https://evil.test/home', '/api/k/homeevil', '/api/k/movies/../admin', '/api/k/movies/%2e%2e/admin', '/api/k/sources/%252fadmin', '/api/k/stream/token', '/api/k//evil.test']) {
    assert.equal((await invoke(path)).code, 400, path);
  }
  for (const method of ['PATCH', 'OPTIONS', 'HEAD']) assert.equal((await invoke('/api/k/home', method)).code, 405);
  assert.equal((await invoke('/api/k/movies/1', 'POST', '{}')).code, 405);
});
test('forwards fixed upstream, query, bearer, JSON and passes response without cookies', async () => {
  process.env.KOVIES_API_KEY = 'test-only';
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), 'https://kovies.kerix.tech/api/user/watchlist?type=all&x=1&x=2');
    assert.equal(new Headers(options?.headers).get('x-api-key'), 'test-only');
    assert.equal(new Headers(options?.headers).get('authorization'), 'Bearer sample');
    assert.equal(options?.redirect, 'manual');
    assert.equal(options?.body, '{"title":"Example"}');
    return new Response('{"item":{}}', { status: 201, headers: { 'content-type': 'application/json', 'set-cookie': 'session=secret' } });
  };
  const r = await invoke('/api/k/user/watchlist?type=all&x=1&x=2', 'POST', '{"title":"Example"}', { authorization: 'Bearer sample', 'content-type': 'application/json' });
  assert.equal(r.code, 201); assert.equal(r.headers['cache-control'], 'private, no-store');
  assert.equal(r.headers['set-cookie'], undefined); assert.equal(String(r.body), '{"item":{}}');
});
test('rejects redirects, invalid JSON, and oversized bodies', async () => {
  process.env.KOVIES_API_KEY = 'test-only';
  globalThis.fetch = async () => new Response('', { status: 302, headers: { location: 'https://evil.test' } });
  assert.equal((await invoke('/api/k/home')).code, 502);
  assert.equal((await invoke('/api/k/auth/login', 'POST', '{bad', { 'content-type': 'application/json' })).code, 400);
  assert.equal((await invoke('/api/k/auth/login', 'POST', JSON.stringify({ data: 'a'.repeat(65536) }), { 'content-type': 'application/json' })).code, 413);
});
