'use client';

// ============================================================
// OKEKARAOKE — TV Page Client
// Full-screen cinema karaoke TV screen experience with glass overlays
// ============================================================

import { useState, useCallback, useEffect, useRef } from 'react';
import { Smartphone, RotateCw, X, Maximize2, Minimize2 } from 'lucide-react';
import { TVHeader } from '@/components/tv/TVHeader';
import { TVBanner } from '@/components/tv/TVBanner';
import { TVQueue } from '@/components/tv/TVQueue';
import { YouTubePlayer } from '@/components/tv/YouTubePlayer';
import { NowPlaying } from '@/components/tv/NowPlaying';
import { QRPanel } from '@/components/tv/QRPanel';
import KaraokeScoreModal from '@/components/tv/KaraokeScoreModal';
import { SongCountdownModal } from '@/components/tv/SongCountdownModal';
import { TVShoutoutOverlay, type ShoutoutItem } from '@/components/tv/TVShoutoutOverlay';
import { TVFloatingReactions } from '@/components/tv/TVFloatingReactions';
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
  const [countdownSong, setCountdownSong] = useState<EnrichedQueueItem | null>(null);
  const lastCountdownSongIdRef = useRef<string | null>(null);
  const [queue, setQueue] = useState<EnrichedQueueItem[]>([]);
  const queueRef = useRef<EnrichedQueueItem[]>([]);
  useEffect(() => { queueRef.current = queue; }, [queue]);

  const [scoreModalData, setScoreModalData] = useState<{
    completedSong: { title: string; artist: string; guestName?: string | null };
    nextSong?: { title: string; artist: string; guestName?: string | null } | null;
    completedQueueItemId: string;
  } | null>(null);
  const scoreModalDataRef = useRef<typeof scoreModalData>(null);

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
  const [bannerSettings, setBannerSettings] = useState<{
    banner_enabled: boolean;
    banner_type?: 'ticker' | 'side_card' | 'bottom_bar' | 'popup';
    banner_text: string;
    banner_image_url?: string;
    banner_images?: string[];
    banner_speed?: number;
  }>({ banner_enabled: false, banner_text: '' });
  const [shoutouts, setShoutouts] = useState<ShoutoutItem[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('reconnecting');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);
  const [dismissMobileBanner, setDismissMobileBanner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<string | null>(null);
  const advancingRef = useRef(false);
  const currentSongRef = useRef<EnrichedQueueItem | null>(null);
  const autoStartQueueRef = useRef<() => void>(() => { });
  // Track queue_item_ids that were stopped/skipped by remote so the YouTube
  // player's onEnded callback does NOT call /api/queue/next for them.
  const skippedByRemoteRef = useRef<Set<string>>(new Set());
  const hasRegisteredTVRef = useRef(false);

  // Auto-start: advance queue to play the first song when nothing is playing
  const autoStartQueue = useCallback(async () => {
    if (advancingRef.current) return;
    if (currentSongRef.current) return; // already playing

    // Ensure session ID is initialized
    let sessionId = sessionRef.current;
    if (!sessionId) {
      const session = getOrCreateGuestSession();
      sessionRef.current = session.session_id;
      sessionId = session.session_id;
    }

    // Pre-register TV device to ensure authorization
    await fetch('/api/instances/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room_code: roomCode,
        guest_session_id: sessionId,
        device_type: 'tv',
        guest_name: 'TV Screen',
      }),
    }).catch(() => { });

    advancingRef.current = true;
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        if (currentSongRef.current) break;
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
          break;
        }
        await new Promise((r) => setTimeout(r, 400));
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
  const fetchStateRef = useRef<(triggerAutoStart?: boolean) => void>(() => { });

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
        fetch('/api/admin/settings').then(res => res.json()).then(json => { if (json.success) setBannerSettings(json.data); }).catch(() => { }); setLoading(false);
        return;
      }

      const state = json.data as InstanceState;
      setInstanceState(state);
      setCurrentSong(state.current_song);
      currentSongRef.current = state.current_song;

      if (state.current_song) {
        if (state.current_song.queue_item_id !== lastCountdownSongIdRef.current) {
          if (!scoreModalDataRef.current) {
            lastCountdownSongIdRef.current = state.current_song.queue_item_id;
            setCountdownSong(state.current_song);
          }
        }
      } else {
        // Only clear countdown if one isn't already running — a countdown started
        // immediately from local queue data must not be wiped by a transient null state.
        if (!lastCountdownSongIdRef.current) {
          setCountdownSong(null);
        }
      }

      setQueue(state.queue);
      setError(null);
      setConnectionStatus('connected');
      fetch('/api/admin/settings').then(res => res.json()).then(json => { if (json.success) setBannerSettings(json.data); }).catch(() => { }); setLoading(false);

      // Register TV device in DB once so /api/queue/next accepts it as authorized without spamming
      if (!hasRegisteredTVRef.current) {
        hasRegisteredTVRef.current = true;
        const session = getOrCreateGuestSession();
        sessionRef.current = session.session_id;
        setGuestSessionForInstance(state.instance.id, roomCode, 'tv');
        localStorage.setItem('okekaraoke_last_tv_room', roomCode);

        fetch('/api/instances/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            room_code: roomCode,
            guest_session_id: session.session_id,
            device_type: 'tv',
            guest_name: 'TV Screen',
          }),
        }).catch(() => { });
      } else {
        sessionRef.current = sessionRef.current || getOrCreateGuestSession().session_id;
      }

      // Auto-start: if queue has songs but nothing is playing, kick off playback
      // Delay 1200ms to let the /api/instances/join above complete first
      if (triggerAutoStart && !state.current_song && state.queue.length > 0) {
        setTimeout(() => autoStartQueueRef.current(), 1200);
      }

    } catch {
      setConnectionStatus('offline');
      fetch('/api/admin/settings').then(res => res.json()).then(json => { if (json.success) setBannerSettings(json.data); }).catch(() => { }); setLoading(false);
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
    intervalMs: 30000,
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

    const sessionId = sessionRef.current || getOrCreateGuestSession().session_id;
    sessionRef.current = sessionId;

    try {
      const response = await fetch('/api/queue/next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_code: roomCode,
          session_id: sessionId,
          completed_queue_item_id: completedQueueItemId,
        }),
      });

      const json = await response.json();

      if (json.success && json.data.next_queue_item_id) {
        fetchState();
      } else {
        // No next song — clear current song and player state so TV returns to idle screen
        setCurrentSong(null);
        currentSongRef.current = null;
        lastCountdownSongIdRef.current = null;
        setCountdownSong(null);
        setPlayerState({ status: 'idle', video_id: null, queue_item_id: null });
        fetchState();
      }
    } catch (err) {
      console.error('Failed to advance queue:', err);
    } finally {
      advancingRef.current = false;
    }
  }, [roomCode, fetchState]);

  // Score popup trigger: when song finishes playing, show score modal.
  // Queue advance is intentionally DEFERRED until the score modal closes — so the
  // next song never starts loading/playing while the score screen is visible.
  const triggerSongEndedScore = useCallback((completedQueueItemId: string) => {
    if (skippedByRemoteRef.current.has(completedQueueItemId)) {
      skippedByRemoteRef.current.delete(completedQueueItemId);
      return;
    }

    const songItem = currentSongRef.current || queueRef.current.find(i => i.queue_item_id === completedQueueItemId);

    const completed = {
      title: songItem?.song.title ?? 'Karaoke Performance',
      artist: songItem?.song.artist ?? 'OKEKARAOKE',
      guestName: songItem?.guest_name ?? 'Singer',
    };

    const remainingQueue = queueRef.current.filter(i => i.queue_item_id !== completedQueueItemId);
    const next = remainingQueue.length > 0 ? {
      title: remainingQueue[0].song.title,
      artist: remainingQueue[0].song.artist,
      guestName: remainingQueue[0].guest_name,
    } : null;

    const modalData = {
      completedSong: completed,
      nextSong: next,
      completedQueueItemId,
    };

    // Stop the player immediately so no audio plays during score screen
    setCurrentSong(null);
    currentSongRef.current = null;
    setPlayerState({ status: 'idle', video_id: null, queue_item_id: null });

    setScoreModalData(modalData);
    scoreModalDataRef.current = modalData;
    // DO NOT call handleSongEnded here — it is called in handleScoreModalComplete
  }, []);

  const handleScoreModalComplete = useCallback(() => {
    const completedId = scoreModalDataRef.current?.completedQueueItemId;

    setScoreModalData(null);
    scoreModalDataRef.current = null;

    // Immediately start the countdown from local queue data — no API wait needed.
    // queueRef.current holds the waiting songs (not the one that just finished).
    const nextItem = queueRef.current[0];
    if (nextItem) {
      lastCountdownSongIdRef.current = nextItem.queue_item_id;
      setCountdownSong(nextItem);
    }

    // Advance the queue in the background — fetchState will update currentSong
    // so the YouTube player loads once the countdown finishes.
    if (completedId) {
      handleSongEnded(completedId);
    }
  }, [handleSongEnded]);


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
      if (payload?.skipped_queue_item_id) {
        skippedByRemoteRef.current.add(payload.skipped_queue_item_id);
        setScoreModalData(null);
      } else if (currentSongRef.current?.queue_item_id) {
        skippedByRemoteRef.current.add(currentSongRef.current.queue_item_id);
      }
      fetchStateRef.current();
      setConnectionStatus('connected');
    },
    song_finished: () => {
      // Keep score modal active for full 10s countdown even when queue becomes empty
      setCurrentSong(null);
      currentSongRef.current = null;
      lastCountdownSongIdRef.current = null;
      setCountdownSong(null);
      setPlayerState({ status: 'idle', video_id: null, queue_item_id: null });
      fetchStateRef.current();
    },
    song_skipped: (payload: any) => {
      if (payload?.skipped_queue_item_id) {
        skippedByRemoteRef.current.add(payload.skipped_queue_item_id);
        setScoreModalData(null);
      }
      fetchStateRef.current();
    },
    instance_updated: () => fetchStateRef.current(),
    banner_updated: (payload: any) => { if (payload) setBannerSettings(payload); else fetch('/api/admin/settings').then(res => res.json()).then(json => { if (json.success) setBannerSettings(json.data); }); },
    shoutout_broadcast: (payload: any) => {
      if (payload && payload.message) {
        setShoutouts((prev) => [...prev, payload]);
      }
    },
  }).current;

  useRealtime({
    roomCode,
    handlers: realtimeHandlers,
    enabled: true,
  });

  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);

  useEffect(() => {
    const checkMobileAndOrientation = () => {
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
      // Android TV / TV Bro / Smart TV browsers report "Android" in UA — exclude them from mobile detection
      const isTVAgent = /TV Bro|SmartTV|SMART-TV|HbbTV|AndroidTV|Android.*TV|Tizen|Web0S|NetCast|CrKey|Roku|BRAVIA|VIZIO/i.test(userAgent);
      const mobile = !isTVAgent && (
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) ||
        (typeof window !== 'undefined' && window.innerWidth < 768)
      );
      setIsMobileDevice(mobile);
      setIsPortrait(typeof window !== 'undefined' && window.innerHeight > window.innerWidth);
    };

    checkMobileAndOrientation();
    window.addEventListener('resize', checkMobileAndOrientation);
    window.addEventListener('orientationchange', checkMobileAndOrientation);
    return () => {
      window.removeEventListener('resize', checkMobileAndOrientation);
      window.removeEventListener('orientationchange', checkMobileAndOrientation);
    };
  }, []);

  // Fullscreen & Mobile Landscape Lock with cross-browser & pseudo-fullscreen fallback
  const handleFullscreen = useCallback(async () => {
    const docEl = document.documentElement as any;
    const doc = document as any;
    const isNativeFS = !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement);

    if (!isNativeFS && !isPseudoFullscreen) {
      try {
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) {
          await docEl.webkitRequestFullscreen();
        } else if (docEl.mozRequestFullScreen) {
          await docEl.mozRequestFullScreen();
        } else if (docEl.msRequestFullscreen) {
          await docEl.msRequestFullscreen();
        } else {
          setIsPseudoFullscreen(true);
        }
      } catch {
        setIsPseudoFullscreen(true);
      }
      setIsFullscreen(true);
    } else {
      if (isNativeFS) {
        try {
          if (doc.exitFullscreen) {
            await doc.exitFullscreen();
          } else if (doc.webkitExitFullscreen) {
            await doc.webkitExitFullscreen();
          } else if (doc.mozCancelFullScreen) {
            await doc.mozCancelFullScreen();
          } else if (doc.msExitFullscreen) {
            await doc.msExitFullscreen();
          }
        } catch { }
      }
      setIsPseudoFullscreen(false);
      setIsFullscreen(false);
    }
  }, [isPseudoFullscreen]);

  const handleMobileLandscapeFullscreen = useCallback(async () => {
    const docEl = document.documentElement as any;
    try {
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen();
      } else if (docEl.webkitRequestFullscreen) {
        await docEl.webkitRequestFullscreen();
      } else if (docEl.mozRequestFullScreen) {
        await docEl.mozRequestFullScreen();
      } else if (docEl.msRequestFullscreen) {
        await docEl.msRequestFullscreen();
      } else {
        setIsPseudoFullscreen(true);
      }
    } catch {
      setIsPseudoFullscreen(true);
    }

    if (typeof screen !== 'undefined' && screen.orientation && (screen.orientation as any).lock) {
      try {
        await (screen.orientation as any).lock('landscape');
      } catch (err) {
        console.log('Orientation lock unavailable:', err);
      }
    }
    setIsFullscreen(true);
  }, []);

  // TV Remote & Keyboard Controls (Press 'F' for Fullscreen, D-Pad support)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        handleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFullscreen]);

  useEffect(() => {
    const handleChange = () => {
      const doc = document as any;
      const nativeFS = !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement);
      setIsFullscreen(nativeFS || isPseudoFullscreen);
    };
    document.addEventListener('fullscreenchange', handleChange);
    document.addEventListener('webkitfullscreenchange', handleChange);
    document.addEventListener('mozfullscreenchange', handleChange);
    document.addEventListener('MSFullscreenChange', handleChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleChange);
      document.removeEventListener('webkitfullscreenchange', handleChange);
      document.removeEventListener('mozfullscreenchange', handleChange);
      document.removeEventListener('MSFullscreenChange', handleChange);
    };
  }, [isPseudoFullscreen]);

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
  const hideOverlays = isFullscreen || isPseudoFullscreen || (isMobileDevice && !isPortrait);

  return (
    <div
      className={isPseudoFullscreen ? "fixed inset-0 z-[9999] w-screen h-[100dvh] bg-black overflow-hidden" : "relative w-full h-full"}
      style={{ height: '100dvh', background: '#000', overflow: 'hidden' }}
    >
      {/* LAYER 0: Fullscreen YouTube Video Player (Corner-to-Corner) */}
      <div className="absolute inset-0 z-0">
        <YouTubePlayer
          videoId={currentVideoId}
          queueItemId={currentQueueItemId}
          onEnded={triggerSongEndedScore}
          onStateChange={handlePlayerStateChange}
          autoplay={instanceState?.settings.autoplay ?? true}
          className="w-full h-full"
        />
      </div>

      {/* LAYER 1: Single Clean Header Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 pointer-events-auto">
        <TVBanner
          bannerEnabled={bannerSettings.banner_enabled}
          bannerType={bannerSettings.banner_type}
          bannerText={bannerSettings.banner_text}
          bannerImageUrl={bannerSettings.banner_image_url}
          bannerImages={bannerSettings.banner_images}
          bannerSpeed={bannerSettings.banner_speed}
        />
        <TVHeader
          roomCode={roomCode}
          connectionStatus={connectionStatus}
          queue={queue}
        />
      </div>

      {/* Floating Top Right Corner Fullscreen Toggle Button */}
      <button
        id="tv-fullscreen-btn"
        onClick={handleFullscreen}
        className="absolute top-13 right-3 z-30 p-1.5 text-white/50 hover:text-white/90 transition-all active:scale-95 flex items-center justify-center pointer-events-auto drop-shadow"
        aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      >
        {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
      </button>

      {/* LAYER 2: Floating Corner Widgets (Auto-hidden in fullscreen mode for clean view) */}
      <div className="absolute bottom-4 left-6 right-6 z-20 flex items-end justify-between gap-4 pointer-events-none">
        <div className={`pointer-events-auto transition-all duration-300 ${hideOverlays ? 'opacity-0 pointer-events-none invisible scale-95' : 'opacity-100 visible scale-100'}`}>
          <NowPlaying currentSong={currentSong} />
        </div>
        <div className={`pointer-events-auto transition-all duration-300 ${hideOverlays ? 'opacity-0 pointer-events-none invisible scale-95' : 'opacity-100 visible scale-100'}`}>
          <QRPanel roomCode={roomCode} appUrl={process.env.NEXT_PUBLIC_APP_URL} />
        </div>
      </div>

      {/* LAYER 3: Authentic Videoke/Karaoke Score Screen Popup Modal */}
      {scoreModalData && (
        <KaraokeScoreModal
          completedSong={scoreModalData.completedSong}
          nextSong={scoreModalData.nextSong}
          onCountdownComplete={handleScoreModalComplete}
          onSkip={handleScoreModalComplete}
        />
      )}

      {/* LAYER 3.5: 5-Second Song Countdown Screen Overlay for YouTube Pre-Buffering & Auto-Play */}
      {countdownSong && (
        <SongCountdownModal
          song={{
            title: countdownSong.song.title,
            artist: countdownSong.song.artist,
            guestName: countdownSong.guest_name,
            code: countdownSong.song.code,
          }}
          onComplete={() => setCountdownSong(null)}
        />
      )}

      {/* LAYER 3.8: Floating Real-time Room Shoutouts Overlay */}
      <TVShoutoutOverlay shoutouts={shoutouts} />

      {/* LAYER 3.9: Floating Real-time Emoji Reactions from all users in room */}
      <TVFloatingReactions roomCode={roomCode} />

      {/* LAYER 4: Mobile Portrait TV Mode Overlay Banner — ONLY shown when viewing TV mode on mobile devices in portrait orientation */}
      {isMobileDevice && isPortrait && !dismissMobileBanner && (
        <div className="fixed inset-x-3 top-11 sm:top-20 z-40 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-zinc-900/95 border border-teal-500/50 backdrop-blur-xl text-white shadow-2xl flex items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-400 shrink-0">
              <Smartphone size={15} className="rotate-90" />
            </div>
            <div>
              <p className="text-[10px] sm:text-[11px] font-black text-teal-300 uppercase tracking-wider">Mobile TV Screen Mode</p>
              <p className="text-[9px] sm:text-[10px] text-zinc-300 font-medium">Rotate to landscape or connect to TV!</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleMobileLandscapeFullscreen}
              className="px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg sm:rounded-xl bg-teal-400 hover:bg-teal-300 text-black font-extrabold text-[10px] sm:text-[11px] uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition-all shadow-md"
            >
              <RotateCw size={12} />
              <span>Go Landscape</span>
            </button>

            <button
              onClick={() => setDismissMobileBanner(true)}
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              aria-label="Hide banner"
              title="Hide banner"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
