'use client';

// ============================================================
// OKEKARAOKE — TV Header Component
// Shows brand, room code, and connection status
// ============================================================

import { Wifi, WifiOff, RefreshCw, Fullscreen, Mic2 } from 'lucide-react';
import type { ConnectionStatus } from '@/lib/types';

interface TVHeaderProps {
  roomCode: string;
  connectionStatus: ConnectionStatus;
  onFullscreen: () => void;
  isFullscreen: boolean;
}

const statusConfig = {
  connected: { icon: Wifi, label: 'CONNECTED', color: '#22c55e' },
  reconnecting: { icon: RefreshCw, label: 'RECONNECTING', color: '#f59e0b' },
  offline: { icon: WifiOff, label: 'OFFLINE', color: '#ef4444' },
};

export function TVHeader({ roomCode, connectionStatus, onFullscreen, isFullscreen }: TVHeaderProps) {
  const { icon: StatusIcon, label: statusLabel, color: statusColor } = statusConfig[connectionStatus];

  return (
    <header
      className="flex items-center justify-between px-6 py-3 shrink-0"
      style={{
        background: 'rgba(5, 5, 8, 0.95)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2">
        <Mic2 size={20} className="text-indigo-400" />
        <span
          className="text-lg font-black tracking-tight"
          style={{ fontFamily: 'Space Grotesk, sans-serif' }}
        >
          <span style={{ background: 'linear-gradient(135deg, #a78bfa, #6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            OKE
          </span>
          <span className="text-white">KARAOKE</span>
        </span>
      </div>

      {/* Room Code */}
      <div
        className="flex items-center gap-2 px-4 py-1.5 rounded-full"
        style={{
          background: 'rgba(99, 102, 241, 0.1)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
        }}
      >
        <span className="text-xs font-bold text-slate-400 tracking-widest">ROOM</span>
        <span
          className="text-xl font-black text-white tracking-widest"
          style={{ fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '0.15em' }}
          aria-label={`Room code: ${roomCode}`}
        >
          {roomCode}
        </span>
      </div>

      {/* Status + Controls */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div
            className="status-dot"
            style={{ backgroundColor: statusColor }}
            aria-hidden="true"
          />
          <StatusIcon
            size={14}
            style={{ color: statusColor }}
            className={connectionStatus === 'reconnecting' ? 'animate-spin' : ''}
          />
          <span className="text-xs font-bold" style={{ color: statusColor }}>
            {statusLabel}
          </span>
        </div>

        <button
          id="tv-fullscreen-btn"
          onClick={onFullscreen}
          className="p-2 rounded-lg transition-colors hover:bg-white/10 text-slate-400 hover:text-white"
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          <Fullscreen size={18} />
        </button>
      </div>
    </header>
  );
}
