import React from 'react';
import type { StreamingProvider } from '../../api/types';

/** Exact providers and icons matching cinejoy.pk */
export const FALLBACK_PROVIDERS: StreamingProvider[] = [
  { id: 8, name: 'Netflix', logo: 'https://image.tmdb.org/t/p/w154/rK1KljqmbvO9HQa1PBFLILWah72.png' },
  { id: 9, name: 'Amazon Prime Video', logo: 'https://image.tmdb.org/t/p/w154/gMZdpavHmxFNnLpMHwVxfqeux2g.png' },
  { id: 337, name: 'Disney Plus', logo: 'https://image.tmdb.org/t/p/w154/5eZ872CghnHFLB1j8grszbrx0dx.png' },
  { id: 15, name: 'Hulu', logo: 'https://image.tmdb.org/t/p/w154/44uAnmSqvA4yBOdbPWN8YgQHjWm.png' },
  { id: 1899, name: 'HBO Max', logo: 'https://image.tmdb.org/t/p/w154/skypuy7SXuugIQeYg0IglmzoKaS.png' },
  { id: 2303, name: 'Paramount Plus', logo: 'https://image.tmdb.org/t/p/w154/4N4BMd0Mm0kHAmF7RZgL5lW3cwc.png' },
  { id: 386, name: 'Peacock Premium', logo: 'https://image.tmdb.org/t/p/w154/a1UIdq5BrkcAxnxcUhFsNbXnxeu.png' },
  { id: 283, name: 'Crunchyroll', logo: 'https://image.tmdb.org/t/p/w154/uFL3c4Cq8M6WoLymlC5Y8bmGytV.png' },
  { id: 43, name: 'Starz', logo: 'https://image.tmdb.org/t/p/w154/h25xjouKmiSmFiiqw0aDXbxGZo7.png' },
  { id: 526, name: 'AMC+', logo: 'https://image.tmdb.org/t/p/w154/wsCUflcmL4dCkzBUaGP8cj1cTkh.png' },
  { id: 34, name: 'MGM Plus', logo: 'https://image.tmdb.org/t/p/w154/q63Uzpu7JAs566vA2G23Lk7LcID.png' },
  { id: 188, name: 'YouTube Premium', logo: 'https://image.tmdb.org/t/p/w154/eWHpKZihdiY617s5LipWJWvN28U.png' },
  { id: 192, name: 'YouTube', logo: 'https://image.tmdb.org/t/p/w154/5Maob4o5w8oZnNeYpCDyVFD3M7X.png' },
  { id: 73, name: 'Tubi TV', logo: 'https://image.tmdb.org/t/p/w154/9dEuvA8wg5TSeFBZlPxSVxFdimJ.png' },
  { id: 300, name: 'Pluto TV', logo: 'https://image.tmdb.org/t/p/w154/fN4czqaMQNLeF6sSSIjGbAWzvwK.png' },
];

interface ProviderRowProps {
  providers?: StreamingProvider[];
  activeId?: number | null;
  onSelect: (provider: StreamingProvider) => void;
}

/** "Browse by Provider" — horizontally scrolling row of streaming-platform badges. */
export const ProviderRow: React.FC<ProviderRowProps> = ({ providers, activeId, onSelect }) => {
  const source = providers && providers.length > 0 ? providers : FALLBACK_PROVIDERS;
  // One badge per platform: TMDB lists "Apple TV" and "Apple TV+" separately with near-identical icons.
  const hasApplePlus = source.some((p) => p.name.toLowerCase() === 'apple tv+');
  const seen = new Set<string>();
  const displayProviders = source.filter((p) => {
    if (hasApplePlus && p.name.toLowerCase() === 'apple tv') return false;
    const key = p.logo || p.name;
    if (seen.has(p.id + '') || seen.has(key)) return false;
    seen.add(p.id + '');
    seen.add(key);
    return true;
  });

  return (
    <section aria-label="Browse by Provider" className="w-full px-4 sm:px-8 md:px-12 lg:px-16">
      <h2 className="font-title text-base sm:text-lg font-bold text-white mb-3">Browse by Provider</h2>
      <div className="flex gap-3 sm:gap-4 overflow-x-auto no-scrollbar pb-2 -mx-1 px-1">
        {displayProviders.map((provider) => {
          const active = provider.id === activeId;
          return (
            <button
              key={provider.id}
              type="button"
              onClick={() => onSelect(provider)}
              aria-label={`Browse ${provider.name}`}
              aria-pressed={active}
              title={provider.name}
              className="group shrink-0 flex flex-col items-center gap-2 w-[72px] sm:w-20 focus:outline-none"
            >
              <span
                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden bg-surface-800 flex items-center justify-center border transition-all duration-200 group-hover:scale-105 group-focus-visible:ring-2 group-focus-visible:ring-primary ${
                  active ? 'border-primary shadow-[0_0_0_2px_rgba(123,91,245,0.5)]' : 'border-white/10 group-hover:border-white/30'
                }`}
              >
                {provider.logo ? (
                  <img
                    src={provider.logo}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs font-bold text-white/80">{provider.name.slice(0, 2)}</span>
                )}
              </span>
              <span
                className={`text-[11px] leading-tight text-center line-clamp-2 transition-colors ${
                  active ? 'text-white font-semibold' : 'text-gray-400 group-hover:text-white'
                }`}
              >
                {provider.name}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};
