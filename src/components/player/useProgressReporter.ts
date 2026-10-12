import { useCallback, useEffect, useRef } from 'react';
import type { RecordProgressPayload } from '../../api/types';

const REPORT_INTERVAL_MS = 15_000;
const MIN_POSITION_MS = 1_000;

type Meta = Omit<RecordProgressPayload, 'position' | 'duration'>;

/**
 * Reports watch progress (milliseconds) every 15s while playing, on pause,
 * on seek end, on end, on page hide and on unmount (keepalive fetch).
 * Returns handlers to wire onto the <video> element.
 */
export function useProgressReporter(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  meta: Meta,
  send: (payload: RecordProgressPayload, options?: { keepalive?: boolean }) => Promise<void>
) {
  const metaRef = useRef(meta);
  const sendRef = useRef(send);
  useEffect(() => {
    metaRef.current = meta;
    sendRef.current = send;
  }, [meta, send]);

  // Last sane position seen; survives the <video> being reset during teardown.
  const lastSeenRef = useRef<{ position: number; duration: number } | null>(null);
  const lastSentRef = useRef<number | null>(null);

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const duration = video.duration;
    const position = video.ended ? duration : video.currentTime;
    if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(position) || position <= 0) return;
    lastSeenRef.current = { position: Math.round(position * 1000), duration: Math.round(duration * 1000) };
  }, [videoRef]);

  const report = useCallback(
    (options: { keepalive?: boolean; force?: boolean } = {}) => {
      capture();
      const seen = lastSeenRef.current;
      if (!seen || seen.position < MIN_POSITION_MS) return;
      if (!options.force && lastSentRef.current !== null && Math.abs(lastSentRef.current - seen.position) < 1_000) {
        return;
      }
      lastSentRef.current = seen.position;
      void sendRef.current(
        { ...metaRef.current, position: Math.min(seen.position, seen.duration), duration: seen.duration },
        { keepalive: options.keepalive }
      );
    },
    [capture]
  );

  // Periodic report while playing.
  useEffect(() => {
    const timer = window.setInterval(() => {
      const video = videoRef.current;
      if (video && !video.paused && !video.ended) report();
    }, REPORT_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [report, videoRef]);

  // Page hide / tab hidden / unmount — keepalive so the request survives unload.
  useEffect(() => {
    const onPageHide = () => report({ keepalive: true });
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') report({ keepalive: true });
    };
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibility);
      report({ keepalive: true });
    };
  }, [report]);

  return {
    onTimeUpdate: capture,
    onPause: () => report(),
    onSeeked: () => report(),
    onEnded: () => report({ force: true }),
  };
}
