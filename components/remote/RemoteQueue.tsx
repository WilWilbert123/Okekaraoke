'use client';

// ============================================================
// OKEKARAOKE — Remote Queue Component
// Full room queue view on the phone with delete/stop for owner's songs
// ============================================================

import { useState } from 'react';
import { Play, Music2, User, Trash2, Square, Loader2 } from 'lucide-react';
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

  // Stop user's own currently playing song
  const handleStopOwnSong = async (queueItemId: string) => {
    if (!sessionId) return;
    setStoppingId(queueItemId);

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
      if (json.success) {
        onRefresh?.();
      }
    } catch {
      // Error handled silently
    } finally {
      setStoppingId(null);
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

      {/* Now playing */}
      {currentSong && (
        <div
          className="flex items-center gap-3 p-3 rounded-xl"
          style={{
            background: 'rgba(34, 197, 94, 0.06)',
            border: '1px solid rgba(34, 197, 94, 0.2)',
          }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'rgba(34, 197, 94, 0.1)' }}
          >
            <Play size={14} className="text-green-400 fill-green-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white text-sm truncate">{currentSong.song.title}</p>
            <p className="text-xs text-slate-500 truncate">{currentSong.song.artist}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-bold text-green-400">PLAYING</span>

            {/* Stop button if song belongs to current user */}
            {isCurrentSongMine && (
              <button
                onClick={() => handleStopOwnSong(currentSong.queue_item_id)}
                disabled={stoppingId === currentSong.queue_item_id}
                className="px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 active:scale-95 disabled:opacity-50"
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                }}
                title="Stop your song on TV"
              >
                {stoppingId === currentSong.queue_item_id ? (
                  <Loader2 size={12} className="animate-spin text-red-400" />
                ) : (
                  <>
                    <Square size={10} className="fill-red-500 text-red-500" />
                    <span>STOP</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Queued items */}
      {queue.map((item, index) => {
        const isMyItem = item.guest_session_id === sessionId;
        const isCancelling = cancellingId === item.queue_item_id;

        return (
          <div
            key={item.queue_item_id}
            className="flex items-center gap-3 p-3 rounded-xl transition-colors"
            style={{
              background: isMyItem
                ? 'rgba(99, 102, 241, 0.08)'
                : 'rgba(255, 255, 255, 0.02)',
              border: `1px solid ${isMyItem
                ? 'rgba(99, 102, 241, 0.2)'
                : 'rgba(255, 255, 255, 0.05)'}`,
            }}
          >
            {/* Position */}
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold"
              style={{
                background: isMyItem ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                color: isMyItem ? '#a78bfa' : '#475569',
              }}
            >
              {index + 1}
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
