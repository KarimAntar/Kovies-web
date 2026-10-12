import { app, BrowserWindow, globalShortcut, session, shell } from 'electron';
import path from 'node:path';
import { APP_ORIGIN, IPC, isAppUrl, type MediaKey } from '../shared/channels';
import { registerIpc } from './ipc';
import { log } from './log';
import { hasApiKey, installNetworkHooks } from './network';
import { registerAppProtocolHandler, registerAppScheme, resolveWebRoot } from './protocol';
import { runSelfTest } from './selftest';
import { StreamHeaderStore } from './streamHeaders';
import { UpdateManager } from './updater';
import { loadWindowState, MIN_HEIGHT, MIN_WIDTH, trackWindowState } from './windowState';

const BACKGROUND = '#0E0D13';
const START_URL = `${APP_ORIGIN}/`;

// Test/CI isolation: an override lets a second instance run against its own
// profile instead of colliding with a real install over the single-instance
// lock (both share the same userData directory by default).
const userDataOverride = process.env.KOVIES_USER_DATA_DIR;
if (userDataOverride) app.setPath('userData', path.resolve(userDataOverride));

registerAppScheme();

let mainWindow: BrowserWindow | null = null;

function openExternalIfHttps(raw: string): void {
  try {
    const u = new URL(raw);
    if (u.protocol === 'https:') {
      shell.openExternal(raw).catch((err) => {
        log.warn('failed to open external url', raw.slice(0, 200), err instanceof Error ? err.message : err);
      });
    }
  } catch {
    /* ignore malformed */
  }
}

function hardenContents(contents: Electron.WebContents): void {
  contents.setWindowOpenHandler(({ url }) => {
    openExternalIfHttps(url);
    return { action: 'deny' };
  });
  const blockNav = (event: Electron.Event, url: string): void => {
    if (!isAppUrl(url)) {
      event.preventDefault();
      openExternalIfHttps(url);
      log.debug('blocked in-window navigation to', url.slice(0, 200));
    }
  };
  contents.on('will-navigate', blockNav);
  contents.on('will-redirect', blockNav);
  contents.on('will-attach-webview', (event) => event.preventDefault());
}

function sendToRenderer(channel: string, value: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, value);
}

function registerMediaKeys(): void {
  const map: ReadonlyArray<readonly [string, MediaKey]> = [
    ['MediaPlayPause', 'playpause'],
    ['MediaNextTrack', 'next'],
    ['MediaPreviousTrack', 'previous'],
    ['MediaStop', 'stop'],
  ];
  for (const [accelerator, key] of map) {
    try {
      const ok = globalShortcut.register(accelerator, () => sendToRenderer(IPC.mediaKey, key));
      if (!ok) log.warn(`media key ${accelerator} could not be registered (in use by another app?)`);
    } catch (err) {
      log.warn(`media key ${accelerator} registration failed`, err instanceof Error ? err.message : err);
    }
  }
}

function createWindow(): BrowserWindow {
  const state = loadWindowState();
  const isMac = process.platform === 'darwin';

  const win = new BrowserWindow({
    ...(state.x !== undefined && state.y !== undefined ? { x: state.x, y: state.y } : {}),
    width: state.width,
    height: state.height,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    backgroundColor: BACKGROUND,
    title: 'Kovies',
    // Windows/Linux: frameless, the web app draws its own titlebar.
    // macOS: hidden titlebar with traffic light buttons inset nicely.
    ...(isMac
      ? {
          titleBarStyle: 'hidden' as const,
          trafficLightPosition: { x: 18, y: 16 },
        }
      : { frame: false }),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      spellcheck: false,
    },
  });

  if (!isMac) win.removeMenu();
  if (state.maximized) win.maximize();
  trackWindowState(win);

  win.on('maximize', () => sendToRenderer(IPC.maximizedChanged, true));
  win.on('unmaximize', () => sendToRenderer(IPC.maximizedChanged, false));
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });

  win.webContents.on('did-fail-load', (_e, code, desc, url) => log.error('load failed', code, desc, url));
  win.webContents.on('render-process-gone', (_e, details) => log.error('renderer gone', details.reason));

  void win.loadURL(START_URL);
  return win;
}

function configureSession(streams: StreamHeaderStore): void {
  const ses = session.defaultSession;
  const allowed = new Set(['fullscreen', 'clipboard-sanitized-write']);
  ses.setPermissionRequestHandler((_wc, permission, cb) => cb(allowed.has(permission)));
  ses.setPermissionCheckHandler((_wc, permission) => allowed.has(permission));
  installNetworkHooks(ses, streams);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) {
      mainWindow = createWindow();
      return;
    }
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.on('web-contents-created', (_e, contents) => hardenContents(contents));

  app.whenReady().then(() => {
    const webRoot = resolveWebRoot();
    const streams = new StreamHeaderStore();
    log.info(`starting (packaged=${app.isPackaged}, webRoot=${webRoot}, apiKey=${hasApiKey() ? 'set' : 'MISSING'})`);

    registerAppProtocolHandler(webRoot);
    configureSession(streams);
    const updater = new UpdateManager();
    registerIpc(streams, updater);
    mainWindow = createWindow();
    updater.setWindow(mainWindow);
    registerMediaKeys();

    if (app.isPackaged) {
      // Check for updates 5 seconds after startup
      setTimeout(() => {
        void updater.checkForUpdates();
      }, 5000);
    }

    if (process.env.KOVIES_SELFTEST === '1') void runSelfTest(mainWindow);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
    });
  });

  app.on('will-quit', () => globalShortcut.unregisterAll());
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' || process.env.KOVIES_SELFTEST === '1') app.quit();
  });
}
