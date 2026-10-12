// IPC channel names shared by main and preload. Keep in sync on both sides;
// main only registers handlers for these exact names.

export const IPC = {
  registerStreamHeaders: 'kovies:stream-headers:register',
  windowMinimize: 'kovies:window:minimize',
  windowToggleMaximize: 'kovies:window:toggle-maximize',
  windowClose: 'kovies:window:close',
  windowIsMaximized: 'kovies:window:is-maximized',
  // main -> renderer
  maximizedChanged: 'kovies:window:maximized-changed',
  mediaKey: 'kovies:media-key',
  // Auto-Update
  updateCheck: 'kovies:update:check',
  updateAvailable: 'kovies:update:available',
  updateProgress: 'kovies:update:progress',
  updateDownloaded: 'kovies:update:downloaded',
  updateInstall: 'kovies:update:install',
} as const;

export interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string;
  downloadUrl?: string;
}

export interface UpdateProgress {
  percent: number;
  transferred: number;
  total: number;
}

export const APP_SCHEME = 'app';
export const APP_HOST = 'kovies';
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;

/**
 * True when raw is an app://kovies/ URL. WHATWG URL reports origin "null" for
 * non-special schemes, so compare protocol + host instead of .origin.
 */
export function isAppUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return (
      u.protocol === `${APP_SCHEME}:` &&
      u.hostname === APP_HOST &&
      u.port === '' &&
      u.username === '' &&
      u.password === ''
    );
  } catch {
    return false;
  }
}

export const API_HOST = 'kovies.kerix.tech';
export const API_BASE = `https://${API_HOST}/api`;

export type MediaKey = 'playpause' | 'next' | 'previous' | 'stop';
export const MEDIA_KEYS: readonly MediaKey[] = ['playpause', 'next', 'previous', 'stop'];
