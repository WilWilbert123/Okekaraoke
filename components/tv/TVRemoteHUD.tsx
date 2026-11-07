'use client';

// ============================================================
// OKEKARAOKE — TV Remote Control HUD (Heads-Up Display)
// Responsive spatial D-Pad navigation for Smart TV Remotes
// (Android TV, Fire TV, Tizen, webOS, Apple TV, PC Keyboards)
// ============================================================

import React from 'react';
import { RotateCcw, Play, Pause, SkipForward, ListMusic, Maximize2, Minimize2 } from 'lucide-react';

export interface TVRemoteButton {
  id: 'restart' | 'play_pause' | 'skip' | 'queue' | 'fullscreen';
  label: string;
  sublabel: string;
}

export const TV_REMOTE_BUTTONS: TVRemoteButton[] = [
  { id: 'restart', label: 'Restart', sublabel: '0:00' },
  { id: 'play_pause', label: 'Play / Pause', sublabel: 'OK' },
  { id: 'skip', label: 'Next Song', sublabel: 'Skip' },
  { id: 'queue', label: 'Queue', sublabel: 'List' },
  { id: 'fullscreen', label: 'Fullscreen', sublabel: 'View' },
];

interface TVRemoteHUDProps {
  visible: boolean;
  focusedIndex: number;
  isPlaying: boolean;
  hasSong: boolean;
  queueCount: number;
  isFullscreen: boolean;
  onSelectIndex: (index: number) => void;
  onExecuteIndex: (index: number) => void;
}

export function TVRemoteHUD({
  visible,
  focusedIndex,
  isPlaying,
  hasSong,
  queueCount,
  isFullscreen,
  onSelectIndex,
  onExecuteIndex,
}: TVRemoteHUDProps) {
  return (
    <div
      aria-label="TV Remote Controls"
      className={`fixed bottom-12 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-auto transition-all duration-300 select-none ${
        visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-6 scale-95 pointer-events-none'
      }`}
    >
      {/* Remote Navigation Hint Banner */}
      <div className="flex items-center gap-2 px-3.5 py-1 rounded-full bg-zinc-950/85 backdrop-blur-md border border-zinc-800 text-[11px] font-bold text-zinc-300 shadow-xl">
        <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
        <span className="text-teal-400 font-black tracking-wider uppercase">TV Remote</span>
        <span className="text-zinc-500">•</span>
        <span>Use ◀ ▶ arrows to navigate • OK / Enter to select</span>
      </div>

      {/* Control Buttons Container */}
      <div className="flex items-center gap-2.5 p-2 bg-zinc-950/95 backdrop-blur-2xl border border-zinc-800/90 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.9)]">
        {TV_REMOTE_BUTTONS.map((item, index) => {
          const isFocused = focusedIndex === index;

          let Icon = Play;
          let activeLabel = item.label;

          if (item.id === 'restart') {
            Icon = RotateCcw;
          } else if (item.id === 'play_pause') {
            Icon = isPlaying ? Pause : Play;
            activeLabel = isPlaying ? 'Pause' : 'Play';
          } else if (item.id === 'skip') {
            Icon = SkipForward;
          } else if (item.id === 'queue') {
            Icon = ListMusic;
            activeLabel = `Queue (${queueCount})`;
          } else if (item.id === 'fullscreen') {
            Icon = isFullscreen ? Minimize2 : Maximize2;
            activeLabel = isFullscreen ? 'Window' : 'Fullscreen';
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectIndex(index);
                onExecuteIndex(index);
              }}
              className={`relative flex flex-col items-center justify-center gap-1 min-w-[76px] py-2 px-2.5 rounded-xl transition-all duration-150 outline-none ${
                isFocused
                  ? 'bg-teal-500/25 border-2 border-teal-400 text-white shadow-[0_0_20px_rgba(45,212,191,0.5)] scale-110 z-10'
                  : 'bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Icon size={20} className={isFocused ? 'text-teal-300' : 'text-zinc-400'} />
              <span className={`text-[11px] font-extrabold whitespace-nowrap ${isFocused ? 'text-white' : 'text-zinc-300'}`}>
                {activeLabel}
              </span>
              <span className={`text-[9px] font-mono tracking-tighter ${isFocused ? 'text-teal-300 font-bold' : 'text-zinc-500'}`}>
                {item.sublabel}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

