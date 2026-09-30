'use client';

// ============================================================
// OKEKARAOKE — Now Playing Floating Glass Bar
// Sleek, transparent glassmorphism overlay for current song
// ============================================================

import { Play, User, Music2 } from 'lucide-react';
import type { EnrichedQueueItem } from '@/lib/types';

interface NowPlayingProps {
  currentSong: EnrichedQueueItem | null;
}

export function NowPlaying({ currentSong }: NowPlayingProps) {
  if (!currentSong) {
    return null;
  }

  let displayTitle = currentSong.song.title;
  let displayArtist = currentSong.song.artist;

  // Auto-swap check if artist and title were reversed in legacy database entries
  if (
    displayTitle &&
    displayArtist &&
    (
      (displayTitle.toLowerCase().includes('itchyworms') && displayArtist.toLowerCase().includes('beer')) ||
      (displayTitle.toLowerCase().includes('rivermaya') && displayArtist.toLowerCase().includes('214')) ||
      (displayTitle.toLowerCase().includes('bamboo') && displayArtist.toLowerCase().includes('tatsulok')) ||
      (displayTitle.toLowerCase().includes('eraserheads') && displayArtist.toLowerCase().includes('el bimbo')) ||
      (displayTitle.toLowerCase().includes('kamikazee') && displayArtist.toLowerCase().includes('narda'))
    )
  ) {
    const temp = displayTitle;
    displayTitle = displayArtist;
    displayArtist = temp;
  }

  return (
    <div
      className="flex items-center gap-3.5 px-4 py-2.5 rounded-2xl max-w-sm md:max-w-md"
      style={{
        background: 'rgba(5, 5, 12, 0.55)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
      }}
    >
      {/* Playing equalizer indicator */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex gap-0.5 items-end h-6">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-1 rounded-full"
              style={{
                background: 'linear-gradient(to top, #6366f1, #a78bfa)',
                height: `${[40, 90, 60, 100][i]}%`,
                animation: `pulse-bar ${0.6 + i * 0.12}s ease-in-out infinite alternate`,
              }}
            />
          ))}
        </div>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(34, 197, 94, 0.2)', border: '1px solid rgba(34, 197, 94, 0.4)' }}>
          <Play size={13} className="text-green-400 fill-green-400" />
        </div>
      </div>

      {/* Song info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-green-400 uppercase tracking-widest shrink-0">NOW PLAYING</span>
          {currentSong.guest_name && (
            <div className="flex items-center gap-1 shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold text-indigo-300" style={{ background: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
              <User size={10} />
              <span>{currentSong.guest_name}</span>
            </div>
          )}
        </div>
        <p className="text-white font-black text-lg md:text-xl truncate tracking-tight drop-shadow-md">
          {displayTitle}
        </p>
        <p className="text-slate-300 font-medium text-xs md:text-sm truncate opacity-90">
          {displayArtist}
        </p>
      </div>

      <style>{`
        @keyframes pulse-bar {
          from { transform: scaleY(0.4); }
          to { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}
