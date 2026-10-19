import { app, dialog, net, shell, type BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';
import { IPC, type UpdateInfo, type UpdateProgress } from '../shared/channels';
import { log } from './log';

const RELEASE_API = 'https://api.github.com/repos/KarimAntar/Kovies-web/releases/latest';
const RELEASE_PAGE = 'https://github.com/KarimAntar/Kovies-web/releases/latest';

/** True when `remote` is a higher dotted version than `local`. */
export function isNewerVersion(remote: string, local: string): boolean {
  const r = remote.split('.').map((n) => parseInt(n, 10) || 0);
  const l = local.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    const a = r[i] ?? 0;
    const b = l[i] ?? 0;
    if (a !== b) return a > b;
  }
  return false;
}

/** Highest "Kovies-<version>-….dmg" version among release asset names. */
export function latestDmgVersion(assetNames: string[]): string | null {
  let best: string | null = null;
  for (const name of assetNames) {
    const m = /^Kovies-(\d+(?:\.\d+)+)(?:-[a-z0-9]+)?\.dmg$/i.exec(name);
    if (m && (best === null || isNewerVersion(m[1], best))) best = m[1];
  }
  return best;
}

export class UpdateManager {
  private window: BrowserWindow | null = null;
  private isChecking = false;

  constructor() {
    // Configure electron-updater
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => {
      log.info('checking for desktop updates...');
    });

    autoUpdater.on('update-available', (info) => {
      log.info(`update available: ${info.version}`);
      const updateData: UpdateInfo = {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
      };

      if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send(IPC.updateAvailable, updateData);
      }

      // If Windows, automatically download the update via electron-updater
      if (process.platform === 'win32') {
        void autoUpdater.downloadUpdate();
      }
    });

    autoUpdater.on('update-not-available', () => {
      log.info('desktop app is up to date.');
    });

    autoUpdater.on('download-progress', (progressObj) => {
      const data: UpdateProgress = {
        percent: Math.round(progressObj.percent),
        transferred: progressObj.transferred,
        total: progressObj.total,
      };
      if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send(IPC.updateProgress, data);
      }
    });

    autoUpdater.on('update-downloaded', () => {
      log.info('update downloaded successfully.');
      if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send(IPC.updateDownloaded);
      }

      const showReadyDialog = this.window && !this.window.isDestroyed()
        ? dialog.showMessageBox(this.window, {
            type: 'info',
            title: 'Update Ready to Install',
            message: 'An update has been downloaded. Restart Kovies now to apply it.',
            buttons: ['Restart & Install', 'Later'],
            defaultId: 0,
            cancelId: 1,
          })
        : dialog.showMessageBox({
            type: 'info',
            title: 'Update Ready to Install',
            message: 'An update has been downloaded. Restart Kovies now to apply it.',
            buttons: ['Restart & Install', 'Later'],
            defaultId: 0,
            cancelId: 1,
          });

      void showReadyDialog.then(({ response }) => {
        if (response === 0) {
          autoUpdater.quitAndInstall(true, true);
        }
      });
    });

    autoUpdater.on('error', (err) => {
      log.warn('auto-updater error:', err instanceof Error ? err.message : err);
    });
  }

  public setWindow(win: BrowserWindow): void {
    this.window = win;
  }

  /** macOS builds are unsigned DMGs, which electron-updater cannot install: compare against the release assets and link to the download. */
  private async checkMac(): Promise<UpdateInfo | null> {
    const res = await net.fetch(RELEASE_API, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return null;
    const release = (await res.json()) as { assets?: { name?: string }[]; body?: string };
    const version = latestDmgVersion((release.assets ?? []).map((a) => a.name ?? ''));
    if (!version || !isNewerVersion(version, app.getVersion())) return null;
    const info: UpdateInfo = { version, releaseNotes: release.body || undefined };
    if (this.window && !this.window.isDestroyed()) this.window.webContents.send(IPC.updateAvailable, info);
    const options = {
      type: 'info' as const,
      title: 'Kovies Update Available',
      message: `A new version of Kovies (v${version}) is available.`,
      detail: 'Download the updated installer from GitHub Releases to stay up to date.',
      buttons: ['Download Update', 'Later'],
      defaultId: 0,
      cancelId: 1,
    };
    const { response } = this.window && !this.window.isDestroyed()
      ? await dialog.showMessageBox(this.window, options)
      : await dialog.showMessageBox(options);
    if (response === 0) void shell.openExternal(RELEASE_PAGE);
    return info;
  }

  public async checkForUpdates(): Promise<UpdateInfo | null> {
    if (this.isChecking) return null;
    this.isChecking = true;
    try {
      if (process.platform === 'darwin') return await this.checkMac();
      const res = await autoUpdater.checkForUpdates();
      if (res && res.updateInfo) {
        return {
          version: res.updateInfo.version,
          releaseDate: res.updateInfo.releaseDate,
          releaseNotes: typeof res.updateInfo.releaseNotes === 'string' ? res.updateInfo.releaseNotes : undefined,
        };
      }
      return null;
    } catch (err) {
      log.warn('check for updates failed:', err instanceof Error ? err.message : err);
      return null;
    } finally {
      this.isChecking = false;
    }
  }

  public installUpdate(): void {
    if (process.platform === 'win32') {
      autoUpdater.quitAndInstall(true, true);
    }
  }
}
