import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Sparkles, Download, ChevronRight, ChevronLeft, ShieldCheck, Film } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PosterItem {
  title: string;
  url: string;
  year?: string;
  rating?: string;
}

export const TOP_POSTERS: PosterItem[] = [
  {
    title: 'The Godfather',
    url: 'https://image.tmdb.org/t/p/w780/3bhkrj58Vtu7enYsRolD1fZdja1.jpg',
    year: '1972',
    rating: '9.2',
  },
  {
    title: 'The Dark Knight',
    url: 'https://image.tmdb.org/t/p/w780/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
    year: '2008',
    rating: '9.0',
  },
  {
    title: 'Interstellar',
    url: 'https://image.tmdb.org/t/p/w780/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
    year: '2014',
    rating: '8.7',
  },
  {
    title: 'Spider-Man Across the Spider-Verse',
    url: 'https://image.tmdb.org/t/p/w780/8Vt6mWEReuy4Of61Lnj5Xj704m8.jpg',
    year: '2023',
    rating: '8.7',
  },
  {
    title: 'Breaking Bad',
    url: 'https://image.tmdb.org/t/p/w780/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
    year: '2008',
    rating: '9.5',
  },
  {
    title: 'Inception',
    url: 'https://image.tmdb.org/t/p/w780/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg',
    year: '2010',
    rating: '8.8',
  },
  {
    title: 'Pulp Fiction',
    url: 'https://image.tmdb.org/t/p/w780/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg',
    year: '1994',
    rating: '8.9',
  },
  {
    title: 'The Shawshank Redemption',
    url: 'https://image.tmdb.org/t/p/w780/9cqNxx0GxF0bflZmeSMuL5tnGzr.jpg',
    year: '1994',
    rating: '9.3',
  },
  {
    title: 'Fight Club',
    url: 'https://image.tmdb.org/t/p/w780/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
    year: '1999',
    rating: '8.8',
  },
  {
    title: 'Game of Thrones',
    url: 'https://image.tmdb.org/t/p/w780/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg',
    year: '2011',
    rating: '9.2',
  },
  {
    title: 'Stranger Things',
    url: 'https://image.tmdb.org/t/p/w780/49WJfeN0moxb9IPfGn8AIqMGskD.jpg',
    year: '2016',
    rating: '8.7',
  },
  {
    title: 'Arcane',
    url: 'https://image.tmdb.org/t/p/w780/fqldf2t8ztc9aiwn3k6mlX3tvRT.jpg',
    year: '2021',
    rating: '9.0',
  },
];

export interface AppScreenshot {
  title: string;
  description: string;
  badge: string;
  accent: string;
  previewUrl: string;
}

export const APP_SCREENSHOTS: AppScreenshot[] = [
  {
    title: 'Aetherium Cinema Player',
    description: 'Hardware-accelerated 4K adaptive HLS with instant audio track & dynamic SubDL subtitle switching.',
    badge: '4K Cinema Engine',
    accent: '#7B5BF5',
    previewUrl: '/screenshots/player.png',
  },
  {
    title: 'Personal Cloud Sync & Rails',
    description: 'Continue watching exactly where you left off across Windows, macOS, Android, TV, and the Web.',
    badge: 'Cross-Device Sync',
    accent: '#997FF9',
    previewUrl: '/screenshots/tv-home.png',
  },
  {
    title: 'Curated 4K Cinema Catalog',
    description: 'Deep TMDB indexing with real IMDb dataset scores, trailer previews, cast filmographies, and zero ads.',
    badge: 'Zero Ads Guarantee',
    accent: '#F6C700',
    previewUrl: '/screenshots/details.png',
  },
];

interface AnimatedMarqueeHeroProps {
  className?: string;
  onLaunchApp?: () => void;
  onScrollToDownloads?: () => void;
}

