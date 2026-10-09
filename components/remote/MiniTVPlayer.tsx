'use client';

// ============================================================
// OKEKARAOKE — Mini TV Player Component for Remote
// Runs YouTube player directly inside the Phone Remote
// Perfect for 1-phone setup (Solo TV + Remote in 1 screen)
// ============================================================

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Tv, Play, Pause, SkipForward, RotateCcw, Volume2, VolumeX, Maximize2, Minimize2, ChevronUp, ChevronDown, X, Mic2, Music, Sparkles, ExternalLink } from 'lucide-react';
import { YouTubePlayer, type YouTubePlayerRef } from '@/components/tv/YouTubePlayer';
import { useRealtime } from '@/hooks/useRealtime';
import type { EnrichedQueueItem, PlayerState } from '@/lib/types';

interface MiniTVPlayerProps {
  roomCode: string;
  sessionId: string;
  currentSong: EnrichedQueueItem | null;
  queue: EnrichedQueueItem[];
  onClose: () => void;
  onRefreshState: () => void;
}

export function MiniTVPlayer({
  roomCode,
  sessionId,
  currentSong,
  queue,
  onClose,
  onRefreshState,
}: MiniTVPlayerProps) {
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isFullVideo, setIsFullVideo] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const playerRef = useRef<YouTubePlayerRef | null>(null);

  // Toggle in-app fullscreen video mode without leaving the app
  const toggleFullscreenVideo = () => {
    setIsFullVideo((prev) => {
      const next = !prev;
      if (next) {
        const docEl = document.documentElement as any;
        try {
          if (docEl.requestFullscreen) {
            Promise.resolve(docEl.requestFullscreen()).catch(() => {});
          } else if (docEl.webkitRequestFullscreen) {
            Promise.resolve(docEl.webkitRequestFullscreen()).catch(() => {});
          }
        } catch {}
        if (typeof screen !== 'undefined' && screen.orientation && (screen.orientation as any).lock) {
          try {
            Promise.resolve((screen.orientation as any).lock('landscape')).catch(() => {});
          } catch {}
        }
      } else {
        const doc = document as any;
        try {
          if (doc.exitFullscreen) {
            Promise.resolve(doc.exitFullscreen()).catch(() => {});
          } else if (doc.webkitExitFullscreen) {
            Promise.resolve(doc.webkitExitFullscreen()).catch(() => {});
          }
        } catch {}
        if (typeof screen !== 'undefined' && screen.orientation && (screen.orientation as any).unlock) {
          try { screen.orientation.unlock(); } catch {}
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
      if (payload?.action === 'pause') {
        playerRef.current?.pauseVideo();
        setIsPlaying(false);
      } else if (payload?.action === 'resume') {
        playerRef.current?.playVideo();
        setIsPlaying(true);
      }
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

    try {
      // Touch/Upsert device as TV
      await fetch('/api/instances/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_code: roomCode,
          guest_session_id: sessionId,
          device_type: 'tv',
          guest_name: 'Solo Phone TV',
        }),
      }).catch(() => {});

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
      }
    } catch (err) {
      console.error('[MiniTV] Failed to advance queue:', err);
    } finally {
      setAdvancing(false);
    }
  }, [roomCode, sessionId, advancing, onRefreshState]);

  // If active with no current song but queue has items, auto start
  useEffect(() => {
    if (!currentSong && queue.length > 0 && !advancing) {
      advanceQueue(null);
    }
  }, [currentSong, queue.length, advancing, advanceQueue]);

  // Handle video finished
  const handleEnded = useCallback((completedQueueItemId: string) => {
    advanceQueue(completedQueueItemId);
  }, [advanceQueue]);

  // Skip manually
  const handleSkip = async () => {
    if (advancing) return;
    setAdvancing(true);
    try {
      await fetch('/api/queue/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_code: roomCode,
          session_id: sessionId,
          queue_item_id: currentSong?.queue_item_id,
        }),
      });
      onRefreshState();
    } catch (err) {
      console.error('[MiniTV] Skip error:', err);
    } finally {
      setAdvancing(false);
    }
  };

  // Toggle play/pause (calls /api/queue/control so Real TV & all remotes stay in sync)
  const togglePlay = async () => {
    if (!currentSong) return;
    const targetAction = isPlaying ? 'pause' : 'resume';
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
      if (json.success) {
        if (targetAction === 'pause') {
          playerRef.current?.pauseVideo();
          setIsPlaying(false);
        } else {
          playerRef.current?.playVideo();
          setIsPlaying(true);
        }
      } else {
        alert(json.error?.message ?? 'Only the singer who reserved this song can pause it.');
      }
    } catch {
      if (isPlaying) {
        playerRef.current?.pauseVideo();
        setIsPlaying(false);
      } else {
        playerRef.current?.playVideo();
        setIsPlaying(true);
      }
    }
  };

  const videoId = currentSong?.song.youtube_video_id ?? null;
  const queueItemId = currentSong?.queue_item_id ?? null;

  return (
    <>
      {/* ── IN-APP FULLSCREEN VIDEO MODE (Stays 100% inside Play Store App) ── */}
      {isFullVideo ? (
        <div className="fixed inset-0 z-[9999] w-screen h-[100dvh] bg-black overflow-hidden flex flex-col select-none">
          {/* Top Bar Overlay */}
          <div className="absolute top-0 left-0 right-0 z-30 px-3 py-2 flex items-center justify-between bg-gradient-to-b from-black/90 via-black/50 to-transparent pointer-events-auto backdrop-blur-sm">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-teal-500/30 border border-teal-400/50 text-teal-300 font-black text-[10px] tracking-wider uppercase shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping" />
                <Tv size={11} className="text-teal-400" />
                <span>SOLO TV FULLSCREEN</span>
              </div>

              {currentSong && (
                <div className="truncate text-white font-bold text-xs">
                  <span>{currentSong.song.title}</span>
                  <span className="text-zinc-400 font-normal"> — {currentSong.song.artist}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={navigateToTvPage}
                className="px-2.5 py-1 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700 text-teal-400 hover:text-teal-300 font-extrabold text-[11px] flex items-center gap-1 active:scale-95 transition-all"
                title="Go to TV Page (In App)"
              >
                <span>TV Page</span>
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

          {/* Fullscreen YouTube Video Container */}
          <div className="relative w-full h-full bg-black">
            {videoId ? (
              <YouTubePlayer
                ref={playerRef}
                videoId={videoId}
                queueItemId={queueItemId}
                onEnded={handleEnded}
                onStateChange={(state) => {
                  if (state.status === 'playing') setIsPlaying(true);
                  if (state.status === 'paused') setIsPlaying(false);
                }}
                autoplay={true}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-zinc-950">
                <Mic2 size={36} className="text-teal-400 mb-2 animate-pulse" />
                <h3 className="text-base font-extrabold text-white mb-1">Solo TV Ready</h3>
                <p className="text-xs text-zinc-400 max-w-[280px]">No song is currently playing in queue.</p>
              </div>
            )}
          </div>

          {/* Bottom Controls Overlay */}
          <div className="absolute bottom-0 left-0 right-0 z-30 px-4 py-3 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex items-center justify-between gap-3 pointer-events-auto backdrop-blur-sm">
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
      ) : null}

      {/* ── STANDARD INLINE MINI TV PLAYER ── */}
      <div
        className="shrink-0 bg-zinc-950 border-b border-teal-500/30 transition-all duration-300 relative shadow-2xl z-20"
        style={{
          background: 'linear-gradient(180deg, #09090b 0%, #121217 100%)',
        }}
      >
        {/* Header Controls Bar */}
        <div className="px-3 py-1.5 flex items-center justify-between border-b border-zinc-800/80 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-teal-500/20 border border-teal-500/40 text-teal-300 font-extrabold text-[10px] tracking-wider uppercase shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping" />
              <Tv size={11} className="text-teal-400" />
              <span>SOLO TV MODE</span>
            </div>

            {currentSong && (
              <div className="truncate text-zinc-300 font-medium text-[11px]">
                <span className="text-teal-400 font-bold">{currentSong.song.title}</span>
                <span className="text-zinc-400"> — {currentSong.song.artist}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Collapse/Expand button */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-all active:scale-95"
              title={isCollapsed ? 'Expand TV Video' : 'Collapse TV Video'}
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

            {/* Close Solo TV Mode */}
            <button
              onClick={onClose}
              className="p-1 rounded-lg bg-zinc-900 hover:bg-red-500/20 hover:text-red-400 text-zinc-400 transition-all active:scale-95 ml-1"
              title="Turn Off Solo TV Mode"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Video Display Area (Visually hidden when collapsed, but remains mounted so audio & video playback NEVER stops or restarts) */}
        <div className={`relative w-full bg-black overflow-hidden transition-all duration-300 ${isCollapsed ? 'h-0 opacity-0 pointer-events-none' : 'aspect-video opacity-100'}`}>
          {videoId ? (
            <YouTubePlayer
              ref={playerRef}
              videoId={videoId}
              queueItemId={queueItemId}
              onEnded={handleEnded}
              onStateChange={(state) => {
                if (state.status === 'playing') setIsPlaying(true);
                if (state.status === 'paused') setIsPlaying(false);
              }}
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
                <span>Solo TV Ready</span>
                <Sparkles size={14} className="text-amber-400" />
              </h3>
              <p className="text-[11px] text-zinc-400 max-w-[280px]">
                Search & reserve any song below on your phone to start playing YouTube karaoke video right here!
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

          {/* Singer overlay badge */}
          {currentSong?.guest_name && (
            <div className="absolute top-2 left-2 px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-md border border-white/10 text-[10px] font-black text-white flex items-center gap-1.5 z-10 shadow-lg pointer-events-none">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              <span>SINGING:</span>
              <span className="text-teal-300 font-extrabold">{currentSong.guest_name}</span>
            </div>
          )}
        </div>

        {/* Mini Controls Bar (Visible whether collapsed or expanded) */}
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
      </div>
    </>
  );
}
