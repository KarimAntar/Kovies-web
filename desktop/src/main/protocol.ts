// Serves the built SPA from disk via app://kovies/.
import { app, protocol } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { APP_HOST, APP_SCHEME } from '../shared/channels';
import { log } from './log';

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self' app:",
  "script-src 'self' app:",
  "connect-src 'self' app: https://kovies.kerix.tech https: blob:",
  'media-src https: blob:',
  'img-src https://image.tmdb.org app: data: blob:',
  'frame-src https://www.youtube-nocookie.com https://www.youtube.com',
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com app:',
  // hls.js may spawn its transmuxer worker from a blob: URL.
  "worker-src 'self' app: blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

const MIME: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8',
  '.vtt': 'text/vtt; charset=utf-8',
  '.wasm': 'application/wasm',
};

/** Must run before app 'ready'. */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
        codeCache: true,
      },
    },
  ]);
}

/** Directory holding the built web app (index.html + assets). */
export function resolveWebRoot(): string {
  if (app.isPackaged) return path.join(process.resourcesPath, 'web');
  const override = process.env.KOVIES_WEB_DIST;
  if (override) return path.resolve(override);
  // desktop/build/main.js -> ../../dist (Kovies-web/dist)
  return path.resolve(__dirname, '..', '..', 'dist');
}

