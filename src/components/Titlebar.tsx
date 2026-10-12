import { useEffect, useState } from 'react';
import { Minus, Square, Copy, X } from 'lucide-react';
import { desktop } from '../platform';

export function Titlebar() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!desktop) return;
    let mounted = true;
    void desktop.isMaximized().then((value) => {
      if (mounted) setMaximized(value);
    }).catch(() => {});
    const unsubscribe = desktop.onMaximizedChange(setMaximized);
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const bridge = desktop;
  if (!bridge) return null;

  return (
    <div className="desktop-titlebar fixed inset-x-0 top-0 z-[100] h-9 flex items-center justify-between bg-canvas border-b border-white/5 select-none">
      <span className="pl-4 text-xs font-title font-semibold text-gray-300">Kovies</span>
      <div className="flex h-full desktop-no-drag">
        <button
          aria-label="Minimize"
          onClick={() => bridge.minimize()}
          className="w-12 flex items-center justify-center hover:bg-white/10"
        >
          <Minus size={14} />
        </button>
        <button
          aria-label={maximized ? 'Restore window' : 'Maximize'}
          onClick={() => bridge.toggleMaximize()}
          className="w-12 flex items-center justify-center hover:bg-white/10"
        >
          {maximized ? <Copy size={12} /> : <Square size={12} />}
        </button>
        <button
          aria-label="Close window"
          onClick={() => bridge.close()}
          className="w-12 flex items-center justify-center hover:bg-red-600"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
