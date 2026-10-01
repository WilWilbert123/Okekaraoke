'use client';

// ============================================================
// OKEKARAOKE — Authentic Videoke Performance Score Modal
// 10.0s Total Duration: 2.0s Thrilling Rollup + 8.0s Score Celebration
// ============================================================

import { useEffect, useState, useRef, useMemo } from 'react';
import { Music2, Play, Sparkles, Star, Flame, PartyPopper, Trophy, Heart, Zap } from 'lucide-react';

interface KaraokeScoreModalProps {
  completedSong: {
    title: string;
    artist: string;
    guestName?: string | null;
  };
  nextSong?: {
    title: string;
    artist: string;
    guestName?: string | null;
  } | null;
  onCountdownComplete: () => void;
  onSkip?: () => void;
}

function getGradeTitle(score: number) {
  if (score === 100) return '🏆 PERFECT SUPERSTAR 🏆';
  if (score >= 95) return '🔥 SUPERSTAR VOCALS 🔥';
  if (score >= 90) return '⭐ GREAT PERFORMANCE ⭐';
  return '🎤 GOOD EFFORT 🎤';
}

const FIREWORKS_ICONS = [Sparkles, Star, Flame, PartyPopper, Trophy, Heart, Zap];
const FIREWORKS_COLORS = ['#2dd4bf', '#f59e0b', '#ec4899', '#38bdf8', '#a855f7', '#10b981', '#f97316'];

function synthScoreSound(score: number) {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const freqs = score >= 95
      ? [523.25, 659.25, 783.99, 1046.50, 1318.51]
      : [440, 554.37, 659.25, 880, 1108.73];

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
      gain.gain.setValueAtTime(0.18, ctx.currentTime + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.12);
      osc.stop(ctx.currentTime + idx * 0.12 + 0.5);
    });
  } catch {}
}