function respond(status: number, body: string, isHead = false): Response {
  return new Response(isHead ? null : body, {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Security-Policy': CONTENT_SECURITY_POLICY,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

const MACOS_CSS_OVERRIDE = `
<style id="kovies-macos-desktop-layout">
  /* Give macOS traffic light buttons (top-left) dedicated clearance and a
     grabbable strip of at least 38px tall (macOS traffic lights are ~37px). */
  /* Hide custom Windows titlebar and its window control buttons on macOS */
  .desktop-titlebar, [class*="desktop-titlebar"] {
    display: none !important;
  }
  :root {
    --titlebar-h: 0px !important;
  }

  /*
   * Window dragging on macOS. With titleBarStyle:'hidden' the window has no
   * native title bar, so the page must declare its own drag regions.
   *
   * Both top bars opt into the --titlebar-h CSS variable (the navbar header
   * and the player's control bar), so matching on that inline style picks up
   * the real app chrome at the top of the window instead of guessing at
   * framework-generated class names.
   */
  header,
  [style*="titlebar-h"] {
    -webkit-app-region: drag;
    app-region: drag;
  }

  /*
   * Interactive elements inside a drag region must opt out, otherwise they
   * stop receiving clicks (the drag region swallows the pointer events).
   */
  header a,
  header button,
  header input,
  header nav,
  header form,
  header label,
  header [role="button"],
  header [role="slider"],
  header [tabindex],
  [style*="titlebar-h"] a,
  [style*="titlebar-h"] button,
  [style*="titlebar-h"] input,
  [style*="titlebar-h"] nav,
  [style*="titlebar-h"] form,
  [style*="titlebar-h"] label,
  [style*="titlebar-h"] [role="button"],
  [style*="titlebar-h"] [role="slider"],
  [style*="titlebar-h"] [tabindex],
  .desktop-no-drag,
  .desktop-no-drag * {
    -webkit-app-region: no-drag;
    app-region: no-drag;
  }

  /*
   * Dedicated grab strip along the very top edge of the window.
   *
   * The navbar is position:fixed so it is always present, but a modal or the
   * full-screen player (both z-50) covers it, which would leave the window
   * un-grabbable. This strip sits above them and guarantees a continuous
   * handle across the full width.
   *
   * We apply both:
   * 1. html::before for self-test probe inspection and baseline drag area
   * 2. .kovies-drag-strip real DOM element for reliable Chromium pointer-event
   *    drag hit-testing.
   */
  html::before {
    content: "";
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 14px;
    z-index: 10000;
    -webkit-app-region: drag;
    app-region: drag;
    pointer-events: auto;
  }

  .kovies-drag-strip {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 18px;
    z-index: 10000;
    -webkit-app-region: drag;
    app-region: drag;
  }
</style>
`;

/**
 * Real DOM node for the macOS drag strip. Injected immediately after <body>
 * so it is present on first paint. A markup injection, not a script, so the
 * strict CSP on app:// pages still holds.
 */
const MACOS_DRAG_STRIP = `<div class="kovies-drag-strip" aria-hidden="true"></div>`;

async function serveFile(filePath: string, isHead = false): Promise<Response> {
  const ext = path.extname(filePath).toLowerCase();
  const isHtml = ext === '.html';
  const headers: Record<string, string> = {
    'Content-Type': MIME[ext] ?? 'application/octet-stream',
    'Content-Security-Policy': CONTENT_SECURITY_POLICY,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': isHtml ? 'no-cache' : 'public, max-age=31536000, immutable',
  };

  let contentBytes: Uint8Array;
  if (isHtml) {
    let html = await fs.readFile(filePath, 'utf8');
    if (process.platform === 'darwin') {
      html = html.replace('</head>', `${MACOS_CSS_OVERRIDE}</head>`);
      // Real element for the drag strip, right after <body> so it paints first.
      html = html.replace(/<body([^>]*)>/i, `<body$1>${MACOS_DRAG_STRIP}`);
    }
    contentBytes = new TextEncoder().encode(html);
  } else {
    const data = await fs.readFile(filePath);
    contentBytes = new Uint8Array(data);
  }

  headers['Content-Length'] = String(contentBytes.byteLength);

  if (isHead) {
    return new Response(null, { status: 200, headers });
  }

  return new Response(contentBytes as unknown as BodyInit, {
    status: 200,
    headers,
  });
}

/**
 * Maps a request pathname to an absolute path under webRoot, or null if the
 * path escapes the root (traversal), points through a symlink outside the root,
 * uses Windows ADS, or is otherwise malformed.
 */
let cachedRealWebRoot: string | null = null;

export async function safeJoin(webRoot: string, pathname: string): Promise<string | null> {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  // Block NUL bytes, Windows Alternate Data Streams (foo.txt:bar), and backslashes
  if (decoded.includes('\0') || decoded.includes(':') || decoded.includes('\\')) return null;

  // Reject explicit directory traversal attempts
  const segments = decoded.split('/');
  if (segments.some((seg) => seg === '..')) return null;

  let rootReal: string;
  try {
    if (!cachedRealWebRoot) {
      cachedRealWebRoot = await fs.realpath(path.resolve(webRoot));
    }
    rootReal = cachedRealWebRoot;
  } catch {
    return null;
  }

  const normalized = path.posix.normalize('/' + decoded);
  const target = path.resolve(rootReal, '.' + normalized);
  if (target !== rootReal && !target.startsWith(rootReal + path.sep)) return null;

  // Resolve symlinks to prevent escaping the root
  try {
    const targetReal = await fs.realpath(target);
    if (targetReal !== rootReal && !targetReal.startsWith(rootReal + path.sep)) return null;
    return targetReal;
  } catch (err: unknown) {
    // If file doesn't exist, ENOENT is expected (e.g. SPA route); return normalized target
    if (typeof err === 'object' && err !== null && (err as { code?: string }).code === 'ENOENT') {
      return target;
    }
    return null;
  }
}

async function isRegularFile(p: string): Promise<boolean> {
  try {
    return (await fs.stat(p)).isFile();
  } catch {
    return false;
  }
}

export function registerAppProtocolHandler(webRoot: string): void {
  const indexHtml = path.join(webRoot, 'index.html');

  protocol.handle(APP_SCHEME, async (request) => {
    try {
      const isHead = request.method === 'HEAD';
      if (request.method !== 'GET' && !isHead) return respond(405, 'Method Not Allowed', isHead);
      const url = new URL(request.url);
      if (url.host !== APP_HOST) return respond(404, 'Not Found', isHead);

      const target = await safeJoin(webRoot, url.pathname);
      if (!target) return respond(403, 'Forbidden', isHead);

      if (await isRegularFile(target)) return await serveFile(target, isHead);

      // Only treat path as a missing static file if its extension is a known static asset type
      const ext = path.extname(url.pathname).toLowerCase();
      if (ext in MIME && ext !== '.html') return respond(404, 'Not Found', isHead);

      // Everything else (extensionless paths or unknown dot-routes like /title/mr.robot)
      // is client-side SPA routing and gets index.html
      return await serveFile(indexHtml, isHead);
    } catch (err) {
      log.error('app:// handler failed', err instanceof Error ? err.message : err);
      return respond(500, 'Internal Error');
    }
  });
}
