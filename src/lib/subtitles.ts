import type { SubtitleTrack } from '../api/types';

const PLAYABLE_FORMATS = new Set(['srt', 'vtt', 'unknown', '']);

export interface SubtitleGroup {
  language: string;
  label: string;
  tracks: SubtitleTrack[];
}

let displayNames: Intl.DisplayNames | null | undefined;

export function languageName(code: string): string {
  const clean = (code || '').trim();
  if (!clean) return 'Unknown';
  if (displayNames === undefined) {
    try {
      displayNames = new Intl.DisplayNames(['en'], { type: 'language' });
    } catch {
      displayNames = null;
    }
  }
  if (displayNames && /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i.test(clean)) {
    try {
      const name = displayNames.of(clean);
      if (name) return name;
    } catch {
      // fall through
    }
  }
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

/** Drop formats the browser can't render (ASS/SSA) and duplicate URLs. */
export function playableSubtitles(tracks: SubtitleTrack[]): SubtitleTrack[] {
  const seen = new Set<string>();
  return tracks.filter((t) => {
    if (!t || typeof t.url !== 'string' || !t.url) return false;
    if (!PLAYABLE_FORMATS.has((t.format || '').toLowerCase())) return false;
    if (seen.has(t.url)) return false;
    seen.add(t.url);
    return true;
  });
}

/** Group by language; English first, then alphabetical by display name. */
export function groupSubtitles(tracks: SubtitleTrack[]): SubtitleGroup[] {
  const groups = new Map<string, SubtitleGroup>();
  for (const track of tracks) {
    const key = (track.language || 'und').toLowerCase();
    const group = groups.get(key) ?? { language: key, label: languageName(key), tracks: [] };
    group.tracks.push(track);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => {
    const aEn = a.language === 'en' || a.language.startsWith('en-') || a.label === 'English';
    const bEn = b.language === 'en' || b.language.startsWith('en-') || b.label === 'English';
    if (aEn !== bEn) return aEn ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
}
