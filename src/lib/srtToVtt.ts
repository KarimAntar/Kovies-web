/**
 * Converts SRT subtitle text to WebVTT for HTML5 <track> playback.
 *
 * Handles: UTF-8 BOM, CRLF / CR line endings, comma or dot decimal separators,
 * timestamps without hours (MM:SS,mmm), 1-digit hours/minutes/seconds,
 * short millisecond fields, SRT position suffixes (X1:.. Y1:..), and
 * ASS-style override tags ({\an8}) that browsers would otherwise render.
 */

const TIMESTAMP = String.raw`(?:\d+:)?\d{1,2}:\d{1,2}(?:[.,]\d{1,3})?`;
const TIMING_LINE = new RegExp(String.raw`^\s*(${TIMESTAMP})\s*-->\s*(${TIMESTAMP})(.*)$`);

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

/** Normalise one SRT-ish timestamp into HH:MM:SS.mmm. */
export function normalizeTimestamp(raw: string): string {
  const [clock, fraction = ''] = raw.trim().split(/[.,]/);
  const parts = clock.split(':').map((p) => parseInt(p, 10) || 0);
  while (parts.length < 3) parts.unshift(0);
  const [h, m, s] = parts;
  const ms = parseInt(fraction.padEnd(3, '0').slice(0, 3), 10) || 0;
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)}.${pad(ms, 3)}`;
}

function cleanCueText(line: string): string {
  return line
    .replace(/\{\\[^}]*\}/g, '') // ASS override tags e.g. {\an8}
    .replace(/<\/?font[^>]*>/gi, ''); // <font> is not valid in WebVTT
}

export function srtToVtt(input: string): string {
  if (!input) return 'WEBVTT\n\n';

  const text = input.replace(/^﻿/, '').replace(/\r\n?/g, '\n');

  if (/^WEBVTT/.test(text.trimStart())) {
    return text.trimStart();
  }

  const out: string[] = [];
  for (const line of text.split('\n')) {
    const timing = TIMING_LINE.exec(line);
    if (timing) {
      // Drop SRT coordinates ("X1:100 X2:200 ..."); keep valid VTT cue settings.
      const settings = timing[3].trim();
      const keep = settings && !/X1:|Y1:/i.test(settings) ? ` ${settings}` : '';
      out.push(`${normalizeTimestamp(timing[1])} --> ${normalizeTimestamp(timing[2])}${keep}`);
      continue;
    }
    if (line.trim() === '') {
      out.push('');
      continue;
    }
    // "-->" is reserved in WebVTT cue payloads.
    out.push(cleanCueText(line).replace(/-->/g, '->'));
  }

  return `WEBVTT\n\n${out.join('\n').trim()}\n`;
}

/** Creates a blob URL for a WebVTT string. Callers must revoke it. */
export function createVttBlobUrl(vttContent: string): string {
  const blob = new Blob([vttContent], { type: 'text/vtt;charset=utf-8' });
  return URL.createObjectURL(blob);
}
