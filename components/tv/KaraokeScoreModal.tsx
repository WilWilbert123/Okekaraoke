'use client';

import { useEffect, useState, useRef } from 'react';
import { Music2, Sparkles, Play } from 'lucide-react';

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

function getGradeInfo(score: number) {
  if (score === 100) {
    return {
      title: 'PERFECT SUPERSTAR!',
      subtitle: 'LEGENDARY PERFORMANCE 🌟',
      badgeColor: 'from-amber-400 to-yellow-500 text-slate-950 border-amber-300',
      textColor: 'text-amber-400',
      glow: 'shadow-[0_0_80px_rgba(251,191,36,0.6)]',
    };
  }
  if (score >= 95) {
    return {
      title: 'SUPERSTAR VOCALS!',
      subtitle: 'OUTSTANDING SINGING! ✨',
      badgeColor: 'from-emerald-400 to-teal-500 text-slate-950 border-emerald-300',
      textColor: 'text-emerald-400',
      glow: 'shadow-[0_0_80px_rgba(52,211,153,0.5)]',
    };
  }
  if (score >= 90) {
    return {
      title: 'GREAT PERFORMANCE!',
      subtitle: 'TERRIFIC JOB! 👏',
      badgeColor: 'from-sky-400 to-indigo-500 text-white border-sky-300',
      textColor: 'text-sky-400',
      glow: 'shadow-[0_0_80px_rgba(56,189,248,0.5)]',
    };
  }
  return {
    title: 'GOOD EFFORT!',
    subtitle: 'KEEP SINGING! 🎤',
    badgeColor: 'from-purple-400 to-indigo-500 text-white border-purple-300',
    textColor: 'text-purple-400',
    glow: 'shadow-[0_0_80px_rgba(168,85,247,0.4)]',
  };
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

  const [phase, setPhase] = useState<'analyzing' | 'rolling' | 'revealed'>('analyzing');
  const [displayScore, setDisplayScore] = useState(0);
  const [countdown, setCountdown] = useState(6);
  const hasFinishedRef = useRef(false);


  useEffect(() => {
    const analyzeTimer = setTimeout(() => {
      setPhase('rolling');
    }, 1200);

    return () => clearTimeout(analyzeTimer);
  }, []);


  useEffect(() => {
    if (phase !== 'rolling') return;

    let current = 40; // Start rollup from 40 for suspense!
    const duration = 1600; // 1.6s rollup
    const stepTime = 30;
    const increment = (targetScore - 40) / (duration / stepTime);

    const timer = setInterval(() => {
      current += increment;
      if (current >= targetScore) {
        setDisplayScore(targetScore);
        setPhase('revealed');
        clearInterval(timer);


        try {
          const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (AudioCtx) {
            const ctx = new AudioCtx();
            const notes = targetScore >= 95 ? [523.25, 659.25, 783.99, 1046.50] : [440, 554.37, 659.25, 880];
            notes.forEach((freq, idx) => {
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.type = 'triangle';
              osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
              gain.gain.setValueAtTime(0.12, ctx.currentTime + idx * 0.12);
              gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.3);
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.start(ctx.currentTime + idx * 0.12);
              osc.stop(ctx.currentTime + idx * 0.12 + 0.35);
            });
          }
        } catch { }

      } else {
        setDisplayScore(Math.floor(current));
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [phase, targetScore]);

  // Phase 3: 6-Second Countdown Timer (starts when revealed)
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

  const grade = getGradeInfo(targetScore);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-2xl animate-fadeIn">
      {/* Background glowing ambient radial */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 blur-3xl animate-pulse" />
      </div>

      {/* Main Score Card Modal */}
      <div className={`relative z-10 w-full max-w-2xl bg-slate-900/90 border border-slate-700/80 p-8 sm:p-10 rounded-3xl text-center text-white ${phase === 'revealed' ? grade.glow : 'shadow-2xl'} transition-all duration-500 flex flex-col items-center`}>

        {/* Top Header Badge */}
        <div className="flex items-center justify-center gap-2 mb-4 px-4 py-1.5 rounded-full bg-slate-800/90 border border-slate-700 text-xs sm:text-sm font-bold tracking-widest text-slate-300 uppercase">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>OKEKARAOKE SCORE RESULT</span>
          <Sparkles className="w-4 h-4 text-amber-400" />
        </div>

        {/* Completed Song Title */}
        <div className="mb-6 max-w-lg">
          <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
            Completed Song
          </p>
          <h2 className="text-2xl sm:text-3xl font-black text-white truncate tracking-tight">
            {completedSong.title}
          </h2>
          <p className="text-base sm:text-lg text-slate-300 font-medium truncate mt-0.5">
            {completedSong.artist}
            {completedSong.guestName && (
              <span className="text-indigo-400 font-semibold ml-2">
                · Sung by {completedSong.guestName}
              </span>
            )}
          </p>
        </div>

        {/* Big Animated Score Display / Vocal Analysis */}
        <div className="relative my-4 min-h-[140px] flex flex-col items-center justify-center">
          {phase === 'analyzing' ? (
            <div className="flex flex-col items-center gap-3 py-4 animate-fadeIn">
              <div className="flex items-center gap-1.5 h-10">
                <span className="w-2 bg-indigo-500 h-6 rounded-full animate-pulse" />
                <span className="w-2 bg-purple-500 h-10 rounded-full animate-bounce delay-100" />
                <span className="w-2 bg-pink-500 h-8 rounded-full animate-pulse delay-200" />
                <span className="w-2 bg-amber-400 h-10 rounded-full animate-bounce delay-300" />
                <span className="w-2 bg-emerald-400 h-6 rounded-full animate-pulse delay-400" />
              </div>
              <p className="text-sm font-bold tracking-wider uppercase text-indigo-400 animate-pulse">
                ANALYZING VOCAL ACCURACY &amp; PITCH...
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center animate-fadeIn">
              <div className="text-7xl sm:text-9xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-100 to-slate-400 drop-shadow-[0_10px_30px_rgba(255,255,255,0.4)]">
                {displayScore}
              </div>
              <span className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-indigo-400 mt-2">
                VOCAL PERFORMANCE SCORE
              </span>
            </div>
          )}
        </div>

        {/* Grade Banner */}
        {phase === 'revealed' ? (
          <div className={`mt-2 mb-8 px-6 py-2.5 rounded-2xl bg-gradient-to-r ${grade.badgeColor} border font-black text-lg sm:text-2xl tracking-wide shadow-lg uppercase animate-bounce`}>
            {grade.title}
          </div>
        ) : (
          <div className="mt-2 mb-8 px-6 py-2.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 font-bold text-sm text-slate-400 tracking-wider uppercase">
            {phase === 'analyzing' ? 'CALCULATING GRADE...' : 'CALCULATING FINAL RESULT...'}
          </div>
        )}

        {/* Next Song Preview or Queue Finished */}
        <div className="w-full bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-left">
          {nextSong ? (
            <>
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
                  <Music2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 block">
                    UP NEXT ({countdown}s)
                  </span>
                  <p className="text-sm font-bold text-white truncate">{nextSong.title}</p>
                  <p className="text-xs text-slate-400 truncate">{nextSong.artist}</p>
                </div>
              </div>

              <button
                onClick={() => {
                  if (!hasFinishedRef.current) {
                    hasFinishedRef.current = true;
                    onSkip ? onSkip() : onCountdownComplete();
                  }
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shrink-0 shadow-md active:scale-95"
              >
                <span>Play Now</span>
                <Play className="w-4 h-4 fill-white" />
              </button>
            </>
          ) : (
            <div className="w-full text-center py-1">
              <p className="text-sm font-bold text-slate-300">Queue is empty!</p>
              <p className="text-xs text-slate-400">Scan QR Code on Phone Remote to add more songs.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
