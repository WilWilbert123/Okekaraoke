'use client';

// ============================================================
// OKEKARAOKE — Remote Page Client
// Phone remote: search songs, chat, manage reservations, queue
// ============================================================

import { useState, useCallback, useEffect, useRef } from 'react';
import { Mic2, Wifi, WifiOff, RefreshCw, Search, MessageSquare, ListMusic, Star, Pencil, Check, X, QrCode, Download, Settings, Megaphone } from 'lucide-react';
import { SongSearch } from '@/components/remote/SongSearch';
import { RoomChat } from '@/components/remote/RoomChat';
import { MyReservations } from '@/components/remote/MyReservations';
import { RemoteQueue } from '@/components/remote/RemoteQueue';
import { NameModal } from '@/components/remote/NameModal';
import { EmojiReactions } from '@/components/remote/EmojiReactions';
import { ScanRoomModal } from '@/components/remote/ScanRoomModal';
import { SettingsModal } from '@/components/remote/SettingsModal';
import { ShoutoutModal } from '@/components/remote/ShoutoutModal';
import { useRealtime } from '@/hooks/useRealtime';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { getOrCreateGuestSession, updateGuestSession, setGuestSessionForInstance } from '@/lib/auth/guestSession';
import { createClient } from '@/lib/supabase/client';
import type { EnrichedQueueItem, InstanceState, ConnectionStatus } from '@/lib/types';

