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
  const [autoplayUnlocked, setAutoplayUnlocked] = useState(false);
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

  // Unlock autoplay on first tap (browser policy)
  const handleUnlockAutoplay = useCallback(() => {
    setAutoplayUnlocked(true);
  }, []);

  return (
    <div
      className="flex flex-col"
      style={{ height: '100dvh', background: 'var(--color-bg)', overflow: 'hidden' }}
      onClick={!autoplayUnlocked ? handleUnlockAutoplay : undefined}
    >
      {/* Autoplay unlock prompt — shown until user taps the screen */}
      {!autoplayUnlocked && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
        >
          <div
            className="flex flex-col items-center gap-4 px-8 py-6 rounded-2xl text-center"
            style={{ background: 'rgba(20,20,30,0.95)', border: '1px solid rgba(99,102,241,0.3)' }}
          >
            <div className="text-4xl">▶️</div>
            <p className="text-white font-bold text-xl">Tap anywhere to enable autoplay</p>
            <p className="text-slate-400 text-sm">Required once by your browser</p>
          </div>
        </div>
      )}

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
          autoplay={autoplayUnlocked && (instanceState?.settings.autoplay ?? true)}
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
