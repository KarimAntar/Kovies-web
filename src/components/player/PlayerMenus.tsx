import React from 'react';
import { Check } from 'lucide-react';
import type { StreamingSource, SubtitleTrack } from '../../api/types';
import type { SubtitleGroup } from '../../lib/subtitles';

const menuShell =
  'absolute right-0 bottom-12 bg-surface-900/95 backdrop-blur-xl border border-surface-700 rounded-2xl shadow-2xl p-2 z-30 overflow-y-auto no-scrollbar';
const itemBase =
  'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-medium text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary';

interface SubtitleMenuProps {
  groups: SubtitleGroup[];
  activeUrl: string | null;
  loading: boolean;
  listLoading: boolean;
  error: string | null;
  offsetSec: number;
  onOffsetChange: (delta: number) => void;
  onSelect: (track: SubtitleTrack | null) => void;
}

export const SubtitleMenu: React.FC<SubtitleMenuProps> = ({
  groups,
  activeUrl,
  loading,
  listLoading,
  error,
  offsetSec,
  onOffsetChange,
  onSelect,
}) => (
  <div role="menu" aria-label="Subtitles" className={`${menuShell} w-72 max-h-[60vh]`}>
    <div className="px-3 py-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-surface-800 flex items-center justify-between">
      <span>Subtitles</span>
      {loading && <span className="normal-case font-medium text-primary-hover">Loading…</span>}
    </div>

    {/* Subtitle Sync Offset Adjuster */}
    {activeUrl && (
      <div className="px-3 py-2 border-b border-surface-800/80 bg-surface-950/40 rounded-xl my-1.5">
        <div className="flex items-center justify-between text-[11px] font-semibold text-gray-300 mb-1.5">
          <span>Sync Offset</span>
          <span className="font-mono text-primary-hover">{offsetSec > 0 ? `+${offsetSec.toFixed(2)}s` : `${offsetSec.toFixed(2)}s`}</span>
        </div>
        <div className="flex items-center justify-between gap-1.5">
          <button
            type="button"
            onClick={() => onOffsetChange(-0.5)}
            className="px-2 py-1 rounded bg-surface-800 hover:bg-surface-700 text-[10px] font-bold text-gray-200 transition-colors"
          >
            -0.5s
          </button>
          <button
            type="button"
            onClick={() => onOffsetChange(-0.25)}
            className="px-2 py-1 rounded bg-surface-800 hover:bg-surface-700 text-[10px] font-bold text-gray-200 transition-colors"
          >
            -0.25s
          </button>
          <button
            type="button"
            onClick={() => onOffsetChange(0)}
            disabled={offsetSec === 0}
            className="px-2 py-1 rounded bg-surface-800 hover:bg-surface-700 text-[10px] font-bold text-gray-400 hover:text-white disabled:opacity-40 transition-colors"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => onOffsetChange(0.25)}
            className="px-2 py-1 rounded bg-surface-800 hover:bg-surface-700 text-[10px] font-bold text-gray-200 transition-colors"
          >
            +0.25s
          </button>
          <button
            type="button"
            onClick={() => onOffsetChange(0.5)}
            className="px-2 py-1 rounded bg-surface-800 hover:bg-surface-700 text-[10px] font-bold text-gray-200 transition-colors"
          >
            +0.5s
          </button>
        </div>
      </div>
    )}

    {error && <p className="px-3 py-2 text-xs text-red-400">{error}</p>}
    <button
      role="menuitemradio"
      aria-checked={!activeUrl}
      onClick={() => onSelect(null)}
      className={`${itemBase} mt-1 ${!activeUrl ? 'bg-primary/20 text-primary-hover' : 'text-gray-300 hover:bg-surface-800'}`}
    >
      <span>Off</span>
      {!activeUrl && <Check className="w-3.5 h-3.5" />}
    </button>
    {listLoading && groups.length === 0 && (
      <p className="px-3 py-2 text-xs text-gray-400">Finding subtitles…</p>
    )}
    {!listLoading && groups.length === 0 && (
      <p className="px-3 py-2 text-xs text-gray-400">No subtitles available for this title.</p>
    )}
    {groups.map((group) => (
      <div key={group.language} className="mt-2">
        <div className="px-3 py-1 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
          {group.label} <span className="font-medium normal-case">({group.tracks.length})</span>
        </div>
        {group.tracks.map((track, i) => {
          const selected = activeUrl === track.url;
          return (
            <button
              key={track.url}
              role="menuitemradio"
              aria-checked={selected}
              onClick={() => onSelect(track)}
              title={track.release || track.label}
              className={`${itemBase} ${selected ? 'bg-primary/20 text-primary-hover' : 'text-gray-300 hover:bg-surface-800'}`}
            >
              <span className="truncate">{track.release || track.label || `${group.label} ${i + 1}`}</span>
              {selected && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
            </button>
          );
        })}
      </div>
    ))}
  </div>
);

interface SettingsMenuProps {
  playbackRate: number;
  onRate: (rate: number) => void;
  sources: StreamingSource[];
  currentIndex: number;
  isPlayable: (source: StreamingSource) => boolean;
  onSource: (index: number) => void;
}

export const SettingsMenu: React.FC<SettingsMenuProps> = ({
  playbackRate,
  onRate,
  sources,
  currentIndex,
  isPlayable,
  onSource,
}) => (
  <div role="menu" aria-label="Playback settings" className={`${menuShell} w-64 max-h-[60vh] p-3 space-y-3`}>
    <div>
      <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Speed</div>
      <div className="grid grid-cols-3 gap-1">
        {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
          <button
            key={rate}
            onClick={() => onRate(rate)}
            className={`px-2 py-1 rounded-lg text-xs font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              playbackRate === rate ? 'bg-primary text-white font-bold' : 'bg-surface-800 text-gray-300 hover:bg-surface-700'
            }`}
          >
            {rate}x
          </button>
        ))}
      </div>
    </div>
    {sources.length > 1 && (
      <div>
        <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Source</div>
        <div className="space-y-1">
          {sources.map((src, idx) => {
            const selected = idx === currentIndex;
            const playable = isPlayable(src);
            return (
              <button
                key={`${src.provider}-${idx}`}
                onClick={() => onSource(idx)}
                disabled={!playable}
                title={playable ? undefined : 'Not playable in the browser'}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40 disabled:cursor-not-allowed ${
                  selected ? 'bg-primary/20 text-primary-hover' : 'text-gray-300 hover:bg-surface-800'
                }`}
              >
                <span className="uppercase font-bold">{src.quality || 'Auto'}</span>
                <span className="text-[11px] text-gray-400 truncate pl-2">{src.server || src.provider}</span>
              </button>
            );
          })}
        </div>
      </div>
    )}
  </div>
);
