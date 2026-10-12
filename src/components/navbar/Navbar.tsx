import { desktop } from '../../platform';
import React, { useState, useEffect, useRef } from 'react';
import { Search, Bookmark, Download, Film, Tv, Compass, Home, User, LogOut, X, Star } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useDebounce } from '../../hooks/useDebounce';
import { api } from '../../api/client';
import type { MediaItem } from '../../api/types';
import { imageUrl, FALLBACK_POSTER } from '../../lib/images';

export type NavTab = 'home' | 'movies' | 'shows' | 'watchlist' | 'discover' | 'search';

interface NavbarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onSelectMedia: (item: MediaItem) => void;
  onOpenLanding?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  onSelectMedia,
  onOpenLanding,
}) => {
  const { user, isAuthenticated, logout, openAuthModal } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MediaItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 300);
  const searchRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Live search effect
  useEffect(() => {
    if (!debouncedSearch.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    let isCurrent = true;
    setIsSearching(true);

    api
      .search(debouncedSearch.trim())
      .then((res) => {
        if (isCurrent) {
          setSearchResults(res.results?.slice(0, 8) || []);
        }
      })
      .catch((err) => {
        console.error('Search failed', err);
        if (isCurrent) setSearchResults([]);
      })
      .finally(() => {
        if (isCurrent) setIsSearching(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [debouncedSearch]);

  // Click outside search & user menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Desktop navigation pill tabs: primary catalog views (Search has its own dedicated input on desktop)
  const desktopNavItems: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'Home', icon: <Home className="w-4 h-4 flex-shrink-0" /> },
    { id: 'movies', label: 'Movies', icon: <Film className="w-4 h-4 flex-shrink-0" /> },
    { id: 'shows', label: 'Shows', icon: <Tv className="w-4 h-4 flex-shrink-0" /> },
    { id: 'watchlist', label: 'My List', icon: <Bookmark className="w-4 h-4 flex-shrink-0" /> },
    { id: 'discover', label: 'Discover', icon: <Compass className="w-4 h-4 flex-shrink-0" /> },
  ];

  // Mobile navigation includes Search tab for phone touch targets
  const mobileNavItems: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    ...desktopNavItems,
    { id: 'search', label: 'Search', icon: <Search className="w-4 h-4 flex-shrink-0" /> },
  ];

  const isMacDesktop = Boolean(desktop?.isDesktop && desktop?.platform === 'darwin');
  return (
    <header
      style={{ top: 'var(--titlebar-h, 0px)' }}
      className={`fixed left-0 right-0 z-40 transition-all duration-300 ${isMacDesktop ? 'pl-20 sm:pl-24' : ''} ${
        isScrolled
          ? 'bg-canvas/90 backdrop-blur-md border-b border-primary/10 shadow-lg shadow-black/40 py-2.5'
          : 'bg-gradient-to-b from-canvas/95 via-canvas/60 to-transparent py-4'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
        {/* Left: Brand Logo & Navigation */}
        <div className="flex items-center gap-6 lg:gap-8">
          <button
            onClick={() => onTabChange('home')}
            className="flex items-center gap-2.5 focus:outline-none group text-left flex-shrink-0"
          >
            <img
              src="/kovies-symbol.png"
              alt="Kovies Logo"
              className="h-9 w-9 object-contain transform group-hover:scale-105 transition-transform"
            />
            <span className="font-title font-extrabold text-2xl tracking-tight bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
              KOVIES
            </span>
          </button>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-surface-800/70 p-1 rounded-full border border-surface-700/60 backdrop-blur-sm shadow-inner">
            {desktopNavItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`flex items-center gap-2 px-3.5 lg:px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all select-none ${
                    active
                      ? 'bg-primary text-white shadow-md shadow-primary/30'
                      : 'text-gray-300 hover:text-white hover:bg-surface-700/50'
                  }`}
                >
                  {item.icon}
                  <span className="whitespace-nowrap">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right: Live Search & Auth */}
        <div className="flex items-center gap-3">
          {/* Search Box */}
          <div ref={searchRef} className="relative">
            <div className="relative flex items-center">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchOpen(true);
                }}
                onFocus={() => setIsSearchOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setIsSearchOpen(false);
                    onTabChange('search');
                  }
                }}
                placeholder="Search movies, shows..."
                className="w-40 sm:w-60 md:w-64 lg:w-72 h-9 bg-surface-800/80 hover:bg-surface-800 focus:bg-surface-750 text-sm text-gray-100 placeholder-gray-400 pl-9 pr-8 rounded-full border border-surface-700/80 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3 pointer-events-none" />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                  className="absolute right-3 text-gray-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Live Search Suggestions Dropdown */}
            {isSearchOpen && (searchQuery.trim().length > 0 || searchResults.length > 0) && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-surface-800/95 backdrop-blur-xl border border-surface-700/80 rounded-2xl shadow-2xl overflow-hidden z-50 animate-fade-in">
                <div className="p-2.5 max-h-96 overflow-y-auto no-scrollbar">
                  {isSearching ? (
                    <div className="flex items-center justify-center py-6 text-sm text-gray-400 gap-2">
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      Searching catalogue...
                    </div>
                  ) : searchResults.length > 0 ? (
                    <div className="space-y-1">
                      {searchResults.map((item) => (
                        <button
                          key={`${item.type || item.media_type}-${item.id || item.tmdbId}`}
                          onClick={() => {
                            onSelectMedia(item);
                            setIsSearchOpen(false);
                            setSearchQuery('');
                          }}
                          className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-surface-700/70 transition-colors text-left group"
                        >
                          <img
                            src={
                              imageUrl(item.poster || item.poster_path, 'w185') ||
                              FALLBACK_POSTER
                            }
                            alt={item.title || item.name || 'Poster'}
                            className="w-11 h-16 rounded-md object-cover bg-surface-900 flex-shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = FALLBACK_POSTER;
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-gray-100 group-hover:text-primary-hover truncate transition-colors">
                              {item.title || item.name}
                            </h4>
                            <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                              <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-surface-900 border border-surface-700 font-semibold text-gray-300">
                                {item.type || item.media_type || 'Movie'}
                              </span>
                              {item.year && <span>{item.year}</span>}
                              {(item.rating || item.vote_average) ? (
                                <span className="flex items-center gap-1 text-imdb font-medium">
                                  <Star className="w-3 h-3 fill-imdb text-imdb" />
                                  {(item.rating || item.vote_average)?.toFixed(1)}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-sm text-gray-400">
                      No titles found matching &ldquo;{searchQuery}&rdquo;
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Get Apps Landing Trigger */}
          {onOpenLanding && (
            <button
              onClick={onOpenLanding}
              title="Download Native Apps & Features"
              className="hidden sm:flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-surface-800/80 hover:bg-surface-700 text-gray-300 hover:text-white border border-surface-700/80 text-xs font-semibold transition-all hover:scale-102"
            >
              <Download className="w-3.5 h-3.5 text-primary" />
              <span>Get Apps</span>
            </button>
          )}

          {/* Account / Auth trigger */}
          <div ref={userMenuRef} className="relative">
            {isAuthenticated && user ? (
              <div>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 p-1 rounded-full hover:bg-surface-800 transition-colors border border-surface-700 focus:outline-none"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-indigo-600 flex items-center justify-center text-white font-semibold text-xs shadow-inner">
                    {user.displayName ? user.displayName[0].toUpperCase() : 'U'}
                  </div>
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-surface-800/95 backdrop-blur-xl border border-surface-700 rounded-2xl shadow-2xl p-2 z-50 animate-fade-in">
                    <div className="px-3 py-2 border-b border-surface-700/60">
                      <p className="text-sm font-semibold text-white truncate">
                        {user.displayName}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{user.email}</p>
                    </div>
                    <div className="pt-1">
                      <button
                        onClick={() => {
                          onTabChange('watchlist');
                          setShowUserMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-200 hover:bg-surface-700/60 hover:text-white transition-colors text-left"
                      >
                        <Bookmark className="w-4 h-4 text-primary" />
                        My List
                      </button>
                      <button
                        onClick={() => {
                          logout();
                          setShowUserMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-colors text-left"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={openAuthModal}
                className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium px-4 h-9 rounded-full shadow-md shadow-primary/20 transition-all hover:scale-102 whitespace-nowrap"
              >
                <User className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline whitespace-nowrap">Sign In</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Navigation Bar at bottom or secondary row */}
      <div className="md:hidden flex items-center justify-around border-t border-surface-800/80 bg-canvas/95 backdrop-blur-md px-2 py-2 mt-2">
        {mobileNavItems.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-xs font-medium transition-all ${
                active ? 'text-primary' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {item.icon}
              <span className="text-[11px] whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
