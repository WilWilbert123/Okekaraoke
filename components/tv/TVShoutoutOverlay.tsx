'use client';

// ============================================================
// OKEKARAOKE — TV Screen Floating Shoutout Overlay
// Displays real-time room shoutouts floating from bottom to top on left side
// Text-only white bold with text shadow legibility (no card background)
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
          className="animate-shoutout-float-left pointer-events-none absolute bottom-12 left-6 sm:left-10 flex items-center gap-2.5 text-white"
        >
          <Megaphone size={20} className="text-teal-400 shrink-0 animate-bounce drop-shadow-[0_2px_8px_rgba(0,0,0,1)]" />

          <div
            className="text-sm sm:text-base md:text-lg font-black tracking-wide leading-snug max-w-[70vw] sm:max-w-lg break-words"
            style={{
              textShadow: '0 2px 10px rgba(0,0,0,1), 0 0 6px rgba(0,0,0,1), 0 0 2px rgba(0,0,0,1)',
            }}
          >
            <span className="text-teal-300 font-extrabold mr-1.5">{item.guest_name}:</span>
            <span className="text-white font-black">"{item.message}"</span>
          </div>
        </div>
      ))}

      <style>{`
        @keyframes shoutoutFloatLeft {
          0% {
            opacity: 0;
            transform: translate(0px, 40px) scale(0.95);
          }
          6% {
            opacity: 1;
            transform: translate(0px, 0px) scale(1);
          }
          92% {
            opacity: 1;
            transform: translate(0px, -90vh) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(0px, -100vh) scale(0.95);
          }
        }
        .animate-shoutout-float-left {
          animation: shoutoutFloatLeft 15s linear forwards;
        }
      `}</style>
    </div>
  );
}

