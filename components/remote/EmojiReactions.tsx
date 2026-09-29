'use client';

// ============================================================
// OKEKARAOKE — Floating Emoji Reactions
// Each click spawns ONE emoji that floats independently.
// No batching, no restart — pure CSS keyframe per particle.
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ── Emoji catalogue ────────────────────────────────────────────
export const REACTION_EMOJIS = [
  { id: 'fire',   emoji: '🔥', label: 'Fire'   },
  { id: 'haha',   emoji: '😂', label: 'Haha'   },
  { id: 'sad',    emoji: '😢', label: 'Sad'    },
  { id: 'wow',    emoji: '😮', label: 'Wow'    },
  { id: 'cheers', emoji: '🍺', label: 'Cheers' },
  { id: 'love',   emoji: '❤️', label: 'Love'   },
] as const;

export type ReactionId = (typeof REACTION_EMOJIS)[number]['id'];

interface FloatingEmoji {
  key: string;       // unique id
  emoji: string;
  x: number;         // % from left  (10–90)
  sway: number;      // px horizontal drift
  size: number;      // rem font-size (1.6–2.4)
  duration: number;  // ms total float (1800–2400)
}

interface ReactionPayload {
  emoji: string;
  sender_session: string;
  sender_name: string;
}

interface EmojiReactionsProps {
  roomCode: string;
  sessionId: string;
  guestName: string;
}

// counter to make unique CSS animation names even across rapid clicks
let _uid = 0;
function uid() { return ++_uid; }

// ── Floating particle ─────────────────────────────────────────
// Each particle injects its own @keyframes so the browser tracks
// it independently — clicking fast spawns truly independent floaters.
function FloatingParticle({
  emoji, x, sway, size, duration, animId, onDone,
}: {
  emoji: string;
  x: number;
  sway: number;
  size: number;
  duration: number;
  animId: string;
  onDone: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDone, duration + 50);
    return () => clearTimeout(timer);
  }, [duration, onDone]);

  const keyframeName = `float_${animId}`;
  const css = `
@keyframes ${keyframeName} {
  0%   { transform: translate3d(0px, 0px, 0)              scale(0.4); opacity: 0;   }
  15%  { transform: translate3d(${sway * 0.1}px, -8vh,  0) scale(1.1); opacity: 1;   }
  50%  { transform: translate3d(${sway * 0.5}px, -45vh, 0) scale(1.2); opacity: 0.95;}
  80%  { transform: translate3d(${sway * 0.85}px,-70vh, 0) scale(1.1); opacity: 0.6; }
  100% { transform: translate3d(${sway}px,        -88vh, 0) scale(0.7); opacity: 0;   }
}`;

  return (
    <>
      {/* Inject unique keyframes for this particle only */}
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div
        className="absolute pointer-events-none select-none z-50"
        style={{
          left: `${x}%`,
          bottom: '8px',
          fontSize: `${size}rem`,
          lineHeight: 1,
          willChange: 'transform, opacity',
          animation: `${keyframeName} ${duration}ms cubic-bezier(0.22, 0.61, 0.36, 1) forwards`,
        }}
      >
        {emoji}
      </div>
    </>
  );
}

// ── Main component ────────────────────────────────────────────
export function EmojiReactions({ roomCode, sessionId, guestName }: EmojiReactionsProps) {
  const [particles, setParticles] = useState<FloatingEmoji[]>([]);

  const channelRef  = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);
  const supabaseRef = useRef(createClient());

  // ── Remove a finished particle ───────────────────────────────
  const removeParticle = useCallback((key: string) => {
    setParticles((prev) => prev.filter((p) => p.key !== key));
  }, []);

  // ── Spawn a single particle immediately ───────────────────────
  // Each call generates a unique key + animation ID so the CSS
  // @keyframes never collide, even for the same emoji tapped rapidly.
  const spawnParticle = useCallback((emoji: string) => {
    const key      = `${Date.now()}-${uid()}`;
    const x        = 10 + Math.random() * 75;           // 10–85% horizontal
    const sway     = (Math.random() - 0.5) * 80;        // ±40 px sway
    const size     = 1.7 + Math.random() * 0.7;         // 1.7–2.4 rem
    const duration = 1900 + Math.random() * 600;        // 1.9–2.5 s

    setParticles((prev) => [...prev, { key, emoji, x, sway, size, duration }]);
  }, []);

  // ── Supabase realtime subscription ──────────────────────────
  useEffect(() => {
    const supabase = supabaseRef.current;
    const channelName = `okekaraoke:reactions:${roomCode}`;
    const channel = supabase.channel(channelName);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'emoji_reaction' }, ({ payload }) => {
        const data = payload as ReactionPayload;
        // Ignore own reactions — already spawned locally on click
        if (data && data.sender_session !== sessionId && data.emoji) {
          spawnParticle(data.emoji);
        }
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [roomCode, sessionId, spawnParticle]);

  // ── Send reaction to all users ───────────────────────────────
  const sendReaction = useCallback((emoji: string) => {
    // 1. Instantly spawn locally
    spawnParticle(emoji);

    // 2. Broadcast to other users in the room
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'emoji_reaction',
        payload: {
          emoji,
          sender_session: sessionId,
          sender_name: guestName || 'Guest',
        } satisfies ReactionPayload,
      });
    }
  }, [sessionId, guestName, spawnParticle]);

  return (
    <>
      {/* Floating particle layer */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        aria-hidden="true"
      >
        {particles.map((p) => (
          <FloatingParticle
            key={p.key}
            animId={p.key}
            emoji={p.emoji}
            x={p.x}
            sway={p.sway}
            size={p.size}
            duration={p.duration}
            onDone={() => removeParticle(p.key)}
          />
        ))}
      </div>

      {/* Emoji picker bar */}
      <div
        className="shrink-0 flex items-center justify-center gap-2 px-4 py-2.5"
        style={{
          background:     'rgba(5,5,8,0.9)',
          borderTop:      '1px solid rgba(255,255,255,0.05)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {REACTION_EMOJIS.map(({ id, emoji, label }) => (
          <button
            key={id}
            id={`reaction-btn-${id}`}
            aria-label={`React with ${label}`}
            onClick={() => sendReaction(emoji)}
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl transition-all duration-150 active:scale-90"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border:     '1px solid rgba(255,255,255,0.07)',
            }}
            onMouseEnter={(e) => {
              const btn = e.currentTarget as HTMLButtonElement;
              btn.style.background  = 'rgba(99,102,241,0.15)';
              btn.style.borderColor = 'rgba(99,102,241,0.3)';
              btn.style.transform   = 'scale(1.2)';
            }}
            onMouseLeave={(e) => {
              const btn = e.currentTarget as HTMLButtonElement;
              btn.style.background  = 'rgba(255,255,255,0.04)';
              btn.style.borderColor = 'rgba(255,255,255,0.07)';
              btn.style.transform   = 'scale(1)';
            }}
          >
            {emoji}
          </button>
        ))}
      </div>
    </>
  );
}
