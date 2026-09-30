'use client';

// ============================================================
// OKEKARAOKE — Remote Page Client
// Phone remote: search songs, chat, manage reservations, queue
// ============================================================

import { useState, useCallback, useEffect, useRef } from 'react';
import { Mic2, Wifi, WifiOff, RefreshCw, Search, MessageSquare, ListMusic, Star, Pencil, Check, X } from 'lucide-react';
import { SongSearch } from '@/components/remote/SongSearch';
import { RoomChat } from '@/components/remote/RoomChat';
import { MyReservations } from '@/components/remote/MyReservations';
import { RemoteQueue } from '@/components/remote/RemoteQueue';
import { NameModal } from '@/components/remote/NameModal';
import { EmojiReactions } from '@/components/remote/EmojiReactions';
import { useRealtime } from '@/hooks/useRealtime';
import { getOrCreateGuestSession, updateGuestSession, setGuestSessionForInstance } from '@/lib/auth/guestSession';
import type { EnrichedQueueItem, InstanceState, ConnectionStatus } from '@/lib/types';

type RemoteTab = 'search' | 'chat' | 'my-songs' | 'queue';

interface RemotePageClientProps {
  roomCode: string;
}

const statusConfig = {
  connected: { icon: Wifi, color: '#22c55e', label: 'Connected' },
  reconnecting: { icon: RefreshCw, color: '#f59e0b', label: 'Reconnecting' },
  offline: { icon: WifiOff, color: '#ef4444', label: 'Offline' },
};

const NAME_CONFIRMED_KEY = 'okekaraoke_name_confirmed';

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

  // ── Name modal + inline editing ──────────────────────────
  const [showNameModal, setShowNameModal] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  const fetchState = useCallback(async () => {
    try {
      const response = await fetch(`/api/instances/${roomCode}/state?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
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

  // Load saved guest name & decide if modal should show
  useEffect(() => {
    const session = getOrCreateGuestSession();
    setSessionId(session.session_id);

    const confirmed = localStorage.getItem(NAME_CONFIRMED_KEY);
    if (session.guest_name && confirmed) {
      setGuestName(session.guest_name);
    } else {
      setShowNameModal(true);
    }
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
  const realtimeHandlers = useRef({
    queue_added: fetchState,
    queue_removed: fetchState,
    queue_updated: fetchState,
    song_started: fetchState,
    song_finished: fetchState,
    song_skipped: fetchState,
  }).current;

  useRealtime({
    roomCode,
    handlers: realtimeHandlers,
    enabled: true,
  });

  // ── Name modal confirm ────────────────────────────────────
  const handleNameConfirm = useCallback((name: string) => {
    const trimmed = name.trim();
    setGuestName(trimmed);
    updateGuestSession({ guest_name: trimmed });
    localStorage.setItem(NAME_CONFIRMED_KEY, '1');
    setShowNameModal(false);
    registerDevice(trimmed);
  }, [registerDevice]);

  // ── Inline name edit ──────────────────────────────────────
  const startEditName = () => {
    setEditNameValue(guestName);
    setEditingName(true);
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  const saveEditName = () => {
    const trimmed = editNameValue.trim();
    if (trimmed) {
      setGuestName(trimmed);
      updateGuestSession({ guest_name: trimmed });
      registerDevice(trimmed);
    }
    setEditingName(false);
  };

  const cancelEditName = () => {
    setEditingName(false);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') saveEditName();
    if (e.key === 'Escape') cancelEditName();
  };

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
          Home
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

  const myReservations = [
    ...(currentSong && currentSong.guest_session_id === sessionId ? [currentSong] : []),
    ...queue.filter((item) => item.guest_session_id === sessionId),
  ];

  return (
    /* Root: position:relative so the emoji overlay is scoped here */
    <div
      className="flex flex-col relative"
      style={{
        height: '100dvh',
        background: 'var(--color-bg)',
        maxWidth: '480px',
        margin: '0 auto',
        overflow: 'hidden',
      }}
    >
      {/* Name entry modal */}
      <NameModal open={showNameModal} onConfirm={handleNameConfirm} />

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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/okekaraokelogo.png" alt="OKEKARAOKE" className="w-7 h-7 object-contain drop-shadow" />
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

          {/* Guest name — editable */}
          <div className="flex items-center gap-1.5">
            {editingName ? (
              <>
                <input
                  ref={editInputRef}
                  type="text"
                  value={editNameValue}
                  onChange={(e) => setEditNameValue(e.target.value)}
                  onKeyDown={handleEditKeyDown}
                  maxLength={30}
                  className="text-right text-sm text-white bg-transparent border-b border-indigo-500 outline-none w-28"
                  aria-label="Edit your name"
                />
                <button onClick={saveEditName} aria-label="Save name" className="text-green-400 active:scale-90 transition-transform">
                  <Check size={14} />
                </button>
                <button onClick={cancelEditName} aria-label="Cancel" className="text-slate-500 active:scale-90 transition-transform">
                  <X size={14} />
                </button>
              </>
            ) : (
              <>
                <span
                  className="text-sm font-semibold text-slate-300 cursor-pointer"
                  onClick={startEditName}
                >
                  {guestName || 'Your name'}
                </span>
                <button
                  onClick={startEditName}
                  aria-label="Edit name"
                  className="text-slate-600 hover:text-indigo-400 transition-colors active:scale-90"
                >
                  <Pencil size={12} />
                </button>
              </>
            )}
          </div>
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
          { id: 'chat' as const, icon: MessageSquare, label: 'Chat' },
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

      {/* Tab content — relative so emoji overlay stacks correctly */}
      <div className="flex-1 overflow-y-auto relative">
        {tab === 'search' && (
          <SongSearch
            roomCode={roomCode}
            sessionId={sessionId}
            guestName={guestName}
            onReserved={() => fetchState()}
          />
        )}
        {tab === 'chat' && (
          <RoomChat
            roomCode={roomCode}
            sessionId={sessionId}
            guestName={guestName}
          />
        )}
        {tab === 'my-songs' && (
          <MyReservations
            reservations={myReservations}
            sessionId={sessionId}
            roomCode={roomCode}
            onCancelled={() => fetchState()}
            allowCancel={instanceState?.settings.allow_cancel ?? true}
          />
        )}
        {tab === 'queue' && (
          <RemoteQueue
            queue={queue}
            currentSong={currentSong}
            sessionId={sessionId}
            roomCode={roomCode}
            onRefresh={() => fetchState()}
          />
        )}
      </div>

      {/* Emoji reactions bar + floating particles — always visible at bottom */}
      <EmojiReactions
        roomCode={roomCode}
        sessionId={sessionId}
        guestName={guestName}
      />
    </div>
  );
}
