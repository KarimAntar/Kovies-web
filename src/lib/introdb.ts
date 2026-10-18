/**
 * Skip-segment lookup from two community databases:
 * - TheIntroDB (api.theintrodb.org/v3, keyed by TMDB id)
 * - introdb.app (api.introdb.app, keyed by IMDb id)
 *
 * Both are queried in parallel. For each segment kind TheIntroDB wins when it
 * has data; introdb.app fills the gaps. A failed or rate-limited source counts
 * as "no data".
 */

import { isDesktop } from '../platform';

export interface SegmentTime {
  startSec: number;
  endSec: number;
}

export interface SkipSegments {
  intro?: SegmentTime;
  recap?: SegmentTime;
  credits?: SegmentTime;
  preview?: SegmentTime;
}

interface RawSegment {
  start_ms: number | null;
  end_ms: number | null;
}

interface TheIntroDbResponse {
  intro?: RawSegment[];
  recap?: RawSegment[];
  credits?: RawSegment[];
  preview?: RawSegment[];
}

interface IntroDbAppResponse {
  intro?: RawSegment | null;
  recap?: RawSegment | null;
  outro?: RawSegment | null;
}

const memoryCache = new Map<string, SkipSegments | null>();

// introdb.app only allows its own site via CORS: browsers use the same-origin
// Vercel proxy (api/introdb.ts); the desktop main process allows app://kovies.
const INTRODB_APP_URL = isDesktop ? 'https://api.introdb.app/segments' : '/api/introdb';

/** A null start means "from the beginning"; a null end means "until the end". */
const toSegment = (raw?: RawSegment | null): SegmentTime | undefined => {
  if (!raw) return undefined;
  const hasStart = typeof raw.start_ms === 'number';
  const hasEnd = typeof raw.end_ms === 'number';
  if (!hasStart && !hasEnd) return undefined;
  return {
    startSec: hasStart ? Math.max(0, raw.start_ms as number) / 1000 : 0,
    endSec: hasEnd ? (raw.end_ms as number) / 1000 : Infinity,
  };
};

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  try {
    const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' }, signal });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

async function fetchTheIntroDb(
  tmdbId: number,
  mediaType: 'movie' | 'tv',
  season?: number,
  episode?: number,
  signal?: AbortSignal
): Promise<SkipSegments> {
  const params = new URLSearchParams({ tmdb_id: String(tmdbId) });
  if (mediaType === 'tv') {
    params.set('season', String(season ?? 1));
    params.set('episode', String(episode ?? 1));
  }
  const data = await getJson<TheIntroDbResponse>(`https://api.theintrodb.org/v3/media?${params}`, signal);
  if (!data) return {};
  return {
    intro: toSegment(data.intro?.[0]),
    recap: toSegment(data.recap?.[0]),
    credits: toSegment(data.credits?.[0]),
    preview: toSegment(data.preview?.[0]),
  };
}

async function fetchIntroDbApp(
  imdbId: string,
  mediaType: 'movie' | 'tv',
  season?: number,
  episode?: number,
  signal?: AbortSignal
): Promise<SkipSegments> {
  const params = new URLSearchParams({ imdb_id: imdbId });
  if (mediaType === 'tv') {
    params.set('season', String(season ?? 1));
    params.set('episode', String(episode ?? 1));
  } else {
    params.set('is_movie', 'true');
  }
  const data = await getJson<IntroDbAppResponse>(`${INTRODB_APP_URL}?${params}`, signal);
  if (!data) return {};
  return { intro: toSegment(data.intro), recap: toSegment(data.recap), credits: toSegment(data.outro) };
}

/**
 * Fetch skip segments for an episode or movie.
 * Returns null when neither source has any segment.
 */
export async function fetchSkipSegments(
  tmdbId: number,
  mediaType: 'movie' | 'tv',
  season?: number,
  episode?: number,
  signal?: AbortSignal,
  imdbId?: string | null
): Promise<SkipSegments | null> {
  if (!tmdbId || tmdbId <= 0) return null;
  const imdb = imdbId && /^tt\d+$/.test(imdbId) ? imdbId : undefined;

  const cacheKey = `${mediaType}:${tmdbId}:${imdb ?? ''}:${season ?? ''}:${episode ?? ''}`;
  if (memoryCache.has(cacheKey)) return memoryCache.get(cacheKey) ?? null;

  const [primary, secondary] = await Promise.all([
    fetchTheIntroDb(tmdbId, mediaType, season, episode, signal),
    imdb ? fetchIntroDbApp(imdb, mediaType, season, episode, signal) : Promise.resolve<SkipSegments>({}),
  ]);
  if (signal?.aborted) return null;

  const merged: SkipSegments = {};
  for (const kind of ['intro', 'recap', 'credits', 'preview'] as const) {
    const segment = primary[kind] ?? secondary[kind];
    if (segment) merged[kind] = segment;
  }

  const result = Object.keys(merged).length > 0 ? merged : null;
  memoryCache.set(cacheKey, result);
  return result;
}
