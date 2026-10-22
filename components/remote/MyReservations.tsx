'use client';

// ============================================================
// OKEKARAOKE — My Reservations & Favorites Component
// Allows each user to view/manage queued songs and favorite songs
// ============================================================

import { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react';
import {
  Star,
  Loader2,
  Trash2,
  Square,
  Play,
  Pause,
  CheckCircle,
  Plus,
  Music2,
  AlertTriangle,
  RotateCcw,
  History,
  Clock,
  Calendar,
  X,
  Download,
  HardDrive,
  Smartphone,
  Sparkles,
  Search,
  Maximize2,
  Minimize2,
  SkipBack,
  SkipForward,
  ListMusic,
} from 'lucide-react';
import type { EnrichedQueueItem, Song } from '@/lib/types';
import { getFavoriteSongs, toggleFavoriteSong } from '@/lib/utils/favorites';
import { getSongHistory, removeSongFromHistory, clearSongHistory, formatHistoryDate, addSongToHistory, type SongHistoryItem, type HistorySong } from '@/lib/utils/songHistory';
import {
  getDownloadedSongs,
  deleteDownloadedSong,
  clearAllDownloads,
  getStorageUsage,
  createSongMediaUrl,
  DOWNLOADS_CHANGED_EVENT,
  type DownloadedSong,
  type StorageUsage,
} from '@/lib/utils/offlineStorage';
import { OfflineSongThumbnail } from '@/components/remote/OfflineSongThumbnail';
import { AudioVisualizer } from '@/components/tv/AudioVisualizer';

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

interface FavoriteCardProps {
  song: Song;
  isReserving: boolean;
  onToggleFavorite: (song: Song) => void;
  onReserve: (song: Song) => void;
}

const FavoriteCard = memo(function FavoriteCard({
  song,
  isReserving,
  onToggleFavorite,
  onReserve,
}: FavoriteCardProps) {
  const songThumb =
    song.thumbnail_url ||
    (song.youtube_video_id
      ? `https://img.youtube.com/vi/${song.youtube_video_id}/mqdefault.jpg`
      : '');

  return (
    <div
      className="flex flex-col justify-between p-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800/80 hover:border-zinc-700 shadow-sm relative group overflow-hidden"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '0 160px' }}
    >
      {/* Top: Thumbnail with 16:9 Aspect Ratio + Star Toggle Button */}
      <div className="relative aspect-video w-full rounded-md sm:rounded-lg overflow-hidden bg-zinc-950 shrink-0 border border-zinc-800/80 flex items-center justify-center">
        <OfflineSongThumbnail song={song} layoutMode="grid-3" />

        {/* Top-Right Floating Star Button */}
        <div className="absolute top-1 right-1 z-10">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(song);
            }}
            className="w-5 h-5 rounded bg-zinc-950/90 border border-white/10 flex items-center justify-center text-yellow-400 active:scale-90 transition-transform shadow-sm"
            title="Remove from favorites"
            aria-label={`Remove ${song.title} from favorites`}
          >
            <Star size={10} className="fill-yellow-400 text-yellow-400" />
          </button>
        </div>

        {/* Song Code badge or Type (bottom left) */}
        {song.code && song.code !== 'YT' ? (
          <div className="absolute bottom-1 left-1 px-1 py-0.2 rounded bg-zinc-950/90 text-[7px] font-mono font-bold text-teal-300 border border-teal-500/30">
            #{song.code}
          </div>
        ) : song.song_type ? (
          <div className="absolute bottom-1 left-1 px-1 py-0.2 rounded bg-zinc-950/90 text-[7px] font-bold text-teal-300 border border-teal-500/30 uppercase truncate max-w-[50px]">
            {song.song_type}
          </div>
        ) : null}
      </div>

      {/* Middle: Title & Artist */}
      <div className="mt-1 min-w-0 flex-1 flex flex-col justify-between">
        <div>
          <p className="font-bold text-white text-[10px] leading-tight line-clamp-1 truncate" title={song.title}>
            {song.title}
          </p>
          <p className="text-[9px] text-zinc-400 truncate mt-0.5" title={song.artist}>
            {song.artist}
          </p>
        </div>
      </div>

      {/* Bottom: Clean "RESERVE" Button */}
      <button
        id={`reserve-fav-btn-${song.id || song.code}`}
        onClick={() => onReserve(song)}
        disabled={isReserving}
        className="mt-1.5 w-full h-6.5 rounded-md sm:rounded-lg flex items-center justify-center gap-1 bg-teal-400 hover:bg-teal-300 text-black text-[9px] font-black transition-all active:scale-95 shadow-sm disabled:opacity-50 shrink-0"
        title={`Reserve ${song.title}`}
        aria-label={`Reserve ${song.title}`}
      >
        {isReserving ? (
          <Loader2 size={10} className="animate-spin text-black" />
        ) : (
          <>
            <Plus size={10} className="stroke-[3]" />
            <span>RESERVE</span>
          </>
        )}
      </button>
    </div>
  );
});

interface HistoryCardProps {
  item: SongHistoryItem & { formattedDate: string };
  isFavorited: boolean;
  isReserving: boolean;
  onToggleFavorite: (song: HistorySong) => void;
  onRemove: (id: string) => void;
  onReserve: (song: HistorySong, id: string) => void;
}

const HistoryCard = memo(function HistoryCard({
  item,
  isFavorited,
  isReserving,
  onToggleFavorite,
  onRemove,
  onReserve,
}: HistoryCardProps) {
  const songThumb =
    item.song.thumbnail_url ||
    (item.song.youtube_video_id
      ? `https://img.youtube.com/vi/${item.song.youtube_video_id}/mqdefault.jpg`
      : '');

  return (
    <div
      className="flex flex-col justify-between p-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800/80 hover:border-zinc-700 shadow-sm relative group overflow-hidden"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '0 160px' }}
    >
      {/* Top: Thumbnail with 16:9 Aspect Ratio + Floating Badges */}
      <div className="relative aspect-video w-full rounded-md sm:rounded-lg overflow-hidden bg-zinc-950 shrink-0 border border-zinc-800/80 flex items-center justify-center">
        <OfflineSongThumbnail song={item.song} layoutMode="grid-3" />

        {/* Top-Right Floating Actions: Favorite & Delete from history */}
        <div className="absolute top-1 right-1 flex items-center gap-0.5 z-10">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(item.song);
            }}
            className="w-5 h-5 rounded bg-zinc-950/90 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-yellow-400 active:scale-90 transition-transform shadow-sm"
            title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
            aria-label={`Favorite ${item.song.title}`}
          >
            <Star
              size={10}
              className={isFavorited ? 'fill-yellow-400 text-yellow-400' : ''}
            />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(item.id);
            }}
            className="w-5 h-5 rounded bg-zinc-950/90 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-red-400 active:scale-90 transition-transform shadow-sm"
            title="Remove from history"
            aria-label={`Remove ${item.song.title} from history`}
          >
            <Trash2 size={9} />
          </button>
        </div>

        {/* Song Code badge (bottom left) */}
        {item.song.code && item.song.code !== 'YT' && (
          <div className="absolute bottom-1 left-1 px-1 py-0.2 rounded bg-zinc-950/90 text-[7px] font-mono font-bold text-teal-300 border border-teal-500/30">
            #{item.song.code}
          </div>
        )}
      </div>

      {/* Middle: Title, Artist, & Time Played */}
      <div className="mt-1 min-w-0 flex-1 flex flex-col justify-between">
        <div>
          <p className="font-bold text-white text-[10px] leading-tight line-clamp-1 truncate" title={item.song.title}>
            {item.song.title}
          </p>
          <p className="text-[9px] text-zinc-400 truncate mt-0.5" title={item.song.artist}>
            {item.song.artist}
          </p>
        </div>

        <div className="flex items-center gap-0.5 text-[8px] text-zinc-400 mt-1 truncate">
          <Clock size={8} className="text-teal-400 shrink-0" />
          <span className="truncate">{item.formattedDate}</span>
        </div>
      </div>

      {/* Bottom: Clean "PLAY AGAIN" Button */}
      <button
        id={`reserve-history-btn-${item.id}`}
        onClick={() => onReserve(item.song, item.id)}
        disabled={isReserving}
        className="mt-1.5 w-full h-6.5 rounded-md sm:rounded-lg flex items-center justify-center gap-1 bg-teal-400 hover:bg-teal-300 text-black text-[9px] font-black transition-all active:scale-95 shadow-sm disabled:opacity-50 shrink-0"
        title={`Play ${item.song.title} again`}
        aria-label={`Play ${item.song.title} again`}
      >
        {isReserving ? (
          <Loader2 size={10} className="animate-spin text-black" />
        ) : (
          <>
            <RotateCcw size={9} className="stroke-[2.5]" />
            <span>PLAY AGAIN</span>
          </>
        )}
      </button>
    </div>
  );
});

interface DownloadedSongCardProps {
  song: DownloadedSong;
  isReserving: boolean;
  onPlayOffline: (song: DownloadedSong) => void;
  onReserve: (song: DownloadedSong) => void;
  onDelete: (id: string) => void;
  layoutMode?: 'list' | 'grid-3' | 'grid-4' | 'grid-5' | 'grid-6';
}

