type PlaybackEvent = 'source' | 'manifest' | 'fragment' | 'hls-error' | 'loadedmetadata' | 'waiting' | 'stalled' | 'playing' | 'error' | 'ended';
type Entry = Readonly<{ event: PlaybackEvent; at: number; fatal?: boolean; code?: number; readyState?: number; networkState?: number }>;

// Deliberately accept no free-form strings: stream URLs, headers and error text never enter the log.
export function createPlaybackDiagnostics() {
  let entries: Entry[] = [];
  return {
    record(event: PlaybackEvent, data: Record<string, unknown> = {}): void {
      const numbers = Object.fromEntries(['code', 'readyState', 'networkState'].flatMap(key =>
        typeof data[key] === 'number' && Number.isFinite(data[key]) ? [[key, data[key]]] : []));
      entries = [...entries.slice(-99), Object.freeze({ event, at: Date.now(), ...numbers,
        ...(typeof data.fatal === 'boolean' ? { fatal: data.fatal } : {}) })];
    },
    snapshot(): Entry[] { return [...entries]; },
  };
}

export const playbackDiagnostics = createPlaybackDiagnostics();
