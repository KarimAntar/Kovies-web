import { loadSubtitleStyle, saveSubtitleStyle, subtitleCss, subtitleLiftVh, type SubtitleStyle } from '../../lib/subtitleStyle';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  RotateCw,
  Subtitles,
  Settings,
  ArrowLeft,
  Loader2,
  SkipForward,
  FastForward,
} from 'lucide-react';
import type { MediaItem, MediaType, ReleaseWindow, SourcesResponse, StreamingSource, SubtitleTrack } from '../../api/types';
import { releaseNotice, type ReleaseNoticeText } from '../../lib/releaseNotice';
import { api, errorMessage, isAbortError } from '../../api/client';
import { createVttBlobUrl, srtToVtt } from '../../lib/srtToVtt';
import { planPlayback, BROWSER_UNSUPPORTED_MESSAGE } from '../../lib/playback';
import { parseVtt, activeCues, type VttCue } from '../../lib/vtt';
import { fetchSkipSegments, type SkipSegments } from '../../lib/introdb';
import { loadSources } from '../../lib/sourceCache';
import { groupSubtitles, playableSubtitles } from '../../lib/subtitles';
import { desktop, isDesktop } from '../../platform';
import { useWatchlist } from '../../context/WatchlistContext';
import { useProgressReporter } from './useProgressReporter';
import { SettingsMenu, SubtitleMenu } from './PlayerMenus';

const CONTROLS_IDLE_MS = 3000;
const SUBTITLE_PREF_KEY = 'kovies_subtitle_lang';
const SUBTITLE_TITLE_KEY_PREFIX = 'kovies_sub_track:';

function titleSubKey(tmdbId: number, mediaType: string, season?: number, episode?: number): string {
  return `${SUBTITLE_TITLE_KEY_PREFIX}${mediaType}:${tmdbId}:${season ?? ''}:${episode ?? ''}`;
}

function readSavedTrackUrl(tmdbId: number, mediaType: string, season?: number, episode?: number): string | null {
  try {
    return localStorage.getItem(titleSubKey(tmdbId, mediaType, season, episode));
  } catch {
    return null;
  }
}

function writeSavedTrackUrl(tmdbId: number, mediaType: string, season: number | undefined, episode: number | undefined, url: string | null): void {
  try {
    const k = titleSubKey(tmdbId, mediaType, season, episode);
    if (url) localStorage.setItem(k, url);
    else localStorage.removeItem(k);
  } catch {
    // ignore
  }
}

interface VideoPlayerProps {
  media: MediaItem;
  seasonNumber?: number;
  episodeNumber?: number;
  episodeName?: string | null;
  initialSource?: StreamingSource;
  onClose: () => void;
  /** TV only: move to the next/previous episode (remounts the player). */
  onNavigateEpisode?: (delta: 1 | -1) => void;
}

/** Preferred subtitle language: English unless the viewer picked another one or turned them off. */
function readSubtitlePref(): string | null {
  try {
    const value = localStorage.getItem(SUBTITLE_PREF_KEY);
    if (value === 'off') return null;
    return value || 'en';
  } catch {
    return 'en';
  }
}

function writeSubtitlePref(lang: string | null): void {
  try {
    localStorage.setItem(SUBTITLE_PREF_KEY, lang || 'off');
  } catch {
    // ignore
  }
}

