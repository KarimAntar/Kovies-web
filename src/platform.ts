/**
 * Platform bridge contract shared with the Kovies desktop (Electron) shell.
 *
 * The desktop preload script exposes `window.koviesDesktop`; the browser build
 * never has it. The desktop main process injects the backend API key into
 * requests to `apiBase`, so no key ever lives in renderer/browser code.
 */

export interface KoviesDesktopBridge {
  isDesktop: true;
  platform: 'win32' | 'darwin' | 'linux';
  /** e.g. 'https://kovies.kerix.tech/api' — main process injects the API key. */
  apiBase: string;
  registerStreamHeaders(streamUrl: string, headers: Record<string, string>): Promise<void>;
  minimize(): void;
  toggleMaximize(): void;
  close(): void;
  isMaximized(): Promise<boolean>;
  onMaximizedChange(cb: (maximized: boolean) => void): () => void;
  onMediaKey(cb: (key: 'playpause' | 'next' | 'previous' | 'stop') => void): () => void;
}

declare global {
  interface Window {
    koviesDesktop?: KoviesDesktopBridge;
  }
}

export const desktop: KoviesDesktopBridge | undefined =
  typeof window !== 'undefined' ? window.koviesDesktop : undefined;

/** Base for every backend call, without trailing slash. Web → same-origin gateway. */
export const API_BASE: string = (desktop?.apiBase ?? '/api/k').replace(/\/+$/, '');

export const isDesktop = Boolean(desktop?.isDesktop);
