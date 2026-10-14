import { useState, useEffect } from 'react';

export interface ReleaseAsset {
  name: string;
  downloadUrl: string;
  sizeBytes?: number;
}

export interface PlatformDownloads {
  tag: string;
  windowsSetup: string;
  windowsPortable: string;
  macArm64: string;
  macIntel: string;
  androidApk: string;
  androidTvApk: string;
  isLoading: boolean;
}

const FALLBACK_DOWNLOADS: PlatformDownloads = {
  tag: 'v0.1.0',
  windowsSetup: 'https://github.com/KarimAntar/Kovies-web/releases/latest/download/Kovies-Setup-0.1.0-x64.exe',
  windowsPortable: 'https://github.com/KarimAntar/Kovies-web/releases/latest/download/Kovies-0.1.0-x64-portable.exe',
  macArm64: 'https://github.com/KarimAntar/Kovies-web/releases/latest/download/Kovies-0.1.0-arm64.dmg',
  macIntel: 'https://github.com/KarimAntar/Kovies-web/releases/latest/download/Kovies-0.1.0.dmg',
  androidApk: 'https://github.com/KarimAntar/Kovies-web/releases/latest/download/kovies-mobile-v0.9.1.apk',
  androidTvApk: 'https://github.com/KarimAntar/Kovies-web/releases/latest/download/kovies-tv-v0.9.1.apk',
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

        let winSetup = FALLBACK_DOWNLOADS.windowsSetup;
        let winPortable = FALLBACK_DOWNLOADS.windowsPortable;
        let macArm = FALLBACK_DOWNLOADS.macArm64;
        let macIntel = FALLBACK_DOWNLOADS.macIntel;
        let androidApk = FALLBACK_DOWNLOADS.androidApk;
        let tvApk = FALLBACK_DOWNLOADS.androidTvApk;

        for (const asset of assets) {
          const name = asset.name.toLowerCase();
          const url = asset.browser_download_url;

          if (name.endsWith('.exe')) {
            if (name.includes('portable')) winPortable = url;
            else winSetup = url;
          } else if (name.endsWith('.dmg')) {
            if (name.includes('arm64') || name.includes('m1') || name.includes('apple')) macArm = url;
            else macIntel = url;
          } else if (name.endsWith('.apk')) {
            if (name.includes('tv') || name.includes('leanback')) tvApk = url;
            else androidApk = url;
          }
        }

        // If macArm was found but not intel or vice versa, fallback to the available one
        if (macArm !== FALLBACK_DOWNLOADS.macArm64 && macIntel === FALLBACK_DOWNLOADS.macIntel) {
          macIntel = macArm;
        }

        if (mounted) {
          setDownloads({
            tag,
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
