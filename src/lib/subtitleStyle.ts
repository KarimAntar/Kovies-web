import type React from 'react';

export type SubSize = 'S' | 'M' | 'L' | 'XL';
export type SubFont = 'MANROPE' | 'INTER' | 'SANS' | 'SERIF' | 'MONO';
export type SubColor = 'WHITE' | 'YELLOW' | 'CYAN' | 'GREEN';
export type SubEdge = 'NONE' | 'SHADOW' | 'OUTLINE' | 'RAISED';

export interface SubtitleStyle {
  size: SubSize;
  font: SubFont;
  color: SubColor;
  edge: SubEdge;
  background: number;
  position: number;
}

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  size: 'M',
  font: 'INTER',
  color: 'WHITE',
  edge: 'SHADOW',
  background: 0,
  position: 0
};

export const SUBTITLE_SIZES: Record<SubSize, number> = {
  S: 0.8,
  M: 1.0,
  L: 1.25,
  XL: 1.5
};

export const SUBTITLE_FONTS: Record<SubFont, string> = {
  MANROPE: "'Manrope', sans-serif",
  INTER: "'Inter', sans-serif",
  SANS: 'sans-serif',
  SERIF: 'serif',
  MONO: 'monospace'
};

export const SUBTITLE_COLORS: Record<SubColor, string> = {
  WHITE: '#FFFFFF',
  YELLOW: '#FFE14D',
  CYAN: '#5CE1E6',
  GREEN: '#6EE7A0'
};

const VALID_BACKGROUNDS = [0, 0.25, 0.5, 0.75, 1.0];

export function normalizeSubtitleStyle(raw: unknown): SubtitleStyle {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_SUBTITLE_STYLE };
  }

  const obj = raw as Record<string, unknown>;

  const size: SubSize =
    typeof obj.size === 'string' && obj.size in SUBTITLE_SIZES
      ? (obj.size as SubSize)
      : DEFAULT_SUBTITLE_STYLE.size;

  const font: SubFont =
    typeof obj.font === 'string' && obj.font in SUBTITLE_FONTS
      ? (obj.font as SubFont)
      : DEFAULT_SUBTITLE_STYLE.font;

  const color: SubColor =
    typeof obj.color === 'string' && obj.color in SUBTITLE_COLORS
      ? (obj.color as SubColor)
      : DEFAULT_SUBTITLE_STYLE.color;

  const validEdges: SubEdge[] = ['NONE', 'SHADOW', 'OUTLINE', 'RAISED'];
  const edge: SubEdge =
    typeof obj.edge === 'string' && validEdges.includes(obj.edge as SubEdge)
      ? (obj.edge as SubEdge)
      : DEFAULT_SUBTITLE_STYLE.edge;

  const rawBg = typeof obj.background === 'number' ? obj.background : DEFAULT_SUBTITLE_STYLE.background;
  let closestBg = VALID_BACKGROUNDS[0];
  let minDiff = Math.abs(rawBg - closestBg);
  for (const bg of VALID_BACKGROUNDS) {
    const diff = Math.abs(rawBg - bg);
    if (diff < minDiff) {
      minDiff = diff;
      closestBg = bg;
    }
  }

  const rawPos = typeof obj.position === 'number' ? obj.position : DEFAULT_SUBTITLE_STYLE.position;
  const clampedPos = Math.max(-2, Math.min(4, Math.round(rawPos)));

  return {
    size,
    font,
    color,
    edge,
    background: closestBg,
    position: clampedPos
  };
}

const STORAGE_KEY = 'kovies_subtitle_style';

export function loadSubtitleStyle(): SubtitleStyle {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SUBTITLE_STYLE };
    const parsed = JSON.parse(raw);
    return normalizeSubtitleStyle(parsed);
  } catch {
    return { ...DEFAULT_SUBTITLE_STYLE };
  }
}

export function saveSubtitleStyle(style: SubtitleStyle): void {
  try {
    const normalized = normalizeSubtitleStyle(style);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore storage errors (private window / storage quota / blocked)
  }
}

export function subtitleLiftVh(style: SubtitleStyle): number {
  return style.position * 2;
}

export function subtitleCss(style: SubtitleStyle): React.CSSProperties {
  const scale = SUBTITLE_SIZES[style.size] ?? 1.0;
  const fontSize = `calc(clamp(1.05rem, 2.6vw, 2.1rem) * ${scale})`;
  const fontFamily = SUBTITLE_FONTS[style.font] ?? SUBTITLE_FONTS.INTER;
  const color = SUBTITLE_COLORS[style.color] ?? SUBTITLE_COLORS.WHITE;

  let textShadow: string;
  switch (style.edge) {
    case 'NONE':
      textShadow = 'none';
      break;
    case 'SHADOW':
      textShadow = '0 1px 2px rgba(0,0,0,.45), 0 0 12px rgba(0,0,0,.35)';
      break;
    case 'OUTLINE':
      textShadow = '-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000';
      break;
    case 'RAISED':
      textShadow = '2px 2px 0 rgba(0,0,0,.8)';
      break;
    default:
      textShadow = '0 1px 2px rgba(0,0,0,.45), 0 0 12px rgba(0,0,0,.35)';
  }

  const css: React.CSSProperties = {
    fontSize,
    fontFamily,
    color,
    textShadow
  };

  if (style.background > 0) {
    css.backgroundColor = `rgba(0,0,0,${style.background})`;
    css.padding = '0.2em 0.5em';
    css.borderRadius = '0.25rem';
  }

  return css;
}
