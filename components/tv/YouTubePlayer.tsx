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
        onError: () => {
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
