import { test } from 'node:test';
import assert from 'node:assert/strict';
import { srtToVtt } from '../src/lib/srtToVtt.ts';
import { planPlayback, BROWSER_UNSUPPORTED_MESSAGE } from '../src/lib/playback.ts';
import { mapApiUrl } from '../src/lib/apiUrl.ts';
import { playableSubtitles, groupSubtitles } from '../src/lib/subtitles.ts';
import type { StreamingSource, SubtitleTrack } from '../src/api/types.ts';

test('srtToVtt handles CRLF, BOM, commas, and missing hours', () => {
  const srt = '﻿1\r\n00:01:02,123 --> 00:01:05,456\r\nHello world!\r\n\r\n2\r\n02:10,500 --> 02:15,000\r\nLine 2';
  const vtt = srtToVtt(srt);
  assert(vtt.startsWith('WEBVTT\n\n'));
  assert(vtt.includes('00:01:02.123 --> 00:01:05.456'));
  assert(vtt.includes('00:02:10.500 --> 00:02:15.000'));
  assert(vtt.includes('Hello world!'));
});

test('mapApiUrl maps backend relative paths and origin to apiBase', () => {
  assert.equal(
    mapApiUrl('/api/subtitles/subdl/tok123', '/api/k'),
    '/api/k/subtitles/subdl/tok123'
  );
  assert.equal(
    mapApiUrl('https://kovies.kerix.tech/api/subtitles/subdl/tok123', 'https://desktop.api'),
    'https://desktop.api/subtitles/subdl/tok123'
  );
  assert.equal(
    mapApiUrl('https://external.cdn/subs.vtt', '/api/k'),
    'https://external.cdn/subs.vtt'
  );
  assert.equal(mapApiUrl('javascript:alert(1)', '/api/k'), null);
});

test('planPlayback respects web relayUrl and desktop header registration', () => {
  const sourceWithHeaders: StreamingSource = {
    provider: 'stellar',
    type: 'hls',
    url: 'https://provider.stream/master.m3u8',
    relayUrl: 'https://kovies.kerix.tech/api/stream/signed123',
    headers: { Referer: 'https://stellar.gdn' },
    quality: '1080p',
  };

  // Web with relayUrl -> plays relayUrl directly
  const webPlan = planPlayback(sourceWithHeaders, false);
  assert.equal(webPlan.ok, true);
  if (webPlan.ok) {
    assert.equal(webPlan.url, 'https://kovies.kerix.tech/api/stream/signed123');
    assert.equal(webPlan.registerHeaders, null);
  }

  // Web without relayUrl -> shows browser unsupported error
  const noRelay = { ...sourceWithHeaders, relayUrl: undefined };
  const failPlan = planPlayback(noRelay, false);
  assert.equal(failPlan.ok, false);
  if (!failPlan.ok) {
    assert.equal(failPlan.message, BROWSER_UNSUPPORTED_MESSAGE);
  }

  // Desktop -> always plays source.url and registers headers
  const deskPlan = planPlayback(sourceWithHeaders, true);
  assert.equal(deskPlan.ok, true);
  if (deskPlan.ok) {
    assert.equal(deskPlan.url, 'https://provider.stream/master.m3u8');
    assert.deepEqual(deskPlan.registerHeaders, { Referer: 'https://stellar.gdn' });
  }

  // Clean stream (no headers) -> web plays direct URL
  const cleanSource: StreamingSource = {
    provider: 'vidsrc',
    type: 'hls',
    url: 'https://clean.stream/index.m3u8',
    quality: '1080p',
  };
  const cleanPlan = planPlayback(cleanSource, false);
  assert.equal(cleanPlan.ok, true);
  if (cleanPlan.ok) {
    assert.equal(cleanPlan.url, 'https://clean.stream/index.m3u8');
  }
});

test('playableSubtitles filters duplicates and unrenderable formats', () => {
  const tracks: SubtitleTrack[] = [
    { language: 'en', label: 'English', url: '/api/subtitles/1', format: 'srt' },
    { language: 'en', label: 'English Dup', url: '/api/subtitles/1', format: 'srt' },
    { language: 'ja', label: 'Japanese', url: '/api/subtitles/2', format: 'ass' },
    { language: 'es', label: 'Spanish', url: '/api/subtitles/3', format: 'vtt' },
  ];
  const filtered = playableSubtitles(tracks);
  assert.equal(filtered.length, 2);
  assert.equal(filtered[0].language, 'en');
  assert.equal(filtered[1].language, 'es');

  const groups = groupSubtitles(filtered);
  assert.equal(groups[0].language, 'en');
  assert.equal(groups[0].label, 'English');
});

import { parseVtt, activeCues } from '../src/lib/vtt.ts';

test('parseVtt extracts timed cues and activeCues filters by seconds', () => {
  const vtt = [
    'WEBVTT',
    '',
    '1',
    '00:00:05.000 --> 00:00:08.500',
    'because you\'re very good',
    'at telling when I\'m lying',
    '',
    '2',
    '00:00:10.000 --> 00:00:12.000',
    '<b>That doesn\'t feel</b> zeroed in to me',
  ].join('\n');
  const cues = parseVtt(vtt);
  assert.equal(cues.length, 2);
  assert.equal(cues[0].start, 5);
  assert.equal(cues[0].end, 8.5);
  assert.equal(cues[0].text, "because you're very good\nat telling when I'm lying");
  assert.equal(cues[1].text, "That doesn't feel zeroed in to me");
  assert.equal(activeCues(cues, 6).length, 1);
  assert.equal(activeCues(cues, 9).length, 0);
});

test('api client deleteHistory formats request URL with optional query parameters', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = '';
  let requestedMethod = '';
  globalThis.fetch = async (url, options) => {
    requestedUrl = String(url);
    requestedMethod = options?.method ?? 'GET';
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const { api } = await import('../src/api/client.ts');
    // movie without season/episode
    const resMovie = await api.deleteHistory('movie', 550);
    assert.equal(resMovie.success, true);
    assert.equal(requestedMethod, 'DELETE');
    assert.equal(requestedUrl.endsWith('/user/history/movie/550'), true);

    // tv with season & episode query params
    const resTv = await api.deleteHistory('tv', 1234, 2, 5);
    assert.equal(resTv.success, true);
    assert.equal(requestedMethod, 'DELETE');
    assert.equal(requestedUrl.includes('/user/history/tv/1234?seasonNumber=2&episodeNumber=5'), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

import { fetchSkipSegments } from '../src/lib/introdb.ts';

test('fetchSkipSegments parses and caches TheIntroDB responses', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = '';
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return new Response(
      JSON.stringify({
        tmdb_id: 1399,
        intro: [{ start_ms: 85000, end_ms: 175000 }],
        recap: [{ start_ms: 0, end_ms: 45000 }],
        credits: [{ start_ms: 3200000, end_ms: 3350000 }],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  try {
    const segments = await fetchSkipSegments(1399, 'tv', 1, 1);
    assert.ok(segments);
    assert.equal(segments.intro?.startSec, 85);
    assert.equal(segments.intro?.endSec, 175);
    assert.equal(segments.recap?.startSec, 0);
    assert.equal(segments.recap?.endSec, 45);
    assert.equal(segments.credits?.startSec, 3200);
    assert.equal(segments.credits?.endSec, 3350);
    assert.equal(requestedUrl.includes('tmdb_id=1399&season=1&episode=1'), true);

    // Test caching (fetch should not be called again)
    globalThis.fetch = () => { throw new Error('Must use cache'); };
    const cached = await fetchSkipSegments(1399, 'tv', 1, 1);
    assert.deepEqual(cached, segments);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
