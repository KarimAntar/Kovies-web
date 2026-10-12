import type {
  HomeCatalogResponse,
  MediaDetails,
  MediaType,
  SourcesResponse,
  SubtitlesResponse,
  SearchResponse,
  AuthResponse,
  UserProfile,
  WatchlistItem,
  WatchHistoryItem,
  EpisodeInfo,
  PagedResponse,
  RecordProgressPayload,
  WatchlistPayload,
} from './types';
import { API_BASE } from '../platform';
import { mapApiUrl } from '../lib/apiUrl';

/**
 * Backend client. Every call goes through API_BASE:
 *  - web:     '/api/k/<path>' -> Vercel gateway, which adds the API key server-side
 *  - desktop: '<apiBase>/<path>' -> desktop main process injects the API key
 * No API key exists in this bundle.
 */

export const AUTH_TOKEN_KEY = 'kovies_auth_token';

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

/**
 * Robustly formats any error value (Error, ApiError, string, JSON error object,
 * or unknown shape) into a human-readable string. Never returns "[object Object]".
 */
export function errorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (typeof err === 'string' && err.trim().length > 0 && err !== '[object Object]') {
    return err;
  }
  if (err instanceof ApiError) {
    if (err.status === 0) return 'Network error — check your connection and try again.';
    if (err.message && err.message !== '[object Object]') return err.message;
    if (err.code) return `Error: ${err.code}`;
    return fallback;
  }
  if (err instanceof Error && err.message && err.message !== '[object Object]') {
    return err.message;
  }
  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === 'string' && obj.message && obj.message !== '[object Object]') {
      return obj.message;
    }
    if (typeof obj.error === 'string' && obj.error && obj.error !== '[object Object]') {
      return obj.error;
    }
    if (typeof obj.code === 'string' && obj.code) {
      return `Error: ${obj.code}`;
    }
  }
  return fallback;
}

export function readAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function writeAuthToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
    else localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // Storage unavailable (private mode / blocked) — session lives in memory only.
  }
}

// 401 from user/* or auth/me means the JWT is no longer valid.
type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

function isSessionScoped(path: string): boolean {
  return path.startsWith('user/') || path === 'auth/me';
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  keepalive?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = readAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
      keepalive: options.keepalive,
      credentials: 'omit',
    });
  } catch (err) {
    if (isAbortError(err)) throw err;
    throw new ApiError(0, 'Network error');
  }

  if (!response.ok) {
    let message = response.statusText || `Request failed (${response.status})`;
    let code: string | undefined;
    try {
      const data = (await response.json()) as Record<string, unknown>;
      if (typeof data.message === 'string' && data.message) message = data.message;
      else if (typeof data.error === 'string' && data.error) message = data.error;
      if (typeof data.code === 'string') code = data.code;
    } catch {
      // non-JSON error body
    }
    if (response.status === 401 && isSessionScoped(path)) {
      unauthorizedListeners.forEach((l) => l());
    }
    throw new ApiError(response.status, message, code);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function qs(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') query.set(k, String(v));
  }
  const s = query.toString();
  return s ? `?${s}` : '';
}

const id = (n: number) => encodeURIComponent(String(Math.trunc(n)));

