import type { StreamingSource } from '../api/types';

export const BROWSER_UNSUPPORTED_MESSAGE =
  "This source can't play in the browser yet — try the Windows or TV app";

export type PlaybackPlan =
  | { ok: true; url: string; registerHeaders: Record<string, string> | null; kind: 'hls' | 'mp4' }
  | { ok: false; message: string };

function nonEmptyHeaders(source: StreamingSource): Record<string, string> | null {
  const headers = source.headers;
  if (!headers) return null;
  const entries = Object.entries(headers).filter(
    ([k, v]) => typeof k === 'string' && k.length > 0 && typeof v === 'string' && v.length > 0
  );
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function streamKind(source: StreamingSource, url: string): 'hls' | 'mp4' {
  const type = (source.type || '').toLowerCase();
  if (type === 'mp4') return 'mp4';
  if (type === 'hls') return 'hls';
  const path = url.split('?')[0].toLowerCase();
  return path.endsWith('.mp4') || path.endsWith('.webm') ? 'mp4' : 'hls';
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

function isHttpsUrl(value: unknown): value is string {
  return isHttpUrl(value) && new URL(value).protocol === 'https:';
}

/**
 * Decide which URL to hand to the player.
 * - Desktop: the backend relay URL when offered (it reads segments ahead, hiding slow
 *   uncached provider segments); otherwise the original URL with headers registered.
 * - Web, source needs headers: the backend relay URL (absolute, signed); error if missing.
 * - Web, no headers: the original URL.
 */
export function planPlayback(source: StreamingSource, onDesktop: boolean): PlaybackPlan {
  const headers = nonEmptyHeaders(source);

  if (onDesktop) {
    if (isHttpsUrl(source.relayUrl)) {
      return { ok: true, url: source.relayUrl, registerHeaders: null, kind: streamKind(source, source.url) };
    }
    if (!isHttpUrl(source.url)) return { ok: false, message: 'This source has an invalid stream URL.' };
    return { ok: true, url: source.url, registerHeaders: headers, kind: streamKind(source, source.url) };
  }

  if (headers) {
    if (!isHttpUrl(source.relayUrl)) return { ok: false, message: BROWSER_UNSUPPORTED_MESSAGE };
    return { ok: true, url: source.relayUrl, registerHeaders: null, kind: streamKind(source, source.url) };
  }

  if (!isHttpUrl(source.url)) return { ok: false, message: 'This source has an invalid stream URL.' };
  return { ok: true, url: source.url, registerHeaders: null, kind: streamKind(source, source.url) };
}

/** True when the source can be attempted on this platform. */
export function isPlayableHere(source: StreamingSource, onDesktop: boolean): boolean {
  return planPlayback(source, onDesktop).ok;
}
