import type { SubtitleStyle, SubSize, SubFont, SubColor, SubEdge } from '../../lib/subtitleStyle';
import { DEFAULT_SUBTITLE_STYLE, SUBTITLE_COLORS, subtitleCss } from '../../lib/subtitleStyle';
import React from 'react';
import { useMenuFocus } from './useMenuFocus';
import { qualityLabel } from '../../lib/sourceCache';

const MenuSurface: React.FC<React.PropsWithChildren<{ label: string; className: string; onClose: () => void }>> = ({ label, className, onClose, children }) => {
  const ref = useMenuFocus(onClose);
  return <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={label} className={className}>{children}</div>;
};
import { Check, ChevronLeft, SlidersHorizontal } from 'lucide-react';
import type { StreamingSource, SubtitleTrack } from '../../api/types';
import type { SubtitleGroup } from '../../lib/subtitles';

const menuShell =
  'absolute right-0 bottom-12 bg-surface-900/95 backdrop-blur-xl border border-surface-700 rounded-2xl shadow-2xl p-2 z-30 overflow-y-auto no-scrollbar';
const itemBase =
  'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-medium text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary';

interface SubtitleMenuProps {
  onClose: () => void;
  groups: SubtitleGroup[];
  activeUrl: string | null;
  loading: boolean;
  listLoading: boolean;
  error: string | null;
  offsetSec: number;
  onOffsetChange: (delta: number) => void;
  onSelect: (track: SubtitleTrack | null) => void;
  style: SubtitleStyle;
  onStyleChange: (s: SubtitleStyle) => void;
}

const SIZES: SubSize[] = ['S', 'M', 'L', 'XL'];
const FONTS: { id: SubFont; label: string; family: string }[] = [
  { id: 'INTER', label: 'Inter', family: "'Inter', sans-serif" },
  { id: 'MANROPE', label: 'Manrope', family: "'Manrope', sans-serif" },
  { id: 'SANS', label: 'Sans', family: 'sans-serif' },
  { id: 'SERIF', label: 'Serif', family: 'serif' },
  { id: 'MONO', label: 'Mono', family: 'monospace' },
];
const COLORS: SubColor[] = ['WHITE', 'YELLOW', 'CYAN', 'GREEN'];
const EDGES: SubEdge[] = ['NONE', 'SHADOW', 'OUTLINE', 'RAISED'];
const BACKGROUNDS = [0, 0.25, 0.5, 0.75, 1.0];

