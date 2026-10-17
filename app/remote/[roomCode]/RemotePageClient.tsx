'use client';

// ============================================================
// OKEKARAOKE — Remote Page Client
// Phone remote: search songs, chat, manage reservations, queue
// ============================================================

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Mic2, Wifi, WifiOff, RefreshCw, Search, MessageSquare, ListMusic, Star, Pencil, Check, X, QrCode, Download, Settings, Megaphone, Tv, Smartphone } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { SongSearch } from '@/components/remote/SongSearch';
import { RoomChat } from '@/components/remote/RoomChat';
import { MyReservations } from '@/components/remote/MyReservations';
import { RemoteQueue } from '@/components/remote/RemoteQueue';
import { NameModal } from '@/components/remote/NameModal';
import { EmojiReactions } from '@/components/remote/EmojiReactions';
import { ScanRoomModal } from '@/components/remote/ScanRoomModal';
import { SettingsModal } from '@/components/remote/SettingsModal';
import { ShoutoutModal } from '@/components/remote/ShoutoutModal';
import { TransferRoomModal } from '@/components/remote/TransferRoomModal';
import { MiniTVPlayer } from '@/components/remote/MiniTVPlayer';
import { useRealtime } from '@/hooks/useRealtime';
import { useHeartbeat } from '@/hooks/useHeartbeat';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { getOrCreateGuestSession, updateGuestSession, setGuestSessionForInstance } from '@/lib/auth/guestSession';
import { createClient } from '@/lib/supabase/client';
import { addSongToHistory } from '@/lib/utils/songHistory';
import type { EnrichedQueueItem, InstanceState, ConnectionStatus, Song } from '@/lib/types';

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
  const router = useRouter();
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
  const searchParams = useSearchParams();
  const [showScanModal, setShowScanModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showShoutoutModal, setShowShoutoutModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [isSoloTVMode, setIsSoloTVMode] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [soloPlaybackProgress, setSoloPlaybackProgress] = useState<{
    currentTime: number;
    duration: number;
    isPlaying: boolean;
  }>({ currentTime: 0, duration: 0, isPlaying: true });
  const [tvPlaybackProgress, setTvPlaybackProgress] = useState<{
    currentTime: number;
    duration: number;
    isPlaying: boolean;
  }>({ currentTime: 0, duration: 0, isPlaying: true });
  const soloPlaybackControlsRef = useRef<{
    seekTo: (sec: number) => void;
    restartSong: () => void;
    togglePlay: () => void;
    stopSong?: () => void;
  } | null>(null);
  const { isInstallable, installApp } = usePWAInstall();

  const activePlaybackProgress = isSoloTVMode ? soloPlaybackProgress : tvPlaybackProgress;

  // Reset paused and progress state when a new song starts playing
  const prevSongIdRef = useRef<string | null>(null);
  useEffect(() => {
    const currentId = currentSong?.queue_item_id;
    if (!currentId) {
      prevSongIdRef.current = null;
      setIsPaused(false);
      return;
    }
    const prevId = prevSongIdRef.current;
    // Only reset if switching to an entirely different song
    // (don't wipe pause state if simply reconciling a local temp_ ID to server UUID for the same song)
    const isNewSong = prevId && prevId !== currentId && !(prevId.startsWith('temp_') && !currentId.startsWith('temp_'));
    if (isNewSong) {
      setIsPaused(false);
      setTvPlaybackProgress({ currentTime: 0, duration: 0, isPlaying: true });
    }
    prevSongIdRef.current = currentId;
  }, [currentSong?.queue_item_id]);

  // Synchronize paused state when in 1-Device (solo TV) mode
  useEffect(() => {
    if (isSoloTVMode && soloPlaybackProgress) {
      setIsPaused(!soloPlaybackProgress.isPlaying);
    }
  }, [isSoloTVMode, soloPlaybackProgress.isPlaying]);

  // Set 1-Device Solo mode strictly based on URL solotv parameter
  useEffect(() => {
    const isSoloParam = searchParams?.get('solotv') === 'true' || searchParams?.get('solotv') === '1';
    setIsSoloTVMode(isSoloParam);
    if (typeof window !== 'undefined') {
      localStorage.setItem('okekaraoke_solo_tv', isSoloParam ? 'true' : 'false');
    }
  }, [searchParams]);

  const toggleSoloTVMode = () => {
    setIsSoloTVMode((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('okekaraoke_solo_tv', String(next));
      }
      return next;
    });
  };

  // Remember last room code for app shortcuts & quick rejoining
  useEffect(() => {
    if (typeof window !== 'undefined' && roomCode) {
      localStorage.setItem('okekaraoke_last_room', roomCode.toUpperCase());
    }
  }, [roomCode]);

  // Clear unread count when viewing chat
  useEffect(() => {
    if (tab === 'chat') {
      setUnreadChatCount(0);
    }
  }, [tab]);

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

  // Automatically record current user's playing song to history
  useEffect(() => {
    if (currentSong?.song && currentSong.guest_session_id === sessionId) {
      addSongToHistory(currentSong.song, roomCode);
    }
  }, [currentSong?.queue_item_id, currentSong?.guest_session_id, sessionId, roomCode]);

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

      setCurrentSong((prevCurrent) => {
        if (state.current_song) {
          return { ...state.current_song, status: 'playing' as const };
        }
        // Keep local optimistic temp item alive while waiting for server confirmation
        if (prevCurrent?.queue_item_id.startsWith('temp_')) {
          return prevCurrent;
        }
        return null;
      });

      setQueue((prevQueue) => {
        const incomingQueue = (state.queue || []).map((item) => ({
          ...item,
          status: (item.status || 'queued') as any,
        }));

        const incomingIds = new Set(incomingQueue.map((item) => item.queue_item_id));
        const incomingSongIds = new Set(
          incomingQueue.map((item) => item.song?.id || item.song?.code || item.song?.youtube_video_id).filter(Boolean)
        );

        // Keep local optimistic items that haven't been reconciled by server yet
        const pendingOptimistic = prevQueue.filter(
          (item) =>
            item.queue_item_id.startsWith('temp_') &&
            !incomingIds.has(item.queue_item_id) &&
            !incomingSongIds.has(item.song?.id || item.song?.code || item.song?.youtube_video_id)
        );

        return [...incomingQueue, ...pendingOptimistic];
      });

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

  // Periodic heartbeat from Remote device to server (every 30s)
  useHeartbeat({
    roomCode,
    sessionId,
    deviceType: 'remote',
    deviceName: guestName || undefined,
    intervalMs: 30000,
    enabled: !!(roomCode && sessionId),
  });

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
      registerDevice(cleanName);
    } else {
      setShowNameModal(true);
    }
    fetchState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Realtime handlers with instant state updates from payload
  const realtimeHandlers = useRef({
    queue_added: (payload: any) => {
      if (payload?.song_title && payload?.queue_item_id) {
        setQueue((prev) => {
          if (prev.some((item) => item.queue_item_id === payload.queue_item_id)) return prev;
          // Reconcile and replace any local temp item for this song
          const filtered = prev.filter(
            (item) =>
              !(
                item.queue_item_id.startsWith('temp_') &&
                (item.song.title === payload.song_title ||
                  (payload.youtube_video_id && item.song.youtube_video_id === payload.youtube_video_id))
              )
          );
          return [
            ...filtered,
            {
              queue_item_id: payload.queue_item_id,
              instance_id: payload.instance_id || '',
              guest_name: payload.guest_name || 'Guest',
              guest_session_id: payload.guest_session_id || '',
              position: payload.position ?? filtered.length + 1,
              status: 'queued',
              started_at: null,
              reserved_at: payload.timestamp || new Date().toISOString(),
              song: {
                id: payload.song_id || payload.queue_item_id,
                title: payload.song_title,
                artist: payload.song_artist || '',
                code: payload.song_code || '',
                youtube_video_id: payload.youtube_video_id || '',
                thumbnail_url: payload.thumbnail_url || `https://img.youtube.com/vi/${payload.youtube_video_id}/mqdefault.jpg`,
                duration_seconds: 240,
                category: 'YouTube',
                language: 'Karaoke',
                is_active: true,
              },
            },
          ];
        });
      }
      fetchState();
    },
    queue_removed: fetchState,
    queue_updated: fetchState,
    song_started: (payload: any) => {
      if (payload?.youtube_video_id && payload?.queue_item_id) {
        setCurrentSong({
          queue_item_id: payload.queue_item_id,
          guest_name: payload.guest_name || 'Singer',
          guest_session_id: payload.guest_session_id || '',
          position: payload.position ?? 1,
          status: 'playing',
          started_at: payload.timestamp || new Date().toISOString(),
          reserved_at: payload.timestamp || new Date().toISOString(),
          song: {
            id: payload.song_id || payload.queue_item_id,
            title: payload.song_title || 'Karaoke Track',
            artist: payload.song_artist || '',
            code: '',
            youtube_video_id: payload.youtube_video_id,
            thumbnail_url: payload.thumbnail_url || `https://img.youtube.com/vi/${payload.youtube_video_id}/mqdefault.jpg`,
            duration_seconds: 240,
            category: 'YouTube',
          },
        });
      }
      setIsPaused(false);
      setTvPlaybackProgress({ currentTime: 0, duration: 0, isPlaying: true });
      fetchState();
    },
    song_finished: () => {
      // Optimistically clear current song on remote immediately for instant UI update
      setCurrentSong(null);
      setIsPaused(false);
      setTvPlaybackProgress({ currentTime: 0, duration: 0, isPlaying: false });
      fetchState();
    },
    song_skipped: () => {
      setCurrentSong(null);
      setIsPaused(false);
      setTvPlaybackProgress({ currentTime: 0, duration: 0, isPlaying: false });
      fetchState();
    },
    playback_control: (payload: any) => {
      if (payload?.action === 'pause') {
        setIsPaused(true);
        setTvPlaybackProgress((prev) => ({ ...prev, isPlaying: false }));
      } else if (payload?.action === 'resume') {
        setIsPaused(false);
        setTvPlaybackProgress((prev) => ({ ...prev, isPlaying: true }));
      } else if (payload?.action === 'restart') {
        seekLockUntilRef.current = Date.now() + 2500;
        targetSeekTimeRef.current = 0;
        setIsPaused(false);
        setTvPlaybackProgress((prev) => ({ ...prev, currentTime: 0, isPlaying: true }));
      } else if (payload?.action === 'seek') {
        const sec = typeof payload?.seconds === 'number' ? payload.seconds : 0;
        seekLockUntilRef.current = Date.now() + 2500;
        targetSeekTimeRef.current = sec;
        setTvPlaybackProgress((prev) => ({ ...prev, currentTime: sec, isPlaying: true }));
      } else if (payload?.action === 'stop') {
        setIsPaused(false);
        setCurrentSong(null);
        setTvPlaybackProgress({ currentTime: 0, duration: 0, isPlaying: false });
        fetchState();
      }
    },
    playback_sync: (payload: any) => {
      if (typeof payload?.currentTime === 'number' && typeof payload?.duration === 'number') {
        // Optimistic seek lock: ignore stale broadcasts if we just sought
        const isLocked = Date.now() < seekLockUntilRef.current;
        if (isLocked) {
          if (Math.abs(payload.currentTime - targetSeekTimeRef.current) < 2.0) {
            seekLockUntilRef.current = 0;
          } else {
            return;
          }
        }

        setTvPlaybackProgress({
          currentTime: payload.currentTime,
          duration: payload.duration,
          isPlaying: payload.isPlaying !== undefined ? Boolean(payload.isPlaying) : true,
        });
        if (payload.isPlaying !== undefined) {
          setIsPaused(!payload.isPlaying);
        }
      }
    },
  }).current;

  const seekLockUntilRef = useRef<number>(0);
  const targetSeekTimeRef = useRef<number>(0);
  const broadcastRef = useRef<((event: string, payload: Record<string, unknown>) => void) | null>(null);

  const { broadcast } = useRealtime({
    roomCode,
    handlers: realtimeHandlers,
    enabled: true,
  });

  useEffect(() => {
    broadcastRef.current = broadcast;
  }, [broadcast]);

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

  const handleReserveFailed = useCallback((tempId: string) => {
    setQueue((prev) => prev.filter((item) => item.queue_item_id !== tempId));
    setCurrentSong((prev) => (prev?.queue_item_id === tempId ? null : prev));
  }, []);

  const handleSongReserved = useCallback(
    (song?: Song, resultData?: any, tempIdToReplace?: string) => {
      if (!song) {
        fetchState();
        return;
      }

      // Automatically record to song history in localStorage
      addSongToHistory(song, roomCode);

      const songThumb =
        song.thumbnail_url ||
        (song.youtube_video_id ? `https://img.youtube.com/vi/${song.youtube_video_id}/mqdefault.jpg` : '');

      const isFirstSong = !currentSong && queue.length === 0;
      const isAutoStarted = Boolean(resultData?.started_now) || (!resultData && isFirstSong);

      if (isAutoStarted) {
        const playingItem: EnrichedQueueItem = resultData?.current_song || {
          queue_item_id: resultData?.queue_item_id || tempIdToReplace || `temp_${Date.now()}`,
          instance_id: instanceId || '',
          guest_name: guestName || 'You',
          guest_session_id: sessionId,
          position: 1,
          status: 'playing',
          started_at: new Date().toISOString(),
          reserved_at: new Date().toISOString(),
          song: {
            id: song.id,
            title: song.title,
            artist: song.artist,
            code: song.code || '',
            youtube_video_id: song.youtube_video_id,
            thumbnail_url: songThumb,
            duration_seconds: 240,
            category: 'YouTube',
          },
        };

        setCurrentSong(playingItem);
        if (tempIdToReplace) {
          setQueue((prev) => prev.filter((q) => q.queue_item_id !== tempIdToReplace));
        }
      } else {
        const queuedItem: EnrichedQueueItem = {
          queue_item_id: resultData?.queue_item_id || tempIdToReplace || `temp_${Date.now()}`,
          instance_id: instanceId || '',
          guest_name: guestName || 'You',
          guest_session_id: sessionId,
          position: resultData?.position || queue.length + 1,
          status: 'queued',
          started_at: null,
          reserved_at: new Date().toISOString(),
          song: {
            id: song.id,
            title: song.title,
            artist: song.artist,
            code: song.code || '',
            youtube_video_id: song.youtube_video_id,
            thumbnail_url: songThumb,
            duration_seconds: 240,
            category: 'YouTube',
          },
        };

        setQueue((prev) => {
          if (tempIdToReplace && resultData?.queue_item_id) {
            const hasMatch = prev.some((item) => item.queue_item_id === tempIdToReplace);
            if (hasMatch) {
              return prev.map((item) =>
                item.queue_item_id === tempIdToReplace
                  ? { ...queuedItem, queue_item_id: resultData.queue_item_id }
                  : item
              );
            }
          }
          if (prev.some((q) => q.queue_item_id === queuedItem.queue_item_id)) return prev;
          return [...prev, queuedItem];
        });
      }

      if (resultData?.queue_item_id) {
        fetchState();
      }
    },
    [currentSong, queue.length, instanceId, guestName, sessionId, fetchState]
  );

  const myReservations = useMemo(() => {
    const list: EnrichedQueueItem[] = [];
    const seenIds = new Set<string>();

    if (currentSong && (currentSong.guest_session_id === sessionId || currentSong.queue_item_id.startsWith('temp_'))) {
      list.push({ ...currentSong, status: 'playing' as const });
      seenIds.add(currentSong.queue_item_id);
    }

    queue.forEach((item) => {
      const isMine = item.guest_session_id === sessionId || item.queue_item_id.startsWith('temp_');
      if (isMine && !seenIds.has(item.queue_item_id)) {
        seenIds.add(item.queue_item_id);
        list.push({ ...item, status: (item.status || 'queued') as any });
      }
    });

    return list;
  }, [currentSong, queue, sessionId]);

  const reservedSongIds = useMemo(() => {
    const set = new Set<string>();
    myReservations.forEach((item) => {
      if (item.song?.id) set.add(item.song.id);
      if (item.song?.youtube_video_id) set.add(item.song.youtube_video_id);
      if (item.song?.code) set.add(item.song.code);
    });
    return set;
  }, [myReservations]);

  const handleRestartSong = useCallback(
    async (queueItemId: string) => {
      seekLockUntilRef.current = Date.now() + 2500;
      targetSeekTimeRef.current = 0;

      if (isSoloTVMode) {
        soloPlaybackControlsRef.current?.restartSong?.();
        setSoloPlaybackProgress((prev) => ({ ...prev, currentTime: 0, isPlaying: true }));
      }
      setTvPlaybackProgress((prev) => ({ ...prev, currentTime: 0, isPlaying: true }));
      setIsPaused(false);

      // Instant 0ms WebSocket broadcast directly to TV
      broadcastRef.current?.('playback_control', {
        type: 'playback_control',
        action: 'restart',
        seconds: 0,
        queue_item_id: queueItemId,
        guest_session_id: sessionId,
        guest_name: guestName,
        timestamp: new Date().toISOString(),
      });

      try {
        fetch('/api/queue/control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            room_code: roomCode,
            session_id: sessionId,
            action: 'restart',
            queue_item_id: queueItemId,
          }),
        }).catch(() => {});
      } catch (err) {
        console.error('[Restart Song Error]:', err);
      }
    },
    [isSoloTVMode, roomCode, sessionId, guestName]
  );

  const handleSeekSong = useCallback(
    async (queueItemId: string, seconds: number) => {
      // 1. Optimistic seek lock: prevent stale progress broadcasts from snapping back for 2.5s
      seekLockUntilRef.current = Date.now() + 2500;
      targetSeekTimeRef.current = seconds;
      setIsPaused(false);

      if (isSoloTVMode) {
        soloPlaybackControlsRef.current?.seekTo?.(seconds);
        setSoloPlaybackProgress((prev) => ({ ...prev, currentTime: seconds, isPlaying: true }));
      }
      setTvPlaybackProgress((prev) => ({ ...prev, currentTime: seconds, isPlaying: true }));

      // 2. Instant 0ms WebSocket broadcast directly to TV
      broadcastRef.current?.('playback_control', {
        type: 'playback_control',
        action: 'seek',
        seconds,
        queue_item_id: queueItemId,
        guest_session_id: sessionId,
        guest_name: guestName,
        timestamp: new Date().toISOString(),
      });

      // 3. Notify server in background
      try {
        fetch('/api/queue/control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            room_code: roomCode,
            session_id: sessionId,
            action: 'seek',
            seconds,
            queue_item_id: queueItemId,
          }),
        }).catch(() => {});
      } catch (err) {
        console.error('[Seek Song Error]:', err);
      }
    },
    [isSoloTVMode, roomCode, sessionId, guestName]
  );

  const handleTogglePauseSong = useCallback(
    async (queueItemId: string, paused: boolean) => {
      const action = paused ? 'pause' : 'resume';
      setIsPaused(paused);
      setTvPlaybackProgress((prev) => ({ ...prev, isPlaying: !paused }));

      // Instant 0ms WebSocket broadcast directly to TV
      broadcastRef.current?.('playback_control', {
        type: 'playback_control',
        action,
        queue_item_id: queueItemId,
        guest_session_id: sessionId,
        guest_name: guestName,
        timestamp: new Date().toISOString(),
      });

      try {
        fetch('/api/queue/control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            room_code: roomCode,
            session_id: sessionId,
            action,
            queue_item_id: queueItemId,
          }),
        }).catch(() => {});
      } catch (err) {
        console.error('[Toggle Pause Error]:', err);
      }
    },
    [roomCode, sessionId, guestName]
  );

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
        onOpenTransferModal={() => setShowTransferModal(true)}
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

        {/* Action Row: Scan TV, Solo TV Mode, Live Shoutout, Guest Name Edit */}
        <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-zinc-900/80 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 min-w-0 shrink-0">
            <button
              onClick={() => setShowScanModal(true)}
              className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 hover:text-white flex items-center gap-1 text-[11px] font-bold active:scale-95 transition-all shrink-0 whitespace-nowrap"
              title="Scan TV / Switch Room"
            >
              <QrCode size={12} className="text-teal-400" />
              <span>Scan TV</span>
            </button>

            {/* 1-Device indicator — ONLY visible when 1-Device mode is active */}
            {isSoloTVMode && (
              <div
                className="px-2 py-1 rounded-lg border flex items-center gap-1 text-[11px] font-extrabold shrink-0 whitespace-nowrap bg-teal-400 text-black border-teal-300 shadow-sm shadow-teal-500/30"
                title="1-Device Karaoke Mode active: Sing & search directly on this phone"
              >
                <Smartphone size={12} className="text-black" />
                <span>1 DEVICE</span>
              </div>
            )}

            <button
              onClick={() => setShowShoutoutModal(true)}
              className="px-2 py-1 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-teal-300 flex items-center gap-1 text-[11px] font-extrabold active:scale-95 transition-all shadow-sm shrink-0 whitespace-nowrap"
              title="Broadcast Live TV Shoutout"
            >
              <Megaphone size={12} className="text-teal-400 animate-pulse" />
              <span>Shoutout</span>
            </button>
          </div>

          {/* Guest name — editable inline */}
          <div className="flex items-center gap-1 shrink-0 max-w-[130px]">
            {editingName ? (
              <div className="flex items-center gap-1 bg-zinc-900 border border-teal-500/50 rounded-lg px-2 py-0.5">
                <input
                  ref={editInputRef}
                  type="text"
                  value={editNameValue}
                  onChange={(e) => setEditNameValue(e.target.value)}
                  onKeyDown={handleEditKeyDown}
                  maxLength={20}
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
                className="px-2 py-1 rounded-lg bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800/80 text-zinc-300 hover:text-white flex items-center gap-1 text-xs font-semibold active:scale-95 transition-all truncate"
                title="Click to edit your display name"
              >
                <span className="truncate max-w-[80px] text-[11px]">{guestName || 'Your name'}</span>
                <Pencil size={11} className="text-zinc-500 shrink-0" />
              </button>
            )}
          </div>
        </div>

        {/* Now playing mini (shown when Solo TV mode is off) */}
        {!isSoloTVMode && currentSong && (
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

      {/* Mini TV Player for 1-Phone (Solo TV + Remote) Mode */}
      {isSoloTVMode && (
        <MiniTVPlayer
          roomCode={roomCode}
          sessionId={sessionId}
          currentSong={currentSong}
          queue={queue}
          onClose={() => {
            setIsSoloTVMode(false);
            if (typeof window !== 'undefined') {
              localStorage.setItem('okekaraoke_solo_tv', 'false');
            }
            router.replace(`/remote/${roomCode}`);
          }}
          onRefreshState={fetchState}
          onOpenTransferModal={() => setShowTransferModal(true)}
          onProgressChange={setSoloPlaybackProgress}
          onRegisterControls={(ctrls) => {
            soloPlaybackControlsRef.current = ctrls;
          }}
        />
      )}

      {/* Tab content — relative so emoji overlay stacks correctly */}
      <div className="flex-1 min-h-0 flex flex-col relative overflow-hidden">
        <div className="flex-1 overflow-y-auto pb-2" style={{ display: tab === 'search' ? 'block' : 'none' }}>
          <SongSearch
            roomCode={roomCode}
            sessionId={sessionId}
            guestName={guestName}
            onReserved={handleSongReserved}
            onReserveFailed={handleReserveFailed}
            reservedSongIds={reservedSongIds}
            isSoloTVMode={isSoloTVMode}
          />
        </div>
        <div className="flex-1 min-h-0 h-full flex-col overflow-hidden" style={{ display: tab === 'chat' ? 'flex' : 'none' }}>
          <RoomChat
            roomCode={roomCode}
            sessionId={sessionId}
            guestName={guestName}
            onlineUsers={onlineUsers}
            onNewMessage={() => {
              setUnreadChatCount(prev => prev + 1);
            }}
          />
        </div>
        <div className="flex-1 overflow-y-auto pb-2" style={{ display: tab === 'my-songs' ? 'block' : 'none' }}>
          <MyReservations
            reservations={myReservations}
            currentSongId={currentSong?.queue_item_id}
            sessionId={sessionId}
            roomCode={roomCode}
            guestName={guestName}
            onCancelled={() => fetchState()}
            allowCancel={instanceState?.settings.allow_cancel ?? true}
            onReserved={handleSongReserved}
            onReserveFailed={handleReserveFailed}
            isSoloTVMode={isSoloTVMode}
            onSoloStop={() => soloPlaybackControlsRef.current?.stopSong?.()}
            onSoloTogglePlay={() => soloPlaybackControlsRef.current?.togglePlay?.()}
            isPaused={isPaused}
            onTogglePause={(paused) => setIsPaused(paused)}
            onTogglePauseSong={handleTogglePauseSong}
            playbackProgress={activePlaybackProgress}
            onRestartSong={handleRestartSong}
            onSeekSong={handleSeekSong}
          />
        </div>
        <div className="flex-1 overflow-y-auto pb-2" style={{ display: tab === 'queue' ? 'block' : 'none' }}>
          <RemoteQueue
            queue={queue}
            currentSong={currentSong}
            sessionId={sessionId}
            roomCode={roomCode}
            onRefresh={() => fetchState()}
            isPaused={isPaused}
          />
        </div>
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

      {/* Transfer / Pair Queue to Big TV Screen Modal */}
      <TransferRoomModal
        open={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        currentRoomCode={roomCode}
        sessionId={sessionId}
        onTransferred={fetchState}
      />

      {/* Bottom Navigation Bar */}
      <nav
        className="shrink-0 flex items-center justify-around py-1.5 px-2 z-30 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800/80"
        role="tablist"
      >
        {[
          { id: 'search' as const, icon: Search, label: 'Search' },
          { id: 'chat' as const, icon: MessageSquare, label: 'Chat', badgeCount: unreadChatCount },
          { id: 'my-songs' as const, icon: Star, label: 'Mine', count: myReservations.length },
          { id: 'queue' as const, icon: ListMusic, label: 'Queue', count: queue.length },
        ].map(({ id, icon: Icon, label, count, badgeCount }) => (
          <button
            key={id}
            id={`remote-tab-${id}`}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-1 transition-all relative"
          >
            <div
              className={`p-1 rounded-xl transition-all relative ${
                tab === id ? 'bg-white text-black font-extrabold scale-105 shadow' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Icon size={18} />
              {(badgeCount ?? 0) > 0 && tab !== id && (
                <div className="absolute -top-1 -right-2 bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-md animate-bounce">
                  {(badgeCount ?? 0) > 9 ? '9+' : badgeCount}
                </div>
              )}
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
