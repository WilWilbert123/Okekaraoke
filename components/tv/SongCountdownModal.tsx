'use client';

// ============================================================
// OKEKARAOKE — 5-Second Song Countdown Overlay
// Text-only countdown with pop-in, shrinking pulse & clear background
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
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 bg-transparent text-white select-none pointer-events-none">
      <style>{`
        @keyframes countdownPulse {
          0% {
            transform: scale(1.45);
            opacity: 0;
            filter: drop-shadow(0 0 60px rgba(45, 212, 191, 0.9));
          }
          12% {
            transform: scale(1.25);
            opacity: 1;
            filter: drop-shadow(0 0 45px rgba(45, 212, 191, 0.8));
          }
          80% {
            transform: scale(1.0);
            opacity: 0.95;
            filter: drop-shadow(0 0 30px rgba(45, 212, 191, 0.6));
          }
          100% {
            transform: scale(0.9);
            opacity: 0.75;
            filter: drop-shadow(0 0 15px rgba(45, 212, 191, 0.3));
          }
        }
        .animate-countdown-pulse {
          animation: countdownPulse 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Ambient background glow behind text */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative flex flex-col items-center text-center space-y-6 max-w-2xl w-full">
        
        {/* HUGE Animated Countdown Number */}
        <div className="h-48 flex items-center justify-center">
          <span
            key={timeLeft}
            className="animate-countdown-pulse text-9xl md:text-[13rem] font-black text-teal-400 font-mono tracking-tighter leading-none inline-block drop-shadow-[0_0_40px_rgba(45,212,191,0.7)]"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            {timeLeft > 0 ? timeLeft : 'GO!'}
          </span>
        </div>

        {/* Clean Text-Only Song Title & Singer (NO BOX BACKGROUND) */}
        <div className="space-y-2 w-full text-center">
          <h2
            className="text-3xl md:text-5xl font-black text-white tracking-tight drop-shadow-[0_4px_20px_rgba(0,0,0,0.95)] truncate px-4"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            {song.title}
          </h2>

          <p className="text-lg md:text-2xl font-bold text-zinc-300 drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)] truncate">
            {song.artist}
          </p>

          {song.guestName && (
            <div className="pt-2 flex items-center justify-center gap-2 text-sm md:text-lg text-teal-300 font-extrabold drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)]">
              <Mic2 size={18} className="text-teal-400 animate-pulse" />
              <span>Singer: <strong className="text-white">{song.guestName}</strong></span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

