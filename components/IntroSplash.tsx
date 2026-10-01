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

    // Start smooth fade out after 2.3 seconds
    const fadeTimer = setTimeout(() => {
      setFadingOut(true);
    }, 2300);

    // Unmount component after fade completes (2.8 seconds total)
    const hideTimer = setTimeout(() => {
      setVisible(false);
      onComplete?.();
    }, 2800);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, [onComplete]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-zinc-950 transition-all duration-700 ${
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
          <div className="absolute inset-0 rounded-full bg-teal-400/20 blur-2xl scale-150 animate-pulse" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon.png"
            alt="OKEKARAOKE"
            className="w-20 h-20 md:w-28 md:h-28 object-contain filter drop-shadow-[0_12px_30px_rgba(45,212,191,0.4)] relative z-10"
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
                animationDelay: `${400 + idx * 70}ms`,
                textShadow: item.color === '#2dd4bf' ? '0 0 16px rgba(45,212,191,0.4)' : 'none',
              }}
            >
              {item.char}
            </span>
          ))}
        </div>

        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-[0.25em] animate-fade-in-delayed opacity-0 mt-1">
          Karaoke System
        </p>
      </div>

      {/* Custom Keyframe Animations */}
      <style jsx global>{`
        @keyframes fallDown {
          0% {
            transform: translateY(-140px) scale(0.6);
            opacity: 0;
          }
          60% {
            transform: translateY(12px) scale(1.08);
            opacity: 1;
          }
          80% {
            transform: translateY(-4px) scale(0.98);
          }
          100% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }

        @keyframes slideLeftStagger {
          0% {
            transform: translateX(-40px) scale(0.8);
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
            transform: translateY(10px);
          }
          100% {
            opacity: 0.7;
            transform: translateY(0);
          }
        }

        .animate-fall-down {
          animation: fallDown 900ms cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }

        .animate-slide-left-stagger {
          animation: slideLeftStagger 500ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        .animate-fade-in-delayed {
          animation: fadeInDelayed 600ms ease-out 1200ms forwards;
        }
      `}</style>
    </div>
  );
}
