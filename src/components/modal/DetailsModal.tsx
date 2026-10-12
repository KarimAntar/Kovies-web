import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  Film,
  Plus,
  Check,
  Star,
  Clock,
  Calendar,
  Layers,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import type {
  MediaItem,
  MediaDetails,
  EpisodeInfo,
  StreamingSource,
} from '../../api/types';
import { firstImage, FALLBACK_POSTER, FALLBACK_BACKDROP } from '../../lib/images';
import { api } from '../../api/client';
import { useWatchlist } from '../../context/WatchlistContext';

interface DetailsModalProps {
  media: MediaItem | null;
  isOpen: boolean;
  onClose: () => void;
  onPlay: (item: MediaItem, season?: number, episode?: number, source?: StreamingSource) => void;
  onOpenTrailer: (title: string, videos: any[]) => void;
}

export const DetailsModal: React.FC<DetailsModalProps> = ({
  media,
  isOpen,
  onClose,
  onPlay,
  onOpenTrailer,
}) => {
  const { inWatchlist, toggleWatchlist } = useWatchlist();
  const [details, setDetails] = useState<MediaDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [episodes, setEpisodes] = useState<EpisodeInfo[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [sources, setSources] = useState<StreamingSource[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [selectedSource, setSelectedSource] = useState<StreamingSource | null>(null);

  const tmdbId = media?.tmdbId || media?.id;
  const mediaType = media?.type || media?.media_type || 'movie';
  const isSaved = tmdbId ? inWatchlist(tmdbId, mediaType) : false;

  // Load Details & Sources
  useEffect(() => {
    if (!isOpen || !tmdbId) return;

    let isCurrent = true;
    setIsLoading(true);
    setDetails(null);
    setSources([]);
    setSelectedSource(null);

    const fetchDetails =
      mediaType === 'movie'
        ? api.getMovieDetails(tmdbId)
        : api.getTVDetails(tmdbId);

    fetchDetails
      .then((data) => {
        if (!isCurrent) return;
        setDetails(data);

        // If TV, select first non-zero season or season 1
        if (data.seasons && data.seasons.length > 0) {
          const firstValid =
            data.seasons.find((s) => s.seasonNumber > 0) || data.seasons[0];
          setSelectedSeason(firstValid.seasonNumber);
        }
      })
      .catch((err) => {
        console.error('Failed to load media details', err);
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    // If movie, also fetch available stream sources immediately
    if (mediaType === 'movie') {
      setLoadingSources(true);
      api
        .getMovieSources(tmdbId)
        .then((res) => {
          if (!isCurrent) return;
          setSources(res.sources || []);
          if (res.sources && res.sources.length > 0) {
            setSelectedSource(res.sources[0]);
          }
        })
        .catch((err) => {
          console.warn('Sources preview unavailable:', err.message);
        })
        .finally(() => {
          if (isCurrent) setLoadingSources(false);
        });
    }

    return () => {
      isCurrent = false;
    };
  }, [isOpen, tmdbId, mediaType]);

  // Load Season Episodes for TV
  useEffect(() => {
    if (!isOpen || mediaType !== 'tv' || !tmdbId || selectedSeason === undefined) {
      return;
    }

    let isCurrent = true;
    setLoadingEpisodes(true);

    api
      .getTVSeason(tmdbId, selectedSeason)
      .then((res) => {
        if (isCurrent) {
          setEpisodes(res.episodes || []);
        }
      })
      .catch((err) => {
        console.error('Failed to load season episodes', err);
        if (isCurrent) setEpisodes([]);
      })
      .finally(() => {
        if (isCurrent) setLoadingEpisodes(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [isOpen, tmdbId, mediaType, selectedSeason]);

  // Keyboard escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'auto';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !media) return null;

  const currentMedia = details || media;
  const title = currentMedia.title || currentMedia.name || 'Untitled';
  const backdropUrl =
    firstImage('original', currentMedia.backdrop, currentMedia.backdrop_path, currentMedia.poster) ||
    FALLBACK_BACKDROP;
  const posterUrl =
    firstImage('w342', currentMedia.poster, currentMedia.poster_path) ||
    FALLBACK_POSTER;
  const year =
    currentMedia.year ||
    (currentMedia.releaseDate
      ? currentMedia.releaseDate.split('-')[0]
      : currentMedia.firstAirDate
      ? currentMedia.firstAirDate.split('-')[0]
      : '');
  const rating = currentMedia.rating || currentMedia.vote_average;

  const handlePlayMovie = () => {
    onPlay(currentMedia, undefined, undefined, selectedSource || undefined);
    onClose();
  };

  const handlePlayEpisode = (episodeNum: number) => {
    onPlay(currentMedia, selectedSeason, episodeNum);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 md:p-6 lg:p-8 animate-fade-in overflow-y-auto no-scrollbar">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-canvas/90 backdrop-blur-md transition-opacity"
      />

      {/* Modal Dialog Container */}
      <div className="relative w-full max-w-5xl bg-surface-900 border border-surface-700 sm:rounded-3xl shadow-2xl overflow-hidden z-10 my-auto max-h-[96vh] flex flex-col">
        {/* Close Button Top Right */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-30 p-2.5 rounded-full bg-surface-900/80 hover:bg-surface-700 text-gray-300 hover:text-white border border-surface-700/80 backdrop-blur-md shadow-lg transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto no-scrollbar flex-1">
          {/* Hero Backdrop Banner */}
          <div className="relative h-64 sm:h-80 md:h-96 w-full overflow-hidden">
            <img
              src={backdropUrl}
              alt={title}
              className="w-full h-full object-cover object-top"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-surface-900 via-surface-900/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-surface-900/90 via-surface-900/40 to-transparent" />

            {/* Banner Content */}
            <div className="absolute bottom-6 left-6 right-6 flex items-end gap-6 z-10">
              {/* Poster on Desktop */}
              <div className="hidden sm:block w-36 md:w-44 aspect-[2/3] rounded-2xl overflow-hidden border-2 border-surface-700 shadow-2xl flex-shrink-0 bg-card">
                <img
                  src={posterUrl}
                  alt={title}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Title & Key Stats */}
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="uppercase text-xs font-bold px-2.5 py-0.5 rounded-full bg-primary/25 border border-primary/40 text-primary-hover">
                    {mediaType === 'movie' ? 'Movie' : 'TV Series'}
                  </span>
                  {year && (
                    <span className="text-xs text-gray-300 font-medium px-2 py-0.5 rounded-md bg-surface-800/80 border border-surface-700">
                      {year}
                    </span>
                  )}
                  {details?.runtime ? (
                    <span className="flex items-center gap-1 text-xs text-gray-300">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      {Math.floor(details.runtime / 60)}h {details.runtime % 60}m
                    </span>
                  ) : null}
                  {details?.numberOfSeasons ? (
                    <span className="flex items-center gap-1 text-xs text-gray-300">
                      <Layers className="w-3.5 h-3.5 text-gray-400" />
                      {details.numberOfSeasons} Season{details.numberOfSeasons > 1 ? 's' : ''}
                    </span>
                  ) : null}
                  {isLoading && (
                    <span className="flex items-center gap-1 text-xs text-primary-hover">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Loading...</span>
                    </span>
                  )}
                </div>

                <h2 className="font-title text-2xl sm:text-3xl md:text-4xl font-extrabold text-white leading-tight">
                  {title}
                </h2>

                {details?.tagline && (
                  <p className="text-xs sm:text-sm text-gray-400 italic">
                    &ldquo;{details.tagline}&rdquo;
                  </p>
                )}

                {/* Ratings Row */}
                <div className="flex items-center gap-3 pt-1">
                  {/* IMDb Badge */}
                  {(details?.imdbRating || rating) && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-800 border border-imdb/30 text-imdb text-xs font-bold">
                      <Star className="w-3.5 h-3.5 fill-imdb text-imdb" />
                      <span>
                        {(details?.imdbRating || rating)?.toFixed(1)}
                      </span>
                      <span className="text-[10px] text-gray-400 font-normal">IMDb</span>
                    </div>
                  )}

                  {/* Rotten Tomatoes Badge */}
                  {details?.rottenTomatoesRating && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-800 border border-red-500/30 text-red-400 text-xs font-bold">
                      <span>🍅</span>
                      <span>{details.rottenTomatoesRating}</span>
                      <span className="text-[10px] text-gray-400 font-normal">RT</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Action Row & Details Body */}
          <div className="p-6 sm:p-8 space-y-8">
            {/* Primary Action Buttons */}
            <div className="flex flex-wrap items-center gap-3.5">
              {mediaType === 'movie' ? (
                <button
                  onClick={handlePlayMovie}
                  className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-7 py-3 rounded-full font-semibold text-sm sm:text-base shadow-lg shadow-primary/30 transition-all hover:scale-102"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>Play Movie</span>
                </button>
              ) : (
                <button
                  onClick={() => handlePlayEpisode(1)}
                  className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-7 py-3 rounded-full font-semibold text-sm sm:text-base shadow-lg shadow-primary/30 transition-all hover:scale-102"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>Start Series (S1:E1)</span>
                </button>
              )}

              {/* Trailer Button */}
              <button
                onClick={() => onOpenTrailer(title, details?.videos || [])}
                className="flex items-center gap-2 bg-surface-800 hover:bg-surface-700 text-white border border-surface-600 px-5 py-3 rounded-full font-medium text-sm sm:text-base transition-all"
              >
                <Film className="w-4 h-4 text-primary" />
                <span>Trailer</span>
              </button>

              {/* Bookmark Button */}
              <button
                onClick={() => toggleWatchlist(currentMedia)}
                className={`flex items-center gap-2 px-5 py-3 rounded-full font-medium text-sm sm:text-base border transition-all ${
                  isSaved
                    ? 'bg-primary/20 border-primary text-primary-hover'
                    : 'bg-surface-800 hover:bg-surface-700 text-gray-200 border-surface-600'
                }`}
              >
                {isSaved ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                <span>{isSaved ? 'In My List' : 'Add to List'}</span>
              </button>
            </div>

            {/* Synopsis & Genres */}
            <div className="space-y-3">
              <h3 className="font-title text-lg font-bold text-white">Overview</h3>
              <p className="text-sm sm:text-base text-gray-300 leading-relaxed max-w-3xl">
                {currentMedia.overview || 'No synopsis provided for this title.'}
              </p>

              {/* Genres Pills */}
              {currentMedia.genres && currentMedia.genres.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {currentMedia.genres.map((g) => (
                    <span
                      key={g.id}
                      className="px-3 py-1 rounded-full bg-surface-800 border border-surface-700 text-gray-300 text-xs font-medium"
                    >
                      {g.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Stream Sources Picker (If Movie) */}
            {mediaType === 'movie' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-title text-base sm:text-lg font-bold text-white">
                    Streaming Stream Options
                  </h3>
                  {loadingSources && (
                    <span className="text-xs text-gray-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                      Resolving high-speed mirrors...
                    </span>
                  )}
                </div>

                {sources.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {sources.map((src, i) => {
                      const isSelected = selectedSource?.url === src.url;
                      return (
                        <button
                          key={`${src.provider}-${src.quality}-${i}`}
                          onClick={() => setSelectedSource(src)}
                          className={`flex items-center justify-between p-3 rounded-2xl border text-left transition-all ${
                            isSelected
                              ? 'bg-primary/20 border-primary text-white shadow-md shadow-primary/20'
                              : 'bg-surface-800/80 border-surface-700/80 hover:bg-surface-750 text-gray-300'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="uppercase text-xs font-extrabold px-2 py-0.5 rounded bg-surface-900 border border-surface-700 text-primary-hover">
                                {src.quality || 'HD'}
                              </span>
                              <span className="text-xs text-gray-300 font-medium capitalize">
                                {src.server || src.provider}
                              </span>
                            </div>
                            <span className="text-[11px] text-gray-500 block mt-1">
                              Adaptive HLS Stream
                            </span>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-primary" />}
                        </button>
                      );
                    })}
                  </div>
                ) : !loadingSources ? (
                  <div className="p-4 rounded-2xl bg-surface-800/50 border border-surface-700/50 text-xs text-gray-400">
                    Adaptive 4K / 1080p stream will be dynamically resolved when playback begins.
                  </div>
                ) : null}
              </div>
            )}

            {/* Cast Carousel */}
            {details?.cast && details.cast.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-title text-base sm:text-lg font-bold text-white">
                  Top Cast
                </h3>
                <div className="flex items-start gap-4 overflow-x-auto no-scrollbar py-2">
                  {details.cast.slice(0, 14).map((c) => (
                    <div
                      key={c.id}
                      className="flex-shrink-0 w-24 sm:w-28 text-center space-y-1.5"
                    >
                      <div className="w-20 sm:w-24 h-20 sm:h-24 mx-auto rounded-full overflow-hidden bg-surface-800 border border-surface-700 shadow-md">
                        <img
                          src={c.profile || '/kovies-symbol.png'}
                          alt={c.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/kovies-symbol.png';
                          }}
                        />
                      </div>
                      <p className="text-xs font-semibold text-gray-200 line-clamp-1">
                        {c.name}
                      </p>
                      <p className="text-[11px] text-gray-400 line-clamp-1">
                        {c.character}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TV Show Season & Episodes Selector */}
            {mediaType === 'tv' && details?.seasons && details.seasons.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-surface-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h3 className="font-title text-lg font-bold text-white">Episodes</h3>

                  {/* Season Dropdown */}
                  <div className="relative inline-block">
                    <select
                      value={selectedSeason}
                      onChange={(e) => setSelectedSeason(Number(e.target.value))}
                      className="appearance-none bg-surface-800 border border-surface-700 hover:border-primary text-gray-200 text-sm font-medium pl-4 pr-10 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                    >
                      {details.seasons.map((s) => (
                        <option key={s.seasonNumber} value={s.seasonNumber}>
                          {s.name || `Season ${s.seasonNumber}`} ({s.episodeCount || 0} Episodes)
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* Episodes List */}
                {loadingEpisodes ? (
                  <div className="flex items-center justify-center py-12 text-sm text-gray-400 gap-2">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    Loading season episodes...
                  </div>
                ) : episodes.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-96 overflow-y-auto no-scrollbar pr-1">
                    {episodes.map((ep) => (
                      <div
                        key={ep.episodeNumber}
                        onClick={() => handlePlayEpisode(ep.episodeNumber)}
                        className="group flex gap-3 p-2.5 rounded-2xl bg-surface-800/60 hover:bg-surface-750 border border-surface-700/60 hover:border-primary/40 cursor-pointer transition-all"
                      >
                        {/* Still Image with Play overlay */}
                        <div className="relative w-28 sm:w-32 aspect-video rounded-xl overflow-hidden bg-card flex-shrink-0">
                          <img
                            src={ep.still || '/kovies-symbol.png'}
                            alt={ep.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/kovies-symbol.png';
                            }}
                          />
                          <div className="absolute inset-0 bg-canvas/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Play className="w-6 h-6 text-white fill-white" />
                          </div>
                          <span className="absolute bottom-1 right-1 text-[9px] px-1.5 py-0.5 rounded bg-black/70 text-gray-300 font-mono">
                            E{ep.episodeNumber}
                          </span>
                        </div>

                        {/* Episode Info */}
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <h4 className="text-sm font-semibold text-gray-200 group-hover:text-primary-hover truncate transition-colors">
                            {ep.episodeNumber}. {ep.name || `Episode ${ep.episodeNumber}`}
                          </h4>
                          {ep.airDate && (
                            <div className="flex items-center gap-1 text-[11px] text-gray-400 mt-0.5">
                              <Calendar className="w-3 h-3" />
                              <span>{ep.airDate}</span>
                            </div>
                          )}
                          {ep.overview && (
                            <p className="text-xs text-gray-400 line-clamp-2 mt-1">
                              {ep.overview}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-sm text-gray-400 bg-surface-800/30 rounded-2xl">
                    No episodes listed for this season.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
