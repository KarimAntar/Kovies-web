import { dialog, shell, type BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';
import { IPC, type UpdateInfo, type UpdateProgress } from '../shared/channels';
import { log } from './log';

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
      } else if (process.platform === 'darwin') {
        // macOS: If not code-signed, inform the user with direct download prompt
        const showDialog = this.window && !this.window.isDestroyed()
          ? dialog.showMessageBox(this.window, {
              type: 'info',
              title: 'Kovies Update Available',
              message: `A new version of Kovies (v${info.version}) is available.`,
              detail: 'Download the updated installer from GitHub Releases to stay up to date with new features.',
              buttons: ['Download Update', 'Later'],
              defaultId: 0,
              cancelId: 1,
            })
          : dialog.showMessageBox({
              type: 'info',
              title: 'Kovies Update Available',
              message: `A new version of Kovies (v${info.version}) is available.`,
              detail: 'Download the updated installer from GitHub Releases to stay up to date with new features.',
              buttons: ['Download Update', 'Later'],
              defaultId: 0,
              cancelId: 1,
            });

        void showDialog.then(({ response }) => {
          if (response === 0) {
            void shell.openExternal('https://github.com/KarimAntar/Kovies-web/releases/latest');
          }
        });
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

  public async checkForUpdates(): Promise<UpdateInfo | null> {
    if (this.isChecking) return null;
    this.isChecking = true;
    try {
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
