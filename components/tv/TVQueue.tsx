'use client';

// ============================================================
// OKEKARAOKE — TV Queue Bar (max 10 items + N MORE)
// Displays upcoming songs above the YouTube player
// ============================================================

import { useState } from 'react';
import { Music2, ChevronRight } from 'lucide-react';
import type { EnrichedQueueItem } from '@/lib/types';
import { FullQueueModal } from './FullQueueModal';

const MAX_VISIBLE = 10;

interface TVQueueProps {
  queue: EnrichedQueueItem[];
}

export function TVQueue({ queue }: TVQueueProps) {
  const [showModal, setShowModal] = useState(false);

  const visible = queue.slice(0, MAX_VISIBLE);
  const overflowCount = Math.max(0, queue.length - MAX_VISIBLE);

  if (queue.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 py-3 px-4 text-slate-600">
        <Music2 size={16} />
        <span className="text-sm font-medium">Queue is empty — scan QR to add songs</span>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-3 px-4">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mr-2 shrink-0">
          UP NEXT
        </span>

        {visible.map((item, index) => (
          <div
            key={item.queue_item_id}
            className="flex items-center gap-1.5 shrink-0 rounded-lg px-3 py-1.5 transition-colors"
            style={{
              background: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.15)',
            }}
          >
            <span className="text-xs font-bold text-indigo-400 w-4 text-right">{index + 1}</span>
            <div>
              <p className="text-sm font-semibold text-white leading-tight max-w-[120px] truncate">
                {item.song.title}
              </p>
              <p className="text-xs text-slate-500 truncate max-w-[120px]">
                {item.song.artist}
              </p>
            </div>
          </div>
        ))}

        {overflowCount > 0 && (
          <button
            id="tv-queue-more-btn"
            onClick={() => setShowModal(true)}
            className="shrink-0 flex items-center gap-1 rounded-lg px-3 py-1.5 font-bold text-sm text-violet-300 transition-all hover:scale-105"
            style={{
              background: 'rgba(167, 139, 250, 0.1)',
              border: '1px solid rgba(167, 139, 250, 0.2)',
            }}
            aria-label={`Show ${overflowCount} more queued songs`}
          >
            +{overflowCount} MORE
            <ChevronRight size={14} />
          </button>
        )}
      </div>

      {showModal && (
        <FullQueueModal
          queue={queue}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
