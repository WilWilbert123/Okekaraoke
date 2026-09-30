'use client';

// ============================================================
// OKEKARAOKE — 5-Second Song Countdown Overlay
// Clean, minimalist countdown: countdown ring + song title + singer name
// ============================================================

import { useState, useEffect, useRef } from 'react';
import { Mic2 } from 'lucide-react';

interface SongCountdownModalProps {
  song: {
    title: string;
    artist: string;
    guestName?: string | null;
    code?: string | null;
  };
  onComplete: () => void;
}

export function SongCountdownModal({ song, onComplete }: SongCountdownModalProps) {
  const [timeLeft, setTimeLeft] = useState(5);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setTimeout(() => {
            onCompleteRef.current();
          }, 50);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 bg-black/90 backdrop-blur-xl text-white select-none animate-fadeIn">
      {/* Background Decorative Ambient Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />

      <div className="relative max-w-sm w-full flex flex-col items-center text-center space-y-5">
        
        {/* Big Animated 5-Second Countdown Ring */}
        <div className="relative flex items-center justify-center w-36 h-36">
          <div className="absolute inset-0 rounded-full border-4 border-zinc-800" />
          <div
            className="absolute inset-0 rounded-full border-4 border-teal-400 transition-all duration-1000"
            style={{
              clipPath: `inset(0 ${((5 - timeLeft) / 5) * 100}% 0 0)`,
            }}
          />
          
          <span
            key={timeLeft}
            className="text-7xl font-black text-teal-400 font-mono tracking-tighter drop-shadow-[0_0_25px_rgba(45,212,191,0.6)]"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            {timeLeft > 0 ? timeLeft : 'GO!'}
          </span>
        </div>

        {/* Clean Song & Singer Card */}
        <div className="space-y-1.5 w-full bg-zinc-950/80 border border-zinc-800 p-5 rounded-3xl shadow-2xl">
          <h2
            className="text-2xl md:text-3xl font-black text-white truncate px-2"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            {song.title}
          </h2>
          <p className="text-sm font-semibold text-zinc-400 truncate">
            {song.artist}
          </p>

          {song.guestName && (
            <div className="pt-2 flex items-center justify-center gap-1.5 text-xs text-teal-400 font-bold">
              <Mic2 size={13} className="text-teal-400" />
              <span>Singer: <strong className="text-white">{song.guestName}</strong></span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
