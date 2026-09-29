'use client';

// ============================================================
// OKEKARAOKE — TV Page Client
// Full-screen cinema karaoke TV screen experience with glass overlays
// ============================================================

import { useState, useCallback, useEffect, useRef } from 'react';
import { TVHeader } from '@/components/tv/TVHeader';
import { TVBanner } from '@/components/tv/TVBanner';
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
  const [bannerSettings, setBannerSettings] = useState<{ banner_enabled: boolean; banner_text: string; banner_image_url?: string; banner_speed?: number }>({ banner_enabled: false, banner_text: '' });
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('reconnecting');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<string | null>(null);
  const advancingRef = useRef(false);
  const currentSongRef = useRef<EnrichedQueueItem | null>(null);
  const autoStartQueueRef = useRef<() => void>(() => {});
  // Track queue_item_ids that were stopped/skipped by remote so the YouTube
  // player's onEnded callback does NOT call /api/queue/next for them.
  const skippedByRemoteRef = useRef<Set<string>>(new Set());

  // Auto-start: advance queue to play the first song when nothing is playing
  const autoStartQueue = useCallback(async () => {
    if (advancingRef.current) return;
    if (currentSongRef.current) return; // already playing

    // Wait up to 3s for session to be registered in the devices table
    let sessionId = sessionRef.current;
    if (!sessionId) {
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 100));
        sessionId = sessionRef.current;
        if (sessionId) break;
      }
    }
    if (!sessionId) return;

    advancingRef.current = true;
    try {
      const res = await fetch('/api/queue/next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_code: roomCode,
          session_id: sessionId,
          completed_queue_item_id: null,
        }),
      });
      const json = await res.json();
      if (json.success && json.data?.next_queue_item_id) {
        fetchStateRef.current();
      }
    } catch (err) {
      console.error('Auto-start failed:', err);
    } finally {
      advancingRef.current = false;
    }
  }, [roomCode]);

  // Keep autoStartQueueRef current
  useEffect(() => { autoStartQueueRef.current = autoStartQueue; }, [autoStartQueue]);

  // fetchState ref (so autoStartQueue can call it without circular dep)
  const fetchStateRef = useRef<(triggerAutoStart?: boolean) => void>(() => {});

  // Fetch authoritative state from server
  const fetchState = useCallback(async (triggerAutoStart = false) => {
    try {
      const response = await fetch(`/api/instances/${roomCode}/state?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      const json = await response.json();

      if (!response.ok || !json.success) {
        if (response.status === 404) {
          setError('ROOM NOT FOUND\n\nThis OKEKARAOKE room does not exist or has expired.');
        } else {
          setError(json.error?.message ?? 'Failed to load room state.');
        }
        setConnectionStatus('offline');
        fetch('/api/admin/settings').then(res => res.json()).then(json => { if (json.success) setBannerSettings(json.data); }).catch(() => {}); setLoading(false);
        return;
      }

      const state = json.data as InstanceState;
      setInstanceState(state);
      setCurrentSong(state.current_song);
      currentSongRef.current = state.current_song;
      setQueue(state.queue);
      setError(null);
      setConnectionStatus('connected');
      fetch('/api/admin/settings').then(res => res.json()).then(json => { if (json.success) setBannerSettings(json.data); }).catch(() => {}); setLoading(false);

      // Register/update device in localStorage and in Supabase devices table
      const session = getOrCreateGuestSession();
      sessionRef.current = session.session_id;
      setGuestSessionForInstance(state.instance.id, roomCode, 'tv');

      // Register TV device in DB so /api/queue/next accepts it as authorized
      fetch('/api/instances/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_code: roomCode,
          guest_session_id: session.session_id,
          device_type: 'tv',
          guest_name: 'TV Screen',
        }),
      }).catch(() => {}); // fire-and-forget

      // Auto-start: if queue has songs but nothing is playing, kick off playback
      // Delay 1200ms to let the /api/instances/join above complete first
      if (triggerAutoStart && !state.current_song && state.queue.length > 0) {
        setTimeout(() => autoStartQueueRef.current(), 1200);
      }

    } catch {
      setConnectionStatus('offline');
      fetch('/api/admin/settings').then(res => res.json()).then(json => { if (json.success) setBannerSettings(json.data); }).catch(() => {}); setLoading(false);
    }
  }, [roomCode]);

  // Keep fetchStateRef current
  useEffect(() => { fetchStateRef.current = fetchState; }, [fetchState]);

  // Initial load — triggerAutoStart=true so existing queued songs start playing
  useEffect(() => {
    fetchState(true);
  }, [fetchState]);

  // Online/offline events
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
    // If this song was already stopped/skipped by a remote control, the skip
    // endpoint already advanced the queue. Do NOT call /api/queue/next again
    // or it will mark the newly-playing song as completed and delete it.
    if (skippedByRemoteRef.current.has(completedQueueItemId)) {
      skippedByRemoteRef.current.delete(completedQueueItemId);
      return;
    }

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
      fetchStateRef.current();
      if (!currentSongRef.current) {
        setTimeout(() => autoStartQueueRef.current(), 300);
      }
    },
    queue_removed: () => fetchStateRef.current(),
    queue_updated: () => fetchStateRef.current(),
    song_started: (payload: any) => {
      // The previously-playing song was stopped by a remote — mark it so
      // handleSongEnded ignores the YouTube player's onEnded for that song.
      if (payload?.skipped_queue_item_id) {
        skippedByRemoteRef.current.add(payload.skipped_queue_item_id);
      } else if (currentSongRef.current?.queue_item_id) {
        // Fallback: if a new song started and we had one playing, the old one
        // was externally advanced — prevent double-advance.
        skippedByRemoteRef.current.add(currentSongRef.current.queue_item_id);
      }
      fetchStateRef.current();
      setConnectionStatus('connected');
    },
    song_finished: () => {
      setCurrentSong(null);
      currentSongRef.current = null;
      fetchStateRef.current();
    },
    song_skipped: (payload: any) => {
      if (payload?.skipped_queue_item_id) {
        skippedByRemoteRef.current.add(payload.skipped_queue_item_id);
      }
      fetchStateRef.current();
    },
    instance_updated: () => fetchStateRef.current(),
    banner_updated: (payload: any) => { if (payload) setBannerSettings(payload); else fetch('/api/admin/settings').then(res => res.json()).then(json => { if (json.success) setBannerSettings(json.data); }); },
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
        <TVBanner bannerEnabled={bannerSettings.banner_enabled} bannerText={bannerSettings.banner_text} bannerImageUrl={bannerSettings.banner_image_url} bannerSpeed={bannerSettings.banner_speed} />
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