export default function KaraokeScoreModal({
  completedSong,
  nextSong,
  onCountdownComplete,
}: KaraokeScoreModalProps) {
  const [targetScore] = useState(() => {
    const seedStr = `${completedSong.title}-${completedSong.artist}`;
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
      hash = (hash << 5) - hash + seedStr.charCodeAt(i);
      hash |= 0;
    }
    const score = 88 + (Math.abs(hash) % 13);
    return Math.min(100, Math.max(88, score));
  });

  const [phase, setPhase] = useState<'rolling' | 'celebration'>('rolling');
  const [displayScore, setDisplayScore] = useState(1);
  const [celebrationSeconds, setCelebrationSeconds] = useState(10); // 10 full seconds hold
  const hasFinishedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Preload score audio on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const audio = new Audio('/sounds/score.mp3');
        audio.preload = 'auto';
        audioRef.current = audio;
      } catch {}
    }
  }, []);

  const triggerAudio = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {
        try {
          const fallback = new Audio('/score.mp3');
          fallback.play().catch(() => synthScoreSound(targetScore));
        } catch {
          synthScoreSound(targetScore);
        }
      });
    } else {
      synthScoreSound(targetScore);
    }
  };

  // Generate 16 radial fireworks particles
  const particles = useMemo(() => {
    return Array.from({ length: 16 }).map((_, i) => {
      const angle = (i * 360) / 16 + ((i % 2 === 0 ? 1 : -1) * 8);
      const distance = 130 + (i % 3) * 35;
      const iconIndex = i % FIREWORKS_ICONS.length;
      const colorIndex = i % FIREWORKS_COLORS.length;
      const delay = (i % 4) * 100;
      const size = 18 + (i % 3) * 6;
      return {
        id: i,
        icon: FIREWORKS_ICONS[iconIndex],
        color: FIREWORKS_COLORS[colorIndex],
        angle,
        distance,
        delay,
        size,
      };
    });
  }, []);

  // Step 1: Thrilling Score Rollup from 1 to targetScore (e.g. 98) over EXACTLY 2.0s
  useEffect(() => {
    let current = 1;
    const duration = 2000; // 2.0 seconds thrilling rollup
    const stepTime = 30;
    const increment = (targetScore - 1) / (duration / stepTime);

    const timer = setInterval(() => {
      current += increment;
      if (current >= targetScore) {
        setDisplayScore(targetScore);
        setPhase('celebration');
        clearInterval(timer);

        // Instant synchronous audio playback
        triggerAudio();
      } else {
        setDisplayScore(Math.floor(current));
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [targetScore]); // eslint-disable-line react-hooks/exhaustive-deps

  // Step 2: Hold score view for EXACTLY 8.0 SECONDS (Total = 2.0s roll + 8.0s hold = 10.0s exact)
  useEffect(() => {
    if (phase !== 'celebration') return;

    const timer = setInterval(() => {
      setCelebrationSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (!hasFinishedRef.current) {
            hasFinishedRef.current = true;
            onCountdownComplete();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [phase, onCountdownComplete]);

  const gradeTitle = getGradeTitle(targetScore);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 bg-black/90 backdrop-blur-xl animate-fadeIn overflow-hidden text-center text-white">
      {/* Dynamic CSS Keyframes for Radial Fireworks Burst */}
      <style>{`
        @keyframes fireworks-pop {
          0% {
            transform: translate(-50%, -50%) scale(0.1) rotate(0deg);
            opacity: 0;
          }
          20% {
            opacity: 1;
            transform: translate(calc(-50% + var(--tx) * 0.45), calc(-50% + var(--ty) * 0.45)) scale(1.4) rotate(45deg);
          }
          60% {
            opacity: 0.95;
            transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(1.1) rotate(90deg);
          }
          100% {
            opacity: 0;
            transform: translate(calc(-50% + var(--tx) * 1.3), calc(-50% + var(--ty) * 1.3)) scale(0.3) rotate(140deg);
          }
        }
      `}</style>

      {/* Top Title: EXCELLENT! */}
      <div className="mb-2 max-w-xl">
        <h1
          className="text-4xl md:text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-teal-300 via-yellow-300 to-teal-300 uppercase drop-shadow-lg"
          style={{ fontFamily: 'Space Grotesk, sans-serif' }}
        >
          EXCELLENT!
        </h1>
        <p className="text-sm md:text-base text-zinc-300 font-semibold mt-1 truncate">
          {completedSong.title} — {completedSong.artist}
          {completedSong.guestName && (
            <span className="text-teal-400 font-bold ml-1.5">({completedSong.guestName})</span>
          )}
        </p>
      </div>

      {/* GIGANTIC CENTER SCORE with Radial Fireworks Burst (No background box) */}
      <div className="relative my-2 flex flex-col items-center justify-center w-full max-w-2xl min-h-[200px] md:min-h-[260px]">
        {/* Fireworks explosion layer when Score Revealed */}
        {phase === 'celebration' && (
          <div className="absolute inset-0 pointer-events-none overflow-visible z-0" aria-hidden="true">
            {particles.map((p) => {
              const Icon = p.icon;
              const rad = (p.angle * Math.PI) / 180;
              const tx = Math.cos(rad) * (p.distance * 1.35);
              const ty = Math.sin(rad) * (p.distance * 1.35);

              return (
                <div
                  key={p.id}
                  className="absolute top-1/2 left-1/2 pointer-events-none"
                  style={{
                    animation: `fireworks-pop 2.2s cubic-bezier(0.15, 0.85, 0.35, 1.2) infinite`,
                    animationDelay: `${p.delay}ms`,
                    ['--tx' as any]: `${tx}px`,
                    ['--ty' as any]: `${ty}px`,
                  }}
                >
                  <div
                    className="p-3 rounded-full shadow-2xl backdrop-blur-md flex items-center justify-center"
                    style={{
                      backgroundColor: `${p.color}25`,
                      border: `1.5px solid ${p.color}80`,
                      boxShadow: `0 0 25px ${p.color}`,
                    }}
                  >
                    <Icon style={{ width: `${p.size * 1.2}px`, height: `${p.size * 1.2}px`, color: p.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Gigantic Score Number Font */}
        <div
          className={`text-[9rem] sm:text-[12rem] md:text-[15rem] leading-none font-black tracking-tighter font-mono z-10 transition-all duration-300 text-transparent bg-clip-text bg-gradient-to-b from-white via-teal-200 to-teal-400 ${
            phase === 'celebration' ? 'scale-105 drop-shadow-[0_0_55px_rgba(45,212,191,0.85)]' : ''
          }`}
          style={{ fontFamily: 'Space Grotesk, sans-serif' }}
        >
          {displayScore}
        </div>
      </div>

      {/* Label: SCORE */}
      <div
        className="text-2xl md:text-4xl font-black uppercase tracking-[0.35em] text-teal-400 mb-4 drop-shadow"
        style={{ fontFamily: 'Space Grotesk, sans-serif' }}
      >
        SCORE
      </div>

      {/* Grade Title Badge */}
      <div className="mb-6 px-6 py-2 rounded-full bg-teal-400/15 border border-teal-400/40 font-black text-xs md:text-sm text-teal-300 uppercase tracking-widest backdrop-blur-md shadow-xl">
        {gradeTitle}
      </div>

      {/* Minimal Bottom Up Next Banner */}
      {nextSong ? (
        <div className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 backdrop-blur-md max-w-md text-xs shadow-lg">
          <span className="font-extrabold text-teal-400 uppercase tracking-wider shrink-0">
            UP NEXT ({celebrationSeconds}s):
          </span>
          <span className="font-bold text-white truncate">{nextSong.title}</span>
          <span className="text-zinc-400 truncate">· {nextSong.artist}</span>
        </div>
      ) : (
        <div className="text-xs text-zinc-400 font-medium">
          Proceeding in <strong className="text-teal-400 font-bold">{celebrationSeconds}s</strong> · Queue is empty
        </div>
      )}
    </div>
  );
}


