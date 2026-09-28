'use client';

// ============================================================
// OKEKARAOKE — Now Playing Bar
// Shows the currently playing song information
// ============================================================

import { Play, User, Music2 } from 'lucide-react';
import type { EnrichedQueueItem } from '@/lib/types';

interface NowPlayingProps {
  currentSong: EnrichedQueueItem | null;
}

export function NowPlaying({ currentSong }: NowPlayingProps) {
  if (!currentSong) {
    return (
      <div
        className="flex items-center gap-3 px-6 py-3 shrink-0"
        style={{
          background: 'rgba(5, 5, 8, 0.95)',
          borderTop: '1px solid var(--color-border)',
        }}
      >
        <Music2 size={20} className="text-slate-600" />
        <span className="text-slate-600 font-medium">STANDING BY — Reserve a song to get started</span>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-4 px-6 py-3 shrink-0"
      style={{
        background: 'rgba(5, 5, 8, 0.95)',
        borderTop: '1px solid rgba(99, 102, 241, 0.2)',
      }}
    >
      {/* Playing indicator */}
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="flex gap-0.5 items-end h-5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1 rounded-full"
              style={{
                background: '#6366f1',
                height: `${[60, 100, 75][i]}%`,
                animation: `pulse-bar ${0.8 + i * 0.15}s ease-in-out infinite alternate`,
              }}
            />
          ))}
        </div>
        <Play size={14} className="text-indigo-400 fill-indigo-400" />
      </div>

      {/* Song info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest shrink-0">NOW PLAYING</span>
          <p className="text-white font-bold truncate tv-body">
            {currentSong.song.title}
          </p>
          <span className="text-slate-500 shrink-0">·</span>
          <p className="text-slate-400 truncate text-sm shrink-0">
            {currentSong.song.artist}
          </p>
        </div>
      </div>

      {/* Guest */}
      {currentSong.guest_name && (
        <div className="flex items-center gap-1.5 shrink-0 px-3 py-1 rounded-full" style={{ background: 'rgba(255, 255, 255, 0.05)' }}>
          <User size={12} className="text-slate-400" />
          <span className="text-sm text-slate-300 font-medium">{currentSong.guest_name}</span>
        </div>
      )}

      <style>{`
        @keyframes pulse-bar {
          from { transform: scaleY(0.5); }
          to { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}
