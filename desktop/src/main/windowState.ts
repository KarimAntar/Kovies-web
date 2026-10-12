// Persists window bounds + maximized state in userData/window-state.json.
import { app, screen, type BrowserWindow, type Rectangle } from 'electron';
import { promises as fs, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { log } from './log';

export const MIN_WIDTH = 960;
export const MIN_HEIGHT = 600;
export const DEFAULT_WIDTH = 1280;
export const DEFAULT_HEIGHT = 800;
const MAX_DIM = 16384;

export interface WindowState {
  readonly x?: number;
  readonly y?: number;
  readonly width: number;
  readonly height: number;
  readonly maximized: boolean;
}

const DEFAULT_STATE: WindowState = { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT, maximized: false };

const stateFile = (): string => path.join(app.getPath('userData'), 'window-state.json');

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && Math.abs(v) <= MAX_DIM * 4;

function intersects(a: Rectangle, b: Rectangle): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** Validates untrusted JSON; falls back to defaults on anything unexpected. */
export function sanitizeState(raw: unknown): WindowState {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_STATE;
  const r = raw as Record<string, unknown>;
  const width = isInt(r.width) ? Math.min(Math.max(r.width, MIN_WIDTH), MAX_DIM) : DEFAULT_WIDTH;
  const height = isInt(r.height) ? Math.min(Math.max(r.height, MIN_HEIGHT), MAX_DIM) : DEFAULT_HEIGHT;
  const maximized = r.maximized === true;

  if (isInt(r.x) && isInt(r.y)) {
    const rect = { x: r.x, y: r.y, width, height };
    // Only restore the position if the title area is on a connected display.
    const titleStrip = { x: rect.x, y: rect.y, width: rect.width, height: 40 };
    const visible = screen.getAllDisplays().some((d) => intersects(titleStrip, d.workArea));
    if (visible) return { x: r.x, y: r.y, width, height, maximized };
  }
  return { width, height, maximized };
}

export function loadWindowState(): WindowState {
  try {
    return sanitizeState(JSON.parse(readFileSync(stateFile(), 'utf8')));
  } catch {
    return DEFAULT_STATE;
  }
}

async function saveAsync(state: WindowState): Promise<void> {
  const file = stateFile();
  const tmp = `${file}.tmp`;
  try {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(tmp, JSON.stringify(state), 'utf8');
    await fs.rename(tmp, file);
  } catch (err) {
    log.warn('could not save window state', err instanceof Error ? err.message : err);
  }
}

function saveSync(state: WindowState): void {
  const file = stateFile();
  const tmp = `${file}.tmp`;
  try {
    writeFileSync(tmp, JSON.stringify(state), 'utf8');
    renameSync(tmp, file);
  } catch (err) {
    log.warn('could not save window state synchronously', err instanceof Error ? err.message : err);
  }
}

function snapshot(win: BrowserWindow): WindowState {
  const b = win.getNormalBounds();
  return { x: b.x, y: b.y, width: b.width, height: b.height, maximized: win.isMaximized() };
}

/** Saves state on move/resize (debounced async) and on close (synchronous). */
export function trackWindowState(win: BrowserWindow): void {
  let timer: NodeJS.Timeout | undefined;
  const schedule = (): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      if (!win.isDestroyed() && !win.isMinimized() && !win.isFullScreen()) void saveAsync(snapshot(win));
    }, 500);
  };
  for (const ev of ['resize', 'move', 'maximize', 'unmaximize'] as const) {
    win.on(ev as 'resize', schedule);
  }
  win.on('close', () => {
    if (timer) clearTimeout(timer);
    if (!win.isFullScreen()) saveSync(snapshot(win));
  });
}
