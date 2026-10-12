export type MediaType = 'movie' | 'tv';

export interface Genre {
  id: number;
  name: string;
}

export interface MediaItem {
  id: number;
  tmdbId: number;
  type: MediaType;
  media_type?: MediaType;
  title: string;
  name?: string;
  originalTitle?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  poster: string | null;
  backdrop: string | null;
  year?: string;
  releaseDate?: string;
  firstAirDate?: string;
  rating?: number;
  vote_average?: number;
  voteCount?: number;
  popularity?: number;
  genres?: Genre[];
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile: string | null;
  order?: number;
}

export interface VideoItem {
  id: string;
  name: string;
  key: string;
  site: string;
  type: string;
  official: boolean;
  publishedAt?: string;
  url?: string;
}

export interface SeasonInfo {
  seasonNumber: number;
  season_number?: number;
  name: string;
  episodeCount?: number;
  overview?: string;
  poster?: string | null;
}

export interface EpisodeInfo {
  id?: number;
  episodeNumber: number;
  episode_number?: number;
  name: string;
  title?: string;
  overview?: string;
  still: string | null;
  still_path?: string | null;
  airDate?: string;
  runtime?: number;
  rating?: number;
}

export interface MediaDetails extends MediaItem {
  tagline?: string;
  runtime?: number;
  status?: string;
  imdbId?: string;
  imdbRating?: number | null;
  rottenTomatoesRating?: string | null;
  numberOfSeasons?: number;
  numberOfEpisodes?: number;
  seasons?: SeasonInfo[];
  cast?: CastMember[];
  videos?: VideoItem[];
  recommendations?: MediaItem[];
  similar?: MediaItem[];
}

export interface SubtitleTrack {
  language: string;
  label: string;
  url: string;
  format: 'srt' | 'vtt' | 'ass' | string;
  provider?: string;
  server?: string;
  isDefault?: boolean;
  release?: string;
  fps?: number;
}

export interface StreamingSource {
  provider: string;
  server?: string;
  type: 'hls' | 'mp4' | string;
  url: string;
  quality: string; // '4k' | '1080p' | '720p' | etc.
  contentType?: string;
  headers?: Record<string, string>;
  /** Absolute signed backend relay URL for header-bound streams (web playback). */
  relayUrl?: string;
  referer?: string;
  subtitles?: SubtitleTrack[];
  audioLanguages?: string[];
  metadata?: {
    qualityLabel?: string;
    watchUrl?: string;
    servers?: string[];
    resolvedAt?: string;
    requiresHeaders?: string[];
  };
}

export interface SourcesResponse {
  tmdbId: number;
  mediaType: MediaType;
  sources: StreamingSource[];
}

export interface SubtitlesResponse {
  tmdbId: number;
  mediaType: MediaType;
  season?: number;
  episode?: number;
  subtitles: SubtitleTrack[];
}

export interface HomeCatalogResponse {
  featured: MediaItem[];
  trending: MediaItem[];
  popularMovies: MediaItem[];
  popularTV: MediaItem[];
  topRated: MediaItem[];
  issues?: string[];
  rails?: Array<{
    key: string;
    content: {
      page: number;
      results: MediaItem[];
      total_pages?: number;
    };
  }>;
}

export interface SearchResponse {
  results: MediaItem[];
  page?: number;
  total_pages?: number;
  totalPages?: number;
  totalItems?: number;
}

export interface PagedResponse {
  page: number;
  results: MediaItem[];
  total_pages: number;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatar?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
}

export interface WatchHistoryItem {
  id?: string;
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  episodeName?: string | null;
  posterPath?: string | null;
  backdropPath?: string | null;
  /** Milliseconds. */
  position: number;
  /** Milliseconds. */
  duration: number;
  progress: number; // 0.0 - 1.0
  completed?: boolean;
  updatedAt?: string;
}

export interface WatchlistItem {
  id?: string;
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  voteAverage?: number | null;
  releaseDate?: string | null;
  addedAt?: string;
}

export interface RecordProgressPayload {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  episodeName?: string | null;
  posterPath?: string | null;
  backdropPath?: string | null;
  /** Milliseconds. */
  position: number;
  /** Milliseconds. */
  duration: number;
}

export interface WatchlistPayload {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  voteAverage?: number | null;
  releaseDate?: string | null;
}
