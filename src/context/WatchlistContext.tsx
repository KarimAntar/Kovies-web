import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type {
  MediaItem,
  MediaType,
  RecordProgressPayload,
  WatchHistoryItem,
  WatchlistItem,
} from '../api/types';
import { api, errorMessage, isAbortError } from '../api/client';
import { useAuth } from './AuthContext';

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface WatchlistContextType {
  watchlist: WatchlistItem[];
  watchlistStatus: LoadStatus;
  watchlistError: string | null;
  continueWatching: WatchHistoryItem[];
  historyStatus: LoadStatus;
  historyError: string | null;
  inWatchlist: (tmdbId: number, mediaType: MediaType) => boolean;
  /** Opens the sign-in dialog when signed out. */
  toggleWatchlist: (item: MediaItem) => Promise<void>;
  /** position/duration in milliseconds. */
  recordProgress: (payload: RecordProgressPayload, options?: { keepalive?: boolean }) => Promise<void>;
  findProgress: (tmdbId: number, mediaType: MediaType, season?: number, episode?: number) => WatchHistoryItem | undefined;
  latestProgressFor: (tmdbId: number, mediaType: MediaType) => WatchHistoryItem | undefined;
  refreshWatchlist: () => Promise<void>;
  refreshHistory: () => Promise<void>;
}

const WatchlistContext = createContext<WatchlistContextType | undefined>(undefined);

function mediaKey(item: MediaItem): { tmdbId: number; mediaType: MediaType } {
  return {
    tmdbId: item.tmdbId || item.id,
    mediaType: (item.type || item.media_type || 'movie') as MediaType,
  };
}

function sameEpisode(h: WatchHistoryItem, season?: number | null, episode?: number | null): boolean {
  return (h.seasonNumber ?? null) === (season ?? null) && (h.episodeNumber ?? null) === (episode ?? null);
}

