'use client';

// ============================================================
// OKEKARAOKE — Minimal Clean Score Result Modal
// Clean, elegant, logo-teal styled videoke performance score modal
// ============================================================

import { useEffect, useState, useRef } from 'react';
import { Music2, Play } from 'lucide-react';

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
  if (score === 100) return 'PERFECT SUPERSTAR';
  if (score >= 95) return 'SUPERSTAR VOCALS';
  if (score >= 90) return 'GREAT PERFORMANCE';
  return 'GOOD EFFORT';
}

export default function KaraokeScoreModal({
  completedSong,
  nextSong,
  onCountdownComplete,
  onSkip,
}: KaraokeScoreModalProps) {
  const [targetScore] = useState(() => {
    const seedStr = `${completedSong.title}-${completedSong.artist}`;
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
      hash = (hash << 5) - hash + seedStr.charCodeAt(i);
      hash |= 0;
    }
    return 88 + (Math.abs(hash) % 12); // 88 to 99
  });

  const [phase, setPhase] = useState<'rolling' | 'revealed'>('rolling');
  const [displayScore, setDisplayScore] = useState(40);
  const [countdown, setCountdown] = useState(5);
  const hasFinishedRef = useRef(false);

  // Score Rollup Effect
  useEffect(() => {
    let current = 40;
    const duration = 1200; // 1.2s rollup
    const stepTime = 25;
    const increment = (targetScore - 40) / (duration / stepTime);

    const timer = setInterval(() => {
      current += increment;
      if (current >= targetScore) {
        setDisplayScore(targetScore);
        setPhase('revealed');
        clearInterval(timer);

        // Subtle audio fanfare sound
        try {
          const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (AudioCtx) {
            const ctx = new AudioCtx();
            const notes = targetScore >= 95 ? [523.25, 659.25, 783.99, 1046.50] : [440, 554.37, 659.25, 880];
            notes.forEach((freq, idx) => {
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.type = 'triangle';
              osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.1);
              gain.gain.setValueAtTime(0.1, ctx.currentTime + idx * 0.1);
              gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.1 + 0.25);
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.start(ctx.currentTime + idx * 0.1);
              osc.stop(ctx.currentTime + idx * 0.1 + 0.3);
            });
          }
        } catch {}
      } else {
        setDisplayScore(Math.floor(current));
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [targetScore]);

  // Countdown timer once score revealed
  useEffect(() => {
    if (phase !== 'revealed') return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl animate-fadeIn">
      {/* Minimal Glass Container */}
      <div className="relative z-10 w-full max-w-lg bg-zinc-900/90 border border-teal-500/40 p-8 rounded-3xl text-center text-white shadow-2xl flex flex-col items-center">
        
        {/* Header Badge */}
        <p className="text-[10px] font-black text-teal-400 uppercase tracking-widest mb-4">
          PERFORMANCE SCORE
        </p>

        {/* Completed Song Title & Artist */}
        <div className="mb-4 max-w-md">
          <h2 className="text-2xl font-black text-white truncate tracking-tight">
            {completedSong.title}
          </h2>
          <p className="text-sm text-zinc-300 font-medium truncate mt-0.5">
            {completedSong.artist}
            {completedSong.guestName && (
              <span className="text-teal-400 font-semibold ml-2">
                · {completedSong.guestName}
              </span>
            )}
          </p>
        </div>

        {/* Big Score Display */}
        <div className="my-3 flex flex-col items-center justify-center">
          <div className="text-8xl font-black tracking-tighter text-white font-mono drop-shadow-md">
            {displayScore}
          </div>
        </div>

        {/* Grade Badge */}
        <div className="mb-6 px-4 py-1.5 rounded-full bg-teal-400/20 border border-teal-400/50 font-black text-sm text-teal-300 uppercase tracking-wider">
          {gradeTitle}
        </div>

        {/* Next Song Footer Bar */}
        <div className="w-full bg-zinc-800/80 border border-zinc-700/70 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-left">
          {nextSong ? (
            <>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-teal-400/20 border border-teal-400/30 flex items-center justify-center text-teal-400 shrink-0">
                  <Music2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-black uppercase tracking-wider text-teal-400 block">
                    UP NEXT ({countdown}s)
                  </span>
                  <p className="text-xs font-bold text-white truncate">{nextSong.title}</p>
                </div>
              </div>

              <button
                onClick={() => {
                  if (!hasFinishedRef.current) {
                    hasFinishedRef.current = true;
                    onSkip ? onSkip() : onCountdownComplete();
                  }
                }}
                className="px-3.5 py-2 rounded-xl bg-teal-400 hover:bg-teal-300 text-black font-black text-xs uppercase tracking-wider transition-all flex items-center gap-1 shrink-0 active:scale-95 shadow-md"
              >
                <span>Play Now</span>
                <Play className="w-3.5 h-3.5 fill-black" />
              </button>
            </>
          ) : (
            <div className="w-full text-center py-1 text-xs text-zinc-400 font-medium">
              Queue is empty — reserve songs on your phone remote!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
