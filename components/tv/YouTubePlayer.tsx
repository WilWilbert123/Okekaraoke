'use client';

// ============================================================
// OKEKARAOKE — YouTube IFrame Player Component
// Uses official YouTube IFrame Player API
// Direct iframe instantiation with videoId for 100% guaranteed native autoplay
// ============================================================

import { useEffect, useRef, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import { VideoOff, VolumeX } from 'lucide-react';
import type { PlayerState } from '@/lib/types';

declare global {
  interface Window {
    YT: {
      Player: new (elementId: string | HTMLElement, config: YTPlayerConfig) => YTPlayer;
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
    if (typeof window !== 'undefined' && window.YT?.Player) {
      apiReady = true;
      resolve();
      return;
    }

    readyCallbacks.push(resolve);

    const checkReady = () => {
      if (typeof window !== 'undefined' && window.YT?.Player) {
        apiReady = true;
        readyCallbacks.forEach((cb) => cb());
        readyCallbacks.length = 0;
      } else {
        setTimeout(checkReady, 50);
      }
    };

    if (!apiLoading) {
      apiLoading = true;

      const prevOnReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevOnReady) {
          try { prevOnReady(); } catch {}
        }
        checkReady();
      };

      const existingScript = document.querySelector('script[src*="youtube.com/iframe_api"]');
      if (!existingScript) {
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        document.head.appendChild(script);
      } else {
        checkReady();
      }
    }
  });
}

export interface YouTubePlayerRef {
  playVideo: () => void;
  pauseVideo: () => void;
}

interface YouTubePlayerProps {
  videoId: string | null;
  queueItemId: string | null;
  onEnded: (queueItemId: string) => void;
  onStateChange?: (state: PlayerState) => void;
  autoplay?: boolean;
  className?: string;
}

/** Detect iOS (iPhone/iPad/iPod/Mobile Safari) */
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/** Detect TV / Android TV browsers that block autoplay without a user gesture */
function isTVBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /TV Bro|SmartTV|SMART-TV|HbbTV|NetCast|Web0S|Tizen|CrKey|AndroidTV|Android.*TV|Roku|BRAVIA|VIZIO|PhilipsTV|SonyBRAVIA|SamsungBrowser.*SmartTV/i.test(ua);
}

