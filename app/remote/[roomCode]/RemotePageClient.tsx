'use client';

// ============================================================
// OKEKARAOKE — Remote Page Client
// Phone remote experience for searching and reserving songs
// ============================================================

import { useState, useCallback, useEffect, useRef } from 'react';
import { Mic2, Wifi, WifiOff, RefreshCw, Search, Hash, ListMusic, Star } from 'lucide-react';
import { SongSearch } from '@/components/remote/SongSearch';
import { SongCodePad } from '@/components/remote/SongCodePad';
import { MyReservations } from '@/components/remote/MyReservations';
import { RemoteQueue } from '@/components/remote/RemoteQueue';
import { useRealtime } from '@/hooks/useRealtime';
import { getOrCreateGuestSession, setGuestSessionForInstance } from '@/lib/auth/guestSession';
import type { EnrichedQueueItem, InstanceState, ConnectionStatus } from '@/lib/types';

type RemoteTab = 'search' | 'code' | 'my-songs' | 'queue';

interface RemotePageClientProps {
  roomCode: string;
}

const statusConfig = {
  connected: { icon: Wifi, color: '#22c55e', label: 'Connected' },
  reconnecting: { icon: RefreshCw, color: '#f59e0b', label: 'Reconnecting' },
  offline: { icon: WifiOff, color: '#ef4444', label: 'Offline' },
};

