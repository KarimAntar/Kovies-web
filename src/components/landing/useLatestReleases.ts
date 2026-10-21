import { useState, useEffect } from 'react';

export interface ReleaseAsset {
  name: string;
  downloadUrl: string;
  sizeBytes?: number;
}

export interface PlatformDownloads {
  tag: string;
  /** Desktop (Windows/macOS) version label, e.g. v0.2.6 */
  desktopVersion: string;
  /** Android / Android TV version label, e.g. v0.9.8 */
  androidVersion: string;
  windowsSetup: string;
  windowsPortable: string;
  macArm64: string;
  macIntel: string;
  androidApk: string;
  androidTvApk: string;
  isLoading: boolean;
}

const FALLBACK_DOWNLOADS: PlatformDownloads = {
  tag: 'latest',
  desktopVersion: 'v0.2.6',
  androidVersion: 'v0.9.8',
  windowsSetup: 'https://github.com/KarimAntar/Kovies-web/releases/latest/download/Kovies-Setup-0.2.6-x64.exe',
  windowsPortable: 'https://github.com/KarimAntar/Kovies-web/releases/latest/download/Kovies-0.2.6-x64-portable.exe',
  macArm64: 'https://github.com/KarimAntar/Kovies-web/releases/latest/download/Kovies-0.2.6-arm64.dmg',
  macIntel: 'https://github.com/KarimAntar/Kovies-web/releases/latest/download/Kovies-0.2.6.dmg',
  androidApk: 'https://github.com/KarimAntar/Kovies-web/releases/latest/download/kovies-mobile-v0.9.8.apk',
  androidTvApk: 'https://github.com/KarimAntar/Kovies-web/releases/latest/download/kovies-tv-v0.9.8.apk',
  isLoading: false,
};

export function useLatestReleases(): PlatformDownloads {
  const [downloads, setDownloads] = useState<PlatformDownloads>({
    ...FALLBACK_DOWNLOADS,
    isLoading: true,
  });

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    async function fetchReleases() {
      try {
        const res = await fetch('https://api.github.com/repos/KarimAntar/Kovies-web/releases/latest', {
          headers: { Accept: 'application/vnd.github.v3+json' },
          signal: controller.signal,
        });

        if (!res.ok) {
          if (mounted) setDownloads({ ...FALLBACK_DOWNLOADS, isLoading: false });
          return;
        }

        const data = (await res.json()) as {
          tag_name?: string;
          assets?: Array<{ name: string; browser_download_url: string; size?: number }>;
        };

        const tag = data.tag_name || FALLBACK_DOWNLOADS.tag;
        const assets = Array.isArray(data.assets) ? data.assets : [];

        const versionOf = (n: string) => /(\d+(?:\.\d+)+)/.exec(n)?.[1] ?? '0';
        const isNewer = (a: string, b: string) => {
          const x = a.split('.').map(Number);
          const y = b.split('.').map(Number);
          for (let i = 0; i < Math.max(x.length, y.length); i++) {
            if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
          }
          return false;
        };

        // The release keeps older installers too: per download slot, the highest version wins.
        type Slot = 'winSetup' | 'winPortable' | 'macArm' | 'macIntel' | 'apk' | 'tv';
        const best: Partial<Record<Slot, { url: string; version: string }>> = {};
        const offer = (slot: Slot, url: string, version: string) => {
          const cur = best[slot];
          if (!cur || isNewer(version, cur.version)) best[slot] = { url, version };
        };

        for (const asset of assets) {
          const name = asset.name.toLowerCase();
          const url = asset.browser_download_url;
          const v = versionOf(name);
          if (name.endsWith('.exe')) {
            offer(name.includes('portable') ? 'winPortable' : 'winSetup', url, v);
          } else if (name.endsWith('.dmg')) {
            offer(name.includes('arm64') ? 'macArm' : 'macIntel', url, v);
          } else if (name.endsWith('.apk')) {
            offer(name.includes('tv') ? 'tv' : 'apk', url, v);
          }
        }

        const winSetup = best.winSetup?.url ?? FALLBACK_DOWNLOADS.windowsSetup;
        const winPortable = best.winPortable?.url ?? FALLBACK_DOWNLOADS.windowsPortable;
        const macArm = best.macArm?.url ?? FALLBACK_DOWNLOADS.macArm64;
        // Intel Macs run the arm64-only build via the universal dmg when present; otherwise reuse arm64.
        const macIntel = best.macIntel?.url ?? best.macArm?.url ?? FALLBACK_DOWNLOADS.macIntel;
        const androidApk = best.apk?.url ?? FALLBACK_DOWNLOADS.androidApk;
        const tvApk = best.tv?.url ?? FALLBACK_DOWNLOADS.androidTvApk;
        const desktopVersion = best.winSetup ? `v${best.winSetup.version}` : FALLBACK_DOWNLOADS.desktopVersion;
        const androidVersion = best.apk ? `v${best.apk.version}` : FALLBACK_DOWNLOADS.androidVersion;

        if (mounted) {
          setDownloads({
            tag,
            desktopVersion,
            androidVersion,
            windowsSetup: winSetup,
            windowsPortable: winPortable,
            macArm64: macArm,
            macIntel: macIntel,
            androidApk,
            androidTvApk: tvApk,
            isLoading: false,
          });
        }
      } catch {
        if (mounted) setDownloads({ ...FALLBACK_DOWNLOADS, isLoading: false });
      }
    }

    void fetchReleases();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  return downloads;
}

export function detectUserPlatform(): 'windows' | 'macos' | 'android' | 'linux' | 'web' {
  if (typeof window === 'undefined' || !navigator) return 'web';
  const ua = (navigator.userAgent || '').toLowerCase();
  const platform = (navigator.platform || '').toLowerCase();

  if (ua.includes('android')) return 'android';
  if (ua.includes('mac') || platform.includes('mac')) return 'macos';
  if (ua.includes('win') || platform.includes('win')) return 'windows';
  if (ua.includes('linux') || platform.includes('linux')) return 'linux';
  return 'web';
}
