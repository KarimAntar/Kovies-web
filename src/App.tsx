import { useState, useEffect, useCallback } from 'react';
import { Bookmark, Sparkles, Loader2, Film, Tv, Compass, Search, AlertTriangle, History, Flame, Clapperboard, Award, Zap } from 'lucide-react';
import { Navbar, type NavTab } from './components/navbar/Navbar';
import { HeroSpotlight } from './components/hero/HeroSpotlight';
import { MediaRail } from './components/rails/MediaRail';
import { MediaCard } from './components/rails/MediaCard';
import { DetailsModal } from './components/modal/DetailsModal';
import { TrailerModal } from './components/modal/TrailerModal';
import { AuthModal } from './components/modal/AuthModal';
import { VideoPlayer } from './components/player/VideoPlayer';
import { Titlebar } from './components/Titlebar';
import { LandingPage } from './components/landing/LandingPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WatchlistProvider, useWatchlist } from './context/WatchlistContext';
import { api, errorMessage as apiErrorMessage, isAbortError } from './api/client';
import { imageUrl, FALLBACK_POSTER } from './lib/images';
import type {
  MediaItem,
  HomeCatalogResponse,
  StreamingSource,
  VideoItem,
} from './api/types';

const isAbort = (err: unknown) => isAbortError(err);

function isAppRoute(): boolean {
  if (typeof window === 'undefined') return false;
  // If running inside the Electron desktop shell, always render the streaming app
  if (window.koviesDesktop?.isDesktop) return true;
  const p = window.location.pathname.toLowerCase().replace(/\/+$/, '');
  // /app or subroutes like /app/movies, /app/search render the streaming player app
  return p === '/app' || p.startsWith('/app/');
}

function TabError({ message, onRetry }: { message: unknown; onRetry?: () => void }) {
  const displayMsg = apiErrorMessage(message, 'Failed to load content. Please try again.');
  return (
    <div className="py-20 text-center text-sm text-gray-400 max-w-md mx-auto">
      <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-3" />
      <p className="mb-4 leading-relaxed">{displayMsg}</p>
      {(onRetry ?? undefined) !== undefined && (
        <button
          onClick={() => onRetry?.()}
          className="px-5 py-2.5 rounded-full bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-all"
        >
          Try again
        </button>
      )}
    </div>
  );
}

function EmptyGrid({ message }: { message: string }) {
  return <p className="py-16 text-center text-sm text-gray-400">{message}</p>;
}

