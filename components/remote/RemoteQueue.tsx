'use client';

// ============================================================
// OKEKARAOKE — Remote Queue Component
// Full room queue view on the phone with delete/stop for owner's songs
// ============================================================

import { useState } from 'react';
import { Play, Pause, Music2, User, Trash2, Square, Loader2, AlertTriangle, Lock } from 'lucide-react';
import type { EnrichedQueueItem } from '@/lib/types';

interface RemoteQueueProps {
  queue: EnrichedQueueItem[];
  currentSong: EnrichedQueueItem | null;
  sessionId: string;
  roomCode: string;
  onRefresh?: () => void;
}

export function RemoteQueue({ queue, currentSong, sessionId, roomCode, onRefresh }: RemoteQueueProps) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  const [controllingId, setControllingId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [stopError, setStopError] = useState<string | null>(null);

  const [startingNext, setStartingNext] = useState(false);

  // Delete user's own song from room queue
  const handleCancelOwn = async (queueItemId: string) => {
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
        onRefresh?.();
      }
    } catch {
      // Error handled silently
    } finally {
      setCancellingId(null);
    }
  };

  // Toggle Pause/Resume for user's own song
  const handleTogglePauseOwnSong = async (queueItemId: string) => {
    if (!sessionId || !roomCode) return;
    const targetAction = isPaused ? 'resume' : 'pause';
    setControllingId(queueItemId);
    setStopError(null);

    try {
      const response = await fetch('/api/queue/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_code: roomCode,
          session_id: sessionId,
          action: targetAction,
          queue_item_id: queueItemId,
        }),
      });

      const json = await response.json();
      if (json.success) {
        setIsPaused(targetAction === 'pause');
        onRefresh?.();
      } else {
        setStopError(json.error?.message ?? 'Only the singer can pause this song.');
      }
    } catch (err) {
      setStopError(`Network error: ${err}`);
    } finally {
      setControllingId(null);
    }
  };

  const handleStopOwnSong = async (queueItemId: string) => {
    if (!sessionId) return;
    setStoppingId(queueItemId);
    setStopError(null);

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
      console.log('[STOP] API response:', response.status, json);
      if (!json.success) {
        setStopError(`${response.status}: ${json.error?.code ?? 'ERR'} — ${json.error?.message ?? 'Unknown error'}`);
      }
    } catch (err) {
      setStopError(`Network error: ${err}`);
    } finally {
      setStoppingId(null);
      onRefresh?.();
    }
  };

  // Play next queued song when room is stopped/idle
  const handlePlayNextSong = async () => {
    if (!sessionId) return;
    setStartingNext(true);

    try {
      const response = await fetch('/api/queue/next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_code: roomCode,
          session_id: sessionId,
          completed_queue_item_id: null,
        }),
      });

      const json = await response.json();
      if (json.success) {
        onRefresh?.();
      }
    } catch {
      // Error handled silently
    } finally {
      setStartingNext(false);
    }
  };

  const isCurrentSongMine = currentSong?.guest_session_id === sessionId;

  if (!currentSong && queue.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <Music2 size={40} className="text-slate-700 mx-auto mb-3" />
        <p className="text-slate-500 font-medium">QUEUE IS EMPTY</p>
        <p className="text-sm text-slate-600 mt-1">Reserve a song to get the party started!</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-2">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
        ROOM QUEUE ({queue.length} waiting{currentSong ? ' + now playing' : ''})
      </p>

      {/* Start Next Song Bar — shown when TV is stopped/idle but songs are waiting */}
      {!currentSong && queue.length > 0 && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-zinc-800 mb-2">
          <div>
            <p className="text-xs font-bold text-teal-400">TV is currently stopped</p>
            <p className="text-[11px] text-zinc-400">{queue.length} song(s) waiting in queue</p>
          </div>
          <button
            onClick={handlePlayNextSong}
            disabled={startingNext}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white hover:bg-zinc-200 text-black flex items-center gap-1.5 active:scale-95 disabled:opacity-50 transition-all shadow-md"
          >
            {startingNext ? (
              <Loader2 size={12} className="animate-spin text-black" />
            ) : (
              <>
                <Play size={12} className="fill-black text-black" />
                <span>PLAY NEXT SONG</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Now playing */}
      {currentSong && (() => {
        const currentThumb = currentSong.song.thumbnail_url || (currentSong.song.youtube_video_id ? `https://img.youtube.com/vi/${currentSong.song.youtube_video_id}/mqdefault.jpg` : null);
        return (
          <div
            className="flex items-center gap-2.5 p-2.5 rounded-xl"
            style={{
              background: isPaused ? 'rgba(234, 179, 8, 0.06)' : 'rgba(34, 197, 94, 0.06)',
              border: isPaused ? '1px solid rgba(234, 179, 8, 0.3)' : '1px solid rgba(34, 197, 94, 0.2)',
            }}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: isPaused ? 'rgba(234, 179, 8, 0.15)' : 'rgba(34, 197, 94, 0.1)' }}
            >
              {isPaused ? (
                <Pause size={13} className="text-amber-400 fill-amber-400" />
              ) : (
                <Play size={13} className="text-green-400 fill-green-400" />
              )}
            </div>

            {/* Thumbnail */}
            <div className="w-[48px] h-[48px] rounded-[8px] overflow-hidden bg-black shrink-0 relative border border-green-500/20 flex items-center justify-center">
              {currentThumb ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={currentThumb}
                  alt={currentSong.song.title}
                  className="w-full h-full object-cover scale-[1.18]"
                  loading="lazy"
                />
              ) : (
                <Music2 size={18} className="text-green-400" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white text-sm truncate">{currentSong.song.title}</p>
              <p className="text-xs text-slate-500 truncate">
                {currentSong.song.artist}
                {currentSong.guest_name && (
                  <span className="ml-1.5 text-teal-400/90 font-medium">({currentSong.guest_name})</span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`text-xs font-bold ${isPaused ? 'text-amber-400 animate-pulse' : 'text-green-400'}`}>
                {isPaused ? 'PAUSED' : 'PLAYING'}
              </span>

              {/* Controls ONLY for the owner of the currently playing song ("Your Song, Your Rule") */}
              {isCurrentSongMine ? (
                <>
                  {/* Pause / Resume Button (Icon only) */}
                  <button
                    onClick={() => handleTogglePauseOwnSong(currentSong.queue_item_id)}
                    disabled={controllingId === currentSong.queue_item_id}
                    className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-95 disabled:opacity-50 transition-all shadow-sm shrink-0"
                    style={{
                      background: isPaused ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      border: isPaused ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
                      color: isPaused ? '#22c55e' : '#f59e0b',
                    }}
                    title={isPaused ? 'Resume your song on TV' : 'Pause your song on TV'}
                    aria-label={isPaused ? 'Resume song' : 'Pause song'}
                  >
                    {controllingId === currentSong.queue_item_id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : isPaused ? (
                      <Play size={13} className="fill-green-400 text-green-400 ml-0.5" />
                    ) : (
                      <Pause size={13} className="fill-amber-400 text-amber-400" />
                    )}
                  </button>

                  {/* Stop button (Icon only) */}
                  <button
                    onClick={() => handleStopOwnSong(currentSong.queue_item_id)}
                    disabled={stoppingId === currentSong.queue_item_id}
                    className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-95 disabled:opacity-50 shrink-0"
                    style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#ef4444',
                    }}
                    title="Stop your song on TV"
                    aria-label="Stop song"
                  >
                    {stoppingId === currentSong.queue_item_id ? (
                      <Loader2 size={13} className="animate-spin text-red-400" />
                    ) : (
                      <Square size={12} className="fill-red-500 text-red-500" />
                    )}
                  </button>
                </>
              ) : (
                /* Locked badge for other guests */
                <div
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400 font-semibold"
                  title={`Only ${currentSong.guest_name || 'the singer'} can pause or stop this song`}
                >
                  <Lock size={10} className="text-zinc-500 shrink-0" />
                  <span className="truncate max-w-[75px]">{currentSong.guest_name || 'Guest'}</span>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Stop error notification */}
      {stopError && (
        <div
          className="px-3 py-2 rounded-lg text-xs text-red-300 font-mono break-all flex items-center gap-1.5 animate-fadeIn"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          <AlertTriangle size={12} className="text-red-400 shrink-0" />
          <span>{stopError}</span>
        </div>
      )}

      {/* Queued items */}
      {queue.map((item, index) => {
        const isMyItem = item.guest_session_id === sessionId;
        const isCancelling = cancellingId === item.queue_item_id;
        const itemThumb = item.song.thumbnail_url || (item.song.youtube_video_id ? `https://img.youtube.com/vi/${item.song.youtube_video_id}/mqdefault.jpg` : null);

        return (
          <div
            key={item.queue_item_id}
            className="flex items-center gap-2.5 p-2.5 rounded-xl transition-colors"
            style={{
              background: isMyItem
                ? 'rgba(99, 102, 241, 0.08)'
                : 'rgba(255, 255, 255, 0.02)',
              border: `1px solid ${isMyItem
                ? 'rgba(45, 212, 191, 0.25)'
                : 'rgba(255, 255, 255, 0.05)'}`,
            }}
          >
            {/* Position */}
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold"
              style={{
                background: isMyItem ? 'rgba(45, 212, 191, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                color: isMyItem ? '#2dd4bf' : '#475569',
              }}
            >
              {index + 1}
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
              <p className="font-semibold text-white text-sm truncate">{item.song.title}</p>
              <p className="text-xs text-slate-500 truncate">{item.song.artist}</p>
            </div>

            {/* Guest + Delete button (ONLY for user's own songs) */}
            <div className="flex items-center gap-2 shrink-0">
              {item.guest_name && (
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <User size={10} />
                  <span className="truncate max-w-16">{item.guest_name}</span>
                </div>
              )}

              {isMyItem ? (
                <button
                  onClick={() => handleCancelOwn(item.queue_item_id)}
                  disabled={isCancelling}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors active:scale-95 disabled:opacity-50"
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                  }}
                  title="Delete your reservation"
                  aria-label={`Delete ${item.song.title}`}
                >
                  {isCancelling ? (
                    <Loader2 size={12} className="text-red-400 animate-spin" />
                  ) : (
                    <Trash2 size={12} className="text-red-400" />
                  )}
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
