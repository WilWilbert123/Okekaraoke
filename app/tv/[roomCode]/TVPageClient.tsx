'use client';

// ============================================================
// OKEKARAOKE — TV Page Client
// Full-screen cinema karaoke TV screen experience with glass overlays
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
  const handlePlayerStateChange = useCallback((newState: PlayerState) => {
    setPlayerState((prev) => {
      if (
        prev.status === newState.status &&
        prev.video_id === newState.video_id &&
        prev.queue_item_id === newState.queue_item_id
      ) {
        return prev;
      }
      return newState;
    });
  }, []);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('reconnecting');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<string | null>(null);
  const advancingRef = useRef(false);
  const currentSongRef = useRef<EnrichedQueueItem | null>(null);

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
      currentSongRef.current = state.current_song;
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

  // Auto-start: advance queue to play the first song when nothing is playing
  const autoStartQueue = useCallback(async () => {
    if (advancingRef.current) return;
    if (currentSongRef.current) return; // already playing

    // Wait up to 2s for session to be available
    let sessionId = sessionRef.current;
    if (!sessionId) {
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 100));
        sessionId = sessionRef.current;
        if (sessionId) break;
      }
    }
    if (!sessionId) return; // give up

    advancingRef.current = true;
    try {
      await fetch('/api/queue/next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_code: roomCode,
          session_id: sessionId,
          completed_queue_item_id: null,
        }),
      });
      // song_started realtime event will call fetchState
    } catch (err) {
      console.error('Auto-start failed:', err);
    } finally {
      advancingRef.current = false;
    }
  }, [roomCode]);

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
        fetchState();
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
  }, [roomCode, fetchState]);

  // Realtime subscriptions
  const realtimeHandlers = useRef({
    queue_added: () => {
      fetchState();
      if (!currentSongRef.current) {
        setTimeout(() => autoStartQueue(), 300);
      }
    },
    queue_removed: fetchState,
    queue_updated: fetchState,
    song_started: () => {
      fetchState();
      setConnectionStatus('connected');
    },
    song_finished: () => {
      setCurrentSong(null);
      currentSongRef.current = null;
      fetchState();
    },
    song_skipped: fetchState,
  }).current;

  useRealtime({
    roomCode,
    handlers: realtimeHandlers,
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
      className="relative w-full h-full"
      style={{ height: '100dvh', background: '#000', overflow: 'hidden' }}
    >
      {/* LAYER 0: Fullscreen YouTube Video Player (Corner-to-Corner) */}
      <div className="absolute inset-0 z-0">
        <YouTubePlayer
          videoId={currentVideoId}
          queueItemId={currentQueueItemId}
          onEnded={handleSongEnded}
          onStateChange={handlePlayerStateChange}
          autoplay={instanceState?.settings.autoplay ?? true}
          className="w-full h-full"
        />
      </div>

      {/* LAYER 1: Floating Header & Up Next Bar (Top) */}
      <div className="absolute top-0 left-0 right-0 z-20 pointer-events-auto">
        <TVHeader
          roomCode={roomCode}
          connectionStatus={connectionStatus}
          onFullscreen={handleFullscreen}
          isFullscreen={isFullscreen}
        />
        {queue.length > 0 && (
          <div style={{ background: 'rgba(5, 5, 12, 0.65)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <TVQueue queue={queue} />
          </div>
        )}
      </div>

      {/* LAYER 2: Floating Glass Bottom Bar (Now Playing + QR Code Card) */}
      <div
        className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-between gap-4 px-6 py-3 pointer-events-auto"
        style={{
          background: 'linear-gradient(to top, rgba(5, 5, 12, 0.95) 0%, rgba(5, 5, 12, 0.5) 75%, transparent 100%)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <NowPlaying currentSong={currentSong} />
        <QRPanel roomCode={roomCode} appUrl={process.env.NEXT_PUBLIC_APP_URL} />
      </div>
    </div>
  );
}
