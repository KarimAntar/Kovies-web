/**
 * TheIntroDB client (theintrodb.org / introdb.app).
 *
 * Provides exact timestamps for skipping:
 * - Intros / Title sequences
 * - Recaps ("Previously on...")
 * - Credits / Outros
 * - Previews
 *
 * Free API: https://api.theintrodb.org/v3
 */

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
  start_ms: number;
  end_ms: number | null;
}

interface TheIntroDbResponse {
  tmdb_id?: number;
  type?: string;
  season?: number;
  episode?: number;
  intro?: RawSegment[];
  recap?: RawSegment[];
  credits?: RawSegment[];
  preview?: RawSegment[];
}

const memoryCache = new Map<string, SkipSegments | null>();

/**
 * Fetch skip segments for an episode or movie from TheIntroDB.
 * Returns null if no segments are found or request fails.
 */
export async function fetchSkipSegments(
  tmdbId: number,
  mediaType: 'movie' | 'tv',
  season?: number,
  episode?: number,
  signal?: AbortSignal
): Promise<SkipSegments | null> {
  if (!tmdbId || tmdbId <= 0) return null;

  const cacheKey = `${mediaType}:${tmdbId}:${season ?? ''}:${episode ?? ''}`;
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey) ?? null;
  }

  try {
    const params = new URLSearchParams({
      tmdb_id: String(tmdbId),
    });

    if (mediaType === 'tv') {
      params.set('season', String(season ?? 1));
      params.set('episode', String(episode ?? 1));
    }

    const url = `https://api.theintrodb.org/v3/media?${params.toString()}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal,
    });

    if (!res.ok) {
      memoryCache.set(cacheKey, null);
      return null;
    }

    const data: TheIntroDbResponse = await res.json();
    const segments: SkipSegments = {};

    const toSegment = (arr?: RawSegment[]): SegmentTime | undefined => {
      if (!arr || arr.length === 0) return undefined;
      const first = arr[0];
      if (typeof first.start_ms !== 'number') return undefined;
      const startSec = first.start_ms / 1000;
      const endSec = typeof first.end_ms === 'number' ? first.end_ms / 1000 : Infinity;
      return { startSec, endSec };
    };

    if (data.intro) segments.intro = toSegment(data.intro);
    if (data.recap) segments.recap = toSegment(data.recap);
    if (data.credits) segments.credits = toSegment(data.credits);
    if (data.preview) segments.preview = toSegment(data.preview);

    const hasAny = Boolean(segments.intro || segments.recap || segments.credits || segments.preview);
    const result = hasAny ? segments : null;
    memoryCache.set(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}