function formatTime(secs: number): string {
  if (!Number.isFinite(secs) || secs < 0) return '0:00';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

const isPlayableHere = (s: StreamingSource) => planPlayback(s, isDesktop).ok;

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  media,
  seasonNumber,
  episodeNumber,
  episodeName,
  initialSource,
  onClose,
  onNavigateEpisode,
}) => {
  const { recordProgress, findProgress } = useWatchlist();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const trackElRef = useRef<HTMLTrackElement>(null);

  const tmdbId = media.tmdbId || media.id;
  const mediaType: MediaType = (media.type || media.media_type || 'movie') as MediaType;
  const title = media.title || media.name || 'Untitled';
  const isTv = mediaType === 'tv';
  const season = isTv ? seasonNumber ?? 1 : undefined;
  const episode = isTv ? episodeNumber ?? 1 : undefined;

  // ---------------------------------------------------------------------------
  // Sources
  // ---------------------------------------------------------------------------
  const [sources, setSources] = useState<StreamingSource[]>(initialSource ? [initialSource] : []);
  const [sourceIndex, setSourceIndex] = useState<number>(-1);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [attachKey, setAttachKey] = useState(0);
  const [isBuffering, setIsBuffering] = useState(true);
  const [streamError, setStreamError] = useState<string | null>(null);
  // Set when a movie has no stream because it is still in (or not yet in) cinemas.
  const [releaseInfo, setReleaseInfo] = useState<ReleaseNoticeText | null>(null);
  const currentSource = sourceIndex >= 0 ? sources[sourceIndex] ?? null : null;

  // Resume position (seconds) — taken once from Continue Watching.
  const pendingSeekRef = useRef<number | null>(null);
  useEffect(() => {
    if (pendingSeekRef.current === null) {
      const entry = findProgress(tmdbId, mediaType, season, episode);
      if (entry && !entry.completed && entry.progress < 0.95) {
        const secs = entry.position / 1000;
        if (secs > 5) pendingSeekRef.current = secs;
      }
    }
  }, [tmdbId, mediaType, season, episode, findProgress]);

  // ---------------------------------------------------------------------------
  // Playback state
  // ---------------------------------------------------------------------------
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [openMenu, setOpenMenu] = useState<'subtitles' | 'settings' | null>(null);
  const [scrubTime, setScrubTime] = useState<number | null>(null);

  // ---------------------------------------------------------------------------
  // Subtitles
  // ---------------------------------------------------------------------------
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([]);
  const [subtitleListLoading, setSubtitleListLoading] = useState(true);
  const [activeSubtitle, setActiveSubtitle] = useState<SubtitleTrack | null>(null);
  const [subtitleBlobUrl, setSubtitleBlobUrl] = useState<string | null>(null);
  const [subtitleLoading, setSubtitleLoading] = useState(false);
  const [subtitleError, setSubtitleError] = useState<string | null>(null);
  const [subtitleCues, setSubtitleCues] = useState<VttCue[]>([]);
  const [subtitleOffsetSec, setSubtitleOffsetSec] = useState<number>(0);
  const [subStyle, setSubStyle] = useState<SubtitleStyle>(() => loadSubtitleStyle());
  const handleStyleChange = (s: SubtitleStyle) => {
    saveSubtitleStyle(s);
    setSubStyle(s);
  };
  const [skipSegments, setSkipSegments] = useState<SkipSegments | null>(null);
  const subtitleAbortRef = useRef<AbortController | null>(null);
  const subtitleGroups = useMemo(() => groupSubtitles(subtitleTracks), [subtitleTracks]);

  // ---------------------------------------------------------------------------
  // Progress reporting (ms)
  // ---------------------------------------------------------------------------
  const progressHandlers = useProgressReporter(
    videoRef,
    {
      tmdbId,
      mediaType,
      title,
      seasonNumber: season ?? null,
      episodeNumber: episode ?? null,
      episodeName: episodeName ?? null,
      posterPath: media.poster_path || media.poster || null,
      backdropPath: media.backdrop_path || media.backdrop || null,
    },
    recordProgress
  );

  // ---------------------------------------------------------------------------
  // TheIntroDB Skip Segments (Option E)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const controller = new AbortController();
    // introdb.app needs the IMDb id; list cards often lack it, so read it from details.
    const resolveImdbId = async (): Promise<string | undefined> => {
      if (media.imdbId) return media.imdbId;
      try {
        const details = mediaType === 'tv'
          ? await api.getTVDetails(tmdbId, controller.signal)
          : await api.getMovieDetails(tmdbId, controller.signal);
        return details.imdbId ?? undefined;
      } catch {
        return undefined;
      }
    };
    resolveImdbId()
      .then((imdbId) => fetchSkipSegments(tmdbId, mediaType, season, episode, controller.signal, imdbId))
      .then((segments) => {
        if (!controller.signal.aborted) {
          setSkipSegments(segments);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setSkipSegments(null);
        }
      });
    return () => controller.abort();
  }, [tmdbId, mediaType, season, episode, media.imdbId]);

  // ---------------------------------------------------------------------------
  // Load sources + subtitle list (cancelled when the title/episode changes)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const pickSource = (list: StreamingSource[], releaseWindow?: ReleaseWindow) => {
      setSources(list);
      if (list.length === 0) {
        const notice = releaseNotice(releaseWindow, title);
        setSourceIndex(-1);
        setReleaseInfo(notice);
        setStreamError(notice?.body ?? 'No streams currently available for this title.');
        return;
      }
      const playable = list.findIndex(isPlayableHere);
      if (playable >= 0) {
        setSourceIndex(playable);
      } else {
        setSourceIndex(0);
        setStreamError(isDesktop ? 'No valid stream URL was returned for this title.' : BROWSER_UNSUPPORTED_MESSAGE);
      }
    };

    setSourcesLoading(true);
    setStreamError(null);
    setReleaseInfo(null);

    // Reuses the lookup the details modal prefetched (finished or still in flight); ranked best quality first.
    const sourcesPromise = initialSource
      ? Promise.resolve<Pick<SourcesResponse, 'sources' | 'releaseWindow'>>({ sources: [initialSource] })
      : loadSources(tmdbId, isTv ? 'tv' : 'movie', season, episode);

    sourcesPromise
      .then((res) => {
        if (signal.aborted) return;
        const list = Array.isArray(res?.sources) ? res.sources : [];
        pickSource(list, res?.releaseWindow);
        // Fallback subtitles embedded in sources (used if the list endpoint fails).
        const embedded = list.flatMap((s) => s.subtitles ?? []);
        if (embedded.length) {
          setSubtitleTracks((prev) => (prev.length ? prev : playableSubtitles(embedded)));
        }
      })
      .catch((err) => {
        if (signal.aborted || isAbortError(err)) return;
        const msg = errorMessage(err, 'No streams currently available for this title.');
        setStreamError(msg === 'Not found' || msg.includes('404') ? 'No streams currently available for this title.' : msg);
      })
      .finally(() => {
        if (!signal.aborted) setSourcesLoading(false);
      });

    setSubtitleListLoading(true);
    api
      .getSubtitles(mediaType, tmdbId, season, episode, signal)
      .then((res) => {
        if (signal.aborted) return;
        const list = playableSubtitles(Array.isArray(res?.subtitles) ? res.subtitles : []);
        if (list.length) setSubtitleTracks(list);
      })
      .catch(() => {
        // subtitles are optional
      })
      .finally(() => {
        if (!signal.aborted) setSubtitleListLoading(false);
      });

    return () => controller.abort();
  }, [tmdbId, mediaType, isTv, season, episode, initialSource]);

  // ---------------------------------------------------------------------------
  // Attach stream (hls.js / native HLS / progressive)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentSource) return;

    const plan = planPlayback(currentSource, isDesktop);
    if (!plan.ok) {
      setStreamError(plan.message);
      return;
    }

    let cancelled = false;
    let hls: Hls | null = null;
    let networkRetries = 0;
    let mediaRecoveries = 0;
    setStreamError(null);
    setIsBuffering(true);

    const fail = (message: string) => {
      if (cancelled) return;
      setStreamError(message);
      setIsBuffering(false);
    };

    const start = async () => {
      if (plan.registerHeaders && desktop) {
        try {
          await desktop.registerStreamHeaders(currentSource.url, plan.registerHeaders);
        } catch {
          fail('Could not prepare this stream. Try another source.');
          return;
        }
      }
      if (cancelled) return;

      const autoplay = () => {
        video.play().catch(() => setIsPlaying(false));
      };

      if (plan.kind === 'mp4') {
        video.src = plan.url;
        autoplay();
        return;
      }

      if (Hls.isSupported()) {
        hls = new Hls({ enableWorker: true, backBufferLength: 90 });
        hls.subtitleDisplay = false;
        hls.on(Hls.Events.MANIFEST_PARSED, autoplay);
        hls.on(Hls.Events.ERROR, (_evt, data) => {
          if (!data.fatal || !hls) return;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRetries < 2) {
            networkRetries += 1;
            hls.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRecoveries < 2) {
            mediaRecoveries += 1;
            if (mediaRecoveries === 2) hls.swapAudioCodec();
            hls.recoverMediaError();
          } else {
            fail(
              data.type === Hls.ErrorTypes.NETWORK_ERROR
                ? 'The stream server could not be reached. Try another source.'
                : 'This stream could not be played. Try another source.'
            );
            hls.destroy();
            hls = null;
          }
        });
        hls.loadSource(plan.url);
        hls.attachMedia(video);
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = plan.url;
        autoplay();
      } else {
        fail('HLS streaming is not supported by this browser.');
      }
    };

    void start();

    return () => {
      cancelled = true;
      if (hls) {
        hls.destroy();
        hls = null;
      }
      video.removeAttribute('src');
      video.load();
    };
  }, [currentSource, attachKey]);

  // Subtitle blob lifecycle: revoke the previous URL whenever it changes / on unmount.
  useEffect(() => {
    if (!subtitleBlobUrl) return;
    return () => URL.revokeObjectURL(subtitleBlobUrl);
  }, [subtitleBlobUrl]);

  // Keep the blob track loaded (for persistence/inspection) but disable native
  // rendering: cues are drawn by the custom overlay so they clear the controls.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    for (let i = 0; i < video.textTracks.length; i += 1) {
      video.textTracks[i].mode = 'disabled';
    }
  }, [subtitleBlobUrl]);

  useEffect(() => () => subtitleAbortRef.current?.abort(), []);

  const selectSubtitle = useCallback((track: SubtitleTrack | null, remember = true) => {
    subtitleAbortRef.current?.abort();
    setSubtitleError(null);
    setSubtitleOffsetSec(0);
    setActiveSubtitle(track);
    if (remember) {
      writeSubtitlePref(track ? track.language : null);
      writeSavedTrackUrl(tmdbId, mediaType, season, episode, track ? track.url : null);
    }
    if (!track) {
      setSubtitleCues([]);
      setSubtitleBlobUrl(null);
      setSubtitleLoading(false);
      return;
    }
    const controller = new AbortController();
    subtitleAbortRef.current = controller;
    setSubtitleLoading(true);
    api
      .fetchSubtitleContent(track.url, controller.signal)
      .then((raw) => {
        if (controller.signal.aborted) return;
        const vtt = srtToVtt(raw);
        setSubtitleCues(parseVtt(vtt));
        setSubtitleBlobUrl(createVttBlobUrl(vtt));
      })
      .catch((err) => {
        if (controller.signal.aborted || isAbortError(err)) return;
        setSubtitleError('Could not load that subtitle. Try another one.');
        setActiveSubtitle(null);
        setSubtitleCues([]);
        setSubtitleBlobUrl(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setSubtitleLoading(false);
      });
  }, []);

  // Restore the exact subtitle track previously chosen for this title (or fall back to preferred language).
  const autoSubtitleDoneRef = useRef(false);
  useEffect(() => {
    if (autoSubtitleDoneRef.current || subtitleTracks.length === 0) return;
    autoSubtitleDoneRef.current = true;
    const pref = readSubtitlePref();
    if (!pref) return; // User explicitly turned subtitles off
    const savedUrl = readSavedTrackUrl(tmdbId, mediaType, season, episode);
    const match = (savedUrl ? subtitleTracks.find((t) => t.url === savedUrl) : null)
      || subtitleTracks.find((t) => t.language === pref);
    if (match) selectSubtitle(match, false);
  }, [subtitleTracks, selectSubtitle, tmdbId, mediaType, season, episode]);

  // ---------------------------------------------------------------------------
  // Controls auto-hide
  // ---------------------------------------------------------------------------
  const idleTimerRef = useRef<number | null>(null);
  const hideBlockedRef = useRef(false);
  useEffect(() => {
    hideBlockedRef.current = !isPlaying || openMenu !== null || scrubTime !== null;
  }, [isPlaying, openMenu, scrubTime]);

  const poke = useCallback(() => {
    setShowControls(true);
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => {
      if (!hideBlockedRef.current) setShowControls(false);
    }, CONTROLS_IDLE_MS);
  }, []);

  useEffect(() => {
    poke();
  }, [isPlaying, openMenu, poke]);

  useEffect(
    () => () => {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.currentSrc) return;
    if (video.paused || video.ended) video.play().catch(() => setIsPlaying(false));
    else video.pause();
  }, []);

  const seekBy = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
  }, []);

  const changeVolume = useCallback((next: number) => {
    const video = videoRef.current;
    if (!video) return;
    const clamped = Math.round(Math.max(0, Math.min(1, next)) * 100) / 100;
    video.volume = clamped;
    video.muted = clamped === 0;
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    if (!video.muted && video.volume === 0) video.volume = 0.5;
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else el.requestFullscreen?.().catch(() => {});
  }, []);

  const toggleCaptions = useCallback(() => {
    if (activeSubtitle) {
      selectSubtitle(null);
      return;
    }
    const pref = readSubtitlePref();
    const pick =
      (pref && subtitleTracks.find((t) => t.language === pref)) ||
      subtitleTracks.find((t) => t.language === 'en' || t.language.startsWith('en-')) ||
      subtitleTracks[0];
    if (pick) selectSubtitle(pick);
  }, [activeSubtitle, subtitleTracks, selectSubtitle]);

  const changeRate = useCallback((rate: number) => {
    if (videoRef.current) videoRef.current.playbackRate = rate;
    setPlaybackRate(rate);
    setOpenMenu(null);
  }, []);

  const switchSource = useCallback(
    (index: number) => {
      const video = videoRef.current;
      if (video && video.currentTime > 5) pendingSeekRef.current = video.currentTime;
      setOpenMenu(null);
      if (index === sourceIndex) setAttachKey((k) => k + 1);
      else setSourceIndex(index);
    },
    [sourceIndex]
  );

  const nextPlayableIndex = useMemo(() => {
    for (let step = 1; step <= sources.length; step += 1) {
      const idx = (sourceIndex + step) % sources.length;
      if (idx !== sourceIndex && isPlayableHere(sources[idx])) return idx;
    }
    return -1;
  }, [sources, sourceIndex]);

  // Fullscreen state + body scroll lock.
  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      document.body.style.overflow = previousOverflow;
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

  const shownTime = scrubTime ?? currentTime;

  const activeSkip = useMemo(() => {
    if (!skipSegments) return null;
    const t = shownTime;
    if (skipSegments.recap && t >= skipSegments.recap.startSec && t < skipSegments.recap.endSec) {
      return {
        type: 'recap' as const,
        label: 'Skip Recap',
        targetSec: skipSegments.recap.endSec + 0.5,
        isNextEpisode: false,
      };
    }
    if (skipSegments.intro && t >= skipSegments.intro.startSec && t < skipSegments.intro.endSec) {
      return {
        type: 'intro' as const,
        label: 'Skip Intro',
        targetSec: skipSegments.intro.endSec + 0.5,
        isNextEpisode: false,
      };
    }
    if (skipSegments.credits && t >= skipSegments.credits.startSec && t < skipSegments.credits.endSec) {
      return {
        type: 'credits' as const,
        label: isTv && onNavigateEpisode ? 'Next Episode' : 'Skip Credits',
        targetSec: skipSegments.credits.endSec + 0.5,
        isNextEpisode: isTv && Boolean(onNavigateEpisode),
      };
    }
    return null;
  }, [skipSegments, shownTime, isTv, onNavigateEpisode]);

  const handleSkip = useCallback(() => {
    if (!activeSkip) return;
    if (activeSkip.isNextEpisode && onNavigateEpisode) {
      onNavigateEpisode(1);
    } else {
      const video = videoRef.current;
      if (video) {
        const dest = Math.min(video.duration || activeSkip.targetSec, activeSkip.targetSec);
        video.currentTime = dest;
        setCurrentTime(dest);
      }
    }
  }, [activeSkip, onNavigateEpisode]);

  // ---------------------------------------------------------------------------
  // Keyboard + desktop media keys (latest actions via ref → single listener)
  // ---------------------------------------------------------------------------
  const actionsRef = useRef({
    togglePlay,
    seekBy,
    changeVolume,
    toggleMute,
    toggleFullscreen,
    toggleCaptions,
    handleSkip,
    activeSkip,
    onClose,
    onNavigateEpisode,
    poke,
    openMenu,
    setOpenMenu,
  });
  useEffect(() => {
    actionsRef.current = {
      togglePlay,
      seekBy,
      changeVolume,
      toggleMute,
      toggleFullscreen,
      toggleCaptions,
      handleSkip,
      activeSkip,
      onClose,
      onNavigateEpisode,
      poke,
      openMenu,
      setOpenMenu,
    };
  }, [
    togglePlay,
    seekBy,
    changeVolume,
    toggleMute,
    toggleFullscreen,
    toggleCaptions,
    handleSkip,
    activeSkip,
    onClose,
    onNavigateEpisode,
    poke,
    openMenu,
  ]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
      const a = actionsRef.current;
      const video = videoRef.current;
      switch (e.key) {
        case ' ':
        case 'Spacebar':
          if (tag === 'BUTTON') return; // let the focused button activate
          e.preventDefault();
          a.togglePlay();
          break;
        case 'k':
        case 'K':
          e.preventDefault();
          a.togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          a.seekBy(-10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          a.seekBy(10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          a.changeVolume((video?.muted ? 0 : video?.volume ?? 1) + 0.05);
          break;
        case 'ArrowDown':
          e.preventDefault();
          a.changeVolume((video?.muted ? 0 : video?.volume ?? 1) - 0.05);
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          a.toggleFullscreen();
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          a.toggleMute();
          break;
        case 'c':
        case 'C':
          e.preventDefault();
          a.toggleCaptions();
          break;
        case 's':
        case 'S':
          if (a.activeSkip) {
            e.preventDefault();
            a.handleSkip();
          }
          break;
        case 'Escape':
          e.preventDefault();
          if (a.openMenu) a.setOpenMenu(null);
          else if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
          else a.onClose();
          break;
        default:
          return;
      }
      a.poke();
    };
    window.addEventListener('keydown', onKeyDown);

    const unsubscribeMediaKeys = desktop?.onMediaKey((key) => {
      const a = actionsRef.current;
      if (key === 'playpause') a.togglePlay();
      else if (key === 'stop') a.onClose();
      else if (key === 'next') {
        if (a.onNavigateEpisode) a.onNavigateEpisode(1);
        else a.seekBy(10);
      } else if (key === 'previous') {
        const v = videoRef.current;
        if (v && v.currentTime > 10) v.currentTime = 0;
        else if (a.onNavigateEpisode) a.onNavigateEpisode(-1);
        else a.seekBy(-10);
      }
      a.poke();
    });

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      unsubscribeMediaKeys?.();
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Scrubber (pointer events — mouse, touch and pen)
  // ---------------------------------------------------------------------------
  const timeAtPointer = (clientX: number): number => {
    const bar = progressBarRef.current;
    if (!bar || duration <= 0) return 0;
    const rect = bar.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * duration;
  };

  const onScrubStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setScrubTime(timeAtPointer(e.clientX));
  };
  const onScrubMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (scrubTime === null) return;
    setScrubTime(timeAtPointer(e.clientX));
  };
  const onScrubEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (scrubTime === null) return;
    const t = timeAtPointer(e.clientX);
    if (videoRef.current) videoRef.current.currentTime = t;
    setCurrentTime(t);
    setScrubTime(null);
  };

  // ---------------------------------------------------------------------------
  // Video element events
  // ---------------------------------------------------------------------------
  const onLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    const resume = pendingSeekRef.current;
    if (resume !== null && Number.isFinite(video.duration) && resume < video.duration - 5) {
      video.currentTime = resume;
    }
    pendingSeekRef.current = null;
    video.playbackRate = playbackRate;
  };

  const onTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    if (scrubTime === null) setCurrentTime(video.currentTime);
    if (video.buffered.length > 0) setBuffered(video.buffered.end(video.buffered.length - 1));
    progressHandlers.onTimeUpdate();
  };

  const onVolumeChange = () => {
    const video = videoRef.current;
    if (!video) return;
    setVolume(video.volume);
    setIsMuted(video.muted || video.volume === 0);
  };

  const loading = !streamError && (sourcesLoading || isBuffering);
  // Hide subtitle overlay while the video is still buffering at startup.
  const showSubtitleOverlay =
    !loading && isPlaying && subtitleCues.length > 0
      ? activeCues(subtitleCues, shownTime + subtitleOffsetSec)
      : [];
  // Native macOS traffic lights sit over the window's top-left corner.
  const isMacDesktop = desktop?.platform === 'darwin';

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-label={`Playing ${title}`}
      onPointerMove={poke}
      onPointerDown={poke}
      className={`fixed inset-0 z-50 bg-black flex items-center justify-center select-none overflow-hidden ${
        showControls ? '' : 'cursor-none'
      }`}
    >
      <video
        ref={videoRef}
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        onPlay={() => setIsPlaying(true)}
        onPause={() => {
          setIsPlaying(false);
          progressHandlers.onPause();
        }}
        onEnded={() => {
          setIsPlaying(false);
          progressHandlers.onEnded();
        }}
        onSeeked={progressHandlers.onSeeked}
        onTimeUpdate={onTimeUpdate}
        onDurationChange={() => {
          const d = videoRef.current?.duration;
          if (d && Number.isFinite(d)) setDuration(d);
        }}
        onLoadedMetadata={onLoadedMetadata}
        onVolumeChange={onVolumeChange}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onCanPlay={() => setIsBuffering(false)}
        onError={() => {
          // hls.js reports its own errors; this covers native/progressive playback.
          const video = videoRef.current;
          if (video?.error && !Hls.isSupported()) {
            setStreamError('This stream could not be played. Try another source.');
          } else if (video?.error && video.currentSrc && !video.currentSrc.startsWith('blob:')) {
            setStreamError('This stream could not be played. Try another source.');
          }
        }}
        className="w-full h-full object-contain"
        playsInline
        preload="auto"
      >
        {subtitleBlobUrl && activeSubtitle && (
          <track
            key={subtitleBlobUrl}
            ref={trackElRef}
            kind="subtitles"
            src={subtitleBlobUrl}
            srcLang={activeSubtitle.language}
            label={activeSubtitle.label || activeSubtitle.language}
            default
          />
        )}
      </video>

      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 pointer-events-none z-20">
          <Loader2 className="w-14 h-14 text-primary animate-spin mb-3" />
          <p className="text-white text-sm font-semibold tracking-wide">
            {sourcesLoading ? 'Finding the best stream…' : 'Buffering…'}
          </p>
        </div>
      )}

      {streamError && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-surface-950/95 p-6">
          <div role="alert" className="max-w-lg text-center flex flex-col items-center">
            <img
              src="/kovies-symbol.png"
              alt="Kovies"
              className="w-16 h-16 mb-5 object-contain"
            />
            <h3 className="font-title text-2xl font-bold text-white mb-3">{releaseInfo?.title ?? 'Playback unavailable'}</h3>
            <p className="text-sm text-gray-300 mb-6 leading-relaxed max-w-md mx-auto">{typeof streamError === 'string' ? streamError : errorMessage(streamError, 'No streams currently available for this title.')}</p>
            <div className="flex flex-wrap justify-center gap-3">
              {nextPlayableIndex >= 0 && (
                <button
                  onClick={() => switchSource(nextPlayableIndex)}
                  className="px-5 py-2.5 rounded-full bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  Try another source
                </button>
              )}
              {currentSource && isPlayableHere(currentSource) && (
                <button
                  onClick={() => switchSource(sourceIndex)}
                  className="px-5 py-2.5 rounded-full bg-surface-800 hover:bg-surface-700 text-gray-200 text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Retry
                </button>
              )}
              <button
                onClick={onClose}
                autoFocus
                className="px-5 py-2.5 rounded-full bg-surface-800 hover:bg-surface-700 text-gray-200 text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom subtitle overlay: sits above the control bar, drops when it hides */}
      {showSubtitleOverlay.length > 0 && !streamError && (
        <div
          aria-live="polite"
          className="pointer-events-none absolute inset-x-0 z-20 flex flex-col items-center gap-1 px-6 text-center"
          style={{
            // Low by default; lifted above the control bar while it is visible (never faded) + custom position lift
            bottom: `calc(${showControls ? '7.5rem' : '4vh'} + ${subtitleLiftVh(subStyle)}vh)`,
            transition: 'bottom 220ms ease',
          }}
        >
          {showSubtitleOverlay.map((cue, i) => (
            <span
              key={`${cue.start}-${i}`}
              className="kovies-subtitle"
              style={subtitleCss(subStyle)}
            >
              {cue.text.split('\n').map((line, j) => (
                <span key={j} className="block">
                  {line}
                </span>
              ))}
            </span>
          ))}
        </div>
      )}

      {/* Netflix-style Skip Button */}
      {activeSkip && !streamError && (
        <div
          className="absolute right-6 sm:right-10 z-30 pointer-events-auto transition-all duration-300"
          style={{
            bottom: showControls ? '6.5rem' : '2.5rem',
          }}
        >
          <button
            type="button"
            onClick={handleSkip}
            className="group flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-surface-900/90 hover:bg-surface-800 text-white font-semibold text-xs sm:text-sm border border-surface-600/80 hover:border-primary/60 backdrop-blur-xl shadow-2xl shadow-black/80 hover:scale-105 active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            title={`${activeSkip.label} (S)`}
          >
            <FastForward className="w-4 h-4 text-primary group-hover:translate-x-0.5 transition-transform" />
            <span>{activeSkip.label}</span>
            <span className="hidden sm:inline text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-800 text-gray-400 border border-surface-700">
              S
            </span>
          </button>
        </div>
      )}

      <div
        className={`absolute inset-0 flex flex-col justify-between pointer-events-none transition-opacity duration-300 z-20 ${
          showControls || streamError ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Top bar */}
        <div
          className="p-3 sm:p-6 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between gap-3 pointer-events-auto"
          style={{
            paddingTop: 'calc(var(--titlebar-h, 0px) + 0.75rem)',
            paddingLeft: isMacDesktop ? '5.5rem' : undefined,
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onClose}
              aria-label="Close player (Esc)"
              title="Close player (Esc)"
              className="p-2.5 rounded-full bg-surface-900/60 hover:bg-surface-800 text-gray-200 hover:text-white border border-white/10 backdrop-blur-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h2 className="font-title text-base sm:text-lg font-bold text-white drop-shadow truncate">{title}</h2>
              {isTv && (
                <p className="text-xs text-primary-hover font-medium truncate">
                  S{season} · E{episode}
                  {episodeName ? ` — ${episodeName}` : ''}
                </p>
              )}
            </div>
          </div>
          {currentSource && (
            <span className="hidden sm:inline uppercase text-xs font-bold px-2.5 py-1 rounded-md bg-surface-800/80 border border-primary/40 text-primary-hover backdrop-blur-md">
              {currentSource.quality || 'Auto'}
            </span>
          )}
        </div>

        {/* Bottom bar */}
        <div className="p-3 sm:p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent space-y-3 pointer-events-auto">
          <div
            ref={progressBarRef}
            role="slider"
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(shownTime)}
            aria-valuetext={`${formatTime(shownTime)} of ${formatTime(duration)}`}
            onPointerDown={onScrubStart}
            onPointerMove={onScrubMove}
            onPointerUp={onScrubEnd}
            onPointerCancel={() => setScrubTime(null)}
            className="group/scrub relative w-full h-2 hover:h-3 bg-white/20 rounded-full cursor-pointer transition-all duration-150 touch-none"
          >
            <div
              className="absolute left-0 top-0 bottom-0 bg-white/30 rounded-full pointer-events-none"
              style={{ width: `${duration > 0 ? Math.min(100, (buffered / duration) * 100) : 0}%` }}
            />
            <div
              className="absolute left-0 top-0 bottom-0 bg-primary rounded-full pointer-events-none"
              style={{ width: `${duration > 0 ? Math.min(100, (shownTime / duration) * 100) : 0}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-4 h-4 rounded-full bg-white shadow-lg opacity-0 group-hover/scrub:opacity-100 transition-opacity" />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-1 sm:gap-3 min-w-0">
              <ControlButton label={isPlaying ? 'Pause (Space)' : 'Play (Space)'} onClick={togglePlay}>
                {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
              </ControlButton>
              <ControlButton label="Back 10 seconds (←)" onClick={() => seekBy(-10)} className="hidden xs:inline-flex sm:inline-flex">
                <RotateCcw className="w-5 h-5" />
              </ControlButton>
              <ControlButton label="Forward 10 seconds (→)" onClick={() => seekBy(10)} className="hidden xs:inline-flex sm:inline-flex">
                <RotateCw className="w-5 h-5" />
              </ControlButton>
              {isTv && onNavigateEpisode && (
                <ControlButton label="Next episode" onClick={() => onNavigateEpisode(1)}>
                  <SkipForward className="w-5 h-5" />
                </ControlButton>
              )}
              <div className="flex items-center gap-1">
                <ControlButton label={isMuted ? 'Unmute (M)' : 'Mute (M)'} onClick={toggleMute}>
                  {isMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5" />}
                </ControlButton>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  aria-label="Volume"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => changeVolume(parseFloat(e.target.value))}
                  className="hidden sm:block w-20 md:w-24 h-1 bg-surface-700 rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
              </div>
              <div className="text-xs font-mono text-gray-300 pl-1 whitespace-nowrap">
                {formatTime(shownTime)}
                <span className="mx-1 text-gray-500">/</span>
                {formatTime(duration)}
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-3 relative">
              <div className="relative">
                <ControlButton
                  label="Subtitles (C)"
                  onClick={() => setOpenMenu((m) => (m === 'subtitles' ? null : 'subtitles'))}
                  active={Boolean(activeSubtitle)}
                  expanded={openMenu === 'subtitles'}
                >
                  {subtitleLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Subtitles className="w-5 h-5" />}
                </ControlButton>
                {openMenu === 'subtitles' && (
                  <SubtitleMenu
                    groups={subtitleGroups}
                    activeUrl={activeSubtitle?.url ?? null}
                    loading={subtitleLoading}
                    listLoading={subtitleListLoading}
                    error={subtitleError}
                    offsetSec={subtitleOffsetSec}
                    onOffsetChange={(delta) =>
                      setSubtitleOffsetSec((prev) => (delta === 0 ? 0 : Math.round((prev + delta) * 100) / 100))
                    }
                    onSelect={(track) => {
                      selectSubtitle(track);
                      setOpenMenu(null);
                    }}
                    style={subStyle}
                    onStyleChange={handleStyleChange}
                  />
                )}
              </div>
              <div className="relative">
                <ControlButton
                  label="Playback settings"
                  onClick={() => setOpenMenu((m) => (m === 'settings' ? null : 'settings'))}
                  expanded={openMenu === 'settings'}
                >
                  <Settings className="w-5 h-5" />
                </ControlButton>
                {openMenu === 'settings' && (
                  <SettingsMenu
                    playbackRate={playbackRate}
                    onRate={changeRate}
                    sources={sources}
                    currentIndex={sourceIndex}
                    isPlayable={isPlayableHere}
                    onSource={switchSource}
                  />
                )}
              </div>
              <ControlButton label={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'} onClick={toggleFullscreen}>
                {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </ControlButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ControlButtonProps {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  expanded?: boolean;
  className?: string;
}

const ControlButton: React.FC<ControlButtonProps> = ({ label, onClick, children, active, expanded, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    aria-pressed={active}
    aria-expanded={expanded}
    className={`inline-flex items-center justify-center p-2 rounded-xl border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
      active ? 'bg-primary/20 border-primary text-primary-hover' : 'border-transparent text-gray-200 hover:text-white hover:bg-white/10'
    } ${className}`}
  >
    {children}
  </button>
);
