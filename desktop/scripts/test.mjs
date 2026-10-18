import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { build } from 'esbuild';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

async function load(entry, electronMock = {}) {
  const result = await build({
    entryPoints: [path.join(root, 'src', entry)],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
    external: ['electron'],
    define: { __KOVIES_API_KEY__: JSON.stringify('test-only-key') },
  });
  const moduleObj = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports,__dirname){${result.outputFiles[0].text}\n})`)(
    (id) => (id === 'electron' ? electronMock : require(id)),
    moduleObj,
    moduleObj.exports,
    path.join(root, 'build'),
  );
  return moduleObj.exports;
}

const stream = await load('main/streamHeaders.ts');
const shared = await load('shared/channels.ts');

test('app URLs reject remote origins and credentials', () => {
  assert.equal(shared.isAppUrl('app://kovies/watch/1'), true);
  for (const url of ['https://kovies/', 'app://evil/', 'app://kovies:99/', 'app://user@kovies/']) {
    assert.equal(shared.isAppUrl(url), false);
  }
});

test('stream input validation and exact-host expiry', () => {
  // Invalid inputs
  for (const headers of [
    { Cookie: 'x' },
    { Origin: 'http://example.com' },
    { Referer: 'https://user:pass@example.com' },
    { 'User-Agent': 'a\rb' },
    { 'User-Agent': 'x'.repeat(513) },
  ]) {
    assert.throws(() => stream.validateRegistration('https://cdn.example/a', headers));
  }
  assert.throws(() => stream.validateRegistration('http://cdn.example/a', {}));

  // Valid inputs
  const valid = stream.validateRegistration('https://CDN.example/a', { Referer: 'https://provider.example/' });
  let time = 100;
  const s = new stream.StreamHeaderStore(() => time);
  s.register(valid.host, valid.headers);
  assert.equal(s.get('cdn.example')?.Referer, 'https://provider.example/');
  assert.equal(s.get('child.cdn.example'), undefined);

  // Expire after 6h
  time += 6 * 60 * 60 * 1000 + 1;
  assert.equal(s.get('cdn.example'), undefined);
});

test('API key only reaches exact HTTPS API host and onBeforeSendHeaders behavior', async () => {
  const hooks = {};
  const network = await load('main/network.ts');
  const store = new stream.StreamHeaderStore();
  const webRequest = {
    onBeforeSendHeaders: (...args) => {
      hooks.onBeforeSendHeaders = args.at(-1);
    },
    onHeadersReceived: (...args) => {
      hooks.onHeadersReceived = args.at(-1);
    },
  };
  network.installNetworkHooks({ webRequest }, store);

  const request = (url, headers = {}) => {
    let result = {};
    hooks.onBeforeSendHeaders({ url, requestHeaders: headers, resourceType: 'xhr' }, (r) => {
      result = r;
    });
    return result.requestHeaders ?? headers;
  };

  const headers = request('https://kovies.kerix.tech/api/health');
  assert.equal(headers['X-API-Key'], 'test-only-key');

  // Should not inject on other hosts
  const otherHeaders = request('https://other.example/api');
  assert.equal(otherHeaders['X-API-Key'], undefined);

  // Stream headers
  store.register('cdn.example', { Referer: 'https://provider.example/' });
  const cdnHeaders = request('https://cdn.example/a.m3u8');
  assert.equal(cdnHeaders.Referer, 'https://provider.example/');
});

test('CORS headers allow app origin for trusted hosts', async () => {
  const hooks = {};
  const network = await load('main/network.ts');
  const store = new stream.StreamHeaderStore();
  const webRequest = {
    onBeforeSendHeaders: () => {},
    onHeadersReceived: (...args) => {
      hooks.onHeadersReceived = args.at(-1);
    },
  };
  network.installNetworkHooks({ webRequest }, store);

  let response;
  hooks.onHeadersReceived(
    {
      url: 'https://kovies.kerix.tech/api/health',
      method: 'OPTIONS',
      statusCode: 204,
      responseHeaders: {},
    },
    (v) => {
      response = v;
    },
  );
  assert.deepEqual(response.responseHeaders['Access-Control-Allow-Origin'], ['app://kovies']);
});

test('CORS allows the app origin for the introdb.app skip-segment API only', async () => {
  const hooks = {};
  const network = await load('main/network.ts');
  const store = new stream.StreamHeaderStore();
  network.installNetworkHooks({ webRequest: {
    onBeforeSendHeaders: () => {},
    onHeadersReceived: (...args) => { hooks.onHeadersReceived = args.at(-1); },
  } }, store);
  const run = (url) => {
    let response;
    hooks.onHeadersReceived({ url, method: 'GET', statusCode: 200, responseHeaders: { 'Access-Control-Allow-Origin': ['https://introdb.app'] } }, (v) => { response = v; });
    return response;
  };
  assert.deepEqual(run('https://api.introdb.app/segments?imdb_id=tt1').responseHeaders['Access-Control-Allow-Origin'], ['app://kovies']);
  assert.equal(run('https://evil.example/segments').responseHeaders, undefined);
});

test('protocol rejects traversal, alternate streams and symlink escape; serves routes and MIME', async () => {
  let handler;
  const protocol = await load('main/protocol.ts', {
    protocol: {
      handle: (_scheme, fn) => {
        handler = fn;
      },
    },
  });

  for (const pathname of ['/../secret', '/%2e%2e/secret', '/file.txt:secret', '/%00']) {
    assert.equal(await protocol.safeJoin(root, pathname), null);
  }

  const temp = await mkdtemp(path.join(root, '.test-'));
  try {
    const web = path.join(temp, 'web');
    await mkdir(web);
    await writeFile(path.join(web, 'index.html'), '<html>test</html>');
    await writeFile(path.join(web, 'bundle.js'), 'export {};');
    await writeFile(path.join(temp, 'secret.txt'), 'secret');
    if (process.platform !== 'win32') {
      await symlink(path.join(temp, 'secret.txt'), path.join(web, 'escape.txt'));
    }

    protocol.registerAppProtocolHandler(web);
    const get = (route, method = 'GET') => handler(new Request(`app://kovies${route}`, { method }));

    assert.equal((await get('/watch/1')).status, 200);
    assert.match((await get('/bundle.js')).headers.get('content-type'), /javascript/);
    assert.equal((await get('/missing.js')).status, 404);
    assert.equal(await (await get('/', 'HEAD')).text(), '');
    if (process.platform !== 'win32') {
      assert.notEqual((await get('/escape.txt')).status, 200);
    }
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
