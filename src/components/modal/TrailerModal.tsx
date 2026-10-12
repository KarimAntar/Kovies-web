import React, { useEffect } from 'react';
import { X, Film } from 'lucide-react';
import type { VideoItem } from '../../api/types';

interface TrailerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  videos?: VideoItem[];
}

export const TrailerModal: React.FC<TrailerModalProps> = ({
  isOpen,
  onClose,
  title,
  videos,
}) => {
  // Handle ESC key
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

  if (!isOpen) return null;

  // Find best YouTube trailer: official Trailer > any Trailer > any YouTube video
  const youtubeVideo =
    videos?.find((v) => v.site === 'YouTube' && v.type === 'Trailer' && v.official) ||
    videos?.find((v) => v.site === 'YouTube' && v.type === 'Trailer') ||
    videos?.find((v) => v.site === 'YouTube' && (v.type === 'Teaser' || v.type === 'Featurette')) ||
    videos?.find((v) => v.site === 'YouTube');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10 animate-fade-in">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/85 backdrop-blur-md transition-opacity"
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-4xl bg-surface-900 border border-surface-700 rounded-3xl overflow-hidden shadow-2xl z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-800 bg-surface-850">
          <div className="flex items-center gap-2">
            <Film className="w-5 h-5 text-primary" />
            <h3 className="font-title text-base sm:text-lg font-bold text-white truncate max-w-md">
              {title} — Official Trailer
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-surface-700 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Player */}
        <div className="relative aspect-video w-full bg-black">
          {youtubeVideo ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${youtubeVideo.key}?autoplay=1&rel=0&modestbranding=1`}
              title={`${title} Trailer`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full border-0"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 p-8 text-center">
              <Film className="w-12 h-12 text-gray-600 mb-3" />
              <p className="text-base font-semibold text-gray-300">
                No official video trailer available
              </p>
              <p className="text-sm text-gray-500 mt-1 max-w-sm">
                A preview video could not be retrieved from the provider catalogue.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
