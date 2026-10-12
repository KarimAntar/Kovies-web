import React from 'react';
import { Play, Film, Plus, Check, Star, Info } from 'lucide-react';
import type { MediaItem } from '../../api/types';
import { firstImage, FALLBACK_BACKDROP } from '../../lib/images';
import { useWatchlist } from '../../context/WatchlistContext';

interface HeroSpotlightProps {
  item: MediaItem;
  onPlay: (item: MediaItem) => void;
  onOpenTrailer: (item: MediaItem) => void;
  onOpenDetails: (item: MediaItem) => void;
}

export const HeroSpotlight: React.FC<HeroSpotlightProps> = ({
  item,
  onPlay,
  onOpenTrailer,
  onOpenDetails,
}) => {
  const { inWatchlist, toggleWatchlist } = useWatchlist();
  const tmdbId = item.tmdbId || item.id;
  const mediaType = item.type || item.media_type || 'movie';
  const isSaved = inWatchlist(tmdbId, mediaType);

  const backdropUrl =
    firstImage('original', item.backdrop, item.backdrop_path, item.poster) ||
    FALLBACK_BACKDROP;

  const title = item.title || item.name || 'Untitled';
  const year =
    item.year ||
    (item.releaseDate
      ? item.releaseDate.split('-')[0]
      : item.firstAirDate
      ? item.firstAirDate.split('-')[0]
      : '');
  const rating = item.rating || item.vote_average;

  return (
    <div className="relative w-full h-[42vh] sm:h-[46vh] md:h-[48vh] min-h-[300px] max-h-[420px] overflow-hidden select-none">
      {/* Background Image with Fallbacks */}
      <div className="absolute inset-0">
        <img
          src={backdropUrl}
          alt={title}
          className="w-full h-full object-cover object-center transform scale-105 animate-pulse duration-1000"
          style={{ animationDuration: '8s' }}
        />
        {/* Gradients to blend smoothly with canvas #0E0D13 */}
        <div className="absolute inset-0 hero-side-gradient" />
        <div className="absolute inset-0 hero-gradient" />
        <div className="absolute inset-0 hero-vignette opacity-70" />
      </div>

      {/* Hero Content Overlay */}
      <div className="relative w-full h-full px-4 sm:px-8 md:px-12 lg:px-16 flex flex-col justify-end pt-16 pb-3 sm:pb-4 z-10">
        <div className="max-w-2xl space-y-2.5 sm:space-y-3 animate-slide-up">
          {/* Metadata Badges */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs sm:text-sm font-medium">
            <span className="uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-primary/25 border border-primary/40 text-primary-hover font-bold text-xs backdrop-blur-md">
              {mediaType === 'movie' ? 'Movie' : 'TV Series'}
            </span>

            {year && (
              <span className="px-2.5 py-0.5 rounded-full bg-surface-800/80 border border-surface-700/80 text-gray-300">
                {year}
              </span>
            )}

            {rating ? (
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-800/90 border border-imdb/30 text-imdb font-bold">
                <Star className="w-3.5 h-3.5 fill-imdb text-imdb" />
                <span>{rating.toFixed(1)}</span>
                <span className="text-[10px] text-gray-400 font-normal">IMDb</span>
              </div>
            ) : null}

            {/* Genres */}
            {item.genres && item.genres.length > 0 && (
              <div className="hidden sm:flex items-center gap-1.5">
                {item.genres.slice(0, 3).map((g) => (
                  <span
                    key={g.id}
                    className="px-2.5 py-0.5 rounded-full bg-surface-700/50 border border-surface-600/50 text-gray-300 text-xs"
                  >
                    {g.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Title */}
          <h1 className="font-title text-2xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight drop-shadow-md">
            {title}
          </h1>

          {/* Synopsis */}
          {item.overview && (
            <p className="text-xs sm:text-sm md:text-base text-gray-300 line-clamp-2 sm:line-clamp-3 leading-relaxed max-w-xl drop-shadow">
              {item.overview}
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {/* Play Button */}
            <button
              onClick={() => onPlay(item)}
              className="flex items-center gap-2.5 bg-primary hover:bg-primary-hover text-white px-6 py-3 rounded-full font-semibold text-sm sm:text-base shadow-lg shadow-primary/30 transition-all hover:scale-105 active:scale-98"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Play Now</span>
            </button>

            {/* Trailer Button */}
            <button
              onClick={() => onOpenTrailer(item)}
              className="flex items-center gap-2 bg-surface-800/80 hover:bg-surface-700/90 text-white border border-surface-600 px-5 py-3 rounded-full font-medium text-sm sm:text-base backdrop-blur-md transition-all hover:scale-102"
            >
              <Film className="w-4 h-4 text-primary" />
              <span>Trailer</span>
            </button>

            {/* Details Button */}
            <button
              onClick={() => onOpenDetails(item)}
              className="flex items-center gap-2 bg-surface-800/80 hover:bg-surface-700/90 text-white border border-surface-600 px-4 py-3 rounded-full font-medium text-sm sm:text-base backdrop-blur-md transition-all hover:scale-102"
            >
              <Info className="w-4 h-4 text-gray-300" />
              <span className="hidden sm:inline">Details</span>
            </button>

            {/* Bookmark Button */}
            <button
              onClick={() => toggleWatchlist(item)}
              title={isSaved ? 'Remove from My List' : 'Add to My List'}
              className={`p-3 rounded-full border backdrop-blur-md transition-all hover:scale-105 ${
                isSaved
                  ? 'bg-primary/20 border-primary text-primary-hover'
                  : 'bg-surface-800/80 border-surface-600 text-gray-300 hover:text-white'
              }`}
            >
              {isSaved ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