export const AnimatedMarqueeHero: React.FC<AnimatedMarqueeHeroProps> = ({
  className,
  onLaunchApp,
  onScrollToDownloads,
}) => {
  const [activeSlide, setActiveSlide] = useState(0);

  const row1 = TOP_POSTERS.slice(0, 6);
  const row2 = TOP_POSTERS.slice(6, 12);

  // Triple items for seamless infinite marquee loop
  const marquee1 = [...row1, ...row1, ...row1];
  const marquee2 = [...row2, ...row2, ...row2];

  const handleNextSlide = () => {
    setActiveSlide((prev) => (prev + 1) % APP_SCREENSHOTS.length);
  };

  const handlePrevSlide = () => {
    setActiveSlide((prev) => (prev - 1 + APP_SCREENSHOTS.length) % APP_SCREENSHOTS.length);
  };

  return (
    <section className={cn('relative min-h-screen overflow-hidden bg-canvas pt-20 pb-24 flex flex-col justify-between', className)}>
      {/* Background Radial Glow Effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-primary/15 blur-[140px] pointer-events-none rounded-full" />
      <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] bg-indigo-600/10 blur-[120px] pointer-events-none rounded-full" />
      <div className="absolute top-2/3 right-1/4 w-[500px] h-[400px] bg-primary/10 blur-[130px] pointer-events-none rounded-full" />

      {/* Hero Header Content */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6 pt-10 sm:pt-14">
        {/* Release Pill Badge */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface-800/90 border border-primary/30 shadow-lg shadow-primary/10 backdrop-blur-md"
        >
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-semibold uppercase tracking-wider text-primary-hover">
            v0.1.0 Universal Release
          </span>
          <span className="text-xs text-gray-400">• Windows, macOS, Android, TV & Web</span>
        </motion.div>

        {/* Main Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="font-title text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white leading-[1.08]"
        >
          Cinema Without Limits.{' '}
          <span className="bg-gradient-to-r from-primary via-primary-hover to-indigo-300 bg-clip-text text-transparent block sm:inline">
            Any Device.
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-2xl mx-auto text-base sm:text-lg text-gray-300 leading-relaxed"
        >
          The next-generation cinematic streaming ecosystem. Native 4K adaptive HLS, live mirror fallback,
          dynamic SubDL subtitles, and instant cloud watch progress sync.
        </motion.p>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-wrap items-center justify-center gap-4 pt-2"
        >
          <button
            onClick={onLaunchApp}
            className="group relative flex items-center gap-2.5 px-8 py-3.5 rounded-full bg-primary hover:bg-primary-hover text-white font-semibold text-base shadow-xl shadow-primary/30 hover:shadow-primary/50 transition-all hover:scale-105 active:scale-98"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>Launch Web Player</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>

          <button
            onClick={onScrollToDownloads}
            className="flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-surface-800/90 hover:bg-surface-700/90 text-gray-100 font-semibold text-base border border-surface-700 hover:border-surface-600 backdrop-blur-md transition-all hover:scale-102"
          >
            <Download className="w-5 h-5 text-primary" />
            <span>Download Native Apps</span>
          </button>
        </motion.div>

        {/* Feature Badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="flex flex-wrap items-center justify-center gap-6 pt-4 text-xs text-gray-400 font-medium"
        >
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-primary" />
            Adaptive 4K HLS Playback
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Zero Ads & No Tracking
          </span>
          <span className="flex items-center gap-1.5">
            <Film className="w-4 h-4 text-imdb" />
            Verified SubDL Subtitles
          </span>
        </motion.div>
      </div>

      {/* Animated Poster Marquee Tracks (Sliding High-Res Posters) */}
      <div className="relative my-12 overflow-hidden py-4 select-none">
        {/* Left & Right Fade Gradients */}
        <div className="absolute left-0 inset-y-0 w-24 sm:w-40 bg-gradient-to-r from-canvas via-canvas/80 to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 inset-y-0 w-24 sm:w-40 bg-gradient-to-l from-canvas via-canvas/80 to-transparent z-10 pointer-events-none" />

        {/* Top & Bottom Vignette */}
        <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-canvas to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-canvas to-transparent z-10 pointer-events-none" />

        {/* Track 1: Scrolling Left */}
        <div className="flex overflow-hidden mb-5">
          <motion.div
            className="flex gap-4 shrink-0"
            animate={{ x: ['0%', '-33.333%'] }}
            transition={{
              duration: 40,
              ease: 'linear',
              repeat: Infinity,
            }}
          >
            {marquee1.map((poster, idx) => (
              <div
                key={`row1-${poster.title}-${idx}`}
                className="group relative w-36 sm:w-44 md:w-48 aspect-[2/3] rounded-2xl overflow-hidden bg-surface-850 border border-surface-700/60 shadow-xl flex-shrink-0 transition-transform duration-300 hover:scale-105"
              >
                <img
                  src={poster.url}
                  alt={poster.title}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                  <p className="font-title text-xs font-bold text-white line-clamp-1">{poster.title}</p>
                  <p className="text-[10px] text-gray-300">{poster.year} • ★ {poster.rating}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Track 2: Scrolling Right */}
        <div className="flex overflow-hidden">
          <motion.div
            className="flex gap-4 shrink-0"
            animate={{ x: ['-33.333%', '0%'] }}
            transition={{
              duration: 45,
              ease: 'linear',
              repeat: Infinity,
            }}
          >
            {marquee2.map((poster, idx) => (
              <div
                key={`row2-${poster.title}-${idx}`}
                className="group relative w-36 sm:w-44 md:w-48 aspect-[2/3] rounded-2xl overflow-hidden bg-surface-850 border border-surface-700/60 shadow-xl flex-shrink-0 transition-transform duration-300 hover:scale-105"
              >
                <img
                  src={poster.url}
                  alt={poster.title}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                  <p className="font-title text-xs font-bold text-white line-clamp-1">{poster.title}</p>
                  <p className="text-[10px] text-gray-300">{poster.year} • ★ {poster.rating}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* App Showcase Carousel */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 w-full mt-4">
        <div className="text-center mb-6">
          <span className="text-xs font-bold uppercase tracking-widest text-primary-hover">Interactive Showcase</span>
          <h2 className="font-title text-2xl sm:text-3xl font-extrabold text-white mt-1">Engineered for Perfection</h2>
        </div>

        <div className="relative rounded-3xl bg-surface-900 border border-surface-700/80 shadow-2xl overflow-hidden p-2 sm:p-4 backdrop-blur-xl">
          {/* Top Window Bar Simulation */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-surface-800 bg-surface-950/60 rounded-t-2xl">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-green-500/80 inline-block" />
              <span className="text-xs font-mono text-gray-400 pl-2">kovies://player/cinema</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-primary/20 text-primary-hover border border-primary/30">
                {APP_SCREENSHOTS[activeSlide].badge}
              </span>
            </div>
          </div>

          {/* Carousel Slide Viewer */}
          <div className="relative aspect-video w-full rounded-b-2xl overflow-hidden bg-black group/carousel">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSlide}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.4 }}
                className="relative w-full h-full"
              >
                <img
                  src={APP_SCREENSHOTS[activeSlide].previewUrl}
                  alt={APP_SCREENSHOTS[activeSlide].title}
                  className="w-full h-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-950 via-surface-950/40 to-transparent" />

                {/* Slide Caption Overlay */}
                <div className="absolute bottom-6 left-6 right-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4 z-10">
                  <div className="max-w-xl">
                    <h3 className="font-title text-xl sm:text-2xl font-bold text-white drop-shadow">
                      {APP_SCREENSHOTS[activeSlide].title}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-300 mt-1 drop-shadow">
                      {APP_SCREENSHOTS[activeSlide].description}
                    </p>
                  </div>
                  <button
                    onClick={onLaunchApp}
                    className="self-start sm:self-auto flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-black hover:bg-gray-200 text-xs font-bold transition-all shadow-lg"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Try It Now</span>
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Navigation Arrows */}
            <button
              onClick={handlePrevSlide}
              aria-label="Previous slide"
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-surface-900/80 hover:bg-surface-800 text-white border border-surface-700/80 backdrop-blur-md transition-all shadow-lg focus:outline-none"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <button
              onClick={handleNextSlide}
              aria-label="Next slide"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-surface-900/80 hover:bg-surface-800 text-white border border-surface-700/80 backdrop-blur-md transition-all shadow-lg focus:outline-none"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Indicators Bar */}
          <div className="flex items-center justify-center gap-2 pt-3 pb-1">
            {APP_SCREENSHOTS.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveSlide(i)}
                aria-label={`Slide ${i + 1}`}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  activeSlide === i ? 'w-8 bg-primary shadow-sm shadow-primary' : 'w-2 bg-surface-700 hover:bg-surface-600'
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default AnimatedMarqueeHero;
