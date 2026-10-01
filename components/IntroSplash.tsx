'use client';

// ============================================================
// OKEKARAOKE — Premium Animated Intro Splash Screen
// Icon falls from top with spring motion, O-K-E-K-A-R-A-O-K-E
// letters slide in per-letter from left with staggered delay.
// ============================================================

import { useState, useEffect } from 'react';

interface IntroSplashProps {
  onComplete?: () => void;
}

const LETTERS = [
  { char: 'O', color: '#2dd4bf' },
  { char: 'K', color: '#2dd4bf' },
  { char: 'E', color: '#2dd4bf' },
  { char: 'K', color: '#ffffff' },
  { char: 'A', color: '#ffffff' },
  { char: 'R', color: '#ffffff' },
  { char: 'A', color: '#ffffff' },
  { char: 'O', color: '#ffffff' },
  { char: 'K', color: '#ffffff' },
  { char: 'E', color: '#ffffff' },
];

export function IntroSplash({ onComplete }: IntroSplashProps) {
  const [visible, setVisible] = useState(true);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    // Play intro on fresh open & browser refresh
    const hasShown = typeof window !== 'undefined' ? sessionStorage.getItem('okekaraoke_intro_played') : null;
    if (hasShown) {
      setVisible(false);
      onComplete?.();
      return;
    }

    if (typeof window !== 'undefined') {
      sessionStorage.setItem('okekaraoke_intro_played', '1');
    }

    // Start smooth fade out after 3.2 seconds
    const fadeTimer = setTimeout(() => {
      setFadingOut(true);
    }, 3200);

    // Unmount component after fade completes (4.0 seconds total)
    const hideTimer = setTimeout(() => {
      setVisible(false);
      onComplete?.();
    }, 4000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, [onComplete]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-zinc-950 transition-all duration-800 ease-in-out ${
        fadingOut ? 'opacity-0 pointer-events-none scale-105 backdrop-blur-0' : 'opacity-100 backdrop-blur-2xl'
      }`}
      style={{
        background: 'radial-gradient(circle at center, rgba(18, 18, 28, 0.98) 0%, rgba(9, 9, 11, 1) 100%)',
      }}
    >
      <div className="flex flex-col items-center justify-center gap-6 px-4 select-none text-center">
        {/* Falling Icon from top with spring motion */}
        <div className="relative animate-fall-down">
          {/* Ambient Glow behind icon */}
          <div className="absolute inset-0 rounded-full bg-teal-400/25 blur-3xl scale-150 animate-pulse" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon.png"
            alt="OKEKARAOKE"
            className="w-20 h-20 md:w-28 md:h-28 object-contain filter drop-shadow-[0_12px_30px_rgba(45,212,191,0.5)] relative z-10"
          />
        </div>

        {/* Staggered Per-Letter Text Entry from Left */}
        <div className="flex items-center gap-0.5 sm:gap-1 md:gap-1.5 tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          {LETTERS.map((item, idx) => (
            <span
              key={idx}
              className="text-2xl sm:text-3xl md:text-5xl font-black inline-block animate-slide-left-stagger opacity-0"
              style={{
                color: item.color,
                animationDelay: `${550 + idx * 90}ms`,
                textShadow: item.color === '#2dd4bf' ? '0 0 18px rgba(45,212,191,0.5)' : 'none',
              }}
            >
              {item.char}
            </span>
          ))}
        </div>

        <p className="text-xs sm:text-sm font-semibold text-zinc-400 uppercase tracking-[0.3em] animate-fade-in-delayed opacity-0 mt-1">
          Karaoke System
        </p>
      </div>

      {/* Custom Keyframe Animations */}
      <style jsx global>{`
        @keyframes fallDown {
          0% {
            transform: translateY(-160px) scale(0.5);
            opacity: 0;
          }
          60% {
            transform: translateY(10px) scale(1.06);
            opacity: 1;
          }
          80% {
            transform: translateY(-3px) scale(0.98);
          }
          100% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }

        @keyframes slideLeftStagger {
          0% {
            transform: translateX(-50px) scale(0.85);
            opacity: 0;
          }
          100% {
            transform: translateX(0) scale(1);
            opacity: 1;
          }
        }

        @keyframes fadeInDelayed {
          0% {
            opacity: 0;
            transform: translateY(12px);
          }
          100% {
            opacity: 0.8;
            transform: translateY(0);
          }
        }

        .animate-fall-down {
          animation: fallDown 1100ms cubic-bezier(0.175, 0.885, 0.32, 1.25) forwards;
        }

        .animate-slide-left-stagger {
          animation: slideLeftStagger 600ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .animate-fade-in-delayed {
          animation: fadeInDelayed 800ms ease-out 1900ms forwards;
        }
      `}</style>
    </div>
  );
}