export const YouTubePlayer = forwardRef<YouTubePlayerRef, YouTubePlayerProps>(function YouTubePlayer(
  {
    videoId,
    queueItemId,
    onEnded,
    onStateChange,
    autoplay = true,
    className = '',
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const currentVideoIdRef = useRef<string | null>(null);
  const currentQueueItemIdRef = useRef<string | null>(null);
  const hasStartedPlayingRef = useRef<boolean>(false);
  const userInteractedRef = useRef<boolean>(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [embedBlocked, setEmbedBlocked] = useState(false);
  const [needsUserGesture, setNeedsUserGesture] = useState(false);
  const [needsUnmuteGesture, setNeedsUnmuteGesture] = useState(false);
  const gestureTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEndedRef = useRef(onEnded);
  const onStateChangeRef = useRef(onStateChange);

  // Global user gesture tracking to unlock WebKit/iOS audio
  useEffect(() => {
    const handleUserGesture = () => {
      userInteractedRef.current = true;
      setNeedsUnmuteGesture(false);
      if (playerRef.current) {
        try {
          playerRef.current.unMute();
        } catch {}
      }
    };
    window.addEventListener('touchstart', handleUserGesture, { capture: true, passive: true });
    window.addEventListener('click', handleUserGesture, { capture: true, passive: true });
    return () => {
      window.removeEventListener('touchstart', handleUserGesture, { capture: true });
      window.removeEventListener('click', handleUserGesture, { capture: true });
    };
  }, []);

  // Expose imperative methods to parent (e.g. countdown modal completion)
  useImperativeHandle(ref, () => ({
    playVideo: () => {
      if (playerRef.current) {
        try {
          playerRef.current.mute();
          playerRef.current.playVideo();
          setTimeout(() => {
            try {
              if (userInteractedRef.current || !isIOS()) {
                playerRef.current?.unMute();
              }
            } catch {}
          }, 300);
        } catch {}
      }
    },
    pauseVideo: () => {
      try {
        playerRef.current?.pauseVideo();
      } catch {}
    },
  }));

  // Keep refs current
  useEffect(() => { onEndedRef.current = onEnded; }, [onEnded]);
  useEffect(() => { onStateChangeRef.current = onStateChange; }, [onStateChange]);
  useEffect(() => { currentQueueItemIdRef.current = queueItemId; }, [queueItemId]);

  // Load/Recreate/Update player whenever videoId changes
  useEffect(() => {
    let isCancelled = false;

    const syncPlayer = async () => {
      if (!videoId) {
        currentVideoIdRef.current = null;
        currentQueueItemIdRef.current = null;
        hasStartedPlayingRef.current = false;
        if (playerRef.current) {
          try {
            playerRef.current.pauseVideo();
            playerRef.current.stopVideo();
            playerRef.current.destroy();
          } catch {}
          playerRef.current = null;
        }
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }
        return;
      }

      await loadYouTubeAPI();
      if (isCancelled) return;

      setEmbedBlocked(false);

      // If player already exists, load the new videoId smoothly
      if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
        if (currentVideoIdRef.current !== videoId) {
          currentVideoIdRef.current = videoId;
          currentQueueItemIdRef.current = queueItemId;
          hasStartedPlayingRef.current = false;
          try {
            playerRef.current.mute();
            playerRef.current.loadVideoById(videoId);
            playerRef.current.playVideo();
            setTimeout(() => {
              try {
                if (!hasStartedPlayingRef.current && playerRef.current) {
                  playerRef.current.mute();
                  playerRef.current.playVideo();
                }
              } catch {}
            }, 250);
          } catch (e) {
            console.warn('Error loading video by ID:', e);
          }
        } else {
          // Same videoId — only auto-play if it hasn't started yet (don't restart a finished song)
          if (!hasStartedPlayingRef.current) {
            try {
              playerRef.current.mute();
              playerRef.current.playVideo();
            } catch {}
          }
        }
        return;
      }

      // Player does not exist yet — Create new native YT.Player instance
      currentVideoIdRef.current = videoId;
      currentQueueItemIdRef.current = queueItemId;
      hasStartedPlayingRef.current = false;
      setPlayerReady(false);

      if (!containerRef.current) return;
      containerRef.current.innerHTML = '';
      const mountNode = document.createElement('div');
      const playerId = `yt-player-${Date.now()}`;
      mountNode.id = playerId;
      mountNode.style.width = '100%';
      mountNode.style.height = '100%';
      containerRef.current.appendChild(mountNode);

      if (!window.YT || !window.YT.Player) return;

      playerRef.current = new window.YT.Player(playerId, {
        width: '100%',
        height: '100%',
        videoId: videoId,
        playerVars: {
          autoplay: autoplay ? 1 : 0,
          mute: 1,
          controls: 0,
          rel: 0,
          modestbranding: 1,
          fs: 0,
          playsinline: 1,
          enablejsapi: 1,
          iv_load_policy: 3,
          disablekb: 1,
          origin: typeof window !== 'undefined' ? window.location.origin : '',
        },
        events: {
          onReady: (event) => {
            if (isCancelled) return;
            setPlayerReady(true);
            try {
              event.target.mute();
              event.target.playVideo();
              // On TV browsers autoplay often fails silently — show tap overlay after 2s if not playing
              if (gestureTimeoutRef.current) clearTimeout(gestureTimeoutRef.current);
              gestureTimeoutRef.current = setTimeout(() => {
                if (!hasStartedPlayingRef.current) {
                  setNeedsUserGesture(true);
                }
              }, 2000);
            } catch (e) {
              console.warn('Player onReady play error:', e);
              setNeedsUserGesture(true);
            }
          },
          onStateChange: (event) => {
            if (isCancelled) return;
            const YTState = window.YT.PlayerState;

            let playerStatus: PlayerState['status'] = 'idle';
            switch (event.data) {
              case YTState.PLAYING:
                playerStatus = 'playing';
                hasStartedPlayingRef.current = true;
                setNeedsUserGesture(false);
                if (gestureTimeoutRef.current) { clearTimeout(gestureTimeoutRef.current); gestureTimeoutRef.current = null; }
                if (userInteractedRef.current || !isIOS()) {
                  try {
                    playerRef.current?.unMute();
                  } catch {}
                } else {
                  setNeedsUnmuteGesture(true);
                }
                break;
              case YTState.PAUSED:
              case YTState.CUED:
              case -1: // UNSTARTED
                playerStatus = 'paused';
                if (!hasStartedPlayingRef.current && currentVideoIdRef.current) {
                  try {
                    event.target.mute();
                    event.target.playVideo();
                  } catch {}
                } else if (isIOS() && currentVideoIdRef.current && !userInteractedRef.current) {
                  try {
                    event.target.mute();
                    event.target.playVideo();
                    setNeedsUnmuteGesture(true);
                  } catch {}
                }
                break;
              case YTState.BUFFERING:
                playerStatus = 'buffering';
                if (!hasStartedPlayingRef.current && currentVideoIdRef.current) {
                  try {
                    event.target.mute();
                    event.target.playVideo();
                  } catch {}
                }
                break;
              case YTState.ENDED:
                playerStatus = 'ended';
                const targetId = currentQueueItemIdRef.current || queueItemId;
                if (targetId) {
                  onEndedRef.current(targetId);
                }
                break;
            }

            onStateChangeRef.current?.({
              status: playerStatus,
              video_id: currentVideoIdRef.current,
              queue_item_id: currentQueueItemIdRef.current,
            });
          },
          onError: (event) => {
            if (isCancelled) return;
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
    };

    syncPlayer();

    return () => {
      isCancelled = true;
    };
  }, [videoId, queueItemId, autoplay]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch {}
        playerRef.current = null;
      }
    };
  }, []);

  // Smart Initial Autoplay & End-of-Video Watchdog
  useEffect(() => {
    if (!videoId || !playerReady) return;

    let endedTriggered = false;
    // On TV browsers we use a slower poll interval to be less aggressive
    const pollMs = isTVBrowser() ? 1000 : 250;

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

        // 2. Initial playback recovery: ONLY until video starts playing for the first time.
        // Skip retries when the tap-to-play overlay is shown — let the user tap instead.
        if (!hasStartedPlayingRef.current && !needsUserGesture) {
          if (state === 1) {
            hasStartedPlayingRef.current = true;
            try { playerRef.current.unMute(); } catch {}
          } else if (state === 5 || state === -1 || state === 2) {
            try {
              playerRef.current.mute();
              playerRef.current.playVideo();
            } catch {}
          }
        }
      } catch {}
    }, pollMs);

    return () => clearInterval(interval);
  }, [videoId, queueItemId, playerReady, needsUserGesture]);

  // Dismiss gesture overlay and force-play
  const handleTapToPlay = useCallback(() => {
    setNeedsUserGesture(false);
    if (playerRef.current) {
      try {
        playerRef.current.mute();
        playerRef.current.playVideo();
        setTimeout(() => {
          try { playerRef.current?.unMute(); } catch {}
        }, 300);
      } catch {}
    }
  }, []);

  return (
    <div className={`relative w-full h-full bg-black overflow-hidden pointer-events-none select-none ${className}`}>
      {/* YouTube Player Container — NO scale on TV to prevent over-zoom */}
      <div
        ref={containerRef}
        className="w-full h-full"
      />

      {/* Embed blocked overlay */}
      {embedBlocked && videoId && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/95 z-10">
          <div className="text-center px-8 max-w-lg">
            <VideoOff size={48} className="text-red-400 mb-4 mx-auto" />
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

      {/* Tap-to-play overlay — shown on TV browsers when autoplay is blocked */}
      {needsUserGesture && videoId && !embedBlocked && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/80 z-20 pointer-events-auto cursor-pointer"
          onClick={handleTapToPlay}
        >
          <div className="flex flex-col items-center gap-4 text-center px-8">
            {/* Big animated play button */}
            <div className="w-28 h-28 rounded-full bg-white/10 border-4 border-white/60 flex items-center justify-center backdrop-blur-sm animate-pulse">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="white">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
            <p className="text-white text-2xl font-bold drop-shadow-lg">Tap to Start Playing</p>
            <p className="text-white/60 text-sm">Your TV browser requires a tap to enable audio</p>
          </div>
        </div>
      )}

      {/* Tap-to-unmute audio badge — shown on iOS WebKit when audio needs user gesture */}
      {needsUnmuteGesture && videoId && !embedBlocked && !needsUserGesture && (
        <button
          onClick={() => {
            userInteractedRef.current = true;
            setNeedsUnmuteGesture(false);
            if (playerRef.current) {
              try {
                playerRef.current.unMute();
                playerRef.current.playVideo();
              } catch {}
            }
          }}
          className="absolute bottom-3 right-3 z-30 px-3 py-1.5 rounded-full bg-teal-500/90 hover:bg-teal-400 text-black text-xs font-black flex items-center gap-1.5 shadow-xl animate-bounce pointer-events-auto backdrop-blur-md"
          title="Tap to enable sound"
        >
          <VolumeX size={14} />
          <span>Tap for Sound 🔊</span>
        </button>
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
});