function MainApp() {
  // If at root '/' or '/landing' or '/download' -> Landing Page
  // If at '/app' or running inside desktop app -> Web App Player
  const [viewMode, setViewMode] = useState<'app' | 'landing'>(() => (isAppRoute() ? 'app' : 'landing'));

  useEffect(() => {
    const handlePopState = () => {
      setViewMode(isAppRoute() ? 'app' : 'landing');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleOpenLanding = () => {
    setViewMode('landing');
    if (window.location.pathname !== '/' && window.location.pathname !== '/landing') {
      window.history.pushState({}, '', '/');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLaunchApp = () => {
    setViewMode('app');
    if (window.location.pathname !== '/app') {
      window.history.pushState({}, '', '/app');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const {
    continueWatching,
    historyStatus,
    watchlist,
    watchlistStatus,
    watchlistError,
    refreshWatchlist,
    removeFromHistory,
  } = useWatchlist();
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>('home');

  // Home Catalog Data
  const [homeData, setHomeData] = useState<HomeCatalogResponse | null>(null);
  const [isLoadingHome, setIsLoadingHome] = useState(true);
  const [homeError, setHomeError] = useState<string | null>(null);

  // Tab Catalog Data (for Movies, Shows, Discover)
  const [tabItems, setTabItems] = useState<MediaItem[]>([]);
  const [isLoadingTab, setIsLoadingTab] = useState(false);
  const [tabError, setTabError] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<MediaItem[]>([]);
  const [reloadTick, setReloadTick] = useState(0);
  const [isSearching, setIsSearching] = useState(false);

  // Modals & Player State
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [trailerData, setTrailerData] = useState<{
    isOpen: boolean;
    title: string;
    videos: VideoItem[];
  }>({
    isOpen: false,
    title: '',
    videos: [],
  });

  const [activePlayer, setActivePlayer] = useState<{
    media: MediaItem;
    season?: number;
    episode?: number;
    source?: StreamingSource;
  } | null>(null);

  // Load Home Catalog
  const loadHome = useCallback(async () => {
    setIsLoadingHome(true);
    setHomeError(null);
    try {
      const data = await api.getHome();
      setHomeData(data);
    } catch (err) {
      setHomeError(apiErrorMessage(err, 'Could not load the Kovies catalogue.'));
    } finally {
      setIsLoadingHome(false);
    }
  }, []);

  useEffect(() => {
    loadHome();
  }, [loadHome]);

  // Load Movies or Shows Tab Data
  useEffect(() => {
    if (activeTab === 'movies' || activeTab === 'shows') {
      const type = activeTab === 'movies' ? 'movie' : 'tv';
      const controller = new AbortController();
      setIsLoadingTab(true);
      setTabError(null);
      api
        .getPopular(type, 1, controller.signal)
        .then((res) => setTabItems(res.results || []))
        .catch((err) => {
          if (!controller.signal.aborted) setTabError(apiErrorMessage(err, 'Could not load this catalogue.'));
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoadingTab(false);
        });
      return () => controller.abort();
    }
    if (activeTab === 'discover') {
      setIsLoadingTab(true);
      setTabError(null);
      // Mix popular movies and shows.
      Promise.allSettled([api.getPopular('movie', 1), api.getPopular('tv', 1)])
        .then(([moviesRes, tvRes]) => {
          const movies = moviesRes.status === 'fulfilled' ? moviesRes.value.results : [];
          const shows = tvRes.status === 'fulfilled' ? tvRes.value.results : [];
          if (movies.length === 0 && shows.length === 0) {
            const failed = moviesRes.status === 'rejected' ? moviesRes.reason : tvRes.status === 'rejected' ? tvRes.reason : undefined;
            setTabError(apiErrorMessage(failed, 'Could not load the Discover catalogue.'));
          }
          setTabItems([...movies, ...shows]);
        })
        .finally(() => setIsLoadingTab(false));
    }
    else {
      setIsLoadingTab(false);
      setTabError(null);
      setTabItems([]);
    }
  }, [activeTab, reloadTick]);

  // Search page results (the navbar box is the quick-access variant).
  useEffect(() => {
    if (activeTab !== 'search') return;
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setIsSearching(true);
      api
        .search(trimmed, 1, controller.signal)
        .then((res) => {
          if (!controller.signal.aborted) setSearchResults(res.results || []);
        })
        .catch((err) => {
          if (!controller.signal.aborted && !isAbort(err)) {
            setSearchResults([]);
            setTabError(apiErrorMessage(err, 'Search failed.'));
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsSearching(false);
        });
    }, 300);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [activeTab, searchQuery]);

  const handleSearchSubmit = useCallback((q: string) => {
    const trimmed = q.trim();
    setSearchQuery(q);
    setActiveTab('search');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (!trimmed) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    setTabError(null);
    api
      .search(trimmed, 1)
      .then((res) => {
        setSearchResults(res.results || []);
      })
      .catch((err) => {
        if (!isAbort(err)) {
          setSearchResults([]);
          setTabError(apiErrorMessage(err, 'Search failed.'));
        }
      })
      .finally(() => {
        setIsSearching(false);
      });
  }, []);

  // Handle Play Action
  const handlePlayMedia = (
    item: MediaItem,
    season?: number,
    episode?: number,
    source?: StreamingSource
  ) => {
    setActivePlayer({
      media: item,
      season,
      episode,
      source,
    });
  };

  // Handle Trailer Open from Spotlight or Details
  const handleOpenTrailer = async (item: MediaItem) => {
    const tmdbId = item.tmdbId || item.id;
    const mediaType = item.type || item.media_type || 'movie';
    const title = item.title || item.name || 'Untitled';

    try {
      const details =
        mediaType === 'movie'
          ? await api.getMovieDetails(tmdbId)
          : await api.getTVDetails(tmdbId);

      setTrailerData({
        isOpen: true,
        title,
        videos: details.videos || [],
      });
    } catch {
      setTrailerData({
        isOpen: true,
        title,
        videos: [],
      });
    }
  };

  const handleOpenTrailerWithVideos = (title: string, videos: VideoItem[]) => {
    setTrailerData({
      isOpen: true,
      title,
      videos,
    });
  };

  // Top 5 spotlight items (featured or trending)
  const spotlightItems =
    homeData?.featured && homeData.featured.length > 0
      ? homeData.featured.slice(0, 5)
      : homeData?.trending && homeData.trending.length > 0
      ? homeData.trending.slice(0, 5)
      : [];

  // Filter tab items by genre if applicable
  const filteredTabItems =
    selectedGenre === 'all'
      ? tabItems
      : tabItems.filter((i) =>
          i.genres?.some((g) => g.name.toLowerCase() === selectedGenre.toLowerCase())
        );

  const GENRES = [
    'all',
    'Action',
    'Adventure',
    'Animation',
    'Comedy',
    'Crime',
    'Drama',
    'Mystery',
    'Sci-Fi & Fantasy',
    'Thriller',
  ];

  if (viewMode === 'landing') {
    return <LandingPage onLaunchApp={handleLaunchApp} />;
  }

  return (
    <div className="min-h-screen bg-canvas text-gray-100 flex flex-col justify-between">
      {/* Global Navbar */}
      <Navbar
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onSelectMedia={(item) => setSelectedMedia(item)}
        onOpenLanding={handleOpenLanding}
        onSearchSubmit={handleSearchSubmit}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-20">
        {activeTab === 'home' && (
          <div>
            {/* Hero Spotlight */}
            {isLoadingHome && !homeData ? (
              <div className="w-full h-[70vh] flex flex-col items-center justify-center bg-surface-950 text-gray-400 gap-3">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                <p className="text-sm font-medium tracking-wide">
                  Loading Kovies cinema spotlight...
                </p>
              </div>
            ) : homeError && !homeData ? (
              <div className="w-full min-h-[50vh] flex flex-col items-center justify-center bg-surface-950 text-gray-400 gap-4 px-6 text-center">
                <AlertTriangle className="w-10 h-10 text-amber-400" />
                <p className="text-sm max-w-md leading-relaxed">{apiErrorMessage(homeError, 'Could not load the Kovies catalogue.')}</p>
                <button
                  onClick={loadHome}
                  className="px-5 py-2.5 rounded-full bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-all"
                >
                  Try again
                </button>
              </div>
            ) : spotlightItems.length > 0 ? (
              <HeroSpotlight
                items={spotlightItems}
                onPlay={(item) => handlePlayMedia(item)}
                onOpenTrailer={(item) => handleOpenTrailer(item)}
                onOpenDetails={(item) => setSelectedMedia(item)}
              />
            ) : null}

            {/* Rails Container */}
            <div className="space-y-2 mt-0 relative z-20">
              {/* Trending Now Rail */}
              {homeData?.trending && (
                <MediaRail
                  title="Trending Now"
                  subtitle="Top trending titles across global viewers"
                  icon={<Flame className="w-5 h-5 text-amber-400" />}
                  items={homeData.trending}
                  onSelect={(item) => setSelectedMedia(item)}
                  onPlay={(item) => handlePlayMedia(item)}
                />
              )}

              {/* Cinejoy Instant Streams Rail */}
              {homeData?.cinejoyTrending && homeData.cinejoyTrending.length > 0 && (
                <MediaRail
                  title="Cinejoy Instant 1080p"
                  subtitle="Streamable right now, no waiting on sources"
                  icon={<Zap className="w-5 h-5 text-emerald-400" />}
                  items={homeData.cinejoyTrending}
                  onSelect={(item) => setSelectedMedia(item)}
                  onPlay={(item) => handlePlayMedia(item)}
                />
              )}

              {isAuthenticated && historyStatus === 'ready' && continueWatching.length === 0 && !homeError && (
                <div className="w-full px-4 sm:px-8 md:px-12 lg:px-16 pt-4">
                  <div className="rounded-2xl border border-surface-800 bg-surface-900/50 px-5 py-4 text-sm text-gray-400">
                    <span className="font-semibold text-gray-200">Continue Watching is empty.</span>{' '}
                    Start any title and your position will sync across devices.
                  </div>
                </div>
              )}
              {/* Continue Watching Rail */}
              {continueWatching.length > 0 && (
                <MediaRail
                  title="Continue Watching"
                  subtitle="Jump right back into your active streams"
                  icon={<History className="w-5 h-5 text-indigo-400" />}
                  items={continueWatching.map((h) => ({
                    id: h.tmdbId,
                    tmdbId: h.tmdbId,
                    type: h.mediaType,
                    title: h.title,
                    poster: imageUrl(h.posterPath, 'w342') ?? FALLBACK_POSTER,
                    backdrop: imageUrl(h.backdropPath, 'w780') ?? null,
                    rating: undefined,
                  }))}
                  historyItems={continueWatching}
                  onSelect={(item) => setSelectedMedia(item)}
                  onPlay={(item, s, ep) => handlePlayMedia(item, s, ep)}
                  onRemoveHistory={(_item, history) => {
                    void removeFromHistory(
                      history.mediaType,
                      history.tmdbId,
                      history.seasonNumber ?? undefined,
                      history.episodeNumber ?? undefined
                    );
                  }}
                />
              )}

              {/* Popular Movies Rail */}
              {homeData?.popularMovies && (
                <MediaRail
                  title="Popular Movies"
                  subtitle="Blockbuster films and fan favorites"
                  icon={<Clapperboard className="w-5 h-5 text-primary" />}
                  items={homeData.popularMovies}
                  onSelect={(item) => setSelectedMedia(item)}
                  onPlay={(item) => handlePlayMedia(item)}
                />
              )}

              {/* Top Rated Series / Popular TV Rail */}
              {(homeData?.popularTV || homeData?.topRated) && (
                <MediaRail
                  title="Top Rated Series"
                  subtitle="Binge-worthy shows with critical acclaim"
                  icon={<Award className="w-5 h-5 text-purple-400" />}
                  items={homeData?.popularTV || homeData?.topRated || []}
                  onSelect={(item) => setSelectedMedia(item)}
                  onPlay={(item) => handlePlayMedia(item)}
                />
              )}
            </div>
          </div>
        )}

        {/* Movies Tab */}
        {activeTab === 'movies' && (
          <div className="w-full px-4 sm:px-8 md:px-12 lg:px-16 pt-24 sm:pt-28">
            <div className="flex items-center gap-3 mb-6">
              <Film className="w-7 h-7 text-primary" />
              <div>
                <h1 className="font-title text-2xl sm:text-3xl font-extrabold text-white">
                  Movies
                </h1>
                <p className="text-sm text-gray-400">
                  Explore full-length cinematic feature films in 4K resolution
                </p>
              </div>
            </div>

            {isLoadingTab ? (
              <div className="py-24 flex items-center justify-center gap-2 text-gray-400">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                <span>Loading movies catalogue...</span>
              </div>
            ) : tabError ? (
              <TabError message={tabError} onRetry={() => setReloadTick((n) => n + 1)} />
            ) : tabItems.length === 0 ? (
              <EmptyGrid message="No movies to show right now." />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
                {tabItems.map((item) => (
                  <MediaCard
                    key={`movie-${item.id || item.tmdbId}`}
                    item={item}
                    onSelect={(it) => setSelectedMedia(it)}
                    onPlay={(it) => handlePlayMedia(it)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Shows Tab */}
        {activeTab === 'shows' && (
          <div className="w-full px-4 sm:px-8 md:px-12 lg:px-16 pt-24 sm:pt-28">
            <div className="flex items-center gap-3 mb-6">
              <Tv className="w-7 h-7 text-primary" />
              <div>
                <h1 className="font-title text-2xl sm:text-3xl font-extrabold text-white">
                  TV Shows
                </h1>
                <p className="text-sm text-gray-400">
                  Episodic television and acclaimed mini-series
                </p>
              </div>
            </div>

            {isLoadingTab ? (
              <div className="py-24 flex items-center justify-center gap-2 text-gray-400">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                <span>Loading TV series...</span>
              </div>
            ) : tabError ? (
              <TabError message={tabError} onRetry={() => setReloadTick((n) => n + 1)} />
            ) : tabItems.length === 0 ? (
              <EmptyGrid message="No shows to show right now." />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
                {tabItems.map((item) => (
                  <MediaCard
                    key={`tv-${item.id || item.tmdbId}`}
                    item={item}
                    onSelect={(it) => setSelectedMedia(it)}
                    onPlay={(it) => handlePlayMedia(it)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* My List (Watchlist) Tab */}
        {activeTab === 'watchlist' && (
          <div className="w-full px-4 sm:px-8 md:px-12 lg:px-16 pt-24 sm:pt-28">
            <div className="flex items-center gap-3 mb-6">
              <Bookmark className="w-7 h-7 text-primary" />
              <div>
                <h1 className="font-title text-2xl sm:text-3xl font-extrabold text-white">
                  My List
                </h1>
                <p className="text-sm text-gray-400">
                  Your bookmarked movies and TV series
                </p>
              </div>
            </div>

            {watchlistStatus === 'loading' && watchlist.length === 0 ? (
              <div className="py-24 flex items-center justify-center gap-2 text-gray-400">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                <span>Loading your list...</span>
              </div>
            ) : watchlistStatus === 'error' && watchlist.length === 0 ? (
              <div className="py-24 text-center text-sm text-gray-400">
                <p className="mb-4">{apiErrorMessage(watchlistError, 'Could not load your list.')}</p>
                <button onClick={() => refreshWatchlist()} className="px-5 py-2.5 rounded-full bg-primary hover:bg-primary-hover text-white font-semibold text-sm transition-all">
                  Retry
                </button>
              </div>
            ) : watchlist.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
                {watchlist.map((item) => (
                  <MediaCard
                    key={`watch-${item.tmdbId}-${item.mediaType}`}
                    item={{
                      id: item.tmdbId,
                      tmdbId: item.tmdbId,
                      type: item.mediaType,
                      title: item.title,
                      poster: imageUrl(item.posterPath, 'w342') ?? FALLBACK_POSTER,
                      backdrop: imageUrl(item.backdropPath, 'w780') ?? null,
                      rating: item.voteAverage ?? undefined,
                      releaseDate: item.releaseDate ?? undefined,
                    }}
                    onSelect={(it) => setSelectedMedia(it)}
                    onPlay={(it) => handlePlayMedia(it)}
                  />
                ))}
              </div>
            ) : (
              <div className="py-24 text-center bg-surface-900/50 rounded-3xl border border-surface-800 p-8 max-w-lg mx-auto">
                <Bookmark className="w-12 h-12 text-surface-700 mx-auto mb-3" />
                <h3 className="font-title text-lg font-bold text-white mb-1">
                  Your list is empty
                </h3>
                <p className="text-sm text-gray-400 mb-6">
                  Save movies and shows with the Bookmark button to watch them anytime.
                </p>
                <button
                  onClick={() => setActiveTab('home')}
                  className="px-6 py-2.5 rounded-full bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-all"
                >
                  Explore Home
                </button>
              </div>
            )}
          </div>
        )}

        {/* Discover Tab */}
        {activeTab === 'discover' && (
          <div className="w-full px-4 sm:px-8 md:px-12 lg:px-16 pt-24 sm:pt-28">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <Compass className="w-7 h-7 text-primary" />
                <div>
                  <h1 className="font-title text-2xl sm:text-3xl font-extrabold text-white">
                    Discover
                  </h1>
                  <p className="text-sm text-gray-400">
                    Filter by genre and unearth new cinema masterpieces
                  </p>
                </div>
              </div>

              {/* Genre Pills Filter */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                {GENRES.map((genre) => (
                  <button
                    key={genre}
                    onClick={() => setSelectedGenre(genre)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize whitespace-nowrap transition-all ${
                      selectedGenre.toLowerCase() === genre.toLowerCase()
                        ? 'bg-primary text-white shadow-md shadow-primary/30'
                        : 'bg-surface-800 hover:bg-surface-700 text-gray-300'
                    }`}
                  >
                    {genre}
                  </button>
                ))}
              </div>
            </div>

            {isLoadingTab ? (
              <div className="py-24 flex items-center justify-center gap-2 text-gray-400">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                <span>Discovering titles...</span>
              </div>
            ) : tabError && tabItems.length === 0 ? (
              <TabError message={tabError} onRetry={() => setReloadTick((n) => n + 1)} />
            ) : tabItems.length === 0 ? (
              <EmptyGrid message="Nothing to discover right now." />
            ) : filteredTabItems.length === 0 ? (
              <EmptyGrid message={`No titles in ${selectedGenre} yet.`} />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
                {filteredTabItems.map((item) => (
                  <MediaCard
                    key={`discover-${item.id || item.tmdbId}`}
                    item={item}
                    onSelect={(it) => setSelectedMedia(it)}
                    onPlay={(it) => handlePlayMedia(it)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Search Tab */}
        {activeTab === 'search' && (
          <div className="w-full px-4 sm:px-8 md:px-12 lg:px-16 pt-24 sm:pt-28">
            <div className="flex items-center gap-3 mb-6">
              <Search className="w-7 h-7 text-primary" />
              <div>
                <h1 className="font-title text-2xl sm:text-3xl font-extrabold text-white">Search</h1>
                <p className="text-sm text-gray-400">Find any movie or series on Kovies</p>
              </div>
            </div>

            <div className="relative max-w-xl mb-8">
              <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setTabError(null);
                  setSearchQuery(e.target.value);
                }}
                placeholder="Search movies and shows..."
                autoFocus
                aria-label="Search movies and shows"
                className="w-full bg-surface-800 text-sm text-gray-100 placeholder-gray-400 pl-11 pr-4 py-3 rounded-full border border-surface-700 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
              />
            </div>

            {!searchQuery.trim() ? (
              <EmptyGrid message="Start typing to search the catalogue." />
            ) : isSearching ? (
              <div className="py-16 flex items-center justify-center gap-2 text-gray-400">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                <span>Searching...</span>
              </div>
            ) : tabError ? (
              <TabError message={tabError} />
            ) : searchResults.length === 0 ? (
              <EmptyGrid message={`No titles found matching \u201c${searchQuery.trim()}\u201d.`} />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
                {searchResults.map((item) => (
                  <MediaCard
                    key={`search-${item.id || item.tmdbId}`}
                    item={item}
                    onSelect={(it) => setSelectedMedia(it)}
                    onPlay={(it) => handlePlayMedia(it)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Global Modals */}
      <DetailsModal
        media={selectedMedia}
        isOpen={Boolean(selectedMedia)}
        onClose={() => setSelectedMedia(null)}
        onPlay={(item, s, ep, src) => handlePlayMedia(item, s, ep, src)}
        onOpenTrailer={(t, v) => handleOpenTrailerWithVideos(t, v)}
      />

      <TrailerModal
        isOpen={trailerData.isOpen}
        onClose={() => setTrailerData((prev) => ({ ...prev, isOpen: false }))}
        title={trailerData.title}
        videos={trailerData.videos}
      />

      <AuthModal />

      {/* Fullscreen Video Player */}
      {activePlayer && (
        <VideoPlayer
          media={activePlayer.media}
          seasonNumber={activePlayer.season}
          episodeNumber={activePlayer.episode}
          initialSource={activePlayer.source}
          onClose={() => setActivePlayer(null)}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-surface-800/80 bg-canvas/80 py-8 px-4 text-center text-xs text-gray-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img
              src="/kovies-symbol.png"
              alt="Kovies"
              className="w-5 h-5 opacity-70"
            />
            <span className="font-title font-bold text-gray-300">KOVIES</span>
            <span>— Aetherium Cinema Experience</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 text-gray-400">
            <button
              onClick={handleOpenLanding}
              className="text-primary-hover hover:underline font-semibold transition-colors"
            >
              Download Native Apps
            </button>
            <span className="text-surface-700">•</span>
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>4K Adaptive HLS • Dynamic SubDL Subtitles</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <WatchlistProvider>
        <Titlebar />
        <MainApp />
      </WatchlistProvider>
    </AuthProvider>
  );
}