export function RemotePageClient({ roomCode }: RemotePageClientProps) {
  const [tab, setTab] = useState<RemoteTab>('search');
  const [instanceState, setInstanceState] = useState<InstanceState | null>(null);
  const [currentSong, setCurrentSong] = useState<EnrichedQueueItem | null>(null);
  const [queue, setQueue] = useState<EnrichedQueueItem[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('reconnecting');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guestName, setGuestName] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');
  const [instanceId, setInstanceId] = useState<string>('');

  const fetchState = useCallback(async () => {
    try {
      const response = await fetch(`/api/instances/${roomCode}/state`);
      const json = await response.json();

      if (!response.ok || !json.success) {
        if (response.status === 404) {
          setError('Room not found. This OKEKARAOKE room does not exist.');
        } else {
          setError(json.error?.message ?? 'Failed to connect to room.');
        }
        setConnectionStatus('offline');
        setLoading(false);
        return;
      }

      const state = json.data as InstanceState;
      setInstanceState(state);
      setCurrentSong(state.current_song);
      setQueue(state.queue);
      setInstanceId(state.instance.id);
      setError(null);
      setConnectionStatus('connected');
      setLoading(false);

    } catch {
      setConnectionStatus('offline');
      setLoading(false);
    }
  }, [roomCode]);

  // Register this phone as a remote device
  const registerDevice = useCallback(async (name: string) => {
    const session = getOrCreateGuestSession();
    setSessionId(session.session_id);

    try {
      await fetch('/api/instances/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_code: roomCode,
          guest_session_id: session.session_id,
          device_type: 'remote',
          guest_name: name || null,
        }),
      });

      const state = instanceState;
      if (state) {
        setGuestSessionForInstance(state.instance.id, roomCode, 'remote', name || undefined);
      }
    } catch {
      // Non-critical
    }
  }, [roomCode, instanceState]);

  // Load saved guest name
  useEffect(() => {
    const session = getOrCreateGuestSession();
    setSessionId(session.session_id);
    if (session.guest_name) setGuestName(session.guest_name);
    fetchState();
  }, [fetchState]);

  // Online/offline
  useEffect(() => {
    const handleOnline = () => { setConnectionStatus('reconnecting'); fetchState(); };
    const handleOffline = () => setConnectionStatus('offline');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchState]);

  // Realtime
  useRealtime({
    roomCode: connectionStatus !== 'offline' ? roomCode : null,
    handlers: {
      queue_added: () => fetchState(),
      queue_removed: () => fetchState(),
      queue_updated: () => fetchState(),
      song_started: () => fetchState(),
      song_finished: () => fetchState(),
      song_skipped: () => fetchState(),
    },
    enabled: true,
  });

  const { icon: StatusIcon, color: statusColor, label: statusLabel } = statusConfig[connectionStatus];

  if (error) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center p-4 text-center">
        <Mic2 size={40} className="text-red-400 mb-4" />
        <h1 className="text-2xl font-black text-red-400 mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          ROOM NOT FOUND
        </h1>
        <p className="text-slate-400 mb-6">{error}</p>
        <a href="/" className="px-6 py-3 rounded-xl font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #6366f1, #7c3aed)' }}>
          Go to Home
        </a>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 font-medium text-sm">CONNECTING...</p>
      </div>
    );
  }

  const myReservations = queue.filter((item) => item.guest_session_id === sessionId);

  return (
    <div
      className="flex flex-col"
      style={{
        height: '100dvh',
        background: 'var(--color-bg)',
        maxWidth: '480px',
        margin: '0 auto',
      }}
    >
      {/* Header */}
      <header
        className="px-4 py-3 shrink-0"
        style={{
          background: 'rgba(5, 5, 8, 0.95)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Mic2 size={16} className="text-indigo-400" />
            <span className="text-sm font-black tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              <span style={{ background: 'linear-gradient(135deg, #a78bfa, #6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>OKE</span>
              <span className="text-white">KARAOKE</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <StatusIcon
              size={12}
              style={{ color: statusColor }}
              className={connectionStatus === 'reconnecting' ? 'animate-spin' : ''}
            />
            <span className="text-xs font-medium" style={{ color: statusColor }}>{statusLabel}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">ROOM</span>
            <span
              className="text-lg font-black text-white tracking-widest"
              style={{ fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '0.15em' }}
            >
              {roomCode}
            </span>
          </div>

          {/* Guest name input */}
          <input
            type="text"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            onBlur={() => registerDevice(guestName)}
            placeholder="Your name"
            maxLength={30}
            className="text-right text-sm text-slate-300 bg-transparent border-b border-transparent focus:border-indigo-500 outline-none transition-colors placeholder-slate-600"
            aria-label="Your name"
          />
        </div>

        {/* Now playing mini */}
        {currentSong && (
          <div
            className="mt-2 px-3 py-1.5 rounded-lg flex items-center gap-2"
            style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.15)' }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse shrink-0" />
            <p className="text-xs text-slate-400 truncate">
              NOW: <span className="text-white font-medium">{currentSong.song.title}</span>
              {' · '}{currentSong.song.artist}
            </p>
          </div>
        )}
      </header>

      {/* Tabs */}
      <div
        className="flex shrink-0"
        style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}
        role="tablist"
      >
        {[
          { id: 'search' as const, icon: Search, label: 'Search' },
          { id: 'code' as const, icon: Hash, label: 'Code' },
          { id: 'my-songs' as const, icon: Star, label: `Mine${myReservations.length > 0 ? ` (${myReservations.length})` : ''}` },
          { id: 'queue' as const, icon: ListMusic, label: `Queue (${queue.length})` },
        ].map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            id={`remote-tab-${id}`}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className="flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-semibold transition-colors"
            style={{
              color: tab === id ? '#a78bfa' : '#64748b',
              borderBottom: tab === id ? '2px solid #6366f1' : '2px solid transparent',
            }}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'search' && (
          <SongSearch
            roomCode={roomCode}
            sessionId={sessionId}
            guestName={guestName}
            onReserved={() => fetchState()}
          />
        )}
        {tab === 'code' && (
          <SongCodePad
            roomCode={roomCode}
            sessionId={sessionId}
            guestName={guestName}
            onReserved={() => { fetchState(); setTab('my-songs'); }}
          />
        )}
        {tab === 'my-songs' && (
          <MyReservations
            reservations={myReservations}
            sessionId={sessionId}
            onCancelled={() => fetchState()}
            allowCancel={instanceState?.settings.allow_cancel ?? true}
          />
        )}
        {tab === 'queue' && (
          <RemoteQueue
            queue={queue}
            currentSong={currentSong}
            sessionId={sessionId}
          />
        )}
      </div>
    </div>
  );
}
