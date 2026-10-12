/**
 * Minimal WebVTT parser for the custom subtitle overlay renderer.
 *
 * The player renders cues itself (rather than native ::cue) so subtitles can
 * sit above the control bar and reflow when the controls auto-hide.
 */

export interface VttCue {
  start: number;
  end: number;
  text: string;
}

const TIMING = new RegExp(
  String.raw`((?:\d+:)?\d{1,2}:\d{1,2}(?:[.,]\d{1,3})?)\s*-->\s*((?:\d+:)?\d{1,2}:\d{1,2}(?:[.,]\d{1,3})?)(.*)`
);

export function vttTimeToSeconds(raw: string): number {
  const [clock, fraction = '0'] = raw.trim().split(/[.,]/);
  const parts = clock.split(':').map((p) => parseInt(p, 10) || 0);
  while (parts.length < 3) parts.unshift(0);
  const [h, m, s] = parts;
  const ms = parseInt(fraction.padEnd(3, '0').slice(0, 3), 10) || 0;
  return h * 3600 + m * 60 + s + ms / 1000;
}

function stripMarkup(line: string): string {
  return line
    .replace(/<[^>]+>/g, '') // tags: <b> <i> <c.classname> <v.Name>
    .replace(/\{\\[^}]*\}/g, '') // ASS overrides
    .trim();
}

/** Parse WebVTT (or our converted SRT payload) into plain cues. */
export function parseVtt(vtt: string): VttCue[] {
  if (!vtt) return [];
  const body = vtt.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const start = body.indexOf('\n');
  const blocks = (start < 0 ? '' : body.slice(start + 1)).split(/\n{2,}/);
  const cues: VttCue[] = [];

  for (const block of blocks) {
    const lines = block.split('\n');
    const timingIndex = lines.findIndex((l) => TIMING.test(l));
    if (timingIndex < 0) continue;
    const timing = TIMING.exec(lines[timingIndex]);
    if (!timing) continue;

    const text = lines
      .slice(timingIndex + 1)
      .map(stripMarkup)
      .filter(Boolean)
      .join('\n');
    if (!text) continue;

    const startSec = vttTimeToSeconds(timing[1]);
    const endSec = vttTimeToSeconds(timing[2]);
    if (!Number.isFinite(startSec) || !Number.isFinite(endSec) || endSec <= startSec) continue;
    cues.push({ start: startSec, end: endSec, text });
  }

  return cues.sort((a, b) => a.start - b.start);
}

/** Cues active at `seconds`. `windowSeconds` extends a cue slightly for stability. */
export function activeCues(cues: VttCue[], seconds: number, windowSeconds = 0.15): VttCue[] {
  if (!Number.isFinite(seconds)) return [];
  return cues.filter((c) => seconds >= c.start - windowSeconds && seconds <= c.end + windowSeconds);
}
