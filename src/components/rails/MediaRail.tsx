import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MediaCard } from './MediaCard';
import type { MediaItem, WatchHistoryItem } from '../../api/types';

interface MediaRailProps {
  title: string;
  subtitle?: string;
  items: MediaItem[];
  historyItems?: WatchHistoryItem[];
  onSelect: (item: MediaItem) => void;
  onPlay: (item: MediaItem, season?: number, episode?: number) => void;
}

export const MediaRail: React.FC<MediaRailProps> = ({
  title,
  subtitle,
  items,
  historyItems,
  onSelect,
  onPlay,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    const scrollAmount = scrollContainerRef.current.clientWidth * 0.75;
    scrollContainerRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  if (!items || items.length === 0) {
    return null;
  }

  return (
    <section className="relative group/rail py-4 sm:py-6">
      {/* Rail Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-3 sm:mb-4 flex items-end justify-between">
        <div>
          <h2 className="font-title text-xl sm:text-2xl font-bold text-white tracking-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs sm:text-sm text-gray-400 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Rail Scroller with Controls */}
      <div className="relative">
        {/* Left Scroll Button */}
        <button
          onClick={() => scroll('left')}
          aria-label="Scroll left"
          className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-surface-900/90 hover:bg-primary text-white border border-surface-700/80 shadow-2xl flex items-center justify-center opacity-0 group-hover/rail:opacity-100 transition-all duration-200 hover:scale-110 focus:outline-none"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* Scrollable Container */}
        <div
          ref={scrollContainerRef}
          className="flex items-start gap-4 sm:gap-5 overflow-x-auto no-scrollbar px-4 sm:px-6 lg:px-8 py-2 scroll-smooth"
        >
          {items.map((item, idx) => {
            const history = historyItems?.find(
              (h) => h.tmdbId === (item.tmdbId || item.id)
            );
            return (
              <MediaCard
                key={`${item.id || item.tmdbId}-${idx}`}
                item={item}
                historyItem={history}
                onSelect={onSelect}
                onPlay={onPlay}
              />
            );
          })}
        </div>

        {/* Right Scroll Button */}
        <button
          onClick={() => scroll('right')}
          aria-label="Scroll right"
          className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-surface-900/90 hover:bg-primary text-white border border-surface-700/80 shadow-2xl flex items-center justify-center opacity-0 group-hover/rail:opacity-100 transition-all duration-200 hover:scale-110 focus:outline-none"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </section>
  );
};
