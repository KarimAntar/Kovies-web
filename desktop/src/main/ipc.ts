// IPC handlers. Every handler checks that the sender is the main frame of our
// window and that it is showing app://kovies content.
import { BrowserWindow, ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron';
import { IPC, isAppUrl } from '../shared/channels';
import { log } from './log';
import { StreamHeaderError, validateRegistration, type StreamHeaderStore } from './streamHeaders';
import { resolveStellarLink, validateRequest } from './stellarRip';
import type { UpdateManager } from './updater';

function trustedWindow(event: IpcMainEvent | IpcMainInvokeEvent): BrowserWindow | null {
  const frame = event.senderFrame;
  if (!frame || frame.parent !== null) return null;
  if (!isAppUrl(frame.url)) return null;
  return BrowserWindow.fromWebContents(event.sender);
}

export function registerIpc(streams: StreamHeaderStore, updater?: UpdateManager): void {
  ipcMain.handle(IPC.registerStreamHeaders, (event, streamUrl: unknown, headers: unknown) => {
    if (!trustedWindow(event)) throw new Error('untrusted sender');
    try {
      const v = validateRegistration(streamUrl, headers);
      streams.register(v.host, v.headers);
      log.debug('registered stream headers for host', v.host, Object.keys(v.headers));
    } catch (err) {
      if (err instanceof StreamHeaderError) throw new Error(err.message);
      throw err;
    }
  });

  ipcMain.handle(IPC.resolveStellar, async (event, request: unknown) => {
    if (!trustedWindow(event)) throw new Error('untrusted sender');
    return resolveStellarLink(validateRequest(request));
  });

  ipcMain.handle(IPC.windowIsMaximized, (event) => trustedWindow(event)?.isMaximized() ?? false);

  ipcMain.on(IPC.windowMinimize, (event) => trustedWindow(event)?.minimize());
  ipcMain.on(IPC.windowToggleMaximize, (event) => {
    const win = trustedWindow(event);
    if (!win) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.on(IPC.windowClose, (event) => trustedWindow(event)?.close());

  // Auto-Update IPC
  if (updater) {
    ipcMain.handle(IPC.updateCheck, async (event) => {
      if (!trustedWindow(event)) return null;
      return await updater.checkForUpdates();
    });
    ipcMain.on(IPC.updateInstall, (event) => {
      if (!trustedWindow(event)) return;
      updater.installUpdate();
    });
  }
}