export const SubtitleMenu: React.FC<SubtitleMenuProps> = ({
  onClose,
  groups,
  activeUrl,
  loading,
  listLoading,
  error,
  offsetSec,
  onOffsetChange,
  onSelect,
  style,
  onStyleChange,
}) => {
  const [view, setView] = React.useState<'tracks' | 'style'>('tracks');

  return (
    <MenuSurface
      onClose={onClose}
      label="Subtitles"
      className={`${menuShell} w-80 max-w-[calc(100vw-2rem)] max-h-[75vh] flex flex-col p-0 overflow-hidden`}
    >
      {/* Header with Navigation */}
      <div className="px-3 py-2.5 text-xs font-bold text-gray-300 uppercase tracking-wider border-b border-surface-800 flex items-center justify-between shrink-0 bg-surface-950/40">
        {view === 'style' ? (
          <button
            type="button"
            onClick={() => setView('tracks')}
            className="flex items-center gap-1.5 text-gray-300 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-primary-hover" />
            <span>Subtitle Appearance</span>
          </button>
        ) : (
          <div className="flex items-center justify-between w-full">
            <span>Subtitles</span>
            <div className="flex items-center gap-3">
              {loading && <span className="normal-case font-medium text-primary-hover text-[11px]">Loading…</span>}
              <button
                type="button"
                onClick={() => setView('style')}
                className="flex items-center gap-1 normal-case font-medium text-[11px] text-gray-400 hover:text-primary-hover transition-colors"
                title="Style & Appearance"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Style</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {view === 'style' ? (
        /* Sub-menu 2: Appearance & Styling */
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <div className="flex items-center justify-between text-[11px] font-semibold text-gray-300">
            <span className="uppercase tracking-wider text-gray-400">Preview</span>
            <button
              type="button"
              onClick={() => onStyleChange(DEFAULT_SUBTITLE_STYLE)}
              className="text-[10px] text-gray-400 hover:text-white transition-colors"
            >
              Reset to defaults
            </button>
          </div>

          <div className="p-2.5 rounded-xl bg-black/60 flex items-center justify-center min-h-[50px] overflow-hidden text-center border border-white/5">
            <span style={subtitleCss(style)} className="kovies-subtitle !max-w-full">
              This is how subtitles will look.
            </span>
          </div>

          {/* Size */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400 text-[11px]">Size</span>
            <div className="flex rounded-lg bg-surface-800 p-0.5 gap-0.5">
              {SIZES.map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => onStyleChange({ ...style, size: sz })}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                    style.size === sz ? 'bg-primary text-white shadow-sm' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>

          {/* Font */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400 text-[11px]">Font</span>
            <div className="flex flex-wrap gap-1 justify-end max-w-[200px]">
              {FONTS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  style={{ fontFamily: f.family }}
                  onClick={() => onStyleChange({ ...style, font: f.id })}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${
                    style.font === f.id
                      ? 'bg-primary/20 text-primary-hover ring-1 ring-primary'
                      : 'bg-surface-800 text-gray-300 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Colour */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400 text-[11px]">Colour</span>
            <div className="flex items-center gap-2">
              {COLORS.map((col) => {
                const hex = SUBTITLE_COLORS[col];
                const isSelected = style.color === col;
                return (
                  <button
                    key={col}
                    type="button"
                    onClick={() => onStyleChange({ ...style, color: col })}
                    className={`w-5 h-5 rounded-full transition-transform ${
                      isSelected ? 'ring-2 ring-primary scale-110' : 'ring-1 ring-white/20 hover:scale-105'
                    }`}
                    style={{ backgroundColor: hex }}
                    title={col}
                  />
                );
              })}
            </div>
          </div>

          {/* Edge */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400 text-[11px]">Edge</span>
            <div className="flex rounded-lg bg-surface-800 p-0.5 gap-0.5">
              {EDGES.map((ed) => (
                <button
                  key={ed}
                  type="button"
                  onClick={() => onStyleChange({ ...style, edge: ed })}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                    style.edge === ed ? 'bg-primary text-white shadow-sm' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {ed === 'NONE' ? 'None' : ed === 'SHADOW' ? 'Shadow' : ed === 'OUTLINE' ? 'Outline' : 'Raised'}
                </button>
              ))}
            </div>
          </div>

          {/* Background */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400 text-[11px]">Background</span>
            <div className="flex rounded-lg bg-surface-800 p-0.5 gap-0.5">
              {BACKGROUNDS.map((bg) => (
                <button
                  key={bg}
                  type="button"
                  onClick={() => onStyleChange({ ...style, background: bg })}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                    Math.abs(style.background - bg) < 0.05 ? 'bg-primary text-white shadow-sm' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {bg === 0 ? 'Off' : `${Math.round(bg * 100)}%`}
                </button>
              ))}
            </div>
          </div>

          {/* Position */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400 text-[11px]">Position</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={style.position <= -2}
                onClick={() => onStyleChange({ ...style, position: Math.max(-2, style.position - 1) })}
                className="w-6 h-6 rounded bg-surface-800 hover:bg-surface-700 disabled:opacity-30 text-xs font-bold text-gray-200 flex items-center justify-center transition-colors"
              >
                −
              </button>
              <span className="w-8 text-center font-mono text-[11px] text-primary-hover">
                {style.position > 0 ? `+${style.position}` : `${style.position}`}
              </span>
              <button
                type="button"
                disabled={style.position >= 4}
                onClick={() => onStyleChange({ ...style, position: Math.min(4, style.position + 1) })}
                className="w-6 h-6 rounded bg-surface-800 hover:bg-surface-700 disabled:opacity-30 text-xs font-bold text-gray-200 flex items-center justify-center transition-colors"
              >
                +
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Sub-menu 1: Track list + sync offset */
        <>
          {activeUrl && (
            <div className="px-3 py-2 border-b border-surface-800 bg-surface-950/30 shrink-0">
              <div className="flex items-center justify-between text-[11px] font-semibold text-gray-300 mb-1.5">
                <span className="text-gray-400">Sync Offset</span>
                <span className="font-mono text-primary-hover font-bold">
                  {offsetSec > 0 ? `+${offsetSec.toFixed(2)}s` : `${offsetSec.toFixed(2)}s`}
                </span>
              </div>
              <div className="flex items-center justify-between gap-1.5">
                {[-0.5, -0.25].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => onOffsetChange(val)}
                    className="flex-1 py-1 rounded bg-surface-800 hover:bg-surface-700 text-[10px] font-bold text-gray-200 transition-colors"
                  >
                    {val}s
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => onOffsetChange(0)}
                  disabled={offsetSec === 0}
                  className="px-2.5 py-1 rounded bg-surface-800 hover:bg-surface-700 text-[10px] font-bold text-gray-400 hover:text-white disabled:opacity-40 transition-colors"
                >
                  Reset
                </button>
                {[0.25, 0.5].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => onOffsetChange(val)}
                    className="flex-1 py-1 rounded bg-surface-800 hover:bg-surface-700 text-[10px] font-bold text-gray-200 transition-colors"
                  >
                    +{val}s
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
            {error && <p className="px-3 py-2 text-xs text-red-400">{error}</p>}
            <button
              role="menuitemradio"
              aria-checked={!activeUrl}
              onClick={() => onSelect(null)}
              className={`${itemBase} ${!activeUrl ? 'bg-primary/20 text-primary-hover font-semibold' : 'text-gray-300 hover:bg-surface-800'}`}
            >
              <span>Off</span>
              {!activeUrl && <Check className="w-3.5 h-3.5 text-primary-hover" />}
            </button>
            {listLoading && groups.length === 0 && (
              <p className="px-3 py-3 text-xs text-gray-400">Finding subtitles…</p>
            )}
            {!listLoading && groups.length === 0 && (
              <p className="px-3 py-3 text-xs text-gray-400">No subtitles available for this title.</p>
            )}
            {groups.map((group) => (
              <div key={group.language} className="mt-2.5 first:mt-1">
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
                      className={`${itemBase} ${selected ? 'bg-primary/20 text-primary-hover font-semibold' : 'text-gray-300 hover:bg-surface-800'}`}
                    >
                      <span className="truncate">{track.label || track.release || `${group.label} ${i + 1}`}</span>
                      {selected && <Check className="w-3.5 h-3.5 flex-shrink-0 text-primary-hover" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </MenuSurface>
  );
};

interface SettingsMenuProps {
  onClose: () => void;
  playbackRate: number;
  onRate: (rate: number) => void;
  sources: StreamingSource[];
  currentIndex: number;
  /** Rendition height playing now; labels the selected Auto entry ("Auto · 1080p"). */
  playingHeight?: number | null;
  isPlayable: (source: StreamingSource) => boolean;
  onSource: (index: number) => void;
}

export const SettingsMenu: React.FC<SettingsMenuProps> = ({
  onClose,
  playbackRate,
  onRate,
  sources,
  currentIndex,
  playingHeight,
  isPlayable,
  onSource,
}) => (
  <MenuSurface onClose={onClose} label="Playback settings" className={`${menuShell} w-64 max-w-[calc(100vw-2rem)] max-h-[60vh] p-3 space-y-3`}>
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
                <span className="uppercase font-bold">{qualityLabel(src.quality, selected ? playingHeight : null)}</span>
                <span className="text-[11px] text-gray-400 truncate pl-2">{src.server || src.provider}</span>
              </button>
            );
          })}
        </div>
      </div>
    )}
  </MenuSurface>
);
