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
  destroy(): void;
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
        controls: 1,
        rel: 0,
        modestbranding: 1,
        fs: 1,
        playsinline: 1,
        enablejsapi: 1,
        origin: window.location.origin,
      },
      events: {
        onReady: () => {
          setPlayerReady(true);
          if (videoId) {
            currentVideoIdRef.current = videoId;
          }
        },
        onStateChange: (event) => {
          const YTState = window.YT.PlayerState;

          let playerStatus: PlayerState['status'] = 'idle';
          switch (event.data) {
            case YTState.PLAYING:
              playerStatus = 'playing';
              break;
            case YTState.PAUSED:
              playerStatus = 'paused';
              break;
            case YTState.BUFFERING:
              playerStatus = 'buffering';
              break;
            case YTState.ENDED:
              playerStatus = 'ended';
              // Notify parent — TV will call /api/queue/next
              if (currentQueueItemIdRef.current) {
                onEndedRef.current(currentQueueItemIdRef.current);
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
          // Error codes 101 and 150 mean embedding is disabled by the video owner
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

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
        setPlayerReady(false);
      }
    };
  }, [initPlayer]);

  // Load new video when videoId changes
  useEffect(() => {
    if (!playerRef.current || !playerReady) return;
    if (videoId === currentVideoIdRef.current) return;

    currentVideoIdRef.current = videoId;
    currentQueueItemIdRef.current = queueItemId;
    setEmbedBlocked(false); // Reset error state for new video

    if (videoId) {
      playerRef.current.loadVideoById(videoId);
    } else {
      playerRef.current.stopVideo();
    }
  }, [videoId, queueItemId, playerReady]);

  // Keep queueItemId ref current
  useEffect(() => {
    currentQueueItemIdRef.current = queueItemId;
  }, [queueItemId]);

  return (
    <div className={`relative w-full h-full bg-black ${className}`}>
      <div ref={containerRef} className="w-full h-full" />

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

      {/* Empty state overlay — shown when no video */}
      {!videoId && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none">
          <div className="text-center">
            <p className="text-2xl font-semibold text-slate-400 mb-2">NO SONGS IN QUEUE</p>
            <p className="text-slate-600">Scan the QR code to reserve your next song.</p>
          </div>
        </div>
      )}
    </div>
  );
}