const DownloadedSongCard = memo(function DownloadedSongCard({
  song,
  isReserving,
  onPlayOffline,
  onReserve,
  onDelete,
  layoutMode = 'grid-3',
}: DownloadedSongCardProps) {
  const songThumb =
    song.thumbnail_url ||
    (song.youtube_video_id
      ? `https://img.youtube.com/vi/${song.youtube_video_id}/mqdefault.jpg`
      : '');

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '4.2 MB';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // ─── 1. LIST VIEW (Horizontal) ─────────────────────────
  if (layoutMode === 'list') {
    return (
      <div
        className="flex items-center gap-2.5 p-2 rounded-xl bg-zinc-900/90 border border-zinc-800/80 hover:border-teal-500/40 transition-all shadow-sm group"
        style={{ contentVisibility: 'auto', containIntrinsicSize: '0 64px' }}
      >
        {/* Left Thumbnail (16:9, w-20 sm:w-24) */}
        <div
          onClick={() => onPlayOffline(song)}
          className="relative aspect-video w-20 sm:w-24 rounded-lg overflow-hidden bg-zinc-950 shrink-0 border border-zinc-800 flex items-center justify-center cursor-pointer group/thumb"
          title="Tap to preview video locally"
        >
          <OfflineSongThumbnail song={song} layoutMode="list" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity z-20">
            <Play size={12} fill="currentColor" className="text-teal-400" />
          </div>
          <span className="absolute bottom-0.5 right-0.5 px-1 py-0.2 rounded bg-black/80 text-[7px] font-mono font-bold text-teal-300 z-20">
            {formatFileSize(song.file_size_bytes)}
          </span>
        </div>

        {/* Middle: Title, Artist, Code */}
        <div className="min-w-0 flex-1">
          <p className="font-bold text-white text-xs truncate leading-tight" title={song.title}>
            {song.title}
          </p>
          <p className="text-[10px] text-zinc-400 truncate mt-0.5" title={song.artist}>
            {song.artist}
          </p>
          <div className="flex items-center gap-1.5 mt-1 text-[8px] font-mono text-zinc-500">
            <span className="px-1 py-0.2 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 font-bold">
              OFFLINE MP4
            </span>
            {song.code && song.code !== 'YT' && (
              <span>#{song.code}</span>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onPlayOffline(song)}
            className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-teal-300 border border-teal-500/30 flex items-center justify-center active:scale-95 transition-all"
            title="Preview offline"
            aria-label="Preview offline"
          >
            <Play size={11} fill="currentColor" />
          </button>
          <button
            onClick={() => onReserve(song)}
            disabled={isReserving}
            className="w-7 h-7 rounded-lg bg-teal-400 hover:bg-teal-300 text-black flex items-center justify-center active:scale-95 transition-all disabled:opacity-50"
            title="Reserve & sing on Mini TV"
            aria-label="Reserve song"
          >
            {isReserving ? (
              <Loader2 size={11} className="animate-spin text-black" />
            ) : (
              <Plus size={12} className="stroke-[3]" />
            )}
          </button>
          <button
            type="button"
            onClick={() => onDelete(song.id)}
            className="w-7 h-7 rounded-lg bg-zinc-900 hover:bg-red-500/10 text-zinc-500 hover:text-red-400 border border-zinc-800 hover:border-red-500/30 flex items-center justify-center active:scale-95 transition-all"
            title="Delete from device"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    );
  }

  // ─── 2. MICRO GRIDS (grid-5 & grid-6) ──────────────────
  if (layoutMode === 'grid-5' || layoutMode === 'grid-6') {
    return (
      <div
        className="flex flex-col justify-between p-1 rounded-lg bg-zinc-900/90 border border-zinc-800/80 hover:border-teal-500/40 shadow-sm relative group overflow-hidden transition-all"
        style={{ contentVisibility: 'auto', containIntrinsicSize: '0 110px' }}
      >
        <div
          onClick={() => onPlayOffline(song)}
          className="relative aspect-video w-full rounded overflow-hidden bg-zinc-950 shrink-0 border border-zinc-800/80 flex items-center justify-center cursor-pointer group/thumb"
          title="Tap to preview"
        >
          <OfflineSongThumbnail song={song} layoutMode={layoutMode} />

          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity z-20">
            <Play size={9} fill="currentColor" className="text-teal-400" />
          </div>

          <div className="absolute top-0.5 right-0.5 z-20" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(song.id);
              }}
              className="w-3.5 h-3.5 rounded bg-zinc-950/90 text-zinc-400 hover:text-red-400 flex items-center justify-center shadow"
              title="Delete"
            >
              <Trash2 size={7.5} />
            </button>
          </div>

          <span className="absolute bottom-0.5 left-0.5 px-0.5 py-0.2 rounded bg-black/80 text-[6px] font-mono text-teal-300 z-20">
            {formatFileSize(song.file_size_bytes)}
          </span>
        </div>

        <div className="mt-0.5 min-w-0">
          <p className="font-bold text-white text-[7.5px] leading-tight truncate" title={song.title}>
            {song.title}
          </p>
          <p className="text-[6.5px] text-zinc-400 truncate mt-0.5" title={song.artist}>
            {song.artist}
          </p>
        </div>

        <div className="mt-1 grid grid-cols-2 gap-0.5">
          <button
            onClick={() => onPlayOffline(song)}
            className="h-4.5 rounded bg-zinc-800 hover:bg-zinc-700 text-teal-300 flex items-center justify-center active:scale-95 transition-all"
            title="Preview"
          >
            <Play size={7} fill="currentColor" />
          </button>
          <button
            onClick={() => onReserve(song)}
            disabled={isReserving}
            className="h-4.5 rounded bg-teal-400 hover:bg-teal-300 text-black flex items-center justify-center font-bold active:scale-95 transition-all disabled:opacity-50"
            title="Reserve"
          >
            {isReserving ? <Loader2 size={7} className="animate-spin text-black" /> : <Plus size={7.5} className="stroke-[3]" />}
          </button>
        </div>
      </div>
    );
  }

  // ─── 3. COMPACT GRID (grid-4) ──────────────────────────
  if (layoutMode === 'grid-4') {
    return (
      <div
        className="flex flex-col justify-between p-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800/80 hover:border-teal-500/40 shadow-sm relative group overflow-hidden transition-all"
        style={{ contentVisibility: 'auto', containIntrinsicSize: '0 135px' }}
      >
        <div
          onClick={() => onPlayOffline(song)}
          className="relative aspect-video w-full rounded-md overflow-hidden bg-zinc-950 shrink-0 border border-zinc-800/80 flex items-center justify-center cursor-pointer group/thumb"
          title="Tap to preview video locally"
        >
          <OfflineSongThumbnail song={song} layoutMode="grid-4" />

          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity z-20">
            <Play size={10} fill="currentColor" className="text-teal-400" />
          </div>

          <div className="absolute top-0.5 right-0.5 z-20" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(song.id);
              }}
              className="w-4.5 h-4.5 rounded bg-zinc-950/90 text-zinc-400 hover:text-red-400 flex items-center justify-center shadow"
              title="Delete"
            >
              <Trash2 size={9} />
            </button>
          </div>

          <div className="absolute top-0.5 left-0.5 px-1 py-0.2 rounded bg-teal-500/90 text-[6.5px] font-extrabold text-black uppercase tracking-wider z-20">
            MP4
          </div>

          <span className="absolute bottom-0.5 left-0.5 px-1 py-0.2 rounded bg-zinc-950/90 text-[6.5px] font-mono text-teal-300 z-20">
            {formatFileSize(song.file_size_bytes)}
          </span>
        </div>

        <div className="mt-1 min-w-0">
          <p className="font-bold text-white text-[9px] leading-tight truncate" title={song.title}>
            {song.title}
          </p>
          <p className="text-[8px] text-zinc-400 truncate mt-0.5" title={song.artist}>
            {song.artist}
          </p>
        </div>

        <div className="mt-1 grid grid-cols-2 gap-1">
          <button
            onClick={() => onPlayOffline(song)}
            className="h-5.5 rounded-md flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-teal-300"
            title="Preview"
            aria-label="Preview"
          >
            <Play size={8} fill="currentColor" />
          </button>
          <button
            onClick={() => onReserve(song)}
            disabled={isReserving}
            className="h-5.5 rounded-md flex items-center justify-center bg-teal-400 hover:bg-teal-300 active:scale-95 text-black disabled:opacity-50"
            title="Reserve"
            aria-label="Reserve"
          >
            {isReserving ? <Loader2 size={8} className="animate-spin text-black" /> : <Plus size={8} className="stroke-[3]" />}
          </button>
        </div>
      </div>
    );
  }

  // ─── 4. STANDARD GRID (grid-3) ─────────────────────────
  return (
    <div
      className="flex flex-col justify-between p-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800/80 hover:border-teal-500/40 shadow-sm relative group overflow-hidden transition-all"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '0 160px' }}
    >
      {/* Top: Thumbnail with 16:9 Aspect Ratio + Floating Badges */}
      <div 
        onClick={() => onPlayOffline(song)}
        className="relative aspect-video w-full rounded-md sm:rounded-lg overflow-hidden bg-zinc-950 shrink-0 border border-zinc-800/80 flex items-center justify-center cursor-pointer group/thumb"
        title="Tap to preview video locally"
      >
        <OfflineSongThumbnail song={song} layoutMode="grid-3" />

        {/* Play Overlay on Hover */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity z-20">
          <div className="w-6 h-6 rounded-full bg-teal-400 text-black flex items-center justify-center shadow-lg">
            <Play size={11} fill="currentColor" className="ml-0.5" />
          </div>
        </div>

        {/* Delete button (top-right) */}
        <div className="absolute top-1 right-1 z-10" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(song.id);
            }}
            className="w-5 h-5 rounded bg-zinc-950/90 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-red-400 active:scale-90 transition-transform shadow-sm"
            title="Delete from phone storage"
            aria-label={`Delete ${song.title} from device`}
          >
            <Trash2 size={10} />
          </button>
        </div>

        {/* Offline Ready Badge (top-left) */}
        <div className="absolute top-1 left-1 px-1.5 py-0.2 rounded bg-teal-500/90 text-[7px] font-extrabold text-black uppercase tracking-wider flex items-center gap-1 shadow-sm">
          <span className="w-1 h-1 rounded-full bg-black animate-pulse" />
          <span>OFFLINE MP4</span>
        </div>

        {/* File Size & Code Badge (bottom) */}
        <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between text-[7px] font-mono font-bold text-zinc-300">
          <span className="px-1 py-0.2 rounded bg-zinc-950/90 border border-teal-500/30 text-teal-300">
            {formatFileSize(song.file_size_bytes)}
          </span>
          {song.code && song.code !== 'YT' && (
            <span className="px-1 py-0.2 rounded bg-zinc-950/90 border border-white/10 text-zinc-300">
              #{song.code}
            </span>
          )}
        </div>
      </div>

      {/* Middle: Title & Artist */}
      <div className="mt-1 min-w-0 flex-1 flex flex-col justify-between">
        <div>
          <p className="font-bold text-white text-[10px] leading-tight line-clamp-1 truncate" title={song.title}>
            {song.title}
          </p>
          <p className="text-[9px] text-zinc-400 truncate mt-0.5" title={song.artist}>
            {song.artist}
          </p>
        </div>
      </div>

      {/* Bottom Dual Action Buttons: [ ▶ ] & [ + ] */}
      <div className="mt-1.5 grid grid-cols-2 gap-1">
        <button
          onClick={() => onPlayOffline(song)}
          className="h-6.5 rounded-md sm:rounded-lg flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-teal-300 border border-teal-500/40 transition-all shadow-sm"
          title="Preview video locally on device (Verify offline playback)"
          aria-label="Preview video locally on device"
        >
          <Play size={10} fill="currentColor" />
        </button>

        <button
          onClick={() => onReserve(song)}
          disabled={isReserving}
          className="h-6.5 rounded-md sm:rounded-lg flex items-center justify-center bg-teal-400 hover:bg-teal-300 active:scale-95 text-black transition-all disabled:opacity-50 shadow-sm"
          title="Reserve to queue & play on Mini TV"
          aria-label="Reserve song"
        >
          {isReserving ? (
            <Loader2 size={11} className="animate-spin text-black" />
          ) : (
            <Plus size={11} className="stroke-[3]" />
          )}
        </button>
      </div>
    </div>
  );
});

