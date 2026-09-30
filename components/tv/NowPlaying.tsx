'use client';

// ============================================================
// OKEKARAOKE — Now Playing Floating Glass Bar
// Sleek, transparent glassmorphism overlay for current song
// ============================================================

import { Mic2 } from 'lucide-react';
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
      className="flex items-center gap-3.5 px-4 py-2.5 rounded-2xl max-w-sm md:max-w-md bg-zinc-950/85 border border-zinc-800 shadow-2xl"
      style={{
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      {/* Playing equalizer indicator */}
      <div className="flex gap-0.5 items-end h-5 shrink-0 px-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="w-1 rounded-full bg-teal-400"
            style={{
              height: `${[40, 90, 60, 100][i]}%`,
              animation: `pulse-bar ${0.6 + i * 0.12}s ease-in-out infinite alternate`,
            }}
          />
        ))}
      </div>

      {/* Song info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[10px] font-black text-teal-400 uppercase tracking-wider shrink-0">
            NOW PLAYING
          </span>
          {currentSong.guest_name && (
            <div className="flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-900 border border-zinc-800 text-zinc-300">
              <Mic2 size={10} className="text-teal-400" />
              <span className="truncate max-w-28">{currentSong.guest_name}</span>
            </div>
          )}
        </div>
        <h3 className="text-base md:text-lg font-black text-white truncate tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          {displayTitle}
        </h3>
        <p className="text-xs text-zinc-400 font-semibold truncate">
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
