'use client';

// ============================================================
// OKEKARAOKE — Premium Animated Intro Splash Screen
// Clean white studio background, smooth spring icon entry,
// staggered per-letter text, and hardware-accelerated 60/120fps motion.
// ============================================================

import { useState, useEffect, useCallback } from 'react';

interface IntroSplashProps {
  onComplete?: () => void;
}

const LETTERS = [
  { char: 'O', color: '#0d9488' },
  { char: 'K', color: '#0d9488' },
  { char: 'E', color: '#0d9488' },
  { char: 'K', color: '#09090b' },
  { char: 'A', color: '#09090b' },
  { char: 'R', color: '#09090b' },
  { char: 'A', color: '#09090b' },
  { char: 'O', color: '#09090b' },
  { char: 'K', color: '#09090b' },
  { char: 'E', color: '#09090b' },
];

export function IntroSplash({ onComplete }: IntroSplashProps) {
  const [visible, setVisible] = useState(true);
  const [fadingOut, setFadingOut] = useState(false);

  const handleSkip = useCallback(() => {
    if (fadingOut) return;
    setFadingOut(true);
    setTimeout(() => {
      setVisible(false);
      onComplete?.();
    }, 450);
  }, [fadingOut, onComplete]);

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

    // Start smooth fade out after 2.4 seconds
    const fadeTimer = setTimeout(() => {
      setFadingOut(true);
    }, 2400);

    // Unmount component after fade completes
    const hideTimer = setTimeout(() => {
      setVisible(false);
      onComplete?.();
    }, 2900);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, [onComplete]);

  if (!visible) return null;

  return (
    <div
      onClick={handleSkip}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white cursor-pointer select-none transition-opacity duration-500 ease-out [transform:translateZ(0)] ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        background: 'radial-gradient(circle at center, #ffffff 0%, #f8fafc 100%)',
      }}
    >
      <div className="flex flex-col items-center justify-center gap-4 px-4 select-none text-center">
        {/* Falling Logo with smooth spring motion */}
        <div
          className="relative animate-fall-down"
          style={{ willChange: 'transform, opacity' }}
        >
          {/* Subtle ambient glow behind logo */}
          <div className="absolute inset-0 rounded-full bg-teal-500/10 blur-xl scale-125 pointer-events-none" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/okekaraokelogo.png"
            alt="OKEKARAOKE Logo"
            className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 object-contain relative z-10 drop-shadow-[0_10px_25px_rgba(0,0,0,0.12)]"
            loading="eager"
            decoding="async"
          />
        </div>

        {/* Staggered Per-Letter Text Entry from Left */}
        <div
          className="flex items-center gap-0.5 sm:gap-1 md:gap-1.5 tracking-tight"
          style={{ fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '-0.02em' }}
        >
          {LETTERS.map((item, idx) => (
            <span
              key={idx}
              className="text-3xl sm:text-4xl md:text-5xl font-black inline-block animate-slide-left-stagger opacity-0"
              style={{
                color: item.color,
                animationDelay: `${350 + idx * 50}ms`,
                willChange: 'transform, opacity',
              }}
            >
              {item.char}
            </span>
          ))}
        </div>

        {/* Tagline */}
        <div className="animate-subtitle-fade opacity-0">
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.25em] text-slate-400">
            Interactive Karaoke System
          </span>
        </div>
      </div>

      {/* Subtle tap-to-skip hint */}
      <span className="absolute bottom-6 text-[10px] sm:text-[11px] font-semibold text-slate-400/80 tracking-wider uppercase select-none pointer-events-none">
        Tap anywhere to skip
      </span>

      {/* Custom Keyframe Animations - Hardware accelerated translate3d */}
      <style jsx global>{`
        @keyframes fallDown {
          0% {
            transform: translate3d(0, -90px, 0) scale(0.65);
            opacity: 0;
          }
          65% {
            transform: translate3d(0, 6px, 0) scale(1.04);
            opacity: 1;
          }
          85% {
            transform: translate3d(0, -2px, 0) scale(0.99);
          }
          100% {
            transform: translate3d(0, 0, 0) scale(1);
            opacity: 1;
          }
        }

        @keyframes slideLeftStagger {
          0% {
            transform: translate3d(-30px, 0, 0) scale(0.9);
            opacity: 0;
          }
          100% {
            transform: translate3d(0, 0, 0) scale(1);
            opacity: 1;
          }
        }

        @keyframes subtitleFade {
          0% {
            opacity: 0;
            transform: translate3d(0, 8px, 0);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }

        .animate-fall-down {
          animation: fallDown 750ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .animate-slide-left-stagger {
          animation: slideLeftStagger 450ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .animate-subtitle-fade {
          animation: subtitleFade 500ms ease-out 1000ms forwards;
        }
      `}</style>
    </div>
  );
}
