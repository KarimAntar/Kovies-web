import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Play,
  Download,
  ShieldCheck,
  Zap,
  ArrowRight,
  ExternalLink,
  Globe,
  Radio,
  Database,
  Lock,
} from 'lucide-react';
import { AnimatedMarqueeHero } from '../ui/hero-3';
import { useLatestReleases, detectUserPlatform } from './useLatestReleases';

// Official SVG icons for platforms
const WindowsIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current" aria-hidden="true">
    <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.95-1.801" />
  </svg>
);

const AppleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current" aria-hidden="true">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.89c.66-.82 1.11-1.96.99-3.1-.96.04-2.12.64-2.8 1.44-.6.69-1.12 1.84-.98 2.95 1.07.08 2.14-.54 2.79-1.29z" />
  </svg>
);

const AndroidIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current" aria-hidden="true">
    <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-1.0001s.4482-1.0001.9993-1.0001c.5516 0 .9997.4486.9997 1.0001s-.4481 1.0001-.9997 1.0001m-11.046 0c-.5511 0-.9993-.4486-.9993-1.0001s.4482-1.0001.9993-1.0001c.5516 0 .9997.4486.9997 1.0001s-.4481 1.0001-.9997 1.0001m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.4116 13.8533 8.0818 12 8.0818s-3.5902.3298-5.1368.8678L4.8409 5.4467a.4161.4161 0 00-.5677-.1521.4157.4157 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3432-4.1021-2.6889-7.5743-6.1185-9.4396" />
  </svg>
);

const AndroidTvIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current" aria-hidden="true">
    <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12zm-11-2l6-4-6-4v8z" />
  </svg>
);

