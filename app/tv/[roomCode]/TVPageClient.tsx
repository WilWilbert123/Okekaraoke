'use client';

// ============================================================
// OKEKARAOKE — TV Page Client
// The main karaoke TV screen experience
// ============================================================

import { useState, useCallback, useEffect, useRef } from 'react';
import { TVHeader } from '@/components/tv/TVHeader';
import { TVQueue } from '@/components/tv/TVQueue';
import { YouTubePlayer } from '@/components/tv/YouTubePlayer';
import { NowPlaying } from '@/components/tv/NowPlaying';
import { QRPanel } from '@/components/tv/QRPanel';
import { useRealtime } from '@/hooks/useRealtime';
import { useHeartbeat } from '@/hooks/useHeartbeat';
import { getOrCreateGuestSession, setGuestSessionForInstance } from '@/lib/auth/guestSession';
import type { EnrichedQueueItem, InstanceState, PlayerState, ConnectionStatus } from '@/lib/types';

interface TVPageClientProps {
  roomCode: string;
}

export function TVPageClient({ roomCode }: TVPageClientProps) {
  const [instanceState, setInstanceState] = useState<InstanceState | null>(null);
  const [currentSong, setCurrentSong] = useState<EnrichedQueueItem | null>(null);
  const [queue, setQueue] = useState<EnrichedQueueItem[]>([]);
  const [playerState, setPlayerState] = useState<PlayerState>({ status: 'idle', video_id: null, queue_item_id: null });
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('reconnecting');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<string | null>(null);
  const advancingRef = useRef(false);

  // Fetch authoritative state from server
  const fetchState = useCallback(async () => {
    try {
      const response = await fetch(`/api/instances/${roomCode}/state`);
      const json = await response.json();

      if (!response.ok || !json.success) {
        if (response.status === 404) {
          setError('ROOM NOT FOUND\n\nThis OKEKARAOKE room does not exist or has expired.');
        } else {
          setError(json.error?.message ?? 'Failed to load room state.');
        }
        setConnectionStatus('offline');
        setLoading(false);
        return;
      }

      const state = json.data as InstanceState;
      setInstanceState(state);
      setCurrentSong(state.current_song);
      setQueue(state.queue);
      setError(null);
      setConnectionStatus('connected');
      setLoading(false);

      // Register/update device
      const session = getOrCreateGuestSession();
      sessionRef.current = session.session_id;
      setGuestSessionForInstance(state.instance.id, roomCode, 'tv');

    } catch {
      setConnectionStatus('offline');
      setLoading(false);
    }
  }, [roomCode]);

  // Initial load
  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // Online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setConnectionStatus('reconnecting');
      fetchState();
    };
    const handleOffline = () => setConnectionStatus('offline');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchState]);

  // Heartbeat
  useHeartbeat({
    roomCode,
    sessionId: sessionRef.current,
    deviceType: 'tv',
    intervalMs: 15000,
    enabled: !!sessionRef.current,
  });

  // Song ended handler — TV notifies server
  const handleSongEnded = useCallback(async (completedQueueItemId: string) => {
    if (advancingRef.current) return;
    advancingRef.current = true;

    try {
      const response = await fetch('/api/queue/next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_code: roomCode,
          session_id: sessionRef.current,
          completed_queue_item_id: completedQueueItemId,
        }),
      });

      const json = await response.json();

      if (json.success && json.data.next_queue_item_id) {
        // Realtime will update state, but we can proactively update
        // to reduce latency (server is still the authority)
        setCurrentSong(null); // Will be set by realtime event
      } else {
        // No next song
        setCurrentSong(null);
        setPlayerState({ status: 'idle', video_id: null, queue_item_id: null });
      }
    } catch (err) {
      console.error('Failed to advance queue:', err);
    } finally {
      advancingRef.current = false;
    }
  }, [roomCode]);

  // Realtime subscriptions
  useRealtime({
    roomCode: connectionStatus !== 'offline' ? roomCode : null,
    handlers: {
      queue_added: () => {
        // Refresh state to get updated queue
        fetchState();
      },
      queue_removed: () => {
        fetchState();
      },
      queue_updated: () => {
        fetchState();
      },
      song_started: (payload) => {
        // Build an optimistic current song from payload
        fetchState(); // Full refresh for accuracy
        setConnectionStatus('connected');
      },
      song_finished: () => {
        setCurrentSong(null);
        fetchState();
      },
      song_skipped: () => {
        fetchState();
      },
    },
    enabled: true,
  });

  // Fullscreen
  const handleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      // Fullscreen not supported
    }
  }, []);

  useEffect(() => {
    const handleChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  // Error state
  if (error) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center text-center px-4">
        <div className="glass rounded-2xl p-8 max-w-md">
          <p className="text-4xl font-black text-red-400 mb-4" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            {error.split('\n')[0]}
          </p>
          <p className="text-slate-400 mb-6">{error.split('\n').slice(1).join(' ')}</p>
          <a
            href="/"
            className="inline-block px-6 py-3 rounded-xl font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #6366f1, #7c3aed)' }}
          >
            Back to Home
          </a>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 font-medium">CONNECTING TV...</p>
        <p className="text-slate-600 text-sm">Room: {roomCode}</p>
      </div>
    );
  }

  const currentVideoId = currentSong?.song.youtube_video_id ?? null;
  const currentQueueItemId = currentSong?.queue_item_id ?? null;

  return (
    <div
      className="flex flex-col"
      style={{ height: '100dvh', background: 'var(--color-bg)', overflow: 'hidden' }}
    >
      {/* LAYER 1: Header */}
      <TVHeader
        roomCode={roomCode}
        connectionStatus={connectionStatus}
        onFullscreen={handleFullscreen}
        isFullscreen={isFullscreen}
      />

      {/* LAYER 2: Next Songs Bar */}
      <div style={{ background: 'rgba(13, 13, 20, 0.9)', borderBottom: '1px solid var(--color-border)' }}>
        <TVQueue queue={queue} />
      </div>

      {/* LAYER 3: YouTube Player (flex-1 = takes remaining space) */}
      <div className="flex-1 relative min-h-0" style={{ background: '#000' }}>
        <YouTubePlayer
          videoId={currentVideoId}
          queueItemId={currentQueueItemId}
          onEnded={handleSongEnded}
          onStateChange={setPlayerState}
          autoplay={instanceState?.settings.autoplay ?? true}
          className="absolute inset-0"
        />
      </div>

      {/* LAYER 4: Now Playing */}
      <NowPlaying currentSong={currentSong} />

      {/* LAYER 5: QR Panel */}
      <QRPanel
        roomCode={roomCode}
        appUrl={process.env.NEXT_PUBLIC_APP_URL}
      />
    </div>
  );
}
