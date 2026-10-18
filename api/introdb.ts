import type { VercelRequest, VercelResponse } from '@vercel/node';

// Same-origin proxy for introdb.app skip segments: its CORS policy only allows
// https://introdb.app, so browsers cannot call it directly. GET only, strict
// parameter allowlist, no credentials forwarded.
const UPSTREAM = 'https://api.introdb.app/segments';
const TIMEOUT_MS = 8000;

const IMDB_ID = /^tt\d{1,10}$/;
const SMALL_INT = /^\d{1,4}$/;

export function buildUpstreamUrl(query: Record<string, unknown>): string | null {
  const first = (v: unknown) => (Array.isArray(v) ? v[0] : v);
  const imdbId = String(first(query.imdb_id) ?? '');
  if (!IMDB_ID.test(imdbId)) return null;

  const params = new URLSearchParams({ imdb_id: imdbId });
  if (String(first(query.is_movie) ?? '') === 'true') {
    params.set('is_movie', 'true');
  } else {
    const season = String(first(query.season) ?? '');
    const episode = String(first(query.episode) ?? '');
    if (!SMALL_INT.test(season) || !SMALL_INT.test(episode)) return null;
    params.set('season', season);
    params.set('episode', episode);
  }
  return `${UPSTREAM}?${params}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).setHeader('Allow', 'GET').json({ error: 'Method not allowed' });
    return;
  }
  const url = buildUpstreamUrl(req.query);
  if (!url) {
    res.status(400).json({ error: 'Invalid parameters' });
    return;
  }

  try {
    const upstream = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'Kovies/1.0' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await upstream.text();
    // Segment data rarely changes; cache hits at the edge, misses briefly, never rate-limit responses.
    const cache = upstream.ok
      ? 'public, s-maxage=86400, stale-while-revalidate=604800'
      : upstream.status === 404
        ? 'public, s-maxage=3600'
        : 'no-store';
    res.status(upstream.status).setHeader('Content-Type', 'application/json').setHeader('Cache-Control', cache).send(body);
  } catch {
    res.status(502).setHeader('Cache-Control', 'no-store').json({ error: 'Upstream unavailable' });
  }
}
