import { useEffect, useState } from 'react';

const CHECK_MS = 5 * 60 * 1000;

/** Compares the running build with /version.json and offers a reload when a newer deployment exists. */
export function UpdateBanner() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (window.koviesDesktop?.isDesktop || typeof __BUILD_ID__ === 'undefined') return;
    let stopped = false;
    const check = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { build?: string };
        if (!stopped && data.build && data.build !== __BUILD_ID__) setAvailable(true);
      } catch {
        // offline: try again next interval
      }
    };
    const timer = window.setInterval(check, CHECK_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') void check(); };
    document.addEventListener('visibilitychange', onVisible);
    void check();
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  if (!available) return null;
  return (
    <div role="status" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 rounded-xl border border-white/10 bg-surface-800 px-4 py-3 text-sm text-white shadow-xl">
      <span>A new version of Kovies is available.</span>
      <button type="button" onClick={() => window.location.reload()} className="rounded-lg bg-primary px-3 py-1.5 font-semibold">
        Update
      </button>
      <button type="button" onClick={() => setAvailable(false)} className="text-gray-400 hover:text-white" aria-label="Dismiss">
        Later
      </button>
    </div>
  );
}
