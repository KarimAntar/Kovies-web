/**
 * Shared stream-source lookups.
 *
 * The details modal prefetches sources so Play can start immediately; the
 * player calls the same function and either reuses the finished result or
 * keeps waiting on the in-flight request. Entries expire quickly because
 * stream URLs are short-lived, and failures are never cached.
 */
import { api } from '../api/client';
import type { SourcesResponse, StreamingSource } from '../api/types';

const TTL_MS = 5 * 60_000;

const cache = new Map<string, { at: number; promise: Promise<SourcesResponse> }>();

const keyFor = (tmdbId: number, type: 'movie' | 'tv', season?: number, episode?: number) =>
  type === 'tv' ? `tv:${tmdbId}:${season ?? 1}:${episode ?? 1}` : `movie:${tmdbId}`;

/** Vertical resolution from labels like "1080p", "4K", "720"; 0 when unknown. */
export function qualityRank(quality?: string | null): number {
  const q = (quality ?? '').toLowerCase();
  if (q.includes('4k') || q.includes('uhd')) return 2160;
  const match = q.match(/(\d{3,4})/);
  return match ? Number(match[1]) : 0;
}

/** Highest quality first; equal ranks keep the backend's order. */
export function rankSources(list: StreamingSource[]): StreamingSource[] {
  return list
    .map((source, index) => ({ source, index, rank: qualityRank(source.quality) }))
    .sort((a, b) => b.rank - a.rank || a.index - b.index)
    .map((entry) => entry.source);
}

export function loadSources(
  tmdbId: number,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number
): Promise<SourcesResponse> {
  const key = keyFor(tmdbId, type, season, episode);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise;

  const request = type === 'tv'
    ? api.getTVEpisodeSources(tmdbId, season ?? 1, episode ?? 1)
    : api.getMovieSources(tmdbId);
  const promise = request.then((res) => ({
    ...res,
    sources: rankSources(Array.isArray(res?.sources) ? res.sources : []),
  }));
  cache.set(key, { at: Date.now(), promise });
  promise.catch(() => {
    if (cache.get(key)?.promise === promise) cache.delete(key);
  });
  return promise;
}

/** Background lookup; errors surface later when the player asks again. */
export function prefetchSources(tmdbId: number, type: 'movie' | 'tv', season?: number, episode?: number): void {
  loadSources(tmdbId, type, season, episode).catch(() => undefined);
}

export function invalidateSources(tmdbId: number, type: 'movie' | 'tv', season?: number, episode?: number): void {
  cache.delete(keyFor(tmdbId, type, season, episode));
}

export function clearSourceCache(): void {
  cache.clear();
}
