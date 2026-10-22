// Looks up a stellar.rip stream link on this computer. stellar.rip blocks servers with a
// Cloudflare check, so the API cannot do it; a hidden window here loads the public embed
// page, which passes the check and solves its own puzzle. We only read the playlist link it
// requests. Playback stays in our own player.
import { BrowserWindow, session } from 'electron';
import { log } from './log';

export const STELLAR_ORIGIN = 'https://stellar.rip';
const STREAM_HOST = /^proxy\d*\.jordanblackwell\.bid$/;
const PARTITION = 'persist:stellar-resolver';
const GIVE_UP_AFTER_MISSES = 4;

/** stellar.rip embed page for a TMDB id; only these URLs may be loaded. */
export function embedUrl(mediaType: 'movie' | 'tv', tmdbId: number, season?: number, episode?: number): string {
  return mediaType === 'movie'
    ? `${STELLAR_ORIGIN}/en/watch/embed/movie/${tmdbId}?autoPlay=false`
    : `${STELLAR_ORIGIN}/en/watch/embed/tv/${tmdbId}-${season ?? 1}-${episode ?? 1}?autoPlay=false`;
}

/** Only the master playlist from the stellar.rip stream proxy counts. */
export function isStreamUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && STREAM_HOST.test(u.hostname)
      && u.pathname.startsWith('/playlist/') && u.pathname.endsWith('.m3u8') && !u.pathname.includes('/index-');
  } catch {
    return false;
  }
}

export interface ResolveRequest { mediaType: 'movie' | 'tv'; tmdbId: number; season?: number; episode?: number }

export function validateRequest(raw: unknown): ResolveRequest {
  const r = raw as Partial<ResolveRequest> | null;
  const posInt = (v: unknown, min = 1) => typeof v === 'number' && Number.isInteger(v) && v >= min && v < 1e8;
  if (!r || (r.mediaType !== 'movie' && r.mediaType !== 'tv') || !posInt(r.tmdbId)) throw new Error('invalid request');
  if (r.mediaType === 'tv' && (!posInt(r.season, 0) || !posInt(r.episode))) throw new Error('invalid episode');
  return { mediaType: r.mediaType, tmdbId: r.tmdbId as number, season: r.season, episode: r.episode };
}

const inflight = new Map<string, Promise<string | null>>();

export function resolveStellarLink(req: ResolveRequest, timeoutMs = 30_000): Promise<string | null> {
  const url = embedUrl(req.mediaType, req.tmdbId, req.season, req.episode);
  const existing = inflight.get(url);
  if (existing) return existing;
  const p = runResolve(url, timeoutMs).finally(() => inflight.delete(url));
  inflight.set(url, p);
  return p;
}

function runResolve(url: string, timeoutMs: number): Promise<string | null> {
  return new Promise((resolve) => {
    const ses = session.fromPartition(PARTITION);
    const win = new BrowserWindow({
      show: false,
      width: 1280,
      height: 720,
      webPreferences: { partition: PARTITION, sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
    });
    win.webContents.setAudioMuted(true);
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (e, to) => { if (!to.startsWith(STELLAR_ORIGIN + '/')) e.preventDefault(); });

    let settled = false;
    let misses = 0;
    const t0 = Date.now();
    const finish = (link: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      ses.webRequest.onBeforeRequest(null);
      ses.webRequest.onCompleted(null);
      log.info(`[stellar] ${link ? 'link' : 'no link'} after ${Date.now() - t0}ms for ${url}`);
      if (!win.isDestroyed()) win.destroy();
      resolve(link);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);

    ses.webRequest.onBeforeRequest({ urls: ['https://*/*'] }, (details, cb) => {
      if (isStreamUrl(details.url)) { cb({ cancel: true }); finish(details.url); return; }
      cb({});
    });
    // The page walks its servers; each answer without a link is a miss. After several, the title has no stream.
    ses.webRequest.onCompleted({ urls: [`${STELLAR_ORIGIN}/api/stream-encrypted*`] }, () => {
      setTimeout(() => { if (!settled && ++misses >= GIVE_UP_AFTER_MISSES) finish(null); }, 400);
    });

    win.loadURL(url).catch(() => finish(null));
  });
}
