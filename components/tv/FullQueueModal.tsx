'use client';

// ============================================================
// OKEKARAOKE — Full Queue Modal
// Shows complete queue list, opened from +N MORE button
// ============================================================

import { useEffect } from 'react';
import { X, Music2, User } from 'lucide-react';
import type { EnrichedQueueItem } from '@/lib/types';

interface FullQueueModalProps {
  queue: EnrichedQueueItem[];
  onClose: () => void;
}

export function FullQueueModal({ queue, onClose }: FullQueueModalProps) {
  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Backspace') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Full Song Queue"
    >
      <div
        className="glass rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        style={{ margin: '20px' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              SONG QUEUE
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">{queue.length} song{queue.length !== 1 ? 's' : ''} waiting</p>
          </div>
          <button
            id="close-queue-modal-btn"
            onClick={onClose}
            className="p-2 rounded-lg transition-colors hover:bg-white/10 text-slate-400 hover:text-white"
            aria-label="Close queue"
          >
            <X size={24} />
          </button>
        </div>

        {/* Queue list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {queue.map((item, index) => (
            <div
              key={item.queue_item_id}
              className="flex items-center gap-4 p-4 rounded-xl transition-colors"
              style={{
                background: index === 0 ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                border: `1px solid ${index === 0 ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255, 255, 255, 0.06)'}`,
              }}
            >
              {/* Position */}
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-black shrink-0"
                style={{
                  background: index === 0 ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  color: index === 0 ? '#a78bfa' : '#64748b',
                }}
              >
                {index + 1}
              </div>

              {/* Song info */}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white truncate">{item.song.title}</p>
                <p className="text-sm text-slate-400 truncate">{item.song.artist}</p>
              </div>

              {/* Right side */}
              <div className="text-right shrink-0">
                {item.guest_name && (
                  <div className="flex items-center gap-1.5 text-sm text-slate-400">
                    <User size={12} />
                    <span className="truncate max-w-24">{item.guest_name}</span>
                  </div>
                )}
                <p className="text-xs text-slate-600 mt-0.5 font-mono">#{item.song.code}</p>
              </div>
            </div>
          ))}

          {queue.length === 0 && (
            <div className="text-center py-12">
              <Music2 size={40} className="text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500">Queue is empty</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t text-center text-xs text-slate-600" style={{ borderColor: 'var(--color-border)' }}>
          Press ESC to close
        </div>
      </div>
    </div>
  );
}
