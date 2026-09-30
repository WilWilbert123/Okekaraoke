'use client';

// ============================================================
// OKEKARAOKE — Minimal Clean TV Header Component
// Shows brand & clean white inline UP NEXT ticker
// ============================================================

import { useState } from 'react';
import { Wifi, WifiOff, RefreshCw, ChevronRight } from 'lucide-react';
import type { ConnectionStatus, EnrichedQueueItem } from '@/lib/types';
import { FullQueueModal } from './FullQueueModal';

interface TVHeaderProps {
  roomCode?: string;
  connectionStatus: ConnectionStatus;
  queue?: EnrichedQueueItem[];
}

const statusConfig = {
  connected: { icon: Wifi, label: 'CONNECTED', color: '#22c55e' },
  reconnecting: { icon: RefreshCw, label: 'RECONNECTING', color: '#f59e0b' },
  offline: { icon: WifiOff, label: 'OFFLINE', color: '#ef4444' },
};

export function TVHeader({ connectionStatus, queue = [] }: TVHeaderProps) {
  const [showFullQueueModal, setShowFullQueueModal] = useState(false);
  const { icon: StatusIcon, label: statusLabel, color: statusColor } = statusConfig[connectionStatus];

  const visibleQueue = queue.slice(0, 5);
  const overflowCount = Math.max(0, queue.length - 5);

  return (
    <>
      <header className="flex items-center justify-between px-6 py-2.5 shrink-0 gap-4 bg-gradient-to-b from-black/90 via-black/50 to-transparent">
        {/* Left: Brand */}
        <div className="flex items-center gap-2 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/okekaraokelogo.png" alt="OKEKARAOKE" className="w-8 h-8 object-contain drop-shadow" />
          <span
            className="text-base font-black tracking-tight"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            <span className="text-teal-400">OKE</span>
            <span className="text-white">KARAOKE</span>
          </span>
        </div>

        {/* Center: Minimal Clean White Up Next Ticker (No background box/blur/border) */}
        {queue.length > 0 && (
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-0.5 px-2 text-white text-xs shrink font-medium">
            <span className="font-bold text-white/80 uppercase tracking-wider shrink-0">
              up next:
            </span>

            <div className="flex items-center gap-3 overflow-x-auto no-scrollbar shrink text-white">
              {visibleQueue.map((item, index) => (
                <div key={item.queue_item_id} className="flex items-center gap-1 shrink-0">
                  <span className="font-bold text-white">{index + 1}:</span>
                  <span className="text-white truncate max-w-[160px]" title={item.song.title}>
                    {item.song.title}
                  </span>
                </div>
              ))}
            </div>

            {overflowCount > 0 && (
              <button
                onClick={() => setShowFullQueueModal(true)}
                className="shrink-0 flex items-center gap-0.5 font-bold text-xs text-white/90 hover:text-teal-400 transition-colors"
              >
                +{overflowCount} MORE
                <ChevronRight size={14} />
              </button>
            )}
          </div>
        )}

        {/* Right: Connection Status (if reconnecting/offline) */}
        <div className="flex items-center gap-3 shrink-0">
          {connectionStatus !== 'connected' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60">
              <StatusIcon
                size={12}
                style={{ color: statusColor }}
                className={connectionStatus === 'reconnecting' ? 'animate-spin' : ''}
              />
              <span className="text-[10px] font-bold" style={{ color: statusColor }}>
                {statusLabel}
              </span>
            </div>
          )}
        </div>
      </header>

      {showFullQueueModal && (
        <FullQueueModal
          queue={queue}
          onClose={() => setShowFullQueueModal(false)}
        />
      )}
    </>
  );
}
