'use client';

// ============================================================
// OKEKARAOKE — TV Queue Bar (max 10 items + N MORE)
// Displays upcoming songs above the YouTube player
// ============================================================

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
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
    return null;
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
            className="flex items-center gap-1.5 shrink-0 px-2 py-1"
          >
            <span className="text-xs font-bold text-indigo-400 font-mono">{index + 1}.</span>
            <span className="text-xs font-medium text-slate-200 whitespace-nowrap opacity-90">
              {item.song.title}
            </span>
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