interface MyReservationsProps {
  reservations: EnrichedQueueItem[];
  currentSongId?: string | null;
  sessionId: string;
  roomCode: string;
  guestName?: string;
  onCancelled: () => void;
  allowCancel: boolean;
  onReserved?: (song?: Song, resultData?: any, tempIdToReplace?: string) => void;
  onReserveFailed?: (tempId: string) => void;
  isSoloTVMode?: boolean;
  onSoloStop?: () => void;
  onSoloTogglePlay?: () => void;
  isPaused?: boolean;
  onTogglePause?: (paused: boolean) => void;
  onTogglePauseSong?: (queueItemId: string, paused: boolean) => Promise<void> | void;
  playbackProgress?: {
    currentTime: number;
    duration: number;
    isPlaying: boolean;
  };
  onRestartSong?: (queueItemId: string) => Promise<void> | void;
  onSeekSong?: (queueItemId: string, seconds: number) => Promise<void> | void;
  onStopSong?: (queueItemId: string) => Promise<void> | void;
}

const statusColors = {
  queued: { bg: 'rgba(45, 212, 191, 0.08)', border: 'rgba(45, 212, 191, 0.2)', text: '#2dd4bf', label: 'QUEUED' },
  playing: { bg: 'rgba(34, 197, 94, 0.08)', border: 'rgba(34, 197, 94, 0.2)', text: '#22c55e', label: 'PLAYING' },
  completed: { bg: 'rgba(100, 116, 139, 0.08)', border: 'rgba(100, 116, 139, 0.2)', text: '#64748b', label: 'DONE' },
  cancelled: { bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.2)', text: '#ef4444', label: 'CANCELLED' },
  skipped: { bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.2)', text: '#ef4444', label: 'SKIPPED' },
};