export const api = {
  getHome(signal?: AbortSignal): Promise<HomeCatalogResponse> {
    return request('home', { signal });
  },

  getPopular(type: MediaType, page = 1, signal?: AbortSignal): Promise<PagedResponse> {
    return request(`catalog/${type}/popular${qs({ page })}`, { signal });
  },

  getMovieDetails(tmdbId: number, signal?: AbortSignal): Promise<MediaDetails> {
    return request(`movies/${id(tmdbId)}`, { signal });
  },

  getTVDetails(tmdbId: number, signal?: AbortSignal): Promise<MediaDetails> {
    return request(`tv/${id(tmdbId)}`, { signal });
  },

  getTVSeason(
    tmdbId: number,
    seasonNumber: number,
    signal?: AbortSignal
  ): Promise<{ episodes: EpisodeInfo[]; seasonNumber: number }> {
    return request(`tv/${id(tmdbId)}/season/${id(seasonNumber)}`, { signal });
  },

  search(query: string, page = 1, signal?: AbortSignal): Promise<SearchResponse> {
    return request(`search${qs({ q: query, page })}`, { signal });
  },

  getMovieSources(tmdbId: number, signal?: AbortSignal): Promise<SourcesResponse> {
    return request(`sources/movie/${id(tmdbId)}`, { signal });
  },

  getTVEpisodeSources(
    tmdbId: number,
    season: number,
    episode: number,
    signal?: AbortSignal
  ): Promise<SourcesResponse> {
    return request(`sources/tv/${id(tmdbId)}/${id(season)}/${id(episode)}`, { signal });
  },

  getSubtitles(
    type: MediaType,
    tmdbId: number,
    season?: number,
    episode?: number,
    signal?: AbortSignal
  ): Promise<SubtitlesResponse> {
    return request(`subtitles/${type}/${id(tmdbId)}${qs({ season, episode })}`, { signal });
  },

  /** Fetch a subtitle file. '/api/...' URLs are mapped onto API_BASE. */
  async fetchSubtitleContent(url: string, signal?: AbortSignal): Promise<string> {
    const mapped = mapApiUrl(url, API_BASE);
    if (!mapped) throw new ApiError(400, 'Invalid subtitle URL');
    const sameBackend = mapped.startsWith(`${API_BASE}/`);
    const headers: Record<string, string> = {};
    const token = sameBackend ? readAuthToken() : null;
    if (token) headers.Authorization = `Bearer ${token}`;
    let res: Response;
    try {
      res = await fetch(mapped, { headers, signal, credentials: 'omit' });
    } catch (err) {
      if (isAbortError(err)) throw err;
      throw new ApiError(0, 'Network error');
    }
    if (!res.ok) throw new ApiError(res.status, `Failed to load subtitle file (${res.status})`);
    return res.text();
  },

  // ---------------------------------------------------------------------------
  // Auth & user data
  // ---------------------------------------------------------------------------

  login(payload: { email: string; password: string }): Promise<AuthResponse> {
    return request('auth/login', { method: 'POST', body: payload });
  },

  register(payload: { email: string; password: string; displayName: string }): Promise<AuthResponse> {
    return request('auth/register', { method: 'POST', body: payload });
  },

  me(signal?: AbortSignal): Promise<{ user: UserProfile }> {
    return request('auth/me', { signal });
  },

  getWatchlist(type: 'all' | 'movie' | 'tv' = 'all', signal?: AbortSignal): Promise<{ items: WatchlistItem[] }> {
    return request(`user/watchlist${qs({ type })}`, { signal });
  },

  addToWatchlist(item: WatchlistPayload): Promise<{ success: boolean; item: WatchlistItem }> {
    return request('user/watchlist', { method: 'POST', body: item });
  },

  removeFromWatchlist(mediaType: MediaType, tmdbId: number): Promise<{ success: boolean }> {
    return request(`user/watchlist/${mediaType}/${id(tmdbId)}`, { method: 'DELETE' });
  },

  getContinueWatching(signal?: AbortSignal): Promise<{ items: WatchHistoryItem[] }> {
    return request('user/history/continue-watching', { signal });
  },

  deleteHistory(
    mediaType: MediaType,
    tmdbId: number,
    seasonNumber?: number,
    episodeNumber?: number
  ): Promise<{ success: boolean }> {
    return request(`user/history/${mediaType}/${id(tmdbId)}${qs({ seasonNumber, episodeNumber })}`, {
      method: 'DELETE',
    });
  },

  /** position/duration in milliseconds. Use keepalive for unload-time reports. */
  recordProgress(
    payload: RecordProgressPayload,
    options: { keepalive?: boolean } = {}
  ): Promise<{ success: boolean; item: WatchHistoryItem }> {
    return request('user/history', { method: 'POST', body: payload, keepalive: options.keepalive });
  },
};
