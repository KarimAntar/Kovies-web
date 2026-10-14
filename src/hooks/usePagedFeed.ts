import { useCallback, useRef, useState } from 'react';
import { errorMessage, isAbortError } from '../api/client';
import type { MediaItem } from '../api/types';

/** TMDB-backed endpoints stop serving pages past 500. */
export const MAX_PAGES = 500;

export interface Feed {
  items: MediaItem[];
  page: number;
  totalPages: number;
  loadingMore: boolean;
  /** Message from the last failed load-more request (first-page errors are handled by the caller). */
  error: string | null;
}

export interface PageResult {
  results?: MediaItem[];
  total_pages?: number;
  totalPages?: number;
}

export const EMPTY_FEED: Feed = { items: [], page: 1, totalPages: 1, loadingMore: false, error: null };

export const hasMorePages = (feed: Feed) => feed.page < Math.min(MAX_PAGES, feed.totalPages);

// Type is part of the key: Discover mixes movies and shows, whose TMDB ids can collide.
const itemKey = (m: MediaItem) => `${m.type ?? m.media_type ?? ''}:${m.id || m.tmdbId}`;

function appendUnique(prev: MediaItem[], next: MediaItem[]): MediaItem[] {
  const seen = new Set(prev.map(itemKey));
  const fresh: MediaItem[] = [];
  for (const item of next) {
    const key = itemKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    fresh.push(item);
  }
  return fresh.length > 0 ? [...prev, ...fresh] : prev;
}

/**
 * Paginated grid state: first page via `reset`, further pages via `loadMore`.
 * Any `reset` / `cancelMore` aborts the in-flight load-more request, so a tab,
 * query, provider or type change can never append stale results.
 */
export function usePagedFeed() {
  const [feed, setFeed] = useState<Feed>(EMPTY_FEED);
  const controllerRef = useRef<AbortController | null>(null);

  const abortInFlight = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  /** Replace the feed with page 1 (or empty when called without arguments). */
  const reset = useCallback(
    (first?: { items: MediaItem[]; totalPages: number }) => {
      abortInFlight();
      setFeed(
        first
          ? { items: appendUnique([], first.items), page: 1, totalPages: first.totalPages, loadingMore: false, error: null }
          : EMPTY_FEED
      );
    },
    [abortInFlight]
  );

  /** Abort any in-flight load-more request while keeping the items shown. */
  const cancelMore = useCallback(() => {
    abortInFlight();
    setFeed((f) => (f.loadingMore ? { ...f, loadingMore: false } : f));
  }, [abortInFlight]);

  const loadMore = useCallback(
    async (fetchPage: (page: number, signal: AbortSignal) => Promise<PageResult>) => {
      if (controllerRef.current || feed.loadingMore || !hasMorePages(feed)) return;
      const controller = new AbortController();
      controllerRef.current = controller;
      const nextPage = feed.page + 1;
      setFeed((f) => ({ ...f, loadingMore: true, error: null }));
      try {
        const res = await fetchPage(nextPage, controller.signal);
        if (controller.signal.aborted) return;
        const results = res.results ?? [];
        setFeed((f) => ({
          items: appendUnique(f.items, results),
          page: nextPage,
          // An empty page means the catalogue ran out earlier than total_pages claimed.
          totalPages: results.length > 0 ? res.total_pages ?? res.totalPages ?? f.totalPages : nextPage,
          loadingMore: false,
          error: null,
        }));
      } catch (err) {
        if (controller.signal.aborted || isAbortError(err)) return;
        setFeed((f) => ({ ...f, loadingMore: false, error: errorMessage(err, 'Could not load more titles.') }));
      } finally {
        if (controllerRef.current === controller) controllerRef.current = null;
      }
    },
    [feed]
  );

  return { feed, reset, cancelMore, loadMore };
}
