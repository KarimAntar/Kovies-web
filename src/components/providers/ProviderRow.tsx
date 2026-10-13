import React from 'react';
import type { StreamingProvider } from '../../api/types';

interface ProviderRowProps {
  providers: StreamingProvider[];
  activeId?: number | null;
  onSelect: (provider: StreamingProvider) => void;
}

/** "Browse by Provider" — horizontally scrolling row of streaming-platform badges. */
export const ProviderRow: React.FC<ProviderRowProps> = ({ providers, activeId, onSelect }) => {
  if (!providers || providers.length === 0) return null;

  return (
    <section aria-label="Browse by Provider" className="w-full px-4 sm:px-8 md:px-12 lg:px-16">
      <h2 className="font-title text-base sm:text-lg font-bold text-white mb-3">Browse by Provider</h2>
      <div className="flex gap-3 sm:gap-4 overflow-x-auto no-scrollbar pb-2 -mx-1 px-1">
        {providers.map((provider) => {
          const active = provider.id === activeId;
          return (
            <button
              key={provider.id}
              type="button"
              onClick={() => onSelect(provider)}
              aria-label={`Browse ${provider.name}`}
              aria-pressed={active}
              title={provider.name}
              className={`group shrink-0 flex flex-col items-center gap-2 w-[72px] sm:w-20 focus:outline-none`}
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
