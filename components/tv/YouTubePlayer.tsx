'use client';

// ============================================================
// OKEKARAOKE — YouTube IFrame Player Component
// Uses official YouTube IFrame Player API
// NEVER downloads, proxies, or bypasses YouTube
// ============================================================

import { useEffect, useRef, useCallback, useState } from 'react';
import type { PlayerState } from '@/lib/types';

// YouTube IFrame API type declarations
declare global {
  interface Window {
    YT: {
      Player: new (elementId: string, config: YTPlayerConfig) => YTPlayer;
      PlayerState: {
        UNSTARTED: -1;
        ENDED: 0;
        PLAYING: 1;
        PAUSED: 2;
        BUFFERING: 3;
        CUED: 5;
      };
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

interface YTPlayerConfig {
  width?: string | number;
  height?: string | number;
  videoId?: string;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (event: { target: YTPlayer }) => void;
    onStateChange?: (event: { data: number; target: YTPlayer }) => void;
    onError?: (event: { data: number }) => void;
  };
}

interface YTPlayer {
  loadVideoById(videoId: string): void;
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  getPlayerState(): number;
  getDuration(): number;
  getCurrentTime(): number;
  destroy(): void;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
}

let apiReady = false;
let apiLoading = false;
const readyCallbacks: Array<() => void> = [];

function loadYouTubeAPI(): Promise<void> {
  return new Promise((resolve) => {
    if (apiReady) {
      resolve();
      return;
    }

    readyCallbacks.push(resolve);

    if (!apiLoading) {
      apiLoading = true;

      window.onYouTubeIframeAPIReady = () => {
        apiReady = true;
        readyCallbacks.forEach((cb) => cb());
        readyCallbacks.length = 0;
      };

      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      document.head.appendChild(script);
    }
  });
}

interface YouTubePlayerProps {
  videoId: string | null;
  queueItemId: string | null;
  onEnded: (queueItemId: string) => void;
  onStateChange?: (state: PlayerState) => void;
  autoplay?: boolean;
  className?: string;
}

export function YouTubePlayer({
  videoId,
  queueItemId,
  onEnded,
  onStateChange,
  autoplay = true,
  className = '',
}: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const currentVideoIdRef = useRef<string | null>(null);
  const currentQueueItemIdRef = useRef<string | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [embedBlocked, setEmbedBlocked] = useState(false);
  const onEndedRef = useRef(onEnded);
  const onStateChangeRef = useRef(onStateChange);

  // Keep refs current
  useEffect(() => { onEndedRef.current = onEnded; }, [onEnded]);
  useEffect(() => { onStateChangeRef.current = onStateChange; }, [onStateChange]);

  const initPlayer = useCallback(async () => {
    if (!containerRef.current) return;

    await loadYouTubeAPI();

    if (playerRef.current) return; // Already initialized

    const playerId = `yt-player-${Date.now()}`;
    containerRef.current.id = playerId;

    playerRef.current = new window.YT.Player(playerId, {
      width: '100%',
      height: '100%',
      videoId: videoId ?? undefined,
      playerVars: {
        autoplay: autoplay ? 1 : 0,
        mute: 1,
        controls: 0,
        rel: 0,
        modestbranding: 1,
        fs: 0,
        playsinline: 1,
        enablejsapi: 1,
        origin: window.location.origin,
      },
      events: {
        onReady: () => {
          setPlayerReady(true);
          if (videoId) {
            currentVideoIdRef.current = videoId;
            currentQueueItemIdRef.current = queueItemId;
            try {
              playerRef.current?.mute();
              playerRef.current?.loadVideoById(videoId);
              playerRef.current?.playVideo();
              setTimeout(() => {
                try { playerRef.current?.unMute(); } catch {}
              }, 400);
            } catch (e) {
              console.warn('onReady load video error:', e);
            }
          }
        },
        onStateChange: (event) => {
          const YTState = window.YT.PlayerState;

          let playerStatus: PlayerState['status'] = 'idle';
          switch (event.data) {
            case YTState.PLAYING:
              playerStatus = 'playing';
              // Attempt un-muting once playing starts
              try {
                playerRef.current?.unMute();
              } catch {}
              break;
            case YTState.PAUSED:
              playerStatus = 'paused';
              break;
            case YTState.BUFFERING:
              playerStatus = 'buffering';
              break;
            case YTState.ENDED:
              playerStatus = 'ended';
              const targetId = currentQueueItemIdRef.current || queueItemId;
              if (targetId) {
                onEndedRef.current(targetId);
              }
              break;
            case -1:
              playerStatus = 'loading';
              break;
          }

          onStateChangeRef.current?.({
            status: playerStatus,
            video_id: currentVideoIdRef.current,
            queue_item_id: currentQueueItemIdRef.current,
          });
        },
        onError: (event) => {
          if (event.data === 101 || event.data === 150) {
            setEmbedBlocked(true);
          }
          onStateChangeRef.current?.({
            status: 'error',
            video_id: currentVideoIdRef.current,
            queue_item_id: currentQueueItemIdRef.current,
          });
        },
      },
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize player on mount
  useEffect(() => {
    initPlayer();

    // Enable audio on user interaction anywhere on TV page
    const handleUserGesture = () => {
      if (playerRef.current) {
        try {
          playerRef.current.unMute();
          if (playerRef.current.getPlayerState?.() === 2) playerRef.current.playVideo();
        } catch {}
      }
    };
    window.addEventListener('pointerdown', handleUserGesture, { passive: true });
    window.addEventListener('keydown', handleUserGesture, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', handleUserGesture);
      window.removeEventListener('keydown', handleUserGesture);
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
        setPlayerReady(false);
      }
    };
  }, [initPlayer]);

  // Load new video when videoId changes OR when playerReady transitions to true
  useEffect(() => {
    if (!playerRef.current || !playerReady) return;

    if (videoId) {
      if (currentVideoIdRef.current !== videoId) {
        currentVideoIdRef.current = videoId;
        currentQueueItemIdRef.current = queueItemId;
        setEmbedBlocked(false);
        try {
          playerRef.current.mute();
          playerRef.current.loadVideoById(videoId);
          playerRef.current.playVideo();
          setTimeout(() => {
            try {
              playerRef.current?.unMute();
            } catch {}
          }, 400);
        } catch (e) {
          console.warn('Error playing video:', e);
        }
      }
    } else {
      if (currentVideoIdRef.current !== null) {
        currentVideoIdRef.current = null;
        currentQueueItemIdRef.current = null;
        try {
          playerRef.current.stopVideo();
        } catch {}
      }
    }
  }, [videoId, queueItemId, playerReady]);

  // Keep queueItemId ref current whenever prop changes
  useEffect(() => {
    if (queueItemId) {
      currentQueueItemIdRef.current = queueItemId;
    }
  }, [queueItemId]);

  // Autoplay & End-of-Video Watchdog: Ensures video starts playing if stuck AND auto-advances when video finishes
  useEffect(() => {
    if (!videoId || !playerReady) return;

    let endedTriggered = false;

    const interval = setInterval(() => {
      if (!playerRef.current) return;
      try {
        const state = playerRef.current.getPlayerState?.();

        // 1. Detect video completion via player current time vs duration
        if (typeof playerRef.current.getDuration === 'function' && typeof playerRef.current.getCurrentTime === 'function') {
          const duration = playerRef.current.getDuration();
          const currentTime = playerRef.current.getCurrentTime();

          if (duration > 0 && currentTime >= duration - 1.2 && !endedTriggered) {
            endedTriggered = true;
            const targetId = currentQueueItemIdRef.current || queueItemId;
            if (targetId) {
              onEndedRef.current(targetId);
            }
          }
        }

        // 2. Force play & unmute if player stuck in cued (5), paused (2), or unstarted (-1)
        if (state === 5 || state === 2 || state === -1) {
          playerRef.current.playVideo();
          try { playerRef.current.unMute(); } catch {}
        }
      } catch {}
    }, 1000);

    return () => clearInterval(interval);
  }, [videoId, queueItemId, playerReady]);

  return (
    <div className={`relative w-full h-full bg-black ${className}`}>
      {/* YouTube Player Container — always sized in DOM so YT player computes proper dimensions */}
      <div
        ref={containerRef}
        className="w-full h-full"
      />

      {/* Embed blocked overlay — shown when video owner disabled embedding */}
      {embedBlocked && videoId && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/95 z-10">
          <div className="text-center px-8 max-w-lg">
            <div className="text-5xl mb-4">🚫</div>
            <p className="text-2xl font-bold text-white mb-2">Embedding Disabled</p>
            <p className="text-slate-400 mb-1">This video cannot be played here.</p>
            <p className="text-slate-500 text-sm">
              The video owner has disabled playback on third-party websites.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href={`https://www.youtube.com/watch?v=${videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              Watch on YouTube
            </a>
            {queueItemId && (
              <button
                onClick={() => onEnded(queueItemId)}
                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
              >
                ⏭ Skip to Next Song
              </button>
            )}
          </div>
        </div>
      )}

      {/* Empty state idle screen — shown when no active video */}
      {!videoId && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-slate-950 text-white z-10">
          <div className="relative flex flex-col items-center text-center px-6 max-w-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/okekaraokelogo.png"
              alt="OKEKARAOKE Logo"
              className="w-28 h-28 md:w-36 md:h-36 object-contain mb-6 animate-bounce filter drop-shadow-[0_10px_25px_rgba(99,102,241,0.5)]"
            />

            <p className="text-3xl font-black tracking-tight text-slate-100 mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              NO SONGS IN QUEUE
            </p>
            <p className="text-slate-400 font-medium text-base">
              Scan the QR code to reserve your next song.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
