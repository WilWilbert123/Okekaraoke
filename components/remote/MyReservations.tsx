'use client';

// ============================================================
// OKEKARAOKE — My Reservations & Favorites Component
// Allows each user to view/manage queued songs and favorite songs
// ============================================================

import { useState, useEffect, useMemo, useRef } from 'react';
import { Star, Loader2, Trash2, Square, Play, Pause, CheckCircle, Plus, Music2, AlertTriangle, RotateCcw, History, Clock } from 'lucide-react';
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
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  const [restartingId, setRestartingId] = useState<string | null>(null);
  const [controllingId, setControllingId] = useState<string | null>(null);
  const [controlError, setControlError] = useState<string | null>(null);
  const [reservingFavId, setReservingFavId] = useState<string | null>(null);
  const [reservingHistoryId, setReservingHistoryId] = useState<string | null>(null);
  const [localPaused, setLocalPaused] = useState(false);

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

  // Cancel own queued song
  const handleCancel = async (queueItemId: string) => {
    if (!sessionId) return;
    setCancellingId(queueItemId);

    try {
      const response = await fetch('/api/queue/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queue_item_id: queueItemId,
          guest_session_id: sessionId,
        }),
      });

      const json = await response.json();
      if (json.success) {
        onCancelled();
      }
    } catch {
      // Error handled silently
    } finally {
      setCancellingId(null);
    }
  };

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
    <div className="p-4 space-y-4">
      {/* Top Sub-Tab Navigation Bar */}
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
              const isCancelling = cancellingId === item.queue_item_id;
              const isStopping = stoppingId === item.queue_item_id;
              const isRestarting = restartingId === item.queue_item_id;
              const isControlling = controllingId === item.queue_item_id;
              const canCancel = allowCancel && !isPlaying && effectiveStatus === 'queued';

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

                      {/* Delete button for queued song */}
                      {canCancel && (
                        <button
                          id={`cancel-btn-${item.queue_item_id}`}
                          onClick={() => handleCancel(item.queue_item_id)}
                          disabled={isCancelling}
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors active:scale-95 disabled:opacity-50"
                          style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                          }}
                          title="Delete reservation"
                          aria-label={`Delete reservation for ${item.song.title}`}
                        >
                          {isCancelling ? (
                            <Loader2 size={14} className="text-red-400 animate-spin" />
                          ) : (
                            <Trash2 size={14} className="text-red-400" />
                          )}
                        </button>
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
        <div className="space-y-3">
          {favorites.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Star size={40} className="text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-400 font-bold text-sm">NO FAVORITES YET</p>
              <p className="text-xs text-zinc-500 mt-1 max-w-[240px] mx-auto">
                Tap the star icon on any song in the Search tab to save it here for quick reservations anytime!
              </p>
            </div>
          ) : (
            favorites.map((song, idx) => {
              const songKey = song.id || song.code || `fav-${idx}`;
              const isReserving = reservingFavId === songKey;

              return (
                <div
                  key={`${songKey}_${idx}`}
                  className="flex items-center gap-3 p-3.5 rounded-xl transition-all bg-zinc-900 border border-zinc-800"
                >
                  {/* Star Toggle Button */}
                  <button
                    onClick={() => {
                      toggleFavoriteSong(song);
                      setFavorites(getFavoriteSongs());
                    }}
                    className="p-1.5 rounded-lg transition-all active:scale-90 hover:bg-zinc-800 shrink-0"
                    title="Remove from favorites"
                    aria-label={`Remove ${song.title} from favorites`}
                  >
                    <Star size={18} className="fill-yellow-400 text-yellow-400 drop-shadow" />
                  </button>

                  {/* Song Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-sm truncate">{song.title}</p>
                    <p className="text-xs text-zinc-400 truncate mt-0.5">{song.artist}</p>

                    {song.song_type && (
                      <span className="inline-block text-[10px] font-bold text-teal-400 mt-1 uppercase">
                        {song.song_type}
                      </span>
                    )}
                  </div>

                  {/* Reserve Favorite Song Button */}
                  <button
                    id={`reserve-fav-btn-${songKey}`}
                    onClick={() => handleReserveFavorite(song)}
                    disabled={isReserving}
                    className="shrink-0 h-8.5 px-3 rounded-xl flex items-center gap-1 bg-teal-400 hover:bg-teal-300 text-black text-[11px] font-black transition-all active:scale-95 shadow-sm disabled:opacity-50"
                    aria-label={`Reserve ${song.title}`}
                  >
                    {isReserving ? (
                      <>
                        <Loader2 size={13} className="animate-spin text-black" />
                        <span>...</span>
                      </>
                    ) : (
                      <>
                        <Plus size={14} className="stroke-[3]" />
                        <span>RESERVE</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })
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
                  Played & Reserved ({history.length})
                </span>
                <button
                  onClick={() => {
                    if (window.confirm('Clear your entire song history?')) {
                      clearSongHistory();
                    }
                  }}
                  className="text-[10px] sm:text-[11px] font-bold text-zinc-500 hover:text-red-400 transition-colors flex items-center gap-1 p-1 active:scale-95"
                  title="Clear all song history"
                >
                  <Trash2 size={11} />
                  <span>Clear History</span>
                </button>
              </div>

              {history.map((item, idx) => {
                const songKey = item.song.id || item.song.code || item.id || `hist-${idx}`;
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
                    className="flex items-center gap-3 p-3 rounded-xl transition-all bg-zinc-900 border border-zinc-800 hover:border-zinc-700"
                  >
                    {/* Song Artwork Thumbnail */}
                    <div className="w-[44px] h-[44px] rounded-lg overflow-hidden bg-black shrink-0 relative border border-zinc-800 flex items-center justify-center">
                      {songThumb ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={songThumb}
                          alt={item.song.title}
                          className="w-full h-full object-cover scale-[1.18]"
                          loading="lazy"
                        />
                      ) : (
                        <Music2 size={18} className="text-zinc-600" />
                      )}
                    </div>

                    {/* Song Info & Played Date */}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white text-sm truncate">{item.song.title}</p>
                      <p className="text-xs text-zinc-400 truncate">{item.song.artist}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-zinc-400 flex items-center gap-1 font-medium">
                          <Clock size={10} className="text-teal-400 shrink-0" />
                          <span>{formatHistoryDate(item.playedAt)}</span>
                        </span>
                        {item.song.code && item.song.code !== 'YT' && (
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-zinc-800 text-teal-400 border border-zinc-700">
                            #{item.song.code}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions: Favorite Toggle + Sing Again Button + Delete item */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Star / Favorite toggle */}
                      <button
                        onClick={() => {
                          toggleFavoriteSong(item.song);
                          setFavorites(getFavoriteSongs());
                        }}
                        className="p-1.5 rounded-lg transition-all active:scale-90 hover:bg-zinc-800 text-zinc-500 hover:text-yellow-400"
                        title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                        aria-label={`Favorite ${item.song.title}`}
                      >
                        <Star
                          size={16}
                          className={isFavorited ? 'fill-yellow-400 text-yellow-400' : 'text-zinc-500'}
                        />
                      </button>

                      {/* Sing Again / Reserve Button */}
                      <button
                        id={`reserve-history-btn-${item.id}`}
                        onClick={() => handleReserveHistory(item.song, item.id)}
                        disabled={isReserving}
                        className="shrink-0 h-8.5 px-3 rounded-xl flex items-center gap-1 bg-teal-400 hover:bg-teal-300 text-black text-[11px] font-black transition-all active:scale-95 shadow-sm disabled:opacity-50"
                        title={`Reserve ${item.song.title} again`}
                        aria-label={`Reserve ${item.song.title} again`}
                      >
                        {isReserving ? (
                          <>
                            <Loader2 size={12} className="animate-spin text-black" />
                            <span>...</span>
                          </>
                        ) : (
                          <>
                            <RotateCcw size={12} className="stroke-[2.5]" />
                            <span>SING AGAIN</span>
                          </>
                        )}
                      </button>

                      {/* Delete item from history */}
                      <button
                        onClick={() => removeSongFromHistory(item.id)}
                        className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                        title="Remove from history"
                        aria-label="Remove from history"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

