'use client';

// ============================================================
// OKEKARAOKE — TV Screen Floating Shoutout Overlay
// Displays real-time room shoutouts floating from bottom to top & fading out
// Small text with semi-transparent black background pill
// ============================================================

import { useState, useEffect } from 'react';
import { Megaphone } from 'lucide-react';

export interface ShoutoutItem {
  id: string;
  guest_name: string;
  message: string;
  sent_at: number;
}

interface TVShoutoutOverlayProps {
  shoutouts: ShoutoutItem[];
}

export function TVShoutoutOverlay({ shoutouts }: TVShoutoutOverlayProps) {
  const [activeList, setActiveList] = useState<ShoutoutItem[]>([]);

  useEffect(() => {
    if (shoutouts.length === 0) return;
    const latest = shoutouts[shoutouts.length - 1];

    // Add latest shoutout if not already active
    setActiveList((prev) => {
      if (prev.some((item) => item.id === latest.id)) return prev;
      return [...prev.slice(-4), latest];
    });

    // Auto cleanup after 14 seconds animation completes
    const timer = setTimeout(() => {
      setActiveList((prev) => prev.filter((item) => item.id !== latest.id));
    }, 14000);

    return () => clearTimeout(timer);
  }, [shoutouts]);

  if (activeList.length === 0) return null;

  return (
    <div className="fixed inset-0 z-40 pointer-events-none overflow-hidden">
      {activeList.map((item) => (
        <div
          key={item.id}
          className="animate-shoutout-float pointer-events-auto absolute bottom-6 left-1/2 flex items-center gap-2.5 px-4 py-2 rounded-full bg-black/75 backdrop-blur-md shadow-[0_8px_25px_rgba(0,0,0,0.6)] text-white"
        >
          <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-teal-300 shrink-0">
            <Megaphone size={12} className="animate-pulse" />
          </div>

          <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold truncate max-w-[85vw] sm:max-w-md">
            <span className="text-teal-300 font-extrabold shrink-0">{item.guest_name}:</span>
            <span className="text-zinc-100 font-medium tracking-wide truncate">"{item.message}"</span>
          </div>
        </div>
      ))}

      <style>{`
        @keyframes shoutoutFloat {
          0% {
            opacity: 0;
            transform: translate(-50%, 40px) scale(0.95);
          }
          6% {
            opacity: 1;
            transform: translate(-50%, 0px) scale(1);
          }
          92% {
            opacity: 1;
            transform: translate(-50%, -95vh) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -105vh) scale(0.95);
          }
        }
        .animate-shoutout-float {
          animation: shoutoutFloat 15s linear forwards;
        }
      `}</style>
    </div>
  );
}
