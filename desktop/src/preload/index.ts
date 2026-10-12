// Sandboxed preload. Exposes a narrow, typed bridge as window.koviesDesktop.
// Never exposes ipcRenderer itself; every channel name is fixed here.
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { API_BASE, IPC, MEDIA_KEYS, type MediaKey, type UpdateInfo, type UpdateProgress } from '../shared/channels';

type Platform = 'win32' | 'darwin' | 'linux';

interface KoviesDesktopBridge {
  isDesktop: true;
  platform: Platform;
  apiBase: string;
  registerStreamHeaders(streamUrl: string, headers: Record<string, string>): Promise<void>;
  minimize(): void;
  toggleMaximize(): void;
  close(): void;
  isMaximized(): Promise<boolean>;
  onMaximizedChange(cb: (maximized: boolean) => void): () => void;
  onMediaKey(cb: (key: MediaKey) => void): () => void;
  checkForUpdates(): Promise<UpdateInfo | null>;
  onUpdateAvailable(cb: (info: UpdateInfo) => void): () => void;
  onUpdateProgress(cb: (progress: UpdateProgress) => void): () => void;
  onUpdateDownloaded(cb: () => void): () => void;
  installUpdate(): void;
}

function toPlatform(p: string): Platform {
  return p === 'win32' || p === 'darwin' ? p : 'linux';
}

function subscribe<T>(channel: string, guard: (v: unknown) => v is T, cb: (v: T) => void): () => void {
  if (typeof cb !== 'function') throw new TypeError('callback must be a function');
  const listener = (_event: IpcRendererEvent, value: unknown): void => {
    if (guard(value)) cb(value);
  };
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const isMediaKey = (v: unknown): v is MediaKey =>
  typeof v === 'string' && (MEDIA_KEYS as readonly string[]).includes(v);

const bridge: KoviesDesktopBridge = {
  isDesktop: true,
  platform: toPlatform(process.platform),
  apiBase: API_BASE,
  async registerStreamHeaders(streamUrl, headers) {
    await ipcRenderer.invoke(IPC.registerStreamHeaders, streamUrl, headers);
  },
  minimize: () => ipcRenderer.send(IPC.windowMinimize),
  toggleMaximize: () => ipcRenderer.send(IPC.windowToggleMaximize),
  close: () => ipcRenderer.send(IPC.windowClose),
  isMaximized: async () => (await ipcRenderer.invoke(IPC.windowIsMaximized)) === true,
  onMaximizedChange: (cb) => subscribe(IPC.maximizedChanged, isBool, cb),
  onMediaKey: (cb) => subscribe(IPC.mediaKey, isMediaKey, cb),
  checkForUpdates: async () => (await ipcRenderer.invoke(IPC.updateCheck)) as UpdateInfo | null,
  onUpdateAvailable: (cb) => subscribe(IPC.updateAvailable, (v): v is UpdateInfo => typeof v === 'object' && v !== null, cb),
  onUpdateProgress: (cb) => subscribe(IPC.updateProgress, (v): v is UpdateProgress => typeof v === 'object' && v !== null, cb),
  onUpdateDownloaded: (cb) => subscribe(IPC.updateDownloaded, (_v): _v is void => true, cb),
  installUpdate: () => ipcRenderer.send(IPC.updateInstall),
};

contextBridge.exposeInMainWorld('koviesDesktop', bridge);
