import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Film, Plus, Check, Star, Info, ChevronLeft, ChevronRight } from 'lucide-react';
import type { MediaItem } from '../../api/types';
import { firstImage, FALLBACK_BACKDROP } from '../../lib/images';
import { useWatchlist } from '../../context/WatchlistContext';

interface HeroSpotlightProps {
  items?: MediaItem[];
  item?: MediaItem;
  onPlay: (item: MediaItem) => void;
  onOpenTrailer: (item: MediaItem) => void;
  onOpenDetails: (item: MediaItem) => void;
}

export const HeroSpotlight: React.FC<HeroSpotlightProps> = ({
  items,
  item,
  onPlay,
  onOpenTrailer,
  onOpenDetails,
}) => {
  const { inWatchlist, toggleWatchlist } = useWatchlist();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const spotlightList = items && items.length > 0 ? items : item ? [item] : [];

  // Reset index if list changes
  const activeIndex = currentIndex < spotlightList.length ? currentIndex : 0;
  const currentItem = spotlightList[activeIndex];

  // Auto-advance spotlight every 6 seconds unless paused
  useEffect(() => {
    if (isPaused || spotlightList.length <= 1) return;
    const timer = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % spotlightList.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [isPaused, spotlightList.length]);

  if (!currentItem) {
    return null;
  }

  const tmdbId = currentItem.tmdbId || currentItem.id;
  const mediaType = currentItem.type || currentItem.media_type || 'movie';
  const isSaved = inWatchlist(tmdbId, mediaType);

  const backdropUrl =
    firstImage('original', currentItem.backdrop, currentItem.backdrop_path, currentItem.poster) ||
    FALLBACK_BACKDROP;

  const title = currentItem.title || currentItem.name || 'Untitled';
  const year =
    currentItem.year ||
    (currentItem.releaseDate
      ? currentItem.releaseDate.split('-')[0]
      : currentItem.firstAirDate
      ? currentItem.firstAirDate.split('-')[0]
      : '');
  const rating = currentItem.rating || currentItem.vote_average;

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + spotlightList.length) % spotlightList.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % spotlightList.length);
  };

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="group relative w-full h-[42vh] sm:h-[46vh] md:h-[48vh] min-h-[300px] max-h-[420px] overflow-hidden select-none"
    >
      {/* Background Image with Crossfade Transition */}
      <div className="absolute inset-0">
        <AnimatePresence mode="wait">
          <motion.img
            key={`backdrop-${tmdbId}-${activeIndex}`}
            src={backdropUrl}
            alt={title}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: 'easeInOut' }}
            className="w-full h-full object-cover object-center"
          />
        </AnimatePresence>
        {/* Gradients to blend smoothly with canvas #0E0D13 */}
        <div className="absolute inset-0 hero-side-gradient" />
        <div className="absolute inset-0 hero-gradient" />
        <div className="absolute inset-0 hero-vignette opacity-70" />
      </div>

      {/* Manual Navigation Arrows (Appear on Hover) */}
      {spotlightList.length > 1 && (
        <>
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Previous featured title"
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 p-2 sm:p-2.5 rounded-full bg-surface-950/70 hover:bg-surface-800 text-gray-200 hover:text-white border border-surface-700/60 backdrop-blur-md shadow-xl transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 hover:scale-110 focus:outline-none"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            aria-label="Next featured title"
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 p-2 sm:p-2.5 rounded-full bg-surface-950/70 hover:bg-surface-800 text-gray-200 hover:text-white border border-surface-700/60 backdrop-blur-md shadow-xl transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 hover:scale-110 focus:outline-none"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Hero Content Overlay */}
      <div className="relative w-full h-full px-4 sm:px-8 md:px-12 lg:px-16 flex flex-col justify-end pt-16 pb-3 sm:pb-4 z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={`content-${tmdbId}-${activeIndex}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="max-w-2xl space-y-2.5 sm:space-y-3"
          >
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
              {currentItem.genres && currentItem.genres.length > 0 && (
                <div className="hidden sm:flex items-center gap-1.5">
                  {currentItem.genres.slice(0, 3).map((g) => (
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
            {currentItem.overview && (
              <p className="text-xs sm:text-sm md:text-base text-gray-300 line-clamp-2 sm:line-clamp-3 leading-relaxed max-w-xl drop-shadow">
                {currentItem.overview}
              </p>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {/* Play Button */}
              <button
                type="button"
                onClick={() => onPlay(currentItem)}
                className="flex items-center gap-2.5 bg-primary hover:bg-primary-hover text-white px-6 py-3 rounded-full font-semibold text-sm sm:text-base shadow-lg shadow-primary/30 transition-all hover:scale-105 active:scale-98"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>Play Now</span>
              </button>

              {/* Trailer Button */}
              <button
                type="button"
                onClick={() => onOpenTrailer(currentItem)}
                className="flex items-center gap-2 bg-surface-800/80 hover:bg-surface-700/90 text-white border border-surface-600 px-5 py-3 rounded-full font-medium text-sm sm:text-base backdrop-blur-md transition-all hover:scale-102"
              >
                <Film className="w-4 h-4 text-primary" />
                <span>Trailer</span>
              </button>

              {/* Details Button */}
              <button
                type="button"
                onClick={() => onOpenDetails(currentItem)}
                className="flex items-center gap-2 bg-surface-800/80 hover:bg-surface-700/90 text-white border border-surface-600 px-4 py-3 rounded-full font-medium text-sm sm:text-base backdrop-blur-md transition-all hover:scale-102"
              >
                <Info className="w-4 h-4 text-gray-300" />
                <span className="hidden sm:inline">Details</span>
              </button>

              {/* Bookmark Button */}
              <button
                type="button"
                onClick={() => toggleWatchlist(currentItem)}
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
          </motion.div>
        </AnimatePresence>

        {/* Carousel Pagination Pills */}
        {spotlightList.length > 1 && (
          <div className="absolute bottom-3 sm:bottom-4 right-4 sm:right-8 z-20 flex items-center gap-1.5">
            {spotlightList.map((it, idx) => {
              const isActive = idx === activeIndex;
              return (
                <button
                  key={`pill-${it.id || it.tmdbId}-${idx}`}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIndex(idx);
                  }}
                  aria-label={`Featured slide ${idx + 1}: ${it.title || it.name || ''}`}
                  className={`h-1.5 rounded-full transition-all duration-300 focus:outline-none ${
                    isActive
                      ? 'w-7 sm:w-8 bg-primary shadow-sm shadow-primary'
                      : 'w-2 bg-white/30 hover:bg-white/60'
                  }`}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
