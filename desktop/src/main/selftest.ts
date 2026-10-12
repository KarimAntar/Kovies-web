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
  // macOS: the page must own the window drag region (titleBarStyle:'hidden').
  const region = (el) => el ? getComputedStyle(el).getPropertyValue('-webkit-app-region').trim() : null;
  const hdr = document.querySelector('header');
  r.headerRegion = region(hdr);
  r.headerHeightPx = hdr ? Math.round(hdr.getBoundingClientRect().height) : null;
  r.headerButtonRegion = region(hdr && hdr.querySelector('button, a, input'));
  const playerBar = document.querySelector('[style*="titlebar-h"]');
  r.playerBarRegion = region(playerBar);
  // Where the top strip is actually grabbable vs. reserved for controls.
  const samples = [];
  for (const sy of [4, 8, 12, 16, 22]) {
    for (const sx of [0.2, 0.5, 0.8]) {
      const x = Math.round(document.documentElement.clientWidth * sx);
      const el = document.elementFromPoint(x, sy);
      samples.push({
        y: sy,
        x,
        tag: el ? el.tagName.toLowerCase() : null,
        region: region(el),
      });
    }
  }
  r.topStrip = samples;
  // Dedicated grab strip (html::before): Chromium builds drag regions from
  // computed style, so verify the pseudo-element's own box + app-region.
  const pe = getComputedStyle(document.documentElement, '::before');
  const peStyle = (prop) => pe.getPropertyValue(prop).trim();
  r.dragStripRegion = peStyle('-webkit-app-region');
  r.dragStripHeight = peStyle('height');
  r.dragStripPresent =
    peStyle('content') !== 'none' &&
    peStyle('content') !== 'normal' &&
    peStyle('position') === 'fixed' &&
    peStyle('top') === '0px' &&
    r.dragStripRegion === 'drag';
  return r;
})()`;

/**
 * Synthesizes a real mouse drag across the header and reports whether the OS
 * window actually moved. Opt-in via KOVIES_DRAGTEST=1 so the normal self-test
 * stays fast; uses the production window and the production injected CSS.
 */
async function simulateHeaderDrag(win: BrowserWindow): Promise<Record<string, unknown>> {
  const before = win.getBounds();
  const { x, y } = before;
  // y=6 is inside the dedicated grab strip (0-14px), which is draggable
  // across the full width regardless of what the navbar lays out.
  const startX = Math.round(before.width * 0.65);
  const startY = 6;

  win.webContents.sendInputEvent({ type: 'mouseEnter', x: startX, y: startY });
  win.webContents.sendInputEvent({ type: 'mouseMove', x: startX, y: startY });
  win.webContents.sendInputEvent({ type: 'mouseDown', x: startX, y: startY, button: 'left', clickCount: 1 });
  for (let i = 1; i <= 15; i += 1) {
    win.webContents.sendInputEvent({
      type: 'mouseMove',
      x: startX - i * 9,
      y: startY + i * 5,
    });
    await new Promise((r) => setTimeout(r, 25));
  }
  win.webContents.sendInputEvent({ type: 'mouseUp', x: startX - 135, y: startY + 75, button: 'left', clickCount: 1 });
  await new Promise((r) => setTimeout(r, 400));

  const after = win.getBounds();
  return {
    dragBefore: { x, y },
    dragAfter: { x: after.x, y: after.y },
    dragDx: after.x - x,
    dragDy: after.y - y,
    windowMoved: Math.abs(after.x - x) > 5 || Math.abs(after.y - y) > 5,
  };
}

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

    if (process.env.KOVIES_DRAGTEST === '1' && process.platform === 'darwin') {
      Object.assign(result, await simulateHeaderDrag(win));
    }
    // On macOS the page owns the drag region; without it the window cannot move.
    const macDragOk =
      process.platform !== 'darwin' ||
      (result.headerRegion === 'drag' &&
        result.headerButtonRegion === 'no-drag' &&
        typeof result.headerHeightPx === 'number' &&
        (result.headerHeightPx as number) >= 38 &&
        result.dragStripPresent === true &&
        result.dragStripRegion === 'drag');
    // When the opt-in drag simulation ran, require that the window really moved.
    const dragOk =
      process.env.KOVIES_DRAGTEST !== '1' || result.windowMoved === true;
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
      typeof result.apiStatus === 'number' &&
      macDragOk &&
      dragOk;
    finish(pass ? 0 : 1, { pass, ...result, consoleIssues });
  } catch (err) {
    clearTimeout(timer);
    finish(1, { error: err instanceof Error ? err.message : String(err) });
  }
}
