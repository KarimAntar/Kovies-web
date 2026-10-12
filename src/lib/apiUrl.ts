const BACKEND_API_ORIGIN_PREFIX = 'https://kovies.kerix.tech/api/';

/**
 * Map a backend-relative URL (e.g. '/api/subtitles/subdl/<token>') onto the
 * active API base ('/api/k' on web, the desktop apiBase on Windows).
 * Absolute URLs pointing at the Kovies backend are mapped as well so the web
 * build never calls the backend directly (it would lack the API key).
 * Returns null for values that are not safe to fetch.
 */
export function mapApiUrl(url: string, apiBase: string): string | null {
  if (typeof url !== 'string' || url.length === 0) return null;
  const base = apiBase.replace(/\/+$/, '');

  if (url.startsWith('/api/')) return `${base}/${url.slice('/api/'.length)}`;
  if (url.startsWith(BACKEND_API_ORIGIN_PREFIX)) {
    return `${base}/${url.slice(BACKEND_API_ORIGIN_PREFIX.length)}`;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return parsed.toString();
  } catch {
    // fall through
  }
  return null;
}