export const WatchlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, token, openAuthModal } = useAuth();

  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [watchlistStatus, setWatchlistStatus] = useState<LoadStatus>('idle');
  const [watchlistError, setWatchlistError] = useState<string | null>(null);
  const [continueWatching, setContinueWatching] = useState<WatchHistoryItem[]>([]);
  const [historyStatus, setHistoryStatus] = useState<LoadStatus>('idle');
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Requests started under an old token must not write into a new session.
  const sessionRef = useRef(token);
  useEffect(() => {
    sessionRef.current = token;
  }, [token]);

  const refreshWatchlist = useCallback(async () => {
    if (!token) return;
    const session = token;
    setWatchlistStatus('loading');
    setWatchlistError(null);
    try {
      const res = await api.getWatchlist('all');
      if (sessionRef.current !== session) return;
      setWatchlist(Array.isArray(res?.items) ? res.items : []);
      setWatchlistStatus('ready');
    } catch (err) {
      if (sessionRef.current !== session || isAbortError(err)) return;
      setWatchlistError(errorMessage(err, 'Could not load your list'));
      setWatchlistStatus('error');
    }
  }, [token]);

  const refreshHistory = useCallback(async () => {
    if (!token) return;
    const session = token;
    setHistoryStatus((s) => (s === 'ready' ? s : 'loading'));
    setHistoryError(null);
    try {
      const res = await api.getContinueWatching();
      if (sessionRef.current !== session) return;
      const items = Array.isArray(res?.items) ? res.items : [];
      setContinueWatching(items.filter((i) => !i.completed));
      setHistoryStatus('ready');
    } catch (err) {
      if (sessionRef.current !== session || isAbortError(err)) return;
      setHistoryError(errorMessage(err, 'Could not load Continue Watching'));
      setHistoryStatus('error');
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setWatchlist([]);
      setContinueWatching([]);
      setWatchlistStatus('idle');
      setHistoryStatus('idle');
      setWatchlistError(null);
      setHistoryError(null);
      return;
    }
    void refreshWatchlist();
    void refreshHistory();
  }, [token, refreshWatchlist, refreshHistory]);

  const inWatchlist = useCallback(
    (tmdbId: number, mediaType: MediaType) =>
      watchlist.some((i) => i.tmdbId === tmdbId && i.mediaType === mediaType),
    [watchlist]
  );

  const toggleWatchlist = useCallback(
    async (item: MediaItem) => {
      if (!isAuthenticated) {
        openAuthModal();
        return;
      }
      const { tmdbId, mediaType } = mediaKey(item);
      const exists = watchlist.some((i) => i.tmdbId === tmdbId && i.mediaType === mediaType);
      const previous = watchlist;

      if (exists) {
        setWatchlist((list) => list.filter((i) => !(i.tmdbId === tmdbId && i.mediaType === mediaType)));
        try {
          await api.removeFromWatchlist(mediaType, tmdbId);
        } catch (err) {
          setWatchlist(previous);
          setWatchlistError(errorMessage(err, 'Could not update your list'));
        }
        return;
      }

      const payload = {
        tmdbId,
        mediaType,
        title: item.title || item.name || 'Untitled',
        posterPath: item.poster_path || item.poster || null,
        backdropPath: item.backdrop_path || item.backdrop || null,
        voteAverage: item.vote_average ?? item.rating ?? null,
        releaseDate: item.releaseDate || item.firstAirDate || null,
      };
      const optimistic: WatchlistItem = { ...payload, addedAt: new Date().toISOString() };
      setWatchlist((list) => [optimistic, ...list]);
      try {
        const res = await api.addToWatchlist(payload);
        if (res?.item) {
          setWatchlist((list) =>
            list.map((i) => (i.tmdbId === tmdbId && i.mediaType === mediaType ? res.item : i))
          );
        }
      } catch (err) {
        setWatchlist(previous);
        setWatchlistError(errorMessage(err, 'Could not update your list'));
      }
    },
    [isAuthenticated, openAuthModal, watchlist]
  );

  const recordProgress = useCallback(
    async (payload: RecordProgressPayload, options: { keepalive?: boolean } = {}) => {
      if (!sessionRef.current) return;
      try {
        const res = await api.recordProgress(payload, options);
        const item = res?.item;
        if (!item) return;
        setContinueWatching((prev) => {
          const rest = prev.filter(
            (p) =>
              !(p.tmdbId === item.tmdbId && p.mediaType === item.mediaType && sameEpisode(p, item.seasonNumber, item.episodeNumber))
          );
          return item.completed ? rest : [item, ...rest].slice(0, 20);
        });
      } catch {
        // Progress sync is best-effort; the next report retries.
      }
    },
    []
  );

  const findProgress = useCallback(
    (tmdbId: number, mediaType: MediaType, season?: number, episode?: number) =>
      continueWatching.find(
        (h) => h.tmdbId === tmdbId && h.mediaType === mediaType && sameEpisode(h, season, episode) && !h.completed
      ),
    [continueWatching]
  );

  const latestProgressFor = useCallback(
    (tmdbId: number, mediaType: MediaType) =>
      continueWatching
        .filter((h) => h.tmdbId === tmdbId && h.mediaType === mediaType && !h.completed)
        .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))[0],
    [continueWatching]
  );

  const value = useMemo<WatchlistContextType>(
    () => ({
      watchlist,
      watchlistStatus,
      watchlistError,
      continueWatching,
      historyStatus,
      historyError,
      inWatchlist,
      toggleWatchlist,
      recordProgress,
      findProgress,
      latestProgressFor,
      refreshWatchlist,
      refreshHistory,
    }),
    [
      watchlist,
      watchlistStatus,
      watchlistError,
      continueWatching,
      historyStatus,
      historyError,
      inWatchlist,
      toggleWatchlist,
      recordProgress,
      findProgress,
      latestProgressFor,
      refreshWatchlist,
      refreshHistory,
    ]
  );

  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>;
};

export function useWatchlist(): WatchlistContextType {
  const context = useContext(WatchlistContext);
  if (!context) {
    throw new Error('useWatchlist must be used within a WatchlistProvider');
  }
  return context;
}
