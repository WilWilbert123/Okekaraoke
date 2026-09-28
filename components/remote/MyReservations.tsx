'use client';

// ============================================================
// OKEKARAOKE — My Reservations Component
// Shows the current user's own reservations in this room
// ============================================================

import { useState } from 'react';
import { Star, Loader2, X, Play, CheckCircle, Music2 } from 'lucide-react';
import type { EnrichedQueueItem } from '@/lib/types';

interface MyReservationsProps {
  reservations: EnrichedQueueItem[];
  sessionId: string;
  onCancelled: () => void;
  allowCancel: boolean;
}

const statusColors = {
  queued: { bg: 'rgba(99, 102, 241, 0.08)', border: 'rgba(99, 102, 241, 0.2)', text: '#a78bfa', label: 'QUEUED' },
  playing: { bg: 'rgba(34, 197, 94, 0.08)', border: 'rgba(34, 197, 94, 0.2)', text: '#22c55e', label: 'PLAYING' },
  completed: { bg: 'rgba(100, 116, 139, 0.08)', border: 'rgba(100, 116, 139, 0.2)', text: '#64748b', label: 'DONE' },
  cancelled: { bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.2)', text: '#ef4444', label: 'CANCELLED' },
  skipped: { bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.2)', text: '#ef4444', label: 'SKIPPED' },
};

export function MyReservations({ reservations, sessionId, onCancelled, allowCancel }: MyReservationsProps) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);

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

  if (reservations.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <Star size={40} className="text-slate-700 mx-auto mb-3" />
        <p className="text-slate-500 font-medium">NO RESERVATIONS YET</p>
        <p className="text-sm text-slate-600 mt-1">
          Search for songs or enter a code to reserve
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
        MY RESERVATIONS ({reservations.length})
      </p>

      {reservations.map((item, index) => {
        const statusStyle = statusColors[item.status] ?? statusColors.queued;
        const isCancelling = cancellingId === item.queue_item_id;
        const canCancel = allowCancel && item.status === 'queued';

        return (
          <div
            key={item.queue_item_id}
            className="flex items-center gap-3 p-4 rounded-xl transition-all"
            style={{
              background: statusStyle.bg,
              border: `1px solid ${statusStyle.border}`,
            }}
          >
            {/* Position/status icon */}
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: statusStyle.bg }}
            >
              {item.status === 'playing' ? (
                <Play size={16} style={{ fill: statusStyle.text, color: statusStyle.text }} />
              ) : item.status === 'completed' ? (
                <CheckCircle size={16} style={{ color: statusStyle.text }} />
              ) : (
                <span className="font-black text-sm" style={{ color: statusStyle.text }}>
                  {index + 1}
                </span>
              )}
            </div>

            {/* Song info */}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-sm truncate">{item.song.title}</p>
              <p className="text-xs text-slate-500 truncate">{item.song.artist}</p>
            </div>

            {/* Status badge */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold" style={{ color: statusStyle.text }}>
                {statusStyle.label}
              </span>

              {canCancel && (
                <button
                  id={`cancel-btn-${item.queue_item_id}`}
                  onClick={() => handleCancel(item.queue_item_id)}
                  disabled={isCancelling}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                  }}
                  aria-label={`Cancel reservation for ${item.song.title}`}
                >
                  {isCancelling ? (
                    <Loader2 size={12} className="text-red-400 animate-spin" />
                  ) : (
                    <X size={12} className="text-red-400" />
                  )}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