export function MyReservations({
  reservations,
  currentSongId,
  sessionId,
  roomCode,
  guestName,
  onCancelled,
  allowCancel,
  onReserved,
  onReserveFailed,
  isSoloTVMode,
  onSoloStop,
  onSoloTogglePlay,
  isPaused: propIsPaused,
  onTogglePause,
  onTogglePauseSong,
  playbackProgress,
  onRestartSong,
  onSeekSong,
  onStopSong,
}: MyReservationsProps) {
  const [activeTab, setActiveTab] = useState<'reservations' | 'favorites' | 'history' | 'downloads'>('reservations');
  const [favorites, setFavorites] = useState<Song[]>([]);
  const [history, setHistory] = useState<SongHistoryItem[]>([]);
  const [optimisticallyStoppedIds, setOptimisticallyStoppedIds] = useState<Set<string>>(new Set());
  const [restartingId, setRestartingId] = useState<string | null>(null);
  const [controllingId, setControllingId] = useState<string | null>(null);
  const [controlError, setControlError] = useState<string | null>(null);
  const [reservingFavId, setReservingFavId] = useState<string | null>(null);
  const [reservingHistoryId, setReservingHistoryId] = useState<string | null>(null);
  const [localPaused, setLocalPaused] = useState(false);

  // Offline Downloads state (IndexedDB device storage)
  const [downloadedSongs, setDownloadedSongs] = useState<DownloadedSong[]>([]);
  const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null);
  const [reservingDownloadId, setReservingDownloadId] = useState<string | null>(null);
  const [offlinePlayerSong, setOfflinePlayerSong] = useState<DownloadedSong | null>(null);
  const [offlineMediaUrl, setOfflineMediaUrl] = useState<string | null>(null);
  const [offlineIsPlaying, setOfflineIsPlaying] = useState(true);
  const [offlineCurrentTime, setOfflineCurrentTime] = useState(0);
  const [offlineDuration, setOfflineDuration] = useState(0);
  const offlineVideoRef = useRef<HTMLVideoElement | null>(null);

  // Download search query & layout mode state
  const [downloadQuery, setDownloadQuery] = useState('');
  const [downloadLayout, setDownloadLayout] = useState<'list' | 'grid-3' | 'grid-4' | 'grid-5' | 'grid-6'>('grid-3');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('okekaraoke_downloads_layout') as any;
      if (['list', 'grid-3', 'grid-4', 'grid-5', 'grid-6'].includes(saved)) {
        setDownloadLayout(saved);
      }
    }
  }, []);

  const handleSetDownloadLayout = (mode: 'list' | 'grid-3' | 'grid-4' | 'grid-5' | 'grid-6') => {
    setDownloadLayout(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('okekaraoke_downloads_layout', mode);
    }
  };

  const filteredDownloadedSongs = useMemo(() => {
    if (!downloadQuery.trim()) return downloadedSongs;
    const q = downloadQuery.toLowerCase().trim();
    return downloadedSongs.filter(
      (song) =>
        song.title.toLowerCase().includes(q) ||
        song.artist.toLowerCase().includes(q) ||
        (song.code && song.code.toLowerCase().includes(q))
    );
  }, [downloadedSongs, downloadQuery]);

  const refreshDownloadedSongs = useCallback(async () => {
    try {
      const [songs, usage] = await Promise.all([
        getDownloadedSongs(),
        getStorageUsage(),
      ]);
      setDownloadedSongs(songs);
      setStorageUsage(usage);
    } catch (err) {
      console.warn('Failed to refresh downloaded songs:', err);
    }
  }, []);

  useEffect(() => {
    refreshDownloadedSongs();
    window.addEventListener(DOWNLOADS_CHANGED_EVENT, refreshDownloadedSongs);
    return () => window.removeEventListener(DOWNLOADS_CHANGED_EVENT, refreshDownloadedSongs);
  }, [refreshDownloadedSongs]);

  const handlePlayOffline = useCallback((song: DownloadedSong) => {
    if (offlineMediaUrl) {
      URL.revokeObjectURL(offlineMediaUrl);
    }
    const url = createSongMediaUrl(song);
    setOfflineMediaUrl(url);
    setOfflinePlayerSong(song);
    setOfflineIsPlaying(true);
    setOfflineCurrentTime(0);
  }, [offlineMediaUrl]);

  const handleCloseOfflinePlayer = useCallback(() => {
    if (offlineMediaUrl) {
      URL.revokeObjectURL(offlineMediaUrl);
    }
    setOfflineMediaUrl(null);
    setOfflinePlayerSong(null);
    setOfflineIsPlaying(false);
  }, [offlineMediaUrl]);

  const handleDeleteDownloadedSong = useCallback(async (id: string) => {
    if (offlinePlayerSong?.id === id) {
      handleCloseOfflinePlayer();
    }
    await deleteDownloadedSong(id);
    await refreshDownloadedSongs();
  }, [offlinePlayerSong, handleCloseOfflinePlayer, refreshDownloadedSongs]);

  const handleClearAllDownloads = useCallback(async () => {
    if (typeof window !== 'undefined' && window.confirm('Delete all downloaded songs from device storage to free space?')) {
      handleCloseOfflinePlayer();
      await clearAllDownloads();
      await refreshDownloadedSongs();
    }
  }, [handleCloseOfflinePlayer, refreshDownloadedSongs]);

  const handleReserveDownloaded = useCallback(async (song: DownloadedSong) => {
    setReservingDownloadId(song.id);
    addSongToHistory(song as unknown as Song, roomCode);

    const offlineId = `offline_${song.id || Date.now()}`;
    // Immediately play the downloaded song on this device Mini TV
    onReserved?.(song as unknown as Song, null, offlineId);
    setReservingDownloadId(null);

    // If offline (Airplane Mode / Wi-Fi off), play locally immediately without network delays
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      console.log('[Offline Mode] Playing downloaded song locally on Mini TV.');
      return;
    }

    // If online, optionally sync with room in background without ever killing local playback
    if (sessionId) {
      try {
        const response = await fetch('/api/queue/reserve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            room_code: roomCode,
            song_code: song.code,
            youtube_video_id: song.youtube_video_id,
            title: song.title,
            artist: song.artist,
            thumbnail_url: song.thumbnail_url,
            guest_session_id: sessionId,
            guest_name: guestName || null,
          }),
        });
        const json = await response.json();
        if (json.success) {
          onReserved?.(song as unknown as Song, json.data, offlineId);
        }
      } catch {
        // Keep playing offline locally on this phone
      }
    }
  }, [sessionId, roomCode, guestName, onReserved]);

  // Handle switching to next/previous downloaded song in offline player
  const handleNextOfflineSong = useCallback(() => {
    if (!offlinePlayerSong || downloadedSongs.length <= 1) return;
    const currentIndex = downloadedSongs.findIndex((s) => s.id === offlinePlayerSong.id);
    const nextIndex = (currentIndex + 1) % downloadedSongs.length;
    handlePlayOffline(downloadedSongs[nextIndex]);
  }, [offlinePlayerSong, downloadedSongs, handlePlayOffline]);

  const handlePrevOfflineSong = useCallback(() => {
    if (!offlinePlayerSong || downloadedSongs.length <= 1) return;
    const currentIndex = downloadedSongs.findIndex((s) => s.id === offlinePlayerSong.id);
    const prevIndex = (currentIndex - 1 + downloadedSongs.length) % downloadedSongs.length;
    handlePlayOffline(downloadedSongs[prevIndex]);
  }, [offlinePlayerSong, downloadedSongs, handlePlayOffline]);

  // History date filter state
  const [historyDateFilter, setHistoryDateFilter] = useState<'all' | 'today' | 'yesterday' | 'custom'>('all');
  const [customDate, setCustomDate] = useState<string>('');

  // Precomputed Favorite Key Set for O(1) in-memory checks (0ms, 0 disk reads)
  const favoriteKeySet = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < favorites.length; i++) {
      const fav = favorites[i];
      if (fav.id) set.add(fav.id);
      if (fav.code && fav.code !== 'YT') set.add(fav.code);
    }
    return set;
  }, [favorites]);

  const isSongFavoritedFast = useCallback(
    (song: { id?: string; code?: string }) => {
      if (song.id && favoriteKeySet.has(song.id)) return true;
      if (song.code && song.code !== 'YT' && favoriteKeySet.has(song.code)) return true;
      return false;
    },
    [favoriteKeySet]
  );

  // Optimized history filtered by selected date
  const filteredHistory = useMemo(() => {
    if (historyDateFilter === 'all') return history;

    const now = new Date();
    const nowY = now.getFullYear();
    const nowM = now.getMonth();
    const nowD = now.getDate();

    if (historyDateFilter === 'today') {
      return history.filter((item) => {
        if (!item.playedAt) return false;
        const d = new Date(item.playedAt);
        return d.getFullYear() === nowY && d.getMonth() === nowM && d.getDate() === nowD;
      });
    }

    if (historyDateFilter === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yestY = yesterday.getFullYear();
      const yestM = yesterday.getMonth();
      const yestD = yesterday.getDate();

      return history.filter((item) => {
        if (!item.playedAt) return false;
        const d = new Date(item.playedAt);
        return d.getFullYear() === yestY && d.getMonth() === yestM && d.getDate() === yestD;
      });
    }

    if (historyDateFilter === 'custom' && customDate) {
      const [customY, customM, customD] = customDate.split('-').map(Number);
      return history.filter((item) => {
        if (!item.playedAt) return false;
        const d = new Date(item.playedAt);
        return d.getFullYear() === customY && d.getMonth() === customM - 1 && d.getDate() === customD;
      });
    }

    return history;
  }, [history, historyDateFilter, customDate]);

  // Memoized formatted history items to avoid Intl formatting overhead during renders
  const preparedHistory = useMemo(() => {
    return filteredHistory.map((item) => ({
      ...item,
      formattedDate: formatHistoryDate(item.playedAt),
    }));
  }, [filteredHistory]);

  // Playback progress scrubber & live ticker state
  const [localCurrentTime, setLocalCurrentTime] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);
  const seekLockUntilRef = useRef<number>(0);
  const targetSeekTimeRef = useRef<number>(0);
  const lastSeekTimeRef = useRef<number>(0);

  // Synchronize local playback time when playbackProgress prop updates from TV/Solo mode (only on reservations tab)
  useEffect(() => {
    if (activeTab !== 'reservations') return;
    if (playbackProgress) {
      if (!isScrubbing) {
        // While locked immediately after seeking, ignore stale broadcasts until TV catches up
        const isLocked = Date.now() < seekLockUntilRef.current;
        if (isLocked) {
          if (Math.abs(playbackProgress.currentTime - targetSeekTimeRef.current) < 2.0) {
            seekLockUntilRef.current = 0; // Caught up to seek target, release lock
            setLocalCurrentTime(playbackProgress.currentTime);
          }
          return;
        }

        if (Math.abs(localCurrentTime - playbackProgress.currentTime) > 0.8 || playbackProgress.currentTime === 0) {
          setLocalCurrentTime(playbackProgress.currentTime);
        }
      }
    }
  }, [activeTab, playbackProgress?.currentTime, playbackProgress?.duration, isScrubbing]);

  // Immediately sync playback time when switching to reservations tab
  useEffect(() => {
    if (activeTab === 'reservations' && playbackProgress) {
      setLocalCurrentTime(playbackProgress.currentTime || 0);
    }
  }, [activeTab]);

  // Smooth local 250ms ticker during active playback ONLY on reservations tab to prevent re-rendering History tab
  useEffect(() => {
    if (activeTab !== 'reservations') return;
    const isPlaying = Boolean(playbackProgress?.isPlaying && !propIsPaused && !localPaused && !isScrubbing);
    const duration = playbackProgress?.duration || 0;
    if (!isPlaying || duration <= 0) return;

    const interval = setInterval(() => {
      setLocalCurrentTime((prev) => Math.min(prev + 0.25, duration));
    }, 250);

    return () => clearInterval(interval);
  }, [activeTab, playbackProgress?.isPlaying, playbackProgress?.duration, propIsPaused, localPaused, isScrubbing]);

  // Synchronize local paused state when parent prop updates
  useEffect(() => {
    if (propIsPaused !== undefined) {
      setLocalPaused(propIsPaused);
    }
  }, [propIsPaused]);

  // Reset local playback controls when the currently playing song changes
  useEffect(() => {
    setLocalPaused(false);
    setLocalCurrentTime(0);
    setScrubTime(0);
  }, [currentSongId]);

  const isPaused = propIsPaused !== undefined ? propIsPaused : localPaused;

  // Ensure unique reservations list by queue_item_id to prevent duplicate keys and duplicate entries
  const uniqueReservations = useMemo(() => {
    const seen = new Set<string>();
    return reservations.filter(item => {
      const id = item.queue_item_id;
      if (!id || seen.has(id) || optimisticallyStoppedIds.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [reservations, optimisticallyStoppedIds]);

  // Clean up any stale stopped IDs that are no longer in reservations
  useEffect(() => {
    if (optimisticallyStoppedIds.size > 0) {
      const currentIds = new Set(reservations.map((r) => r.queue_item_id));
      setOptimisticallyStoppedIds((prev) => {
        const next = new Set<string>();
        prev.forEach((id) => {
          if (currentIds.has(id)) next.add(id);
        });
        return next.size === prev.size ? prev : next;
      });
    }
  }, [reservations, optimisticallyStoppedIds.size]);

  // Sync favorites on mount & storage update
  useEffect(() => {
    setFavorites(getFavoriteSongs());
    const handleFavUpdate = () => setFavorites(getFavoriteSongs());
    window.addEventListener('okekaraoke_favorites_updated', handleFavUpdate);
    return () => window.removeEventListener('okekaraoke_favorites_updated', handleFavUpdate);
  }, []);

  // Sync song history on mount & storage update
  useEffect(() => {
    setHistory(getSongHistory());
    const handleHistUpdate = () => setHistory(getSongHistory());
    window.addEventListener('okekaraoke_history_updated', handleHistUpdate);
    return () => window.removeEventListener('okekaraoke_history_updated', handleHistUpdate);
  }, []);

  // Toggle Pause/Resume for user's own playing song (instantaneous 0ms feedback)
  const handleTogglePauseMySong = async (queueItemId: string) => {
    if (!sessionId || !roomCode) return;
    const targetAction = isPaused ? 'resume' : 'pause';
    const nextPaused = targetAction === 'pause';

    // Instant optimistic update in 0ms!
    setLocalPaused(nextPaused);
    onTogglePause?.(nextPaused);
    if (isSoloTVMode && onSoloTogglePlay) {
      onSoloTogglePlay();
    }
    setControllingId(queueItemId);
    setControlError(null);

    const effectiveQueueItemId = (currentSongId && !currentSongId.startsWith('temp_'))
      ? currentSongId
      : queueItemId;

    if (onTogglePauseSong) {
      try {
        await onTogglePauseSong(effectiveQueueItemId, nextPaused);
      } catch (err) {
        setLocalPaused(!nextPaused);
        onTogglePause?.(!nextPaused);
        setControlError(`Control error: ${err}`);
      } finally {
        setControllingId(null);
      }
      return;
    }

    try {
      const response = await fetch('/api/queue/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_code: roomCode,
          session_id: sessionId,
          action: targetAction,
          queue_item_id: effectiveQueueItemId,
        }),
      });

      const json = await response.json();
      if (!json.success) {
        // Revert on error
        setLocalPaused(!nextPaused);
        onTogglePause?.(!nextPaused);
        if (isSoloTVMode && onSoloTogglePlay) {
          onSoloTogglePlay();
        }
        if (json.error?.code === 'NO_SONG_PLAYING' || json.error?.code === 'SONG_MISMATCH') {
          onCancelled();
          return;
        }
        setControlError(json.error?.message ?? 'Only the singer can pause this song.');
      } else {
        onCancelled();
      }
    } catch (err) {
      setLocalPaused(!nextPaused);
      onTogglePause?.(!nextPaused);
      if (isSoloTVMode && onSoloTogglePlay) {
        onSoloTogglePlay();
      }
      setControlError(`Network error: ${err}`);
    } finally {
      setControllingId(null);
    }
  };

  // Stop own currently playing song and advance to next song (instantaneous 0ms realtime stop)
  const handleStopMySong = async (queueItemId: string) => {
    if (!sessionId) return;
    setControlError(null);

    // 1. Instant 0ms optimistic removal from active playing reservations (no loading delay!)
    setOptimisticallyStoppedIds((prev) => new Set(prev).add(queueItemId));

    // 2. Instant 0ms local stop in 1-Device mode
    if (isSoloTVMode && onSoloStop) {
      onSoloStop();
    }

    // 3. Delegate to parent's realtime stop handler (broadcasts via WebSocket to TV in 0ms)
    if (onStopSong) {
      try {
        await onStopSong(queueItemId);
      } catch (err) {
        console.error('[handleStopMySong error]', err);
      }
      return;
    }

    // 4. Fallback if onStopSong not provided
    try {
      fetch('/api/queue/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_code: roomCode,
          session_id: sessionId,
          queue_item_id: queueItemId,
        }),
      })
        .then(() => onCancelled())
        .catch((err) => setControlError(`Network error: ${err}`));
    } catch (err) {
      setControlError(`Network error: ${err}`);
    }
  };

  // Restart own currently playing song from the beginning (instant feedback)
  const handleRestartMySong = async (queueItemId: string) => {
    if (!sessionId || !roomCode) return;
    setRestartingId(queueItemId);
    setControlError(null);
    setLocalCurrentTime(0);
    setScrubTime(0);

    try {
      if (onRestartSong) {
        await onRestartSong(queueItemId);
      } else {
        const response = await fetch('/api/queue/control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            room_code: roomCode,
            session_id: sessionId,
            action: 'restart',
            queue_item_id: queueItemId,
          }),
        });
        const json = await response.json();
        if (!json.success) {
          setControlError(json.error?.message ?? 'Could not restart this song.');
        }
      }
    } catch (err) {
      setControlError(`Network error: ${err}`);
    } finally {
      setTimeout(() => setRestartingId(null), 350);
    }
  };

  // Commit seek to target second in the playing song
  const handleSeekCommit = (queueItemId: string, seconds: number) => {
    const now = Date.now();
    // Prevent duplicate rapid calls within 120ms (e.g. touchend + pointerup + change firing simultaneously)
    if (now - lastSeekTimeRef.current < 120 && Math.abs(seconds - targetSeekTimeRef.current) < 1) {
      return;
    }
    lastSeekTimeRef.current = now;
    setIsScrubbing(false);
    setLocalCurrentTime(seconds);
    setScrubTime(seconds);
    seekLockUntilRef.current = now + 1500;
    targetSeekTimeRef.current = seconds;

    const effectiveQueueItemId = (currentSongId && !currentSongId.startsWith('temp_'))
      ? currentSongId
      : queueItemId;

    if (onSeekSong) {
      onSeekSong(effectiveQueueItemId, seconds);
    } else {
      fetch('/api/queue/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_code: roomCode,
          session_id: sessionId,
          action: 'seek',
          seconds,
          queue_item_id: effectiveQueueItemId,
        }),
      }).catch((err) => console.error('[Seek Error]:', err));
    }
  };

  // Toggle song favorite state (instant O(1))
  const handleToggleFavorite = useCallback((song: Song | HistorySong) => {
    toggleFavoriteSong(song);
    setFavorites(getFavoriteSongs());
  }, []);

  // Remove song from history (instant optimistic removal)
  const handleRemoveHistory = useCallback((historyId: string) => {
    removeSongFromHistory(historyId);
    setHistory((prev) => prev.filter((item) => item.id !== historyId));
  }, []);

  // Reserve favorite song directly from Favorites tab
  const handleReserveFavorite = useCallback(async (song: Song) => {
    if (!sessionId) return;
    const favKey = song.id || song.code;
    setReservingFavId(favKey);

    // Save to history
    addSongToHistory(song, roomCode);

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    onReserved?.(song, null, tempId);

    try {
      const response = await fetch('/api/queue/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_code: roomCode,
          song_code: song.code,
          youtube_video_id: song.youtube_video_id,
          title: song.title,
          artist: song.artist,
          thumbnail_url: song.thumbnail_url,
          guest_session_id: sessionId,
          guest_name: guestName || null,
        }),
      });
      const json = await response.json();
      if (json.success) {
        onReserved?.(song, json.data, tempId);
        onCancelled();
      } else {
        onReserveFailed?.(tempId);
      }
    } catch {
      onReserveFailed?.(tempId);
    } finally {
      setReservingFavId(null);
    }
  }, [sessionId, roomCode, guestName, onReserved, onCancelled, onReserveFailed]);

  // Reserve song directly from History tab
  const handleReserveHistory = useCallback(async (song: HistorySong, historyItemId: string) => {
    if (!sessionId) return;
    setReservingHistoryId(historyItemId);

    // Update history entry (moves to top with latest timestamp)
    addSongToHistory(song, roomCode);

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    onReserved?.(song as Song, null, tempId);

    try {
      const response = await fetch('/api/queue/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_code: roomCode,
          song_code: song.code,
          youtube_video_id: song.youtube_video_id,
          title: song.title,
          artist: song.artist,
          thumbnail_url: song.thumbnail_url,
          guest_session_id: sessionId,
          guest_name: guestName || null,
        }),
      });
      const json = await response.json();
      if (json.success) {
        onReserved?.(song as Song, json.data, tempId);
        onCancelled();
      } else {
        onReserveFailed?.(tempId);
      }
    } catch {
      onReserveFailed?.(tempId);
    } finally {
      setReservingHistoryId(null);
    }
  }, [sessionId, roomCode, guestName, onReserved, onCancelled, onReserveFailed]);

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden">
      {/* Top Sub-Tab Navigation Bar - PINNED at top, never scrolls */}
      <div className="shrink-0 px-4 pt-3 pb-2.5 bg-zinc-950/95 backdrop-blur-md z-10 border-b border-zinc-900">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
          {/* Queue */}
          <button
            onClick={() => setActiveTab('reservations')}
            className={`flex-1 py-2 px-1 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'reservations' ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ListMusic size={14} className="shrink-0" />
            {activeTab === 'reservations' && <span className="text-[10px] font-extrabold truncate">Queue</span>}
            {uniqueReservations.length > 0 && (
              <span className={`px-1.5 py-px rounded-md text-[9px] font-mono font-bold shrink-0 ${
                activeTab === 'reservations' ? 'bg-teal-500/20 text-teal-700' : 'bg-zinc-800 text-zinc-400'
              }`}>
                {uniqueReservations.length}
              </span>
            )}
          </button>

          {/* Favorites */}
          <button
            onClick={() => setActiveTab('favorites')}
            className={`flex-1 py-2 px-1 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'favorites' ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Star size={14} className={`shrink-0 ${activeTab === 'favorites' ? 'fill-yellow-500 text-yellow-500' : 'text-yellow-500/70'}`} />
            {activeTab === 'favorites' && <span className="text-[10px] font-extrabold truncate">Favs</span>}
            {favorites.length > 0 && (
              <span className={`px-1.5 py-px rounded-md text-[9px] font-mono font-bold shrink-0 ${
                activeTab === 'favorites' ? 'bg-yellow-500/20 text-yellow-700' : 'bg-zinc-800 text-zinc-400'
              }`}>
                {favorites.length}
              </span>
            )}
          </button>

          {/* History */}
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 px-1 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'history' ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <History size={14} className={`shrink-0 ${activeTab === 'history' ? 'text-teal-600' : 'text-zinc-400'}`} />
            {activeTab === 'history' && <span className="text-[10px] font-extrabold truncate">History</span>}
            {history.length > 0 && (
              <span className={`px-1.5 py-px rounded-md text-[9px] font-mono font-bold shrink-0 ${
                activeTab === 'history' ? 'bg-teal-500/20 text-teal-700' : 'bg-zinc-800 text-zinc-400'
              }`}>
                {history.length}
              </span>
            )}
          </button>

          {/* Downloads / Offline */}
          <button
            onClick={() => setActiveTab('downloads')}
            className={`flex-1 py-2 px-1 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'downloads' ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Download size={14} className={`shrink-0 ${activeTab === 'downloads' ? 'text-teal-600' : 'text-teal-400'}`} />
            {activeTab === 'downloads' && <span className="text-[10px] font-extrabold truncate">Downloads</span>}
            <span className={`px-1.5 py-px rounded-md text-[9px] font-mono font-bold shrink-0 ${
              activeTab === 'downloads' ? 'bg-teal-500/20 text-teal-700' : 'bg-teal-500/10 text-teal-400 font-bold'
            }`}>
              {downloadedSongs.length}
            </span>
          </button>
        </div>
      </div>

      {/* TAB 1: MY RESERVATIONS */}
      {activeTab === 'reservations' && (
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3 pb-8 overscroll-contain">
          {/* Error notification for playback controls */}
          {controlError && (
            <div
              className="px-3 py-2 rounded-lg text-xs text-red-300 font-mono break-all flex items-center gap-1.5 animate-fadeIn"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              <AlertTriangle size={12} className="text-red-400 shrink-0" />
              <span>{controlError}</span>
            </div>
          )}

          {uniqueReservations.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Music2 size={40} className="text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-400 font-bold text-sm">NO RESERVATIONS YET</p>
              <p className="text-xs text-zinc-500 mt-1">
                Search for songs or pick from your favorites to reserve
              </p>
            </div>
          ) : (
            uniqueReservations.map((item, index) => {
              const isPlaying = item.status === 'playing' || Boolean(currentSongId && item.queue_item_id === currentSongId);
              const effectiveStatus = isPlaying ? 'playing' : (item.status ?? 'queued');
              const statusStyle = statusColors[effectiveStatus] ?? statusColors.queued;
              const isRestarting = restartingId === item.queue_item_id;
              const isControlling = controllingId === item.queue_item_id;

              const itemThumb = item.song.thumbnail_url || (item.song.youtube_video_id ? `https://img.youtube.com/vi/${item.song.youtube_video_id}/mqdefault.jpg` : null);

              const displayTime = isScrubbing ? scrubTime : localCurrentTime;
              const duration = playbackProgress?.duration || 0;
              const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (displayTime / duration) * 100)) : 0;

              return (
                <div
                  key={`${item.queue_item_id}_${effectiveStatus}_${index}`}
                  className={`p-3 rounded-xl transition-all ${isPlaying ? 'flex flex-col gap-2.5' : 'flex items-center gap-2.5'}`}
                  style={{
                    background: isPlaying && isPaused ? 'rgba(245, 158, 11, 0.08)' : statusStyle.bg,
                    border: isPlaying && isPaused ? '1px solid rgba(245, 158, 11, 0.25)' : `1px solid ${statusStyle.border}`,
                  }}
                >
                  {/* Main song info row */}
                  <div className="flex items-center gap-2.5 w-full">
                    {/* Position/status icon */}
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: isPlaying && isPaused ? 'rgba(245, 158, 11, 0.15)' : statusStyle.bg }}
                    >
                      {isPlaying ? (
                        isPaused ? (
                          <Pause size={14} className="fill-amber-400 text-amber-400" />
                        ) : (
                          <Play size={14} style={{ fill: statusStyle.text, color: statusStyle.text }} />
                        )
                      ) : item.status === 'completed' ? (
                        <CheckCircle size={14} style={{ color: statusStyle.text }} />
                      ) : (
                        <span className="font-black text-xs" style={{ color: statusStyle.text }}>
                          {index + 1}
                        </span>
                      )}
                    </div>

                    {/* Thumbnail */}
                    <div className="w-[48px] h-[48px] rounded-[8px] overflow-hidden bg-black shrink-0 relative border border-zinc-800 flex items-center justify-center">
                      {itemThumb ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={itemThumb}
                          alt={item.song.title}
                          className="w-full h-full object-cover scale-[1.18]"
                          loading="lazy"
                        />
                      ) : (
                        <Music2 size={18} className="text-zinc-600" />
                      )}
                    </div>

                    {/* Song info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white text-sm truncate">{item.song.title}</p>
                      <p className="text-xs text-zinc-400 truncate">{item.song.artist}</p>
                    </div>

                    {/* Actions & status badge */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="flex items-center gap-1">
                        <span
                          className={`text-xs font-bold ${isPlaying && isPaused ? 'text-amber-400 animate-pulse' : ''}`}
                          style={{ color: isPlaying && isPaused ? undefined : statusStyle.text }}
                        >
                          {isPlaying ? (isPaused ? 'PAUSED' : 'PLAYING') : statusStyle.label}
                        </span>
                        {isPlaying && !isPaused && (
                          <div className="flex items-end gap-0.5 h-3 ml-0.5" title="Now playing">
                            <span className="w-0.5 h-2 bg-green-400 rounded-full animate-pulse" />
                            <span className="w-0.5 h-3.5 bg-green-400 rounded-full animate-bounce" />
                            <span className="w-0.5 h-2.5 bg-green-400 rounded-full animate-pulse" />
                          </div>
                        )}
                      </div>

                      {/* Controls for playing song: Restart + Pause/Resume + Stop */}
                      {isPlaying && (
                        <>
                          {/* Restart button (Icon only) */}
                          <button
                            id={`restart-btn-${item.queue_item_id}`}
                            onClick={() => handleRestartMySong(item.queue_item_id)}
                            disabled={isRestarting}
                            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 shrink-0 shadow-sm"
                            style={{
                              background: 'rgba(56, 189, 248, 0.15)',
                              border: '1px solid rgba(56, 189, 248, 0.3)',
                              color: '#38bdf8',
                            }}
                            title="Restart song from beginning on TV"
                            aria-label={`Restart ${item.song.title} from beginning`}
                          >
                            {isRestarting ? (
                              <Loader2 size={13} className="animate-spin text-sky-400" />
                            ) : (
                              <RotateCcw size={13} className="text-sky-400" />
                            )}
                          </button>

                          {/* Pause / Resume Button (Icon only) */}
                          <button
                            id={`pause-btn-${item.queue_item_id}`}
                            onClick={() => handleTogglePauseMySong(item.queue_item_id)}
                            disabled={isControlling}
                            className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-95 disabled:opacity-50 transition-all shadow-sm shrink-0"
                            style={{
                              background: isPaused ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                              border: isPaused ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
                              color: isPaused ? '#22c55e' : '#f59e0b',
                            }}
                            title={isPaused ? 'Resume your song on TV' : 'Pause your song on TV'}
                            aria-label={isPaused ? 'Resume song' : 'Pause song'}
                          >
                            {isControlling ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : isPaused ? (
                              <Play size={13} className="fill-green-400 text-green-400 ml-0.5" />
                            ) : (
                              <Pause size={13} className="fill-amber-400 text-amber-400" />
                            )}
                          </button>

                          {/* Stop button (Icon only) - 0ms Realtime Stop */}
                          <button
                            id={`stop-btn-${item.queue_item_id}`}
                            onClick={() => handleStopMySong(item.queue_item_id)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 shrink-0"
                            style={{
                              background: 'rgba(239, 68, 68, 0.15)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#ef4444',
                            }}
                            title="Stop your song on TV"
                            aria-label={`Stop playing ${item.song.title}`}
                          >
                            <Square size={12} className="fill-red-500 text-red-500" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Playback Function: Clean, Realtime Progress Bar & Scrubber (ONLY shown on Mine tab for the currently playing song) */}
                  {isPlaying && (
                    <div className="pt-2 border-t border-white/5 flex items-center gap-2">
                      <span className="text-[10px] sm:text-[11px] font-mono text-zinc-300 font-semibold w-8 text-right tabular-nums select-none shrink-0">
                        {formatTime(Math.floor(displayTime))}
                      </span>

                      <div
                        className="flex-1 relative flex items-center h-6 cursor-pointer group py-1"
                        onClick={(e) => {
                          if (duration <= 0) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          if (rect.width <= 0) return;
                          const clickX = e.clientX - rect.left;
                          const ratio = Math.max(0, Math.min(1, clickX / rect.width));
                          const targetSec = Math.round(ratio * duration);
                          handleSeekCommit(item.queue_item_id, targetSec);
                        }}
                      >
                        <input
                          type="range"
                          min={0}
                          max={duration > 0 ? duration : 100}
                          step={1}
                          value={duration > 0 ? Math.min(Math.floor(displayTime), duration) : 0}
                          disabled={duration <= 0}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            setIsScrubbing(true);
                          }}
                          onTouchStart={(e) => {
                            e.stopPropagation();
                            setIsScrubbing(true);
                          }}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setScrubTime(val);
                          }}
                          onPointerUp={(e) => {
                            e.stopPropagation();
                            const val = Number((e.target as HTMLInputElement).value);
                            handleSeekCommit(item.queue_item_id, val);
                          }}
                          onTouchEnd={(e) => {
                            e.stopPropagation();
                            const val = Number((e.target as HTMLInputElement).value);
                            handleSeekCommit(item.queue_item_id, val);
                          }}
                          onPointerCancel={() => setIsScrubbing(false)}
                          onTouchCancel={() => setIsScrubbing(false)}
                          onKeyUp={(e) => {
                            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                              const val = Number((e.target as HTMLInputElement).value);
                              handleSeekCommit(item.queue_item_id, val);
                            }
                          }}
                          className="w-full h-1.5 rounded-full appearance-none cursor-pointer focus:outline-none transition-all active:scale-y-125 disabled:opacity-40"
                          style={{
                            background: `linear-gradient(to right, #2dd4bf ${progressPercent}%, #27272a ${progressPercent}%)`,
                            accentColor: '#2dd4bf',
                          }}
                          title="Drag or tap to seek song playback"
                          aria-label="Song playback progress scrubber"
                        />
                      </div>

                      <span className="text-[10px] sm:text-[11px] font-mono text-zinc-400 font-medium w-8 text-left tabular-nums select-none shrink-0">
                        {duration > 0 ? formatTime(duration) : '--:--'}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: FAVORITES */}
      {activeTab === 'favorites' && (
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3 pb-8 overscroll-contain">
          {favorites.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Star size={40} className="text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-400 font-bold text-sm">NO FAVORITES YET</p>
              <p className="text-xs text-zinc-500 mt-1 max-w-[240px] mx-auto">
                Tap the star icon on any song in the Search tab to save it here for quick reservations anytime!
              </p>
            </div>
          ) : (
            <>
              {/* Favorites Top Action Bar */}
              <div className="flex items-center justify-between px-1 mb-1">
                <span className="text-[10px] sm:text-[11px] font-extrabold text-zinc-500 uppercase tracking-wider">
                  Starred Songs ({favorites.length})
                </span>
              </div>

              {/* Clean Small 3-Column Grid View */}
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2" style={{ contain: 'paint layout' }}>
                {favorites.map((song, idx) => (
                  <FavoriteCard
                    key={song.id || song.code || `fav-${idx}`}
                    song={song}
                    isReserving={reservingFavId === (song.id || song.code)}
                    onToggleFavorite={handleToggleFavorite}
                    onReserve={handleReserveFavorite}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 3: HISTORY */}
      {activeTab === 'history' && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {history.length === 0 ? (
            <div className="flex-1 min-h-0 overflow-y-auto text-center py-16 px-4">
              <History size={40} className="text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-400 font-bold text-sm">NO HISTORY YET</p>
              <p className="text-xs text-zinc-500 mt-1 max-w-[250px] mx-auto">
                Songs you reserve or sing will be saved here with dates so you can easily reserve them again!
              </p>
            </div>
          ) : (
            <>
              {/* Pinned Top Action & Date Filter Bar (STATIONARY - Will NOT move on scroll) */}
              <div className="shrink-0 px-4 pt-2.5 pb-2 bg-zinc-950/95 border-b border-zinc-900 space-y-2 z-10 shadow-sm">
                {/* History Top Action Bar */}
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-[10px] sm:text-[11px] font-extrabold text-zinc-400 uppercase tracking-wider">
                    Played & Reserved ({filteredHistory.length})
                  </span>
                  <button
                    onClick={() => {
                      if (window.confirm('Clear your entire song history?')) {
                        clearSongHistory();
                        setHistory([]);
                      }
                    }}
                    className="text-[10px] sm:text-[11px] font-bold text-zinc-500 hover:text-red-400 transition-colors flex items-center gap-1 p-1 active:scale-95"
                    title="Clear all song history"
                  >
                    <Trash2 size={11} />
                    <span>Clear History</span>
                  </button>
                </div>

                {/* Clean Date Filter Selector */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 touch-pan-x">
                  <button
                    type="button"
                    onClick={() => {
                      setHistoryDateFilter('all');
                      setCustomDate('');
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0 transition-all ${historyDateFilter === 'all'
                        ? 'bg-teal-400 text-black shadow-sm font-black'
                        : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                      }`}
                  >
                    All ({history.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setHistoryDateFilter('today');
                      setCustomDate('');
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0 transition-all ${historyDateFilter === 'today'
                        ? 'bg-teal-400 text-black shadow-sm font-black'
                        : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                      }`}
                  >
                    Today
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setHistoryDateFilter('yesterday');
                      setCustomDate('');
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0 transition-all ${historyDateFilter === 'yesterday'
                        ? 'bg-teal-400 text-black shadow-sm font-black'
                        : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                      }`}
                  >
                    Yesterday
                  </button>

                  {/* Custom Date Picker */}
                  <div className="relative shrink-0 flex items-center gap-1">
                    <input
                      type="date"
                      value={customDate}
                      onChange={(e) => {
                        if (e.target.value) {
                          setCustomDate(e.target.value);
                          setHistoryDateFilter('custom');
                        }
                      }}
                      className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
                      title="Filter by specific date"
                    />
                    <div
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all border pointer-events-none ${historyDateFilter === 'custom' && customDate
                          ? 'bg-teal-400 text-black border-teal-400 shadow-sm font-black'
                          : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                        }`}
                    >
                      <Calendar size={11} className={historyDateFilter === 'custom' && customDate ? 'text-black' : 'text-zinc-400'} />
                      <span>
                        {customDate
                          ? (() => {
                            const [y, m, d] = customDate.split('-').map(Number);
                            return new Date(y, m - 1, d).toLocaleDateString([], { month: 'short', day: 'numeric' });
                          })()
                          : 'Pick Date'}
                      </span>
                    </div>

                    {historyDateFilter === 'custom' && customDate && (
                      <button
                        type="button"
                        onClick={() => {
                          setCustomDate('');
                          setHistoryDateFilter('all');
                        }}
                        className="p-1 rounded text-zinc-400 hover:text-white transition-colors"
                        title="Reset date filter"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Scrollable Content: ONLY THE GRID SCROLLS! */}
              <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 pb-8 overscroll-contain [transform:translateZ(0)] [-webkit-overflow-scrolling:touch]">
                {preparedHistory.length === 0 ? (
                  <div className="text-center py-10 px-4 bg-zinc-900/40 rounded-xl border border-zinc-800/60 mt-1">
                    <History size={28} className="text-zinc-700 mx-auto mb-2" />
                    <p className="text-zinc-400 font-bold text-xs">NO SONGS ON THIS DATE</p>
                    <p className="text-[11px] text-zinc-500 mt-1">
                      No songs found for {historyDateFilter === 'today' ? 'today' : historyDateFilter === 'yesterday' ? 'yesterday' : 'the selected date'}.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setHistoryDateFilter('all');
                        setCustomDate('');
                      }}
                      className="mt-3 px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-bold rounded-lg transition-all"
                    >
                      Show All History
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2" style={{ contain: 'paint layout' }}>
                    {preparedHistory.map((item) => (
                      <HistoryCard
                        key={item.id}
                        item={item}
                        isFavorited={isSongFavoritedFast(item.song)}
                        isReserving={reservingHistoryId === item.id}
                        onToggleFavorite={handleToggleFavorite}
                        onRemove={handleRemoveHistory}
                        onReserve={handleReserveHistory}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 4: OFFLINE DOWNLOADS */}
      {activeTab === 'downloads' && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* ── Compact Downloads Header (Single 1-line row) ── */}
          <div className="shrink-0 px-3 py-2 bg-zinc-950 border-b border-zinc-900">
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Storage usage */}
              <div className="flex items-center gap-1 shrink-0">
                <HardDrive size={11} className="text-teal-400 shrink-0" />
                <span className="text-[10px] font-bold text-white whitespace-nowrap">
                  {storageUsage?.formattedSize || '0 MB'}
                </span>
              </div>

              {/* Search input (compact, 1-line, flex-1) */}
              <div className="relative flex-1 min-w-[70px] flex items-center">
                <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                <input
                  type="text"
                  value={downloadQuery}
                  onChange={(e) => setDownloadQuery(e.target.value)}
                  placeholder={downloadedSongs.length > 0 ? "Search..." : "Empty"}
                  disabled={downloadedSongs.length === 0}
                  className="w-full pl-6 pr-5 h-7 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-teal-500 text-white text-[10px] placeholder:text-zinc-600 focus:outline-none transition-colors disabled:opacity-40"
                />
                {downloadQuery && (
                  <button
                    onClick={() => setDownloadQuery('')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-zinc-500 hover:text-white"
                  >
                    <X size={10} />
                  </button>
                )}
              </div>

              {/* Layout switcher */}
              <div className="flex items-center gap-0.5 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 shrink-0">
                {(['list', 'grid-3', 'grid-4', 'grid-5', 'grid-6'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => handleSetDownloadLayout(mode)}
                    className={`px-1 sm:px-1.5 py-0.5 rounded text-[8.5px] sm:text-[9px] font-bold transition-all ${
                      downloadLayout === mode
                        ? 'bg-zinc-700 text-white shadow'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {mode === 'list' ? 'List' : mode.replace('grid-', '') + 'x'}
                  </button>
                ))}
              </div>

              {/* Clear all downloads */}
              {downloadedSongs.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllDownloads}
                  className="h-7 w-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-red-400 bg-zinc-900 hover:bg-red-500/10 border border-zinc-800 hover:border-red-500/30 transition-all active:scale-95 shrink-0"
                  title="Delete all downloads"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>

            {/* Filter count indicator (only shown while searching) */}
            {downloadQuery.trim() && (
              <p className="text-[9px] text-zinc-500 px-0.5 pt-1">
                {filteredDownloadedSongs.length} of {downloadedSongs.length} match
              </p>
            )}
          </div>


          {/* Scrollable Downloads Grid / List */}
          <div className="flex-1 min-h-0 overflow-y-auto px-3.5 py-3 pb-8 overscroll-contain [transform:translateZ(0)] [-webkit-overflow-scrolling:touch]">
            {downloadedSongs.length === 0 ? (
              <div className="text-center py-12 px-4 bg-zinc-900/40 rounded-2xl border border-zinc-800/60 mt-2">
                <div className="w-12 h-12 rounded-full bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center mx-auto mb-3 text-zinc-500">
                  <Download size={22} />
                </div>
                <p className="text-zinc-300 font-bold text-xs uppercase tracking-wide">NO DOWNLOADED SONGS YET</p>
                <p className="text-[11px] text-zinc-500 max-w-[260px] mx-auto mt-1 leading-relaxed">
                  Go to <strong className="text-zinc-400">Search</strong> and tap the <span className="inline-flex items-center px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-teal-400 text-[10px] font-bold">⬇️</span> button next to any song to download it for offline play!
                </p>
              </div>
            ) : filteredDownloadedSongs.length === 0 ? (
              <div className="text-center py-10 px-4 bg-zinc-900/40 rounded-2xl border border-zinc-800/60 mt-2">
                <Search size={26} className="text-zinc-600 mx-auto mb-2" />
                <p className="text-zinc-300 font-bold text-xs uppercase">No matching downloaded songs</p>
                <p className="text-[11px] text-zinc-500 mt-1 max-w-xs mx-auto">
                  No downloaded songs match &quot;{downloadQuery}&quot;
                </p>
                <button
                  type="button"
                  onClick={() => setDownloadQuery('')}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-teal-300 text-xs font-bold transition-all active:scale-95"
                >
                  Clear Search
                </button>
              </div>
            ) : downloadLayout === 'list' ? (
              <div className="flex flex-col gap-1.5" style={{ contain: 'paint layout' }}>
                {filteredDownloadedSongs.map((song) => (
                  <DownloadedSongCard
                    key={song.id}
                    song={song}
                    isReserving={reservingDownloadId === song.id}
                    onPlayOffline={handlePlayOffline}
                    onReserve={handleReserveDownloaded}
                    onDelete={handleDeleteDownloadedSong}
                    layoutMode="list"
                  />
                ))}
              </div>
            ) : (
              <div
                className={`grid ${
                  downloadLayout === 'grid-4'
                    ? 'grid-cols-4 gap-1 sm:gap-1.5'
                    : downloadLayout === 'grid-5'
                    ? 'grid-cols-5 gap-1'
                    : downloadLayout === 'grid-6'
                    ? 'grid-cols-6 gap-0.5 sm:gap-1'
                    : 'grid-cols-3 gap-1.5 sm:gap-2'
                }`}
                style={{ contain: 'paint layout' }}
              >
                {filteredDownloadedSongs.map((song) => (
                  <DownloadedSongCard
                    key={song.id}
                    song={song}
                    isReserving={reservingDownloadId === song.id}
                    onPlayOffline={handlePlayOffline}
                    onReserve={handleReserveDownloaded}
                    onDelete={handleDeleteDownloadedSong}
                    layoutMode={downloadLayout}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── OFFLINE KARAOKE PLAYER MODAL (100% OFFLINE / AIRPLANE MODE) ── */}
      {offlinePlayerSong && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col p-4 animate-in fade-in duration-200">
          {/* Modal Header */}
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-ping shrink-0" />
              <div className="min-w-0">
                <span className="text-[9px] font-extrabold uppercase tracking-widest text-teal-400 block">
                  OFFLINE SOLO PLAYER (AIRPLANE MODE)
                </span>
                <p className="text-sm font-bold text-white truncate leading-tight mt-0.5">
                  {offlinePlayerSong.title}
                </p>
                <p className="text-xs text-zinc-400 truncate">
                  {offlinePlayerSong.artist}
                </p>
              </div>
            </div>

            <button
              onClick={handleCloseOfflinePlayer}
              className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white flex items-center justify-center transition-all active:scale-95 shrink-0"
              title="Close Offline Player"
            >
              <X size={16} />
            </button>
          </div>

          {/* Video / Visualizer Display Area */}
          <div className="flex-1 my-3 relative rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800 flex flex-col items-center justify-center shadow-2xl min-h-0">
            {offlineMediaUrl ? (
              <video
                ref={offlineVideoRef}
                src={offlineMediaUrl}
                poster={offlinePlayerSong.thumbnail_data || offlinePlayerSong.thumbnail_url || undefined}
                controls
                playsInline
                autoPlay={offlineIsPlaying}
                onPlay={() => setOfflineIsPlaying(true)}
                onPause={() => setOfflineIsPlaying(false)}
                onTimeUpdate={(e) => {
                  const video = e.currentTarget;
                  setOfflineCurrentTime(video.currentTime);
                  setOfflineDuration(video.duration || 0);
                }}
                onEnded={handleNextOfflineSong}
                className="w-full h-full object-contain bg-black"
              />
            ) : (
              /* Fallback Animated Karaoke Screen */
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center relative overflow-hidden bg-gradient-to-br from-zinc-950 via-zinc-900 to-black">
                {offlinePlayerSong.thumbnail_url && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={offlinePlayerSong.thumbnail_url}
                    alt={offlinePlayerSong.title}
                    className="absolute inset-0 w-full h-full object-cover opacity-20 blur-sm scale-105"
                  />
                )}
                <div className="relative z-10 flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center mb-3 shadow-xl animate-pulse">
                    <Music2 size={30} className="text-teal-400" />
                  </div>
                  <h3 className="text-lg font-black text-white">{offlinePlayerSong.title}</h3>
                  <p className="text-sm text-zinc-400 mt-1">{offlinePlayerSong.artist}</p>
                  <span className="mt-3 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 text-[10px] font-mono font-bold tracking-wide">
                    PLAYING FROM DEVICE LOCAL STORAGE
                  </span>
                </div>
              </div>
            )}

            {/* Bottom Real-time Audio Visualizer */}
            <div className="absolute bottom-0 left-0 right-0 pointer-events-none z-10">
              <AudioVisualizer isPlaying={offlineIsPlaying} barCount={36} height={20} />
            </div>
          </div>

          {/* Offline Controls Footer */}
          <div className="shrink-0 p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevOfflineSong}
                disabled={downloadedSongs.length <= 1}
                className="w-9 h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center transition-all disabled:opacity-30 active:scale-95"
                title="Previous Downloaded Song"
              >
                <SkipBack size={15} />
              </button>

              <button
                onClick={() => {
                  if (offlineVideoRef.current) {
                    if (offlineIsPlaying) {
                      offlineVideoRef.current.pause();
                      setOfflineIsPlaying(false);
                    } else {
                      offlineVideoRef.current.play();
                      setOfflineIsPlaying(true);
                    }
                  } else {
                    setOfflineIsPlaying(!offlineIsPlaying);
                  }
                }}
                className="w-11 h-11 rounded-xl bg-teal-400 hover:bg-teal-300 text-black flex items-center justify-center transition-all shadow-lg active:scale-95"
                title={offlineIsPlaying ? 'Pause' : 'Play'}
              >
                {offlineIsPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
              </button>

              <button
                onClick={handleNextOfflineSong}
                disabled={downloadedSongs.length <= 1}
                className="w-9 h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center transition-all disabled:opacity-30 active:scale-95"
                title="Next Downloaded Song"
              >
                <SkipForward size={15} />
              </button>
            </div>

            <div className="text-right">
              <span className="text-[11px] font-mono font-bold text-teal-400 block">
                {formatTime(offlineCurrentTime)} / {formatTime(offlineDuration || offlinePlayerSong.duration_seconds || 210)}
              </span>
              <span className="text-[9px] text-zinc-400">
                Song {downloadedSongs.findIndex((s) => s.id === offlinePlayerSong.id) + 1} of {downloadedSongs.length}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

