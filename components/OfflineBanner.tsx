'use client';

import { useState, useEffect } from 'react';
import { WifiOff, X } from 'lucide-react';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleOffline = () => {
      setIsOffline(true);
      setDismissed(false);
    };
    const handleOnline = () => {
      setIsOffline(false);
      setDismissed(false);
    };

    if (typeof window !== 'undefined' && !navigator.onLine) {
      setIsOffline(true);
    }

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!isOffline || dismissed) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-black px-3.5 py-1.5 text-xs font-extrabold flex items-center justify-between shadow-lg animate-fadeIn select-none">
      <div className="flex-1 flex items-center justify-center gap-2 min-w-0 pr-2">
        <WifiOff size={14} className="shrink-0" />
        <span className="truncate">You are currently offline. Check your internet connection.</span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="p-1 -mr-1 rounded-md hover:bg-black/15 text-black transition-colors shrink-0 flex items-center justify-center active:scale-95"
        title="Hide offline banner"
        aria-label="Hide offline banner"
      >
        <X size={15} className="stroke-[2.5]" />
      </button>
    </div>
  );
}
