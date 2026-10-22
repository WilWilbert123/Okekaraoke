'use client';

// ============================================================
// OKEKARAOKE — Mini TV Player Component for Remote
// Runs YouTube player directly inside the Phone Remote
// Perfect for 1-phone setup (Solo TV + Remote in 1 screen)
// ============================================================

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Tv, Smartphone, Play, Pause, SkipForward, RotateCcw, Volume2, VolumeX, Maximize2, Minimize2, ChevronUp, ChevronDown, X, Mic2, Music, Sparkles, ExternalLink } from 'lucide-react';
import { YouTubePlayer, type YouTubePlayerRef } from '@/components/tv/YouTubePlayer';
import { AudioVisualizer } from '@/components/tv/AudioVisualizer';
import { useRealtime } from '@/hooks/useRealtime';
import type { EnrichedQueueItem, PlayerState } from '@/lib/types';
import { findDownloadedSong, createSongMediaUrl, detectBufferMimeType } from '@/lib/utils/offlineStorage';

interface MiniTVPlayerProps {
  roomCode: string;
  sessionId: string;
  currentSong: EnrichedQueueItem | null;
  queue: EnrichedQueueItem[];
  onClose: () => void;
  onRefreshState: () => void;
  onOpenTransferModal?: () => void;
  onProgressChange?: (progress: { currentTime: number; duration: number; isPlaying: boolean }) => void;
  onRegisterControls?: (controls: {
    seekTo: (sec: number) => void;
    restartSong: () => void;
    togglePlay: () => void;
    stopSong?: (targetQueueItemId?: string) => void;
  } | null) => void;
  onAdvanceQueue?: (completedQueueItemId?: string) => void;
}

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function MiniTVPlayer({
  roomCode,
  sessionId,
  currentSong,
  queue,
  onClose,
  onRefreshState,
  onOpenTransferModal,
  onProgressChange,
  onRegisterControls,
  onAdvanceQueue,
}: MiniTVPlayerProps) {
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isFullVideo, setIsFullVideo] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);
  const [offlineMediaUrl, setOfflineMediaUrl] = useState<string | null>(null);
  const offlineVideoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<YouTubePlayerRef | null>(null);
  const skippedItemsRef = useRef<Set<string>>(new Set());
  const justStoppedUntilRef = useRef<number>(0);
  const currentSongRef = useRef(currentSong);

  useEffect(() => {
    currentSongRef.current = currentSong;
  }, [currentSong]);

  const [isDeviceOnline, setIsDeviceOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  useEffect(() => {
    const handleOnline = () => setIsDeviceOnline(true);
    const handleOffline = () => setIsDeviceOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Check if currentSong exists in device IndexedDB (Airplane Mode / Offline playback support)
  useEffect(() => {
    if (!currentSong?.song) {
      if (offlineMediaUrl) URL.revokeObjectURL(offlineMediaUrl);
      setOfflineMediaUrl(null);
      return;
    }

    const isOffline = typeof navigator !== 'undefined' ? !navigator.onLine : false;
    // offline_ prefix can be on song.id OR queue_item_id (both paths are used)
    const isExplicitOfflineSong =
      currentSong.song.id?.startsWith('offline_') ||
      currentSong.queue_item_id?.startsWith('offline_');

    // If online AND not an explicitly-tagged offline song AND has a YouTube ID → use online player
    // But if device is offline, ALWAYS try IndexedDB regardless of prefix
    if (!isOffline && !isExplicitOfflineSong && currentSong.song.youtube_video_id) {
      if (offlineMediaUrl) URL.revokeObjectURL(offlineMediaUrl);
      setOfflineMediaUrl(null);
      return;
    }

    // Look up song in IndexedDB by any available identifier
    console.log('[MiniTV] Looking up downloaded song for offline play:', {
      id: currentSong.song.id,
      youtube_video_id: currentSong.song.youtube_video_id,
      code: currentSong.song.code,
      title: currentSong.song.title,
      isOffline,
      isExplicitOfflineSong,
      queue_item_id: currentSong.queue_item_id,
    });

    let cancelled = false;
    findDownloadedSong({
      id: currentSong.song.id,
      youtube_video_id: currentSong.song.youtube_video_id,
      code: currentSong.song.code,
      title: currentSong.song.title,
    }).then((downloaded) => {
      if (cancelled) return;
      console.log('[MiniTV] IndexedDB lookup result:', downloaded
        ? { id: downloaded.id, title: downloaded.title, byteLength: downloaded.media_data?.byteLength ?? 0, mime: downloaded.mime_type }
        : 'NOT FOUND'
      );
      if (downloaded && downloaded.media_data) {
        const mime = detectBufferMimeType(downloaded.media_data) || downloaded.mime_type || '';
        // Only use offline media if it's a real video stream (>50KB and video MIME)
        if (mime.startsWith('video/') && downloaded.media_data.byteLength > 50000) {
          const url = createSongMediaUrl(downloaded);
          setOfflineMediaUrl(url);
          setIsPlaying(true);
          return;
        } else {
          console.warn('[MiniTV] Downloaded song rejected — MIME:', mime, 'Size:', downloaded.media_data.byteLength, 'bytes. Song needs to be re-downloaded.');
        }
      } else if (downloaded && !downloaded.media_data) {
        console.warn('[MiniTV] Downloaded song found but has NO media_data — it was likely downloaded during a server error. Please re-download.');
      } else {
        console.warn('[MiniTV] Song not found in IndexedDB — not downloaded yet, or downloaded with a different ID.');
      }
      setOfflineMediaUrl(null);
    });

    return () => {
      cancelled = true;
    };
  }, [currentSong?.song?.id, currentSong?.song?.youtube_video_id, currentSong?.song?.code, currentSong?.song?.title, isDeviceOnline]);

  const isPlayingRef = useRef(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const currentTimeRef = useRef(currentTime);
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  const durationRef = useRef(duration);
  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  // ── Auto-Pause on App Minimize / Backgrounding (Solo Mode) ───
  // When user minimizes OkeKaraoke, presses Home, or switches to Messenger/Facebook:
  // 1. Immediately pause the local YouTube video (0ms) so it stops playing & doesn't complete in background
  // 2. Notify the backend room state in the background with keepalive: true
  // 3. When returning to OkeKaraoke, song remains paused at exact timestamp
  // 4. When user clicks Play, it resumes smoothly from that exact spot
  useEffect(() => {
    const handlePauseOnBackground = () => {
      if (document.visibilityState === 'hidden') {
        if (isPlayingRef.current && currentSongRef.current) {
          if (offlineMediaUrl && offlineVideoRef.current) {
            offlineVideoRef.current.pause();
          } else {
            try {
              playerRef.current?.pauseVideo();
            } catch { }
          }
          setIsPlaying(false);
          isPlayingRef.current = false;

          onProgressChange?.({
            currentTime: currentTimeRef.current,
            duration: durationRef.current,
            isPlaying: false,
          });

          if (!offlineMediaUrl) {
            try {
              fetch('/api/queue/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  room_code: roomCode,
                  session_id: sessionId,
                  action: 'pause',
                  queue_item_id: currentSongRef.current.queue_item_id,
                }),
                keepalive: true,
              }).catch(() => { });
            } catch { }
          }
        }
      } else if (document.visibilityState === 'visible') {
        // Returned to OkeKaraoke — if online, silently reconcile room state
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          onRefreshState();
        }
      }
    };

    const handlePageHide = () => {
      if (isPlayingRef.current && currentSongRef.current) {
        if (offlineMediaUrl && offlineVideoRef.current) {
          offlineVideoRef.current.pause();
        } else {
          try {
            playerRef.current?.pauseVideo();
          } catch { }
        }
        setIsPlaying(false);
        isPlayingRef.current = false;
      }
    };

    document.addEventListener('visibilitychange', handlePauseOnBackground);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handlePauseOnBackground);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [roomCode, sessionId, onProgressChange, onRefreshState]);

  // Reset progress and ensure playback active when current song changes
  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setIsScrubbing(false);
    setScrubValue(0);
    if (currentSong?.queue_item_id) {
      setIsPlaying(true);
      isPlayingRef.current = true;
    }
  }, [currentSong?.queue_item_id]);

  const handleSeek = useCallback((newTime: number) => {
    if (offlineMediaUrl && offlineVideoRef.current) {
      offlineVideoRef.current.currentTime = newTime;
      offlineVideoRef.current.play().catch(() => { });
    } else {
      playerRef.current?.seekTo(newTime);
      playerRef.current?.playVideo();
    }
    setIsPlaying(true);
    setCurrentTime(newTime);
    setScrubValue(newTime);
  }, [offlineMediaUrl]);

  const handleRestart = useCallback(() => {
    if (offlineMediaUrl && offlineVideoRef.current) {
      offlineVideoRef.current.currentTime = 0;
      offlineVideoRef.current.play().catch(() => { });
    } else {
      playerRef.current?.seekTo(0);
      playerRef.current?.playVideo();
    }
    setCurrentTime(0);
    setScrubValue(0);
    setIsPlaying(true);
  }, [offlineMediaUrl]);

  const handleProgress = useCallback((cur: number, dur: number) => {
    if (!isScrubbing) {
      setCurrentTime(cur);
      setDuration(dur);
    }
    onProgressChange?.({
      currentTime: isScrubbing ? scrubValue : cur,
      duration: dur,
      isPlaying,
    });
  }, [isScrubbing, scrubValue, isPlaying, onProgressChange]);

  // Toggle in-app fullscreen video mode without leaving the app
  const toggleFullscreenVideo = () => {
    setIsFullVideo((prev) => {
      const next = !prev;
      if (next) {
        const docEl = document.documentElement as any;
        try {
          if (docEl.requestFullscreen) {
            Promise.resolve(docEl.requestFullscreen()).catch(() => { });
          } else if (docEl.webkitRequestFullscreen) {
            Promise.resolve(docEl.webkitRequestFullscreen()).catch(() => { });
          }
        } catch { }
        if (typeof screen !== 'undefined' && screen.orientation && (screen.orientation as any).lock) {
          try {
            Promise.resolve((screen.orientation as any).lock('landscape')).catch(() => { });
          } catch { }
        }
      } else {
        const doc = document as any;
        try {
          if (doc.exitFullscreen) {
            Promise.resolve(doc.exitFullscreen()).catch(() => { });
          } else if (doc.webkitExitFullscreen) {
            Promise.resolve(doc.webkitExitFullscreen()).catch(() => { });
          }
        } catch { }
        if (typeof screen !== 'undefined' && screen.orientation && (screen.orientation as any).unlock) {
          try { screen.orientation.unlock(); } catch { }
        }
      }
      return next;
    });
  };

  // Navigate to full TV page inside the app without launching external browser
  const navigateToTvPage = () => {
    router.push(`/tv/${roomCode.toUpperCase()}`);
  };

  // Sync with realtime playback_control events
  const realtimeHandlers = useRef({
    playback_control: (payload: any) => {
      // If queue_item_id is specified and doesn't match our current song, ignore stale command
      if (payload?.queue_item_id && currentSongRef.current?.queue_item_id && payload.queue_item_id !== currentSongRef.current.queue_item_id) {
        return;
      }
      if (payload?.action === 'pause') {
        playerRef.current?.pauseVideo();
        setIsPlaying(false);
      } else if (payload?.action === 'resume') {
        playerRef.current?.playVideo();
        setIsPlaying(true);
      } else if (payload?.action === 'stop') {
        playerRef.current?.pauseVideo();
        setIsPlaying(false);
      }
    },
    song_started: (payload: any) => {
      if (payload?.skipped_queue_item_id) {
        skippedItemsRef.current.add(payload.skipped_queue_item_id);
      } else if (currentSongRef.current?.queue_item_id && currentSongRef.current.queue_item_id !== payload?.queue_item_id) {
        skippedItemsRef.current.add(currentSongRef.current.queue_item_id);
      }
      if (payload?.queue_item_id) {
        skippedItemsRef.current.delete(payload.queue_item_id);
      }
      setIsPlaying(true);
      onRefreshState();
    },
    song_skipped: (payload: any) => {
      if (payload?.skipped_queue_item_id) {
        skippedItemsRef.current.add(payload.skipped_queue_item_id);
      }
      if (payload?.skipped_queue_item_id && currentSongRef.current?.queue_item_id && payload.skipped_queue_item_id !== currentSongRef.current.queue_item_id) {
        onRefreshState();
        return;
      }
      try { playerRef.current?.pauseVideo(); } catch { }
      onRefreshState();
    },
    song_finished: () => {
      try { playerRef.current?.pauseVideo(); } catch { }
      onRefreshState();
    },
  }).current;

  useRealtime({
    roomCode,
    handlers: realtimeHandlers,
    enabled: true,
  });

  // Auto-advance queue if no song is playing but queue has items
  const advanceQueue = useCallback(async (completedId: string | null = null) => {
    if (advancing) return;
    setAdvancing(true);

    const isOffline = typeof navigator !== 'undefined' ? !navigator.onLine : false;
    if (isOffline) {
      onAdvanceQueue?.(completedId || currentSongRef.current?.queue_item_id || '');
      setAdvancing(false);
      return;
    }

    try {
      // Touch/Upsert device as TV
      await fetch('/api/instances/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_code: roomCode,
          guest_session_id: sessionId,
          device_type: 'tv',
          guest_name: '1-Device (Phone)',
        }),
      }).catch(() => { });

      const res = await fetch('/api/queue/next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_code: roomCode,
          session_id: sessionId,
          completed_queue_item_id: completedId,
        }),
      });

      const json = await res.json();
      if (json.success) {
        onRefreshState();
      } else {
        onAdvanceQueue?.(completedId || currentSongRef.current?.queue_item_id || '');
      }
    } catch (err) {
      console.warn('[MiniTV] Network error advancing queue, falling back to local advance:', err);
      onAdvanceQueue?.(completedId || currentSongRef.current?.queue_item_id || '');
    } finally {
      setAdvancing(false);
    }
  }, [roomCode, sessionId, advancing, onRefreshState, onAdvanceQueue]);

  // If active with no current song but queue has items, auto start (guarded against stop transitions)
  useEffect(() => {
    if (!currentSong && queue.length > 0 && !advancing && Date.now() > justStoppedUntilRef.current) {
      const timer = setTimeout(() => {
        if (!currentSongRef.current && queue.length > 0 && !advancing && Date.now() > justStoppedUntilRef.current) {
          advanceQueue(null);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [currentSong, queue.length, advancing, advanceQueue]);

  // Handle video finished
  const handleEnded = useCallback((completedQueueItemId: string) => {
    if (!completedQueueItemId) return;
    // If this song was already manually stopped or skipped, do not advance queue again
    if (skippedItemsRef.current.has(completedQueueItemId)) {
      skippedItemsRef.current.delete(completedQueueItemId);
      return;
    }
    // Protect against stale ended events from previously stopped song
    if (currentSongRef.current?.queue_item_id && completedQueueItemId !== currentSongRef.current.queue_item_id) {
      return;
    }
    advanceQueue(completedQueueItemId);
  }, [advanceQueue]);

  // Skip / Stop manually (instantaneous 0ms stop)
  const handleSkip = useCallback(async () => {
    if (advancing) return;
    setAdvancing(true);
    justStoppedUntilRef.current = Date.now() + 3000;
    const targetId = currentSongRef.current?.queue_item_id;
    if (targetId) {
      skippedItemsRef.current.add(targetId);
    }
    // Instant local pause in 0ms — no delay waiting for network
    try {
      playerRef.current?.pauseVideo();
      if (offlineVideoRef.current) {
        offlineVideoRef.current.pause();
      }
      setIsPlaying(false);
    } catch { }

    const isOffline = typeof navigator !== 'undefined' ? !navigator.onLine : false;
    if (isOffline) {
      onAdvanceQueue?.(targetId || '');
      setAdvancing(false);
      return;
    }

    try {
      await fetch('/api/queue/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_code: roomCode,
          session_id: sessionId,
          queue_item_id: targetId,
        }),
      });
      onRefreshState();
    } catch (err) {
      console.warn('[MiniTV] Skip error, falling back to local advance:', err);
      onAdvanceQueue?.(targetId || '');
    } finally {
      setAdvancing(false);
    }
  }, [advancing, onRefreshState, roomCode, sessionId, onAdvanceQueue]);

  // Toggle play/pause (instantaneous 0ms update with background sync)
  const togglePlay = useCallback(async () => {
    if (!currentSong) return;
    const targetAction = isPlaying ? 'pause' : 'resume';

    // Instant optimistic update in 0ms!
    if (targetAction === 'pause') {
      if (offlineMediaUrl && offlineVideoRef.current) {
        offlineVideoRef.current.pause();
      } else {
        playerRef.current?.pauseVideo();
      }
      setIsPlaying(false);
      isPlayingRef.current = false;
    } else {
      if (offlineMediaUrl && offlineVideoRef.current) {
        offlineVideoRef.current.play().catch(() => { });
      } else {
        // If position was 0 or iframe reloaded, recover timestamp if known
        const pos = playerRef.current?.getCurrentTime?.() ?? 0;
        if (pos === 0 && currentTimeRef.current > 2) {
          playerRef.current?.seekTo?.(currentTimeRef.current);
        }
        playerRef.current?.playVideo();
      }
      setIsPlaying(true);
      isPlayingRef.current = true;
    }

    try {
      const res = await fetch('/api/queue/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_code: roomCode,
          session_id: sessionId,
          action: targetAction,
          queue_item_id: currentSong.queue_item_id,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        // If the song finished or room state changed, silently refresh state without alert popup
        if (json.error?.code === 'NO_SONG_PLAYING' || json.error?.code === 'SONG_MISMATCH') {
          onRefreshState();
          return;
        }

        // Revert on permission failure
        if (targetAction === 'pause') {
          if (offlineMediaUrl && offlineVideoRef.current) {
            offlineVideoRef.current.play().catch(() => { });
          } else {
            playerRef.current?.playVideo();
          }
          setIsPlaying(true);
          isPlayingRef.current = true;
        } else {
          if (offlineMediaUrl && offlineVideoRef.current) {
            offlineVideoRef.current.pause();
          } else {
            playerRef.current?.pauseVideo();
          }
          setIsPlaying(false);
          isPlayingRef.current = false;
        }
        console.warn('[MiniTV] Playback control rejected:', json.error?.message);
      }
    } catch {
      // Network hiccup - maintain current state
    }
  }, [currentSong, isPlaying, offlineMediaUrl, onRefreshState, roomCode, sessionId]);

  // Immediate local stop in 0ms without duplicate network requests
  const stopLocal = useCallback((targetQueueItemId?: string) => {
    justStoppedUntilRef.current = Date.now() + 1500;
    const targetId = targetQueueItemId || currentSongRef.current?.queue_item_id;
    if (targetId) {
      skippedItemsRef.current.add(targetId);
    }
    if (offlineMediaUrl && offlineVideoRef.current) {
      offlineVideoRef.current.pause();
    } else {
      try { playerRef.current?.pauseVideo(); } catch { }
    }
    setIsPlaying(false);
  }, [offlineMediaUrl]);

  // Register controls to parent (e.g. RemotePageClient / RemoteQueue)
  useEffect(() => {
    if (onRegisterControls) {
      onRegisterControls({
        seekTo: handleSeek,
        restartSong: handleRestart,
        togglePlay,
        stopSong: stopLocal,
      });
      return () => {
        onRegisterControls(null);
      };
    }
  }, [onRegisterControls, handleSeek, handleRestart, togglePlay, stopLocal]);

  const isCurrentSongStopped = Boolean(
    currentSong &&
    currentSong.queue_item_id &&
    skippedItemsRef.current.has(currentSong.queue_item_id)
  );
  const effectiveCurrentSong = isCurrentSongStopped ? null : currentSong;
  const effectiveOfflineUrl = isCurrentSongStopped ? null : offlineMediaUrl;
  const videoId = effectiveCurrentSong?.song.youtube_video_id ?? null;
  const queueItemId = effectiveCurrentSong?.queue_item_id ?? null;

  return (
    <div
      className={
        isFullVideo
          ? 'fixed inset-0 z-[9999] w-screen h-[100dvh] bg-black overflow-hidden flex flex-col select-none'
          : 'shrink-0 bg-zinc-950 border-b border-teal-500/30 transition-all duration-300 relative shadow-2xl z-20'
      }
      style={{
        background: isFullVideo ? '#000' : 'linear-gradient(180deg, #09090b 0%, #121217 100%)',
      }}
    >
      {/* ── TOP BAR ── */}
      {isFullVideo ? (
        <div className="absolute top-0 left-0 right-0 z-30 px-3 py-2 flex items-center justify-between bg-gradient-to-b from-black/90 via-black/50 to-transparent pointer-events-auto backdrop-blur-sm">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-teal-500/30 border border-teal-400/50 text-teal-300 font-black text-[10px] tracking-wider uppercase shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping" />
              <Smartphone size={11} className="text-teal-400" />
              <span>1 DEVICE FULLSCREEN</span>
            </div>

            {effectiveCurrentSong && (
              <div className="truncate text-white font-bold text-xs">
                <span>{effectiveCurrentSong.song.title}</span>
                <span className="text-zinc-400 font-normal"> — {effectiveCurrentSong.song.artist}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={navigateToTvPage}
              className="px-2.5 py-1 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700 text-teal-400 hover:text-teal-300 font-extrabold text-[11px] flex items-center gap-1 active:scale-95 transition-all"
              title="Open dedicated TV Display page"
            >
              <span>TV Display</span>
              <ExternalLink size={11} />
            </button>

            <button
              onClick={toggleFullscreenVideo}
              className="p-1.5 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-700 transition-all active:scale-95"
              title="Exit Fullscreen Video"
            >
              <Minimize2 size={16} />
            </button>
          </div>
        </div>
      ) : (
        <div className="px-3 py-1.5 flex items-center justify-between border-b border-zinc-800/80 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-teal-500/20 border border-teal-500/40 text-teal-300 font-extrabold text-[10px] tracking-wider uppercase shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping" />
              <Smartphone size={11} className="text-teal-400" />
              <span>{!isDeviceOnline ? 'OFFLINE' : (effectiveOfflineUrl ? 'OFFLINE PLAY' : 'SOLO MODE')}</span>
            </div>

            {effectiveCurrentSong && (
              <div className="truncate text-zinc-300 font-medium text-[11px]">
                <span className="text-teal-400 font-bold">{effectiveCurrentSong.song.title}</span>
                <span className="text-zinc-400"> — {effectiveCurrentSong.song.artist}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Collapse/Expand button */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-all active:scale-95"
              title={isCollapsed ? 'Expand Video' : 'Collapse Video'}
            >
              {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>

            {/* In-App Fullscreen Video toggle button */}
            <button
              onClick={toggleFullscreenVideo}
              className="p-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-teal-400 hover:text-teal-300 transition-all active:scale-95"
              title="Expand to Fullscreen Video (In App)"
            >
              <Maximize2 size={13} />
            </button>

            {/* Close 1-Device Mode */}
            <button
              onClick={onClose}
              className="p-1 rounded-lg bg-zinc-900 hover:bg-red-500/20 hover:text-red-400 text-zinc-400 transition-all active:scale-95 ml-1"
              title="Turn Off 1-Device Mode"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── VIDEO DISPLAY AREA (Offline HTML5 Video OR Single YouTubePlayer instance) ── */}
      <div
        className={
          isFullVideo
            ? 'flex-1 relative w-full h-full bg-black overflow-hidden'
            : `relative w-full bg-black overflow-hidden transition-all duration-300 ${isCollapsed ? 'h-0 opacity-0 pointer-events-none' : 'aspect-video opacity-100'
            }`
        }
      >
        {effectiveOfflineUrl ? (
          <video
            ref={offlineVideoRef}
            src={effectiveOfflineUrl}
            poster={effectiveCurrentSong?.song?.thumbnail_url || undefined}
            playsInline
            autoPlay={isPlaying}
            controls={false}
            preload="auto"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onError={(e) => {
              console.warn('[MiniTV] Offline video playback error:', e);
            }}
            onTimeUpdate={(e) => {
              const video = e.currentTarget;
              if (!isScrubbing) {
                setCurrentTime(video.currentTime);
                setDuration(video.duration || 0);
              }
              onProgressChange?.({
                currentTime: isScrubbing ? scrubValue : video.currentTime,
                duration: video.duration || 0,
                isPlaying: !video.paused,
              });
            }}
            onEnded={() => {
              handleEnded(queueItemId || currentSongRef.current?.queue_item_id || '');
            }}
            onLoadedData={(e) => {
              if (isPlaying) {
                e.currentTarget.play().catch(() => {});
              }
            }}
            className="w-full h-full object-contain bg-black"
          />
        ) : videoId ? (
          <YouTubePlayer
            ref={playerRef}
            videoId={videoId}
            queueItemId={queueItemId}
            onEnded={handleEnded}
            onStateChange={(state) => {
              if (state.status === 'playing') setIsPlaying(true);
              if (state.status === 'paused') setIsPlaying(false);
            }}
            onProgress={handleProgress}
            cropOverlays={true}
            autoplay={true}
            className="w-full h-full object-cover"
          />
        ) : (
          /* Empty state when no song is playing */
          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-gradient-to-br from-zinc-950 via-zinc-900 to-black relative">
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#2dd4bf_1px,transparent_1px)] [background-size:16px_16px]" />
            <div className="w-12 h-12 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center mb-2 shadow-lg animate-pulse">
              <Mic2 size={24} className="text-teal-400" />
            </div>
            <h3 className="text-sm font-extrabold text-white mb-1 flex items-center gap-1.5">
              <Smartphone size={15} className="text-teal-400" />
              <span>1-Device Mode Ready</span>
              <Sparkles size={14} className="text-amber-400" />
            </h3>
            <p className="text-[11px] text-zinc-400 max-w-[280px]">
              Sing right on your phone! Search &amp; reserve any song below to play video and lyrics directly on this 1 device (No TV required).
            </p>
            {queue.length > 0 && (
              <button
                onClick={() => advanceQueue(null)}
                disabled={advancing}
                className="mt-3 px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-black text-xs font-black flex items-center gap-1.5 transition-all shadow-md active:scale-95"
              >
                <Play size={12} fill="currentColor" />
                <span>Start Queue ({queue.length} ready)</span>
              </button>
            )}
          </div>
        )}

        {/* Real-time Audio Spectrum Visualizer */}
        <div className={`absolute left-0 right-0 z-10 pointer-events-none ${isFullVideo ? 'bottom-24' : 'bottom-0'}`}>
          <AudioVisualizer
            isPlaying={isPlaying && !!currentSong}
            barCount={isFullVideo ? 42 : 30}
            height={isFullVideo ? 24 : 18}
          />
        </div>
      </div>


      {/* ── BOTTOM CONTROLS BAR ── */}
      {isFullVideo ? (
        <div className="absolute bottom-0 left-0 right-0 z-30 px-4 py-3 bg-gradient-to-t from-black/95 via-black/80 to-transparent flex flex-col gap-2 pointer-events-auto backdrop-blur-sm">
          {/* Fullscreen Progress Scrubber */}
          {currentSong && duration > 0 && (
            <div className="flex items-center gap-2.5 w-full select-none">
              <span className="text-xs font-mono font-bold text-teal-400 shrink-0 w-9 text-right">
                {formatTime(isScrubbing ? scrubValue : currentTime)}
              </span>
              <div className="flex-1 relative flex items-center py-1">
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  step={0.5}
                  value={isScrubbing ? scrubValue : currentTime}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setScrubValue(val);
                  }}
                  onMouseDown={() => {
                    setIsScrubbing(true);
                    setScrubValue(currentTime);
                  }}
                  onTouchStart={() => {
                    setIsScrubbing(true);
                    setScrubValue(currentTime);
                  }}
                  onMouseUp={() => {
                    setIsScrubbing(false);
                    handleSeek(scrubValue);
                  }}
                  onTouchEnd={() => {
                    setIsScrubbing(false);
                    handleSeek(scrubValue);
                  }}
                  className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-teal-400 focus:outline-none focus:ring-0 active:h-2.5 transition-all"
                />
              </div>
              <span className="text-xs font-mono text-zinc-400 shrink-0 w-9">
                {formatTime(duration)}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={togglePlay}
                disabled={!currentSong}
                className="w-9 h-9 rounded-full bg-teal-500 hover:bg-teal-400 text-black flex items-center justify-center transition-all disabled:opacity-40 active:scale-90 shadow-lg shrink-0"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
              </button>

              <button
                onClick={handleRestart}
                disabled={!currentSong}
                className="p-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 text-teal-400 hover:text-teal-300 transition-all disabled:opacity-40 active:scale-90 shrink-0"
                title="Restart Song from Beginning (0:00)"
              >
                <RotateCcw size={16} />
              </button>

              <button
                onClick={handleSkip}
                disabled={!currentSong || advancing}
                className="p-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 hover:text-white transition-all disabled:opacity-40 active:scale-90 shrink-0"
                title="Skip Song"
              >
                <SkipForward size={16} />
              </button>

              <div className="truncate text-xs min-w-0">
                {currentSong ? (
                  <p className="truncate font-bold text-white text-sm">
                    {currentSong.song.title}
                    <span className="text-zinc-400 font-normal"> · {currentSong.song.artist}</span>
                  </p>
                ) : (
                  <p className="text-xs text-zinc-500">No song playing</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {queue.length > 0 && (
                <span className="text-xs font-extrabold text-teal-400 bg-teal-500/20 border border-teal-500/40 px-2.5 py-1 rounded-lg font-mono">
                  UP NEXT: {queue.length}
                </span>
              )}
              <button
                onClick={toggleFullscreenVideo}
                className="px-3 py-1.5 rounded-lg bg-zinc-900/90 border border-zinc-700 text-zinc-300 hover:text-white text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all"
              >
                <Minimize2 size={14} />
                <span>Exit Fullscreen</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="px-3 py-1.5 flex items-center justify-between bg-zinc-950/90 backdrop-blur-md border-t border-zinc-800/60">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={togglePlay}
              disabled={!currentSong}
              className="w-7 h-7 rounded-full bg-teal-500 hover:bg-teal-400 text-black flex items-center justify-center transition-all disabled:opacity-40 disabled:hover:bg-teal-500 active:scale-90 shadow-sm shrink-0"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
            </button>

            <button
              onClick={handleRestart}
              disabled={!currentSong}
              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-teal-400 hover:text-teal-300 transition-all disabled:opacity-40 active:scale-90 shrink-0"
              title="Restart Song from Beginning (0:00)"
            >
              <RotateCcw size={13} />
            </button>

            <button
              onClick={handleSkip}
              disabled={!currentSong || advancing}
              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-all disabled:opacity-40 active:scale-90 shrink-0"
              title="Skip Song"
            >
              <SkipForward size={14} />
            </button>

            <div className="truncate text-xs min-w-0">
              {currentSong ? (
                <p className="truncate font-semibold text-white text-[11px]">
                  {currentSong.song.title}
                  <span className="text-zinc-400 font-normal"> · {currentSong.song.artist}</span>
                </p>
              ) : (
                <p className="text-[11px] text-zinc-500 font-medium">No song playing</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {queue.length > 0 && (
              <span className="text-[10px] font-extrabold text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded-md font-mono">
                UP NEXT: {queue.length}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