interface LandingPageProps {
  onLaunchApp: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLaunchApp }) => {
  const releases = useLatestReleases();
  const [userOs] = useState<'windows' | 'macos' | 'android' | 'linux' | 'web'>(() => detectUserPlatform());

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  interface DownloadButton {
    label: string;
    url?: string;
    onClick?: () => void;
    primary: boolean;
  }

  interface PlatformCard {
    id: string;
    name: string;
    version: string;
    tag: string;
    requirements: string;
    icon: React.ReactNode;
    accent: string;
    badge?: string;
    downloads: DownloadButton[];
  }

  const platforms: PlatformCard[] = [
    {
      id: 'macos',
      name: 'macOS',
      version: 'v0.1.0',
      tag: 'Universal (Apple Silicon & Intel)',
      requirements: 'macOS 12 Monterey or later',
      icon: <AppleIcon />,
      accent: 'from-purple-500/20 to-indigo-500/10',
      badge: userOs === 'macos' ? 'Your Operating System' : undefined,
      downloads: [
        { label: 'Download .dmg (Apple Silicon)', url: releases.macArm64, primary: true },
        { label: 'Download .dmg (Intel x64)', url: releases.macIntel, primary: false },
      ],
    },
    {
      id: 'windows',
      name: 'Windows',
      version: 'v0.1.0',
      tag: '64-bit Windows 10 & 11',
      requirements: 'Windows 10 version 1809 or higher',
      icon: <WindowsIcon />,
      accent: 'from-blue-500/20 to-primary/10',
      badge: userOs === 'windows' ? 'Your Operating System' : undefined,
      downloads: [
        { label: 'Download Installer (.exe)', url: releases.windowsSetup, primary: true },
        { label: 'Download Portable (.exe)', url: releases.windowsPortable, primary: false },
      ],
    },
    {
      id: 'android',
      name: 'Android Mobile',
      version: 'v0.9.1',
      tag: 'ARM64 & x86_64 APK',
      requirements: 'Android 8.0 Oreo or higher',
      icon: <AndroidIcon />,
      accent: 'from-emerald-500/20 to-teal-500/10',
      badge: userOs === 'android' ? 'Your Operating System' : undefined,
      downloads: [
        { label: 'Download Mobile APK', url: releases.androidApk, primary: true },
      ],
    },
    {
      id: 'android-tv',
      name: 'Android TV & Google TV',
      version: 'v0.9.1',
      tag: 'Dedicated 10-ft D-Pad UI',
      requirements: 'Android TV 9.0+, Fire TV Stick 4K',
      icon: <AndroidTvIcon />,
      accent: 'from-amber-500/20 to-orange-500/10',
      badge: 'Living Room Optimized',
      downloads: [
        { label: 'Download Android TV APK', url: releases.androidTvApk, primary: true },
      ],
    },
    {
      id: 'web',
      name: 'Kovies Web Player',
      version: 'v1.0.0 Cloud',
      tag: 'Instant Browser Playback',
      requirements: 'Any modern browser (Chrome, Safari, Firefox, Edge)',
      icon: <Globe className="w-6 h-6 text-primary" />,
      accent: 'from-primary/20 to-purple-600/10',
      badge: 'Zero Installation',
      downloads: [
        { label: 'Launch Web App', onClick: onLaunchApp, primary: true },
      ],
    },
  ];

  const features = [
    {
      icon: <Zap className="w-6 h-6 text-primary" />,
      title: '4K Adaptive HLS Stream Relay',
      description:
        'Custom multi-CDN failover and server-side signed relay for header-bound streams. Smooth, instant bitrate adaptation up to 4K 60fps.',
    },
    {
      icon: <SubtitlesIcon />,
      title: 'Dynamic SubDL & SubSource Subtitles',
      description:
        'Automated multi-language subtitle resolution from SubDL. On-the-fly SRT to WebVTT conversion with collision-free player rendering.',
    },
    {
      icon: <Radio className="w-6 h-6 text-indigo-400" />,
      title: 'Real-Time Cross-Device Sync',
      description:
        'Watch on your Mac or Windows desktop, pause, and continue on your phone or TV right down to the exact millisecond.',
    },
    {
      icon: <ShieldCheck className="w-6 h-6 text-emerald-400" />,
      title: 'Zero Ads, Zero Telemetry',
      description:
        'An uncompromising cinema experience. No tracking scripts, no commercial overlays, no banner ads, and no sign-up barriers.',
    },
    {
      icon: <Database className="w-6 h-6 text-amber-400" />,
      title: 'Deep TMDB & IMDb Metadata',
      description:
        'Comprehensive title databases with verified IMDb scores, official trailers, Rotten Tomatoes ratings, and cast filmographies.',
    },
    {
      icon: <Lock className="w-6 h-6 text-cyan-400" />,
      title: 'Secure Cloud Architecture',
      description:
        'Protected Vercel Edge gateway with encrypted tokens and sandboxed Electron desktop bridge for header registration.',
    },
  ];

  return (
    <div className="min-h-screen bg-canvas text-gray-100 selection:bg-primary selection:text-white">
      {/* Top Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-canvas/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <img src="/kovies-symbol.png" alt="Kovies" className="h-8 w-8 object-contain" />
            <span className="font-title font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
              KOVIES
            </span>
          </div>

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-300">
            <button onClick={() => scrollTo('features')} className="hover:text-white transition-colors">
              Features
            </button>
            <button onClick={() => scrollTo('platforms')} className="hover:text-white transition-colors">
              Platforms
            </button>
            <button onClick={() => scrollTo('downloads')} className="hover:text-white transition-colors">
              Downloads
            </button>
          </div>

          {/* Launch Web App Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={onLaunchApp}
              className="group relative flex items-center gap-2 px-5 py-2 rounded-full bg-primary hover:bg-primary-hover text-white text-xs sm:text-sm font-semibold shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all hover:scale-105 active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Launch Web App</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Marquee Section */}
      <AnimatedMarqueeHero onLaunchApp={onLaunchApp} onScrollToDownloads={() => scrollTo('downloads')} />

      {/* Platforms & Direct Downloads Section */}
      <section id="downloads" className="relative py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-primary/10 blur-[140px] pointer-events-none rounded-full" />

        <div className="relative text-center max-w-3xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-bold uppercase tracking-widest text-primary-hover">Universal Ecosystem</span>
          <h2 className="font-title text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Download Kovies on Every Screen
          </h2>
          <p className="text-sm sm:text-base text-gray-400">
            Native hardware-accelerated binaries for macOS, Windows, Android, and Android TV, backed by real-time cloud sync.
          </p>
        </div>

        {/* Platform Cards Grid */}
        <div id="platforms" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
          {platforms.map((p) => {
            const isDetected = p.badge === 'Your Operating System';
            return (
              <motion.div
                key={p.id}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
                className={`relative flex flex-col justify-between p-6 rounded-3xl bg-surface-900/90 border transition-all backdrop-blur-xl ${
                  isDetected
                    ? 'border-primary ring-2 ring-primary/30 shadow-2xl shadow-primary/20 bg-gradient-to-b from-primary/10 via-surface-900 to-surface-900'
                    : 'border-surface-700/80 hover:border-surface-600 shadow-xl'
                }`}
              >
                {/* Badge in top right */}
                {p.badge && (
                  <div className="absolute -top-3 right-6">
                    <span className="px-3 py-1 rounded-full bg-primary text-white text-[11px] font-bold shadow-md shadow-primary/30 uppercase tracking-wider">
                      {p.badge}
                    </span>
                  </div>
                )}

                <div>
                  {/* Platform Icon & Title */}
                  <div className="flex items-center gap-3.5 mb-4">
                    <div className="p-3 rounded-2xl bg-surface-800 border border-surface-700 text-white">
                      {p.icon}
                    </div>
                    <div>
                      <h3 className="font-title text-xl font-bold text-white">{p.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-mono font-semibold text-primary-hover">{p.version}</span>
                        <span className="text-xs text-gray-500">•</span>
                        <span className="text-xs text-gray-400">{p.tag}</span>
                      </div>
                    </div>
                  </div>

                  {/* Requirements */}
                  <div className="p-3 rounded-2xl bg-surface-950/60 border border-surface-800 mb-6">
                    <span className="text-[11px] font-semibold text-gray-400 block mb-0.5">System Requirement</span>
                    <span className="text-xs text-gray-300 font-medium">{p.requirements}</span>
                  </div>
                </div>

                {/* Download Actions */}
                <div className="space-y-2.5">
                  {p.downloads.map((dl, i) => {
                    const isAction = Boolean(dl.onClick);
                    const btnClass = `w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-semibold text-xs sm:text-sm transition-all ${
                      dl.primary
                        ? 'bg-primary hover:bg-primary-hover text-white shadow-lg shadow-primary/25 hover:shadow-primary/40'
                        : 'bg-surface-800 hover:bg-surface-700 text-gray-200 border border-surface-700'
                    }`;

                    if (isAction && dl.onClick) {
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={dl.onClick}
                          className={btnClass}
                        >
                          <Play className="w-4 h-4 fill-current" />
                          <span>{dl.label}</span>
                        </button>
                      );
                    }

                    return (
                      <a
                        key={i}
                        href={dl.url || '#'}
                        className={btnClass}
                      >
                        <Download className="w-4 h-4" />
                        <span>{dl.label}</span>
                      </a>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* GitHub Releases Dynamic Callout */}
        <div className="mt-12 p-6 rounded-3xl bg-surface-900/60 border border-surface-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="space-y-1">
            <h4 className="font-title text-sm font-bold text-white">Automated Continuous Releases</h4>
            <p className="text-xs text-gray-400">
              Binary artifacts are built and signed directly via GitHub Actions CI for every release tag ({releases.tag}).
            </p>
          </div>
          <a
            href="https://github.com/KarimAntar/Kovies-web/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-surface-800 hover:bg-surface-700 text-xs font-semibold text-gray-300 hover:text-white border border-surface-700 transition-all flex-shrink-0"
          >
            <span>View All Release Notes</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </section>

      {/* Features Showcase Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-white/5">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-bold uppercase tracking-widest text-primary-hover">Architectural Precision</span>
          <h2 className="font-title text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Crafted for True Film Enthusiasts
          </h2>
          <p className="text-sm sm:text-base text-gray-400">
            Built from scratch to deliver low-latency cinema playback without compromises or corporate bloat.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, idx) => (
            <div
              key={idx}
              className="p-6 rounded-3xl bg-surface-900/80 border border-surface-800 hover:border-surface-700 transition-all space-y-3"
            >
              <div className="p-3 rounded-2xl bg-surface-800 w-fit border border-surface-700/80">{f.icon}</div>
              <h3 className="font-title text-lg font-bold text-white">{f.title}</h3>
              <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-surface-800/80 bg-surface-950/80 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img src="/kovies-symbol.png" alt="Kovies" className="h-6 w-6 opacity-80" />
            <span className="font-title font-bold text-gray-300">KOVIES</span>
            <span className="text-xs text-gray-500">— Aetherium Cinema Streaming</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-gray-400">
            <button onClick={() => scrollTo('downloads')} className="hover:text-white transition-colors">
              Windows
            </button>
            <button onClick={() => scrollTo('downloads')} className="hover:text-white transition-colors">
              macOS
            </button>
            <button onClick={() => scrollTo('downloads')} className="hover:text-white transition-colors">
              Android
            </button>
            <button onClick={() => scrollTo('downloads')} className="hover:text-white transition-colors">
              Android TV
            </button>
            <button onClick={onLaunchApp} className="text-primary-hover font-semibold hover:underline">
              Web Player
            </button>
          </div>

          <p className="text-xs text-gray-500">© 2026 Kovies. Built with passion for open cinema.</p>
        </div>
      </footer>
    </div>
  );
};

const SubtitlesIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-none stroke-current text-primary" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M7 15h4M15 15h2M7 11h2M13 11h4" />
  </svg>
);

export default LandingPage;
