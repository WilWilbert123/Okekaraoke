'use client';

// ============================================================
// OKEKARAOKE — Clean Minimalist Song Thumbnail Component
// 100% immune to broken image icons in airplane mode / offline
// Priority:
// 1. Cached local Base64 thumbnail (from IndexedDB)
// 2. Online YouTube thumbnail (when connected)
// 3. Ultra-clean Minimalist Vinyl Cover Fallback (Zero text redundancy)
// ============================================================

import React, { useState, useEffect } from 'react';
import { Music2, Disc } from 'lucide-react';

interface OfflineSongThumbnailProps {
  song: {
    title: string;
    artist: string;
    code?: string | null;
    youtube_video_id?: string | null;
    thumbnail_url?: string | null;
    thumbnail_data?: string | null;
  };
  layoutMode?: 'list' | 'grid-3' | 'grid-4' | 'grid-5' | 'grid-6';
  className?: string;
}

export function OfflineSongThumbnail({
  song,
  layoutMode = 'grid-3',
  className = '',
}: OfflineSongThumbnailProps) {
  // Use locally saved Base64 data URL first, fallback to remote URL
  const candidateUrl =
    song.thumbnail_data ||
    song.thumbnail_url ||
    (song.youtube_video_id ? `https://img.youtube.com/vi/${song.youtube_video_id}/mqdefault.jpg` : null);

  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  // Reset state when candidate URL changes
  useEffect(() => {
    setImgError(false);
    setImgLoaded(false);
  }, [candidateUrl]);

  // ─── Clean Minimalist Vinyl Sleeve (Zero Redundant Text) ────────────────
  const renderCleanFallback = () => {
    const isMicro = layoutMode === 'grid-5' || layoutMode === 'grid-6';
    const isCompact = layoutMode === 'grid-4';

    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-950 to-black relative select-none overflow-hidden">
        {/* Subtle decorative vinyl disc grooves */}
        <div className="absolute w-[80%] aspect-square rounded-full border border-white/[0.04] flex items-center justify-center pointer-events-none">
          <div className="w-[60%] aspect-square rounded-full border border-white/[0.04] flex items-center justify-center">
            <div className="w-[40%] aspect-square rounded-full bg-zinc-900/90 border border-teal-500/20" />
          </div>
        </div>

        {/* Center Icon */}
        <div className="relative z-10 flex flex-col items-center justify-center">
          <Music2
            size={isMicro ? 14 : isCompact ? 18 : 22}
            className="text-teal-400/80 drop-shadow-[0_0_8px_rgba(45,212,191,0.2)]"
          />
        </div>
      </div>
    );
  };

  // If candidateUrl is absent or failed, render the clean vinyl sleeve (NO <img> tag in DOM)
  if (!candidateUrl || imgError) {
    return <div className={`w-full h-full ${className}`}>{renderCleanFallback()}</div>;
  }

  return (
    <div className={`w-full h-full relative overflow-hidden bg-zinc-950 ${className}`}>
      {/* Clean placeholder while image is loading */}
      {!imgLoaded && (
        <div className="absolute inset-0 z-0">
          {renderCleanFallback()}
        </div>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={candidateUrl}
        alt={song.title}
        loading="lazy"
        decoding="async"
        onLoad={() => setImgLoaded(true)}
        onError={() => setImgError(true)}
        className={`w-full h-full object-cover scale-[1.03] group-hover:scale-105 transition-transform duration-200 relative z-10 ${
          imgLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
}
