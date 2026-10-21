import React from 'react';
import { Play, Plus, Check, Star, Info, X } from 'lucide-react';
import type { MediaItem, WatchHistoryItem } from '../../api/types';
import { firstImage, FALLBACK_POSTER } from '../../lib/images';
import { useWatchlist } from '../../context/WatchlistContext';

interface MediaCardProps {
  item: MediaItem;
  historyItem?: WatchHistoryItem;
  onSelect: (item: MediaItem) => void;
  onPlay: (item: MediaItem, season?: number, episode?: number) => void;
  onRemoveHistory?: (item: MediaItem, history: WatchHistoryItem) => void;
}

export const MediaCard: React.FC<MediaCardProps> = ({
  item,
  historyItem,
  onSelect,
  onPlay,
  onRemoveHistory,
}) => {
  const { inWatchlist, toggleWatchlist, removeFromHistory } = useWatchlist();
  const tmdbId = item.tmdbId || item.id;
  const mediaType = item.type || item.media_type || 'movie';
  const isSaved = inWatchlist(tmdbId, mediaType);

  const posterUrl =
    firstImage('w342', item.poster, item.poster_path, historyItem?.posterPath, item.backdrop) ||
    FALLBACK_POSTER;

  const title = item.title || item.name || historyItem?.title || 'Untitled';
  const year =
    item.year ||
    (item.releaseDate
      ? item.releaseDate.split('-')[0]
      : item.firstAirDate
      ? item.firstAirDate.split('-')[0]
      : '');
  const rating = item.rating || item.vote_average;

  // Handle play action
  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (historyItem) {
      onPlay(item, historyItem.seasonNumber ?? undefined, historyItem.episodeNumber ?? undefined);
    } else {
      onPlay(item);
    }
  };

  const handleBookmarkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleWatchlist(item);
  };

  const handleRemoveHistoryClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!historyItem) return;
    if (onRemoveHistory) {
      onRemoveHistory(item, historyItem);
    } else {
      void removeFromHistory(
        mediaType,
        tmdbId,
        historyItem.seasonNumber ?? undefined,
        historyItem.episodeNumber ?? undefined
      );
    }
  };

  return (
    <div
      onClick={() => onSelect(item)}
      className="group relative flex-shrink-0 w-44 sm:w-52 md:w-56 cursor-pointer select-none transition-all duration-300"
    >
      {/* Poster Container */}
      <div className="relative aspect-[2/3] w-full rounded-2xl overflow-hidden bg-surface-850/90 border border-surface-700/60 shadow-xl group-hover:shadow-2xl group-hover:shadow-primary/25 group-hover:border-primary/60 transition-all duration-300 transform group-hover:-translate-y-2 ring-0 group-hover:ring-1 group-hover:ring-primary/40">
        <img
          src={posterUrl}
          alt={title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/kovies-symbol.png';
          }}
        />

        {/* Gradient vignette on card */}
        <div className="absolute inset-0 bg-gradient-to-t from-canvas/90 via-canvas/20 to-transparent opacity-60 group-hover:opacity-90 transition-opacity" />

        {/* Badge in top left (Quality or Type) */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
          <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-gray-200 border border-white/15 shadow-sm">
            {mediaType === 'movie' ? 'Movie' : 'Series'}
          </span>
        </div>

        {/* Rating or Remove from History in top right */}
        {historyItem ? (
          <button
            onClick={handleRemoveHistoryClick}
            title="Clear Progress"
            aria-label="Clear Progress"
            className="absolute top-2.5 right-2.5 z-10 p-1.5 rounded-full bg-black/75 hover:bg-red-500/80 text-gray-300 hover:text-white border border-white/15 backdrop-blur-md shadow-md opacity-0 group-hover:opacity-100 transition-all hover:scale-110 focus:opacity-100"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : rating ? (
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-imdb text-[11px] font-bold border border-imdb/30 shadow-sm">
            <Star className="w-3 h-3 fill-imdb text-imdb" />
            <span>{rating.toFixed(1)}</span>
          </div>
        ) : null}

        {/* Quick action buttons on hover */}
        <div className="absolute inset-0 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-canvas/40 backdrop-blur-[2px]">
          <button
            onClick={handlePlayClick}
            title="Play"
            className="w-12 h-12 rounded-full bg-primary hover:bg-primary-hover text-white flex items-center justify-center shadow-lg shadow-primary/40 transform hover:scale-110 active:scale-95 transition-all"
          >
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </button>

          <button
            onClick={handleBookmarkClick}
            title={isSaved ? 'Remove from list' : 'Add to list'}
            className="w-10 h-10 rounded-full bg-surface-800/90 hover:bg-surface-700 text-white border border-surface-600 flex items-center justify-center transform hover:scale-105 transition-all"
          >
            {isSaved ? (
              <Check className="w-4 h-4 text-primary" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect(item);
            }}
            title="Details"
            className="w-10 h-10 rounded-full bg-surface-800/90 hover:bg-surface-700 text-white border border-surface-600 flex items-center justify-center transform hover:scale-105 transition-all"
          >
            <Info className="w-4 h-4 text-gray-200" />
          </button>
        </div>

        {/* Continue watching progress bar */}
        {historyItem && historyItem.progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-canvas to-transparent">
            {historyItem.seasonNumber && historyItem.episodeNumber ? (
              <div className="text-[10px] text-primary-hover font-semibold mb-1 truncate">
                S{historyItem.seasonNumber}:E{historyItem.episodeNumber}{' '}
                {historyItem.episodeName ? `• ${historyItem.episodeName}` : ''}
              </div>
            ) : null}
            <div className="w-full h-1.5 bg-surface-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300 shadow-sm shadow-primary"
                style={{ width: `${Math.min(100, Math.round(historyItem.progress * 100))}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-gray-400 mt-1">
              <span>{Math.round(historyItem.progress * 100)}% watched</span>
              {historyItem.duration > 0 && (
                <span>
                  {Math.max(
                    0,
                    Math.round(
                      (historyItem.duration > 10000
                        ? (historyItem.duration - historyItem.position) / 1000
                        : historyItem.duration - historyItem.position) / 60
                    )
                  )}m left
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Card Metadata Title & Year */}
      <div className="mt-2.5 px-0.5">
        <h3 className="font-medium text-sm text-gray-200 group-hover:text-primary-hover truncate transition-colors">
          {title}
        </h3>
        <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
          {year && <span>{year}</span>}
          <span>•</span>
          <span className="capitalize">{mediaType}</span>
        </div>
      </div>
    </div>
  );
};
