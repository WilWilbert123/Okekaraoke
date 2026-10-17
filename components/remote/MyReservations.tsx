'use client';

// ============================================================
// OKEKARAOKE — My Reservations & Favorites Component
// Allows each user to view/manage queued songs and favorite songs
// ============================================================

import { useState, useEffect, useMemo, useRef } from 'react';
import { Star, Loader2, Trash2, Square, Play, Pause, CheckCircle, Plus, Music2, AlertTriangle, RotateCcw, History, Clock, Calendar, X } from 'lucide-react';
import type { EnrichedQueueItem, Song } from '@/lib/types';
import { getFavoriteSongs, toggleFavoriteSong, isSongFavorited } from '@/lib/utils/favorites';
import { getSongHistory, removeSongFromHistory, clearSongHistory, formatHistoryDate, addSongToHistory, type SongHistoryItem } from '@/lib/utils/songHistory';

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

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
}: MyReservationsProps) {
  const [activeTab, setActiveTab] = useState<'reservations' | 'favorites' | 'history'>('reservations');
  const [favorites, setFavorites] = useState<Song[]>([]);
  const [history, setHistory] = useState<SongHistoryItem[]>([]);
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  const [restartingId, setRestartingId] = useState<string | null>(null);
  const [controllingId, setControllingId] = useState<string | null>(null);
  const [controlError, setControlError] = useState<string | null>(null);
  const [reservingFavId, setReservingFavId] = useState<string | null>(null);
  const [reservingHistoryId, setReservingHistoryId] = useState<string | null>(null);
  const [localPaused, setLocalPaused] = useState(false);

  // History date filter state
  const [historyDateFilter, setHistoryDateFilter] = useState<'all' | 'today' | 'yesterday' | 'custom'>('all');
  const [customDate, setCustomDate] = useState<string>('');

  // Memoized history filtered by selected date
  const filteredHistory = useMemo(() => {
    if (historyDateFilter === 'all') return history;

    const now = new Date();

    return history.filter((item) => {
      if (!item.playedAt) return false;
      const itemDate = new Date(item.playedAt);

      if (historyDateFilter === 'today') {
        return (
          itemDate.getFullYear() === now.getFullYear() &&
          itemDate.getMonth() === now.getMonth() &&
          itemDate.getDate() === now.getDate()
        );
      }

      if (historyDateFilter === 'yesterday') {
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        return (
          itemDate.getFullYear() === yesterday.getFullYear() &&
          itemDate.getMonth() === yesterday.getMonth() &&
          itemDate.getDate() === yesterday.getDate()
        );
      }

      if (historyDateFilter === 'custom' && customDate) {
        const [year, month, day] = customDate.split('-').map(Number);
        return (
          itemDate.getFullYear() === year &&
          itemDate.getMonth() === month - 1 &&
          itemDate.getDate() === day
        );
      }

      return true;
    });
  }, [history, historyDateFilter, customDate]);

  // Playback progress scrubber & live ticker state
  const [localCurrentTime, setLocalCurrentTime] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);
  const seekLockUntilRef = useRef<number>(0);
  const targetSeekTimeRef = useRef<number>(0);
  const lastSeekTimeRef = useRef<number>(0);

  // Synchronize local playback time when playbackProgress prop updates from TV/Solo mode
  useEffect(() => {
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
  }, [playbackProgress?.currentTime, playbackProgress?.duration, isScrubbing]);

  // Smooth local 250ms ticker during active playback for zero stutter
  useEffect(() => {
    const isPlaying = Boolean(playbackProgress?.isPlaying && !propIsPaused && !localPaused && !isScrubbing);
    const duration = playbackProgress?.duration || 0;
    if (!isPlaying || duration <= 0) return;

    const interval = setInterval(() => {
      setLocalCurrentTime((prev) => Math.min(prev + 0.25, duration));
    }, 250);

    return () => clearInterval(interval);
  }, [playbackProgress?.isPlaying, playbackProgress?.duration, propIsPaused, localPaused, isScrubbing]);

  // Synchronize local paused state when parent prop updates
  useEffect(() => {
    if (propIsPaused !== undefined) {
      setLocalPaused(propIsPaused);
    }
  }, [propIsPaused]);

  const isPaused = propIsPaused !== undefined ? propIsPaused : localPaused;

  // Ensure unique reservations list by queue_item_id to prevent duplicate keys and duplicate entries
  const uniqueReservations = useMemo(() => {
    const seen = new Set<string>();
    return reservations.filter(item => {
      const id = item.queue_item_id;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [reservations]);

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

  // Stop own currently playing song and advance to next song (instantaneous 0ms stop)
  const handleStopMySong = async (queueItemId: string) => {
    if (!sessionId) return;
    setStoppingId(queueItemId);
    setControlError(null);

    // Instant local stop in 0ms if in 1-Device mode
    if (isSoloTVMode && onSoloStop) {
      onSoloStop();
    }

    try {
      const response = await fetch('/api/queue/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_code: roomCode,
          session_id: sessionId,
          queue_item_id: queueItemId,
        }),
      });
      const json = await response.json();
      if (json.success || json.error?.code === 'NOTHING_PLAYING') {
        onCancelled();
      } else {
        setControlError(json.error?.message ?? 'Could not stop this song.');
      }
    } catch (err) {
      setControlError(`Network error: ${err}`);
    } finally {
      setStoppingId(null);
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

  // Reserve favorite song directly from Favorites tab
  const handleReserveFavorite = async (song: Song) => {
    if (!sessionId) return;
    setReservingFavId(song.id || song.code);

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
  };

  // Reserve song directly from History tab
  const handleReserveHistory = async (song: SongHistoryItem['song'], historyItemId: string) => {
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
  };

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden">
      {/* Top Sub-Tab Navigation Bar - PINNED at top, never scrolls */}
      <div className="shrink-0 px-4 pt-3 pb-2.5 bg-zinc-950/95 backdrop-blur-md z-10 border-b border-zinc-900">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
          <button
            onClick={() => setActiveTab('reservations')}
            className={`flex-1 py-2 px-1.5 sm:px-2 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all flex items-center justify-center gap-1 sm:gap-1.5 ${
              activeTab === 'reservations'
                ? 'bg-white text-black font-extrabold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span className="truncate">RESERVATIONS</span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono font-bold shrink-0 ${
                activeTab === 'reservations'
                  ? 'bg-teal-500/20 text-teal-700'
                  : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              {uniqueReservations.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('favorites')}
            className={`flex-1 py-2 px-1.5 sm:px-2 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all flex items-center justify-center gap-1 sm:gap-1.5 ${
              activeTab === 'favorites'
                ? 'bg-white text-black font-extrabold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Star
              size={12}
              className={`shrink-0 ${activeTab === 'favorites' ? 'fill-yellow-500 text-yellow-500' : 'text-yellow-500'}`}
            />
            <span className="truncate">FAVORITES</span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono font-bold shrink-0 ${
                activeTab === 'favorites'
                  ? 'bg-yellow-500/20 text-yellow-700'
                  : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              {favorites.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 px-1.5 sm:px-2 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all flex items-center justify-center gap-1 sm:gap-1.5 ${
              activeTab === 'history'
                ? 'bg-white text-black font-extrabold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <History
              size={12}
              className={`shrink-0 ${activeTab === 'history' ? 'text-teal-600' : 'text-zinc-400'}`}
            />
            <span className="truncate">HISTORY</span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono font-bold shrink-0 ${
                activeTab === 'history'
                  ? 'bg-teal-500/20 text-teal-700'
                  : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              {history.length}
            </span>
          </button>
        </div>
      </div>

      {/* Scrollable Content Container - ONLY this list area scrolls */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3 pb-8">
        {/* TAB 1: MY RESERVATIONS */}
        {activeTab === 'reservations' && (
          <div className="space-y-3">
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
              const isStopping = stoppingId === item.queue_item_id;
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

                          {/* Stop button (Icon only) */}
                          <button
                            id={`stop-btn-${item.queue_item_id}`}
                            onClick={() => handleStopMySong(item.queue_item_id)}
                            disabled={isStopping}
                            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 shrink-0"
                            style={{
                              background: 'rgba(239, 68, 68, 0.15)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#ef4444',
                            }}
                            title="Stop your song on TV"
                            aria-label={`Stop playing ${item.song.title}`}
                          >
                            {isStopping ? (
                              <Loader2 size={13} className="animate-spin text-red-400" />
                            ) : (
                              <Square size={12} className="fill-red-500 text-red-500" />
                            )}
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
        <div className="space-y-3 animate-fade-in">
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
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                {favorites.map((song, idx) => {
                  const songKey = song.id || song.code || `fav-${idx}`;
                  const isReserving = reservingFavId === songKey;
                  const songThumb =
                    song.thumbnail_url ||
                    (song.youtube_video_id
                      ? `https://img.youtube.com/vi/${song.youtube_video_id}/mqdefault.jpg`
                      : '');

                  return (
                    <div
                      key={`${songKey}_${idx}`}
                      className="flex flex-col justify-between p-1.5 rounded-xl transition-all bg-zinc-900/90 border border-zinc-800/80 hover:border-zinc-700 shadow-sm relative group overflow-hidden"
                    >
                      {/* Top: Thumbnail with 16:9 Aspect Ratio + Star Toggle Button */}
                      <div className="relative aspect-video w-full rounded-md sm:rounded-lg overflow-hidden bg-zinc-950 shrink-0 border border-zinc-800/80 flex items-center justify-center">
                        {songThumb ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={songThumb}
                            alt={song.title}
                            className="w-full h-full object-cover scale-[1.05] group-hover:scale-110 transition-transform duration-200"
                            loading="lazy"
                          />
                        ) : (
                          <Music2 size={16} className="text-zinc-600" />
                        )}

                        {/* Top-Right Floating Star Button */}
                        <div className="absolute top-1 right-1 z-10">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavoriteSong(song);
                              setFavorites(getFavoriteSongs());
                            }}
                            className="w-4.5 h-4.5 rounded bg-black/70 backdrop-blur-md flex items-center justify-center text-yellow-400 active:scale-90 transition-all border border-white/10 shadow-sm"
                            title="Remove from favorites"
                            aria-label={`Remove ${song.title} from favorites`}
                          >
                            <Star size={10} className="fill-yellow-400 text-yellow-400" />
                          </button>
                        </div>

                        {/* Song Code badge or Type (bottom left) */}
                        {song.code && song.code !== 'YT' ? (
                          <div className="absolute bottom-1 left-1 px-1 py-0.2 rounded bg-black/80 backdrop-blur-md text-[7px] font-mono font-bold text-teal-300 border border-teal-500/30">
                            #{song.code}
                          </div>
                        ) : song.song_type ? (
                          <div className="absolute bottom-1 left-1 px-1 py-0.2 rounded bg-black/80 backdrop-blur-md text-[7px] font-bold text-teal-300 border border-teal-500/30 uppercase truncate max-w-[50px]">
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
                        id={`reserve-fav-btn-${songKey}`}
                        onClick={() => handleReserveFavorite(song)}
                        disabled={isReserving}
                        className="mt-1.5 w-full h-6.5 rounded-md sm:rounded-lg flex items-center justify-center gap-0.5 bg-teal-400 hover:bg-teal-300 text-black text-[9px] font-black transition-all active:scale-95 shadow-sm disabled:opacity-50 shrink-0"
                        title={`Reserve ${song.title}`}
                        aria-label={`Reserve ${song.title}`}
                      >
                        {isReserving ? (
                          <>
                            <Loader2 size={10} className="animate-spin text-black" />
                            <span>...</span>
                          </>
                        ) : (
                          <>
                            <Plus size={10} className="stroke-[3]" />
                            <span>RESERVE</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 3: HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-3 animate-fade-in">
          {history.length === 0 ? (
            <div className="text-center py-16 px-4">
              <History size={40} className="text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-400 font-bold text-sm">NO HISTORY YET</p>
              <p className="text-xs text-zinc-500 mt-1 max-w-[250px] mx-auto">
                Songs you reserve or sing will be saved here with dates so you can easily reserve them again!
              </p>
            </div>
          ) : (
            <>
              {/* History Top Action Bar */}
              <div className="flex items-center justify-between px-1 mb-1">
                <span className="text-[10px] sm:text-[11px] font-extrabold text-zinc-500 uppercase tracking-wider">
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
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1">
                <button
                  type="button"
                  onClick={() => {
                    setHistoryDateFilter('all');
                    setCustomDate('');
                  }}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold shrink-0 transition-all ${
                    historyDateFilter === 'all'
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
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold shrink-0 transition-all ${
                    historyDateFilter === 'today'
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
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold shrink-0 transition-all ${
                    historyDateFilter === 'yesterday'
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
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all border pointer-events-none ${
                      historyDateFilter === 'custom' && customDate
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

              {filteredHistory.length === 0 ? (
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
                /* Clean Small 3-Column Grid View */
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  {filteredHistory.map((item, idx) => {
                    const isReserving = reservingHistoryId === item.id;
                    const isFavorited = isSongFavorited(item.song);
                    const songThumb =
                      item.song.thumbnail_url ||
                      (item.song.youtube_video_id
                        ? `https://img.youtube.com/vi/${item.song.youtube_video_id}/mqdefault.jpg`
                        : '');

                    return (
                      <div
                        key={`${item.id}_${idx}`}
                        className="flex flex-col justify-between p-1.5 rounded-xl transition-all bg-zinc-900/90 border border-zinc-800/80 hover:border-zinc-700 shadow-sm relative group overflow-hidden"
                      >
                        {/* Top: Thumbnail with 16:9 Aspect Ratio + Floating Badges */}
                        <div className="relative aspect-video w-full rounded-md sm:rounded-lg overflow-hidden bg-zinc-950 shrink-0 border border-zinc-800/80 flex items-center justify-center">
                          {songThumb ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={songThumb}
                              alt={item.song.title}
                              className="w-full h-full object-cover scale-[1.05] group-hover:scale-110 transition-transform duration-200"
                              loading="lazy"
                            />
                          ) : (
                            <Music2 size={16} className="text-zinc-600" />
                          )}

                          {/* Top-Right Floating Actions: Favorite & Delete from history */}
                          <div className="absolute top-1 right-1 flex items-center gap-0.5 z-10">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavoriteSong(item.song);
                                setFavorites(getFavoriteSongs());
                              }}
                              className="w-4.5 h-4.5 rounded bg-black/70 backdrop-blur-md flex items-center justify-center text-zinc-400 hover:text-yellow-400 active:scale-90 transition-all border border-white/10 shadow-sm"
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
                                removeSongFromHistory(item.id);
                                setHistory(getSongHistory());
                              }}
                              className="w-4.5 h-4.5 rounded bg-black/70 backdrop-blur-md flex items-center justify-center text-zinc-400 hover:text-red-400 active:scale-90 transition-all border border-white/10 shadow-sm"
                              title="Remove from history"
                              aria-label={`Remove ${item.song.title} from history`}
                            >
                              <Trash2 size={9} />
                            </button>
                          </div>

                          {/* Song Code badge (bottom left) */}
                          {item.song.code && item.song.code !== 'YT' && (
                            <div className="absolute bottom-1 left-1 px-1 py-0.2 rounded bg-black/80 backdrop-blur-md text-[7px] font-mono font-bold text-teal-300 border border-teal-500/30">
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
                            <span className="truncate">{formatHistoryDate(item.playedAt)}</span>
                          </div>
                        </div>

                        {/* Bottom: Clean "SING AGAIN" Button */}
                        <button
                          id={`reserve-history-btn-${item.id}`}
                          onClick={() => handleReserveHistory(item.song, item.id)}
                          disabled={isReserving}
                          className="mt-1.5 w-full h-6.5 rounded-md sm:rounded-lg flex items-center justify-center gap-0.5 bg-teal-400 hover:bg-teal-300 text-black text-[9px] font-black transition-all active:scale-95 shadow-sm disabled:opacity-50 shrink-0"
                          title={`Reserve ${item.song.title} again`}
                          aria-label={`Reserve ${item.song.title} again`}
                        >
                          {isReserving ? (
                            <>
                              <Loader2 size={10} className="animate-spin text-black" />
                              <span>...</span>
                            </>
                          ) : (
                            <>
                              <RotateCcw size={9} className="stroke-[2.5]" />
                              <span>SING AGAIN</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

