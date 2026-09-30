'use client';

// ============================================================
// OKEKARAOKE — Remote Page Client
// Phone remote: search songs, chat, manage reservations, queue
// ============================================================

import { useState, useCallback, useEffect, useRef } from 'react';
import { Mic2, Wifi, WifiOff, RefreshCw, Search, MessageSquare, ListMusic, Star, Pencil, Check, X, QrCode, Download, Settings } from 'lucide-react';
import { SongSearch } from '@/components/remote/SongSearch';
import { RoomChat } from '@/components/remote/RoomChat';
import { MyReservations } from '@/components/remote/MyReservations';
import { RemoteQueue } from '@/components/remote/RemoteQueue';
import { NameModal } from '@/components/remote/NameModal';
import { EmojiReactions } from '@/components/remote/EmojiReactions';
import { ScanRoomModal } from '@/components/remote/ScanRoomModal';
import { SettingsModal } from '@/components/remote/SettingsModal';
import { useRealtime } from '@/hooks/useRealtime';
import { usePWAInstall } from '@/hooks/usePWAInstall';
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
  const [showScanModal, setShowScanModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const { isInstallable, installApp } = usePWAInstall();

  // Remember last room code for app shortcuts & quick rejoining
  useEffect(() => {
    if (typeof window !== 'undefined' && roomCode) {
      localStorage.setItem('okekaraoke_last_room', roomCode.toUpperCase());
    }
  }, [roomCode]);

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
        <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-zinc-400 font-medium text-sm">CONNECTING...</p>
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

      {/* Settings Modal */}
      <SettingsModal
        open={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        guestName={guestName}
        onUpdateName={(name) => {
          setGuestName(name);
          updateGuestSession({ guest_name: name });
          registerDevice(name);
        }}
        roomCode={roomCode}
        isInstallable={isInstallable}
        onInstallApp={installApp}
      />

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
              <span className="text-teal-400">OKE</span>
              <span className="text-white">KARAOKE</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isInstallable && (
              <button
                onClick={installApp}
                className="px-2.5 py-1 rounded-lg bg-teal-400 hover:bg-teal-300 text-black text-[11px] font-black flex items-center gap-1 active:scale-95 transition-all shadow-md shrink-0"
              >
                <Download size={12} />
                <span>Install App</span>
              </button>
            )}

            {connectionStatus !== 'connected' && (
              <div className="flex items-center gap-1.5">
                <StatusIcon
                  size={12}
                  style={{ color: statusColor }}
                  className={connectionStatus === 'reconnecting' ? 'animate-spin' : ''}
                />
                <span className="text-xs font-medium" style={{ color: statusColor }}>{statusLabel}</span>
              </div>
            )}

            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 hover:text-white flex items-center justify-center transition-all active:scale-95"
              title="Settings & Support"
            >
              <Settings size={15} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-zinc-500 font-medium">ROOM</span>
            <span
              className="text-base font-black text-white tracking-widest"
              style={{ fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '0.12em' }}
            >
              {roomCode}
            </span>
            <button
              onClick={() => setShowScanModal(true)}
              className="ml-1 px-2 py-0.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 flex items-center gap-1 text-[11px] font-bold active:scale-95 transition-all"
              title="Scan TV / Switch Room"
            >
              <QrCode size={12} />
              <span>Scan TV</span>
            </button>
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
                  className="text-right text-sm text-white bg-transparent border-b border-teal-400 outline-none w-28"
                  aria-label="Edit your name"
                />
                <button onClick={saveEditName} aria-label="Save name" className="text-green-400 active:scale-90 transition-transform">
                  <Check size={14} />
                </button>
                <button onClick={cancelEditName} aria-label="Cancel" className="text-zinc-500 active:scale-90 transition-transform">
                  <X size={14} />
                </button>
              </>
            ) : (
              <>
                <span
                  className="text-sm font-semibold text-zinc-300 cursor-pointer hover:text-white"
                  onClick={startEditName}
                >
                  {guestName || 'Your name'}
                </span>
                <button
                  onClick={startEditName}
                  aria-label="Edit name"
                  className="text-zinc-500 hover:text-white transition-colors active:scale-90"
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
            className="mt-2 px-3 py-1.5 rounded-lg flex items-center gap-2 bg-zinc-900 border border-zinc-800"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse shrink-0" />
            <p className="text-xs text-zinc-400 truncate">
              NOW: <span className="text-white font-medium">{currentSong.song.title}</span>
              {' · '}{currentSong.song.artist}
            </p>
          </div>
        )}
      </header>

      {/* Tab content — relative so emoji overlay stacks correctly */}
      <div className="flex-1 overflow-y-auto relative pb-2">
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

      {/* Emoji reactions bar + floating particles — ONLY visible on Chat tab */}
      {tab === 'chat' && (
        <EmojiReactions
          roomCode={roomCode}
          sessionId={sessionId}
          guestName={guestName}
        />
      )}

      {/* Camera QR Code Scanner & Room Switcher Modal */}
      <ScanRoomModal
        currentRoomCode={roomCode}
        isOpen={showScanModal}
        onClose={() => setShowScanModal(false)}
      />

      {/* Bottom Navigation Bar */}
      <nav
        className="shrink-0 flex items-center justify-around py-1.5 px-2 z-30 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800/80"
        role="tablist"
      >
        {[
          { id: 'search' as const, icon: Search, label: 'Search' },
          { id: 'chat' as const, icon: MessageSquare, label: 'Chat' },
          { id: 'my-songs' as const, icon: Star, label: 'Mine', count: myReservations.length },
          { id: 'queue' as const, icon: ListMusic, label: 'Queue', count: queue.length },
        ].map(({ id, icon: Icon, label, count }) => (
          <button
            key={id}
            id={`remote-tab-${id}`}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-1 transition-all relative"
          >
            <div
              className={`p-1 rounded-xl transition-all ${
                tab === id ? 'bg-white text-black font-extrabold scale-105 shadow' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Icon size={18} />
            </div>
            <span
              className={`text-[11px] font-bold ${
                tab === id ? 'text-white font-black' : 'text-zinc-400'
              }`}
            >
              {label} {count !== undefined ? `(${count})` : ''}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}
