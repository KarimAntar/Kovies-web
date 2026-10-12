// Opt-in smoke test (KOVIES_SELFTEST=1): waits for the page, probes the
// protocol, bridge, CSP and API CORS path from the renderer, prints one JSON
// line prefixed with KOVIES_SELFTEST and exits (code 0 on pass, 1 on fail).
import { app, type BrowserWindow } from 'electron';

const PROBE = `(async () => {
  const r = {};
  r.href = location.href;
  r.bridge = typeof window.koviesDesktop === 'object' && window.koviesDesktop.isDesktop === true;
  r.bridgeKeys = r.bridge ? Object.keys(window.koviesDesktop).sort() : [];
  r.platform = r.bridge ? window.koviesDesktop.platform : null;
  r.apiBase = r.bridge ? window.koviesDesktop.apiBase : null;
  r.noRequire = typeof require === 'undefined' && typeof process === 'undefined';
  r.rootChildren = document.getElementById('root')?.childElementCount ?? -1;
  const idx = await fetch('/some/client/route');
  r.spaFallback = idx.status + ' ' + idx.headers.get('content-type');
  r.csp = (idx.headers.get('content-security-policy') || '').slice(0, 40);
  const trav = await fetch('/..%2F..%2Fpackage.json');
  r.traversal = trav.status;
  const missing = await fetch('/assets/does-not-exist.js');
  r.missingAsset = missing.status;
  r.isMaximized = r.bridge ? await window.koviesDesktop.isMaximized() : null;
  try { await window.koviesDesktop.registerStreamHeaders('http://x.example/a.m3u8', {}); r.rejectHttp = false; }
  catch { r.rejectHttp = true; }
  try { await window.koviesDesktop.registerStreamHeaders('https://cdn.example/a.m3u8', { Cookie: 'x' }); r.rejectHeader = false; }
  catch { r.rejectHeader = true; }
  try { await window.koviesDesktop.registerStreamHeaders('https://cdn.example/a.m3u8', { Referer: 'https://p.example/x' }); r.acceptValid = true; }
  catch (e) { r.acceptValid = String(e); }
  try { const api = await fetch('https://kovies.kerix.tech/api/health?selftest=' + Date.now(), { cache: 'no-store' }); r.apiStatus = api.status; r.apiBody = (await api.text()).slice(0, 160); }
  catch (e) { r.apiStatus = 'blocked: ' + e; }
  return r;
})()`;

export async function runSelfTest(win: BrowserWindow): Promise<void> {
  const finish = (code: number, payload: unknown): void => {
    console.log('KOVIES_SELFTEST ' + JSON.stringify(payload));
    app.exit(code);
  };
  const consoleIssues: string[] = [];
  win.webContents.on('console-message', (event) => {
    if (event.level === 'warning' || event.level === 'error') consoleIssues.push(event.message.slice(0, 200));
  });
  const timer = setTimeout(() => finish(1, { error: 'timeout' }), 20000);
  try {
    if (win.webContents.isLoading()) {
      await new Promise<void>((resolve) => win.webContents.once('did-finish-load', () => resolve()));
    }
    await new Promise((r) => setTimeout(r, 1500)); // let React mount
    const result = (await win.webContents.executeJavaScript(PROBE, true)) as Record<string, unknown>;
    clearTimeout(timer);
    const pass =
      result.bridge === true &&
      result.noRequire === true &&
      String(result.href).startsWith('app://kovies/') &&
      String(result.spaFallback).startsWith('200 text/html') &&
      result.traversal !== 200 &&
      result.missingAsset === 404 &&
      result.rejectHttp === true &&
      result.rejectHeader === true &&
      result.acceptValid === true &&
      typeof result.apiStatus === 'number';
    finish(pass ? 0 : 1, { pass, ...result, consoleIssues });
  } catch (err) {
    clearTimeout(timer);
    finish(1, { error: err instanceof Error ? err.message : String(err) });
  }
}
