'use client';

// ============================================================
// OKEKARAOKE — Remote Queue Component
// Full room queue view on the phone (not limited to 10)
// ============================================================

import { Play, Music2, User } from 'lucide-react';
import type { EnrichedQueueItem } from '@/lib/types';

interface RemoteQueueProps {
  queue: EnrichedQueueItem[];
  currentSong: EnrichedQueueItem | null;
  sessionId: string;
}

export function RemoteQueue({ queue, currentSong, sessionId }: RemoteQueueProps) {
  const allItems = [
    ...(currentSong ? [{ ...currentSong, _isCurrent: true }] : []),
    ...queue,
  ];

  if (allItems.length === 0) {
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
          <span className="text-xs font-bold text-green-400 shrink-0">PLAYING</span>
        </div>
      )}

      {/* Queued items */}
      {queue.map((item, index) => {
        const isMyItem = item.guest_session_id === sessionId;

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

            {/* Guest + Mine indicator */}
            <div className="text-right shrink-0">
              {item.guest_name && (
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <User size={10} />
                  <span className="truncate max-w-16">{item.guest_name}</span>
                </div>
              )}
              {isMyItem && (
                <span className="text-xs font-bold text-indigo-400">YOU</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