export interface OnlineUser {
  session_id: string;
  name: string;
  device_type?: string;
  online_at?: string;
}

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
  const [showShoutoutModal, setShowShoutoutModal] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const { isInstallable, installApp } = usePWAInstall();

  // Remember last room code for app shortcuts & quick rejoining
  useEffect(() => {
    if (typeof window !== 'undefined' && roomCode) {
      localStorage.setItem('okekaraoke_last_room', roomCode.toUpperCase());
    }
  }, [roomCode]);

  // ── Room-Wide Presence Subscription (tracks all remotes across all tabs) ──
  useEffect(() => {
    if (!roomCode || !sessionId) return;
    const supabase = createClient();
    const presenceChannelName = `okekaraoke:presence:${roomCode.toUpperCase()}`;

    const channel = supabase.channel(presenceChannelName, {
      config: { presence: { key: sessionId } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const activeList: OnlineUser[] = [];
        const seen = new Set<string>();

        Object.values(state).forEach((presences: any) => {
          presences.forEach((p: any) => {
            const sId = p.session_id || p.name;
            if (sId && !seen.has(sId)) {
              seen.add(sId);
              activeList.push({
                session_id: p.session_id || sId,
                name: p.name || 'Guest Remote',
                device_type: p.device_type || 'remote',
                online_at: p.online_at,
              });
            }
          });
        });
        setOnlineUsers(activeList);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            session_id: sessionId,
            name: guestName || 'Guest Remote',
            device_type: 'remote',
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode, sessionId, guestName]);

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

    const storedName = session.guest_name || (typeof window !== 'undefined' ? localStorage.getItem('okekaraoke_guest_name') : null);

    if (storedName && storedName.trim()) {
      const cleanName = storedName.trim();
      setGuestName(cleanName);
      setShowNameModal(false);
      localStorage.setItem(NAME_CONFIRMED_KEY, '1');
      localStorage.setItem('okekaraoke_guest_name', cleanName);
      if (session.guest_name !== cleanName) {
        updateGuestSession({ guest_name: cleanName });
      }
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
    if (trimmed) {
      setGuestName(trimmed);
      updateGuestSession({ guest_name: trimmed });
      localStorage.setItem('okekaraoke_guest_name', trimmed);
      localStorage.setItem(NAME_CONFIRMED_KEY, '1');
      setShowNameModal(false);
      registerDevice(trimmed);
    }
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
      localStorage.setItem('okekaraoke_guest_name', trimmed);
      localStorage.setItem(NAME_CONFIRMED_KEY, '1');
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

      <SettingsModal
        open={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        guestName={guestName}
        onUpdateName={(name) => {
          const trimmed = name.trim();
          if (trimmed) {
            setGuestName(trimmed);
            updateGuestSession({ guest_name: trimmed });
            localStorage.setItem('okekaraoke_guest_name', trimmed);
            localStorage.setItem(NAME_CONFIRMED_KEY, '1');
            registerDevice(trimmed);
          }
        }}
        roomCode={roomCode}
        isInstallable={isInstallable}
        onInstallApp={installApp}
      />

      {/* Header */}
      <header
        className="px-3.5 py-2.5 shrink-0 select-none"
        style={{
          background: 'rgba(9, 9, 11, 0.96)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        {/* Top Row: Logo, Room Code Badge, Status, Settings */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/okekaraokelogo.png" alt="OKEKARAOKE" className="w-6 h-6 object-contain drop-shadow shrink-0" />
            <span className="text-xs font-black tracking-tight shrink-0" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              <span className="text-teal-400">OKE</span>
              <span className="text-white">KARAOKE</span>
            </span>

            {/* Room Code Badge */}
            <div className="px-2 py-0.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] font-black text-teal-400 flex items-center gap-1 shrink-0 font-mono">
              <span className="text-zinc-500 font-semibold">ROOM</span>
              <span className="text-white font-extrabold tracking-wider">{roomCode}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isInstallable && (
              <button
                onClick={installApp}
                className="p-1.5 rounded-lg bg-teal-400 hover:bg-teal-300 text-black flex items-center justify-center transition-all active:scale-95 shadow-sm shrink-0"
                title="Install App"
                aria-label="Install App"
              >
                <Download size={14} />
              </button>
            )}

            {connectionStatus !== 'connected' && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-zinc-900 border border-zinc-800">
                <StatusIcon
                  size={11}
                  style={{ color: statusColor }}
                  className={connectionStatus === 'reconnecting' ? 'animate-spin' : ''}
                />
                <span className="text-[10px] font-semibold" style={{ color: statusColor }}>{statusLabel}</span>
              </div>
            )}

            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white flex items-center justify-center transition-all active:scale-95 shrink-0"
              title="Settings & Support"
            >
              <Settings size={14} />
            </button>
          </div>
        </div>

        {/* Action Row: Scan TV, Live Shoutout, Guest Name Edit */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-900/80">
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              onClick={() => setShowScanModal(true)}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 hover:text-white flex items-center gap-1.5 text-[11px] font-bold active:scale-95 transition-all shrink-0 whitespace-nowrap"
              title="Scan TV / Switch Room"
            >
              <QrCode size={12} className="text-teal-400" />
              <span>Scan TV</span>
            </button>

            <button
              onClick={() => setShowShoutoutModal(true)}
              className="px-2.5 py-1 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-teal-300 flex items-center gap-1.5 text-[11px] font-extrabold active:scale-95 transition-all shadow-sm shrink-0 whitespace-nowrap"
              title="Broadcast Live TV Shoutout"
            >
              <Megaphone size={12} className="text-teal-400 animate-pulse" />
              <span>Shoutout</span>
            </button>
          </div>

          {/* Guest name — editable inline */}
          <div className="flex items-center gap-1 shrink-0 max-w-[140px]">
            {editingName ? (
              <div className="flex items-center gap-1 bg-zinc-900 border border-teal-500/50 rounded-lg px-2 py-0.5">
                <input
                  ref={editInputRef}
                  type="text"
                  value={editNameValue}
                  onChange={(e) => setEditNameValue(e.target.value)}
                  onKeyDown={handleEditKeyDown}
                  maxLength={30}
                  className="text-right text-xs text-white bg-transparent outline-none w-20 font-medium"
                  aria-label="Edit your name"
                />
                <button onClick={saveEditName} aria-label="Save name" className="text-green-400 hover:text-green-300 active:scale-90 transition-transform">
                  <Check size={12} />
                </button>
                <button onClick={cancelEditName} aria-label="Cancel" className="text-zinc-500 hover:text-zinc-300 active:scale-90 transition-transform">
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button
                onClick={startEditName}
                className="px-2 py-1 rounded-lg bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800/80 text-zinc-300 hover:text-white flex items-center gap-1.5 text-xs font-semibold active:scale-95 transition-all truncate"
                title="Click to edit your display name"
              >
                <span className="truncate max-w-[90px] text-[11px]">{guestName || 'Your name'}</span>
                <Pencil size={11} className="text-zinc-500 shrink-0" />
              </button>
            )}
          </div>
        </div>

        {/* Now playing mini */}
        {currentSong && (
          <div
            className="mt-2 px-3 py-1.5 rounded-lg flex items-center gap-2 bg-zinc-900/80 border border-zinc-800/60"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse shrink-0" />
            <p className="text-[11px] text-zinc-400 truncate">
              NOW: <span className="text-white font-medium">{currentSong.song.title}</span>
              {' · '}{currentSong.song.artist}
            </p>
          </div>
        )}
      </header>

      {/* Tab content — relative so emoji overlay stacks correctly */}
      <div className="flex-1 min-h-0 flex flex-col relative overflow-hidden">
        {tab === 'search' && (
          <div className="flex-1 overflow-y-auto pb-2">
            <SongSearch
              roomCode={roomCode}
              sessionId={sessionId}
              guestName={guestName}
              onReserved={() => fetchState()}
            />
          </div>
        )}
        {tab === 'chat' && (
          <div className="flex-1 min-h-0 h-full flex flex-col overflow-hidden">
            <RoomChat
              roomCode={roomCode}
              sessionId={sessionId}
              guestName={guestName}
              onlineUsers={onlineUsers}
            />
          </div>
        )}
        {tab === 'my-songs' && (
          <div className="flex-1 overflow-y-auto pb-2">
            <MyReservations
              reservations={myReservations}
              sessionId={sessionId}
              roomCode={roomCode}
              guestName={guestName}
              onCancelled={() => fetchState()}
              allowCancel={instanceState?.settings.allow_cancel ?? true}
            />
          </div>
        )}
        {tab === 'queue' && (
          <div className="flex-1 overflow-y-auto pb-2">
            <RemoteQueue
              queue={queue}
              currentSong={currentSong}
              sessionId={sessionId}
              roomCode={roomCode}
              onRefresh={() => fetchState()}
            />
          </div>
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

      {/* Live Broadcast TV Shoutout Modal */}
      <ShoutoutModal
        open={showShoutoutModal}
        onClose={() => setShowShoutoutModal(false)}
        roomCode={roomCode}
        guestName={guestName}
        sessionId={sessionId}
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
