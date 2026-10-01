'use client';

// ============================================================
// OKEKARAOKE — Floating SVG Reaction System
// Each click spawns a clean SVG icon particle floating up smoothly.
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { Flame, Smile, Frown, Sparkles, PartyPopper, Heart } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// ── Clean SVG reaction catalogue ────────────────────────────────
export const REACTION_ITEMS = [
  { id: 'fire',   icon: Flame,       label: 'Fire',    color: '#f97316', bg: 'rgba(249, 115, 22, 0.2)',  border: 'rgba(249, 115, 22, 0.4)' },
  { id: 'haha',   icon: Smile,       label: 'Haha',    color: '#eab308', bg: 'rgba(234, 179, 8, 0.2)',   border: 'rgba(234, 179, 8, 0.4)' },
  { id: 'sad',    icon: Frown,       label: 'Sad',     color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.2)',  border: 'rgba(56, 189, 248, 0.4)' },
  { id: 'wow',    icon: Sparkles,    label: 'Wow',     color: '#a855f7', bg: 'rgba(168, 85, 247, 0.2)',  border: 'rgba(168, 85, 247, 0.4)' },
  { id: 'cheers', icon: PartyPopper, label: 'Cheers',  color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.2)',  border: 'rgba(245, 158, 11, 0.4)' },
  { id: 'love',   icon: Heart,       label: 'Love',    color: '#ec4899', bg: 'rgba(236, 72, 153, 0.2)',  border: 'rgba(236, 72, 153, 0.4)' },
] as const;

export type ReactionId = (typeof REACTION_ITEMS)[number]['id'];

interface FloatingParticleData {
  key: string;        // unique id
  reactionId: ReactionId;
  x: number;          // % from left (10–85)
  sway: number;       // px horizontal drift
  size: number;       // rem icon size (1.2–1.8)
  duration: number;   // ms total float (1800–2400)
}

interface ReactionPayload {
  reaction_id?: ReactionId;
  emoji?: string; // backwards compatibility mapping
  sender_session: string;
  sender_name: string;
}

interface EmojiReactionsProps {
  roomCode: string;
  sessionId: string;
  guestName: string;
}

// Map legacy emoji string to reactionId if needed
function emojiToId(emoji?: string): ReactionId {
  if (emoji === '🔥') return 'fire';
  if (emoji === '😂') return 'haha';
  if (emoji === '😢') return 'sad';
  if (emoji === '😮') return 'wow';
  if (emoji === '🍺') return 'cheers';
  if (emoji === '❤️') return 'love';
  return 'fire';
}

// Unique counter for keyframe names
let _uid = 0;
function uid() { return ++_uid; }

// ── Floating particle ─────────────────────────────────────────
function FloatingParticle({
  reactionId, x, sway, size, duration, animId, onDone,
}: {
  reactionId: ReactionId;
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

  const item = REACTION_ITEMS.find((r) => r.id === reactionId) || REACTION_ITEMS[0];
  const Icon = item.icon;

  const keyframeName = `float_${animId}`;
  const css = `
@keyframes ${keyframeName} {
  0%   { transform: translate3d(0px, 0px, 0)              scale(0.3); opacity: 0;   }
  15%  { transform: translate3d(${sway * 0.1}px, -8vh,  0) scale(1.1); opacity: 1;   }
  50%  { transform: translate3d(${sway * 0.5}px, -45vh, 0) scale(1.25); opacity: 0.95;}
  80%  { transform: translate3d(${sway * 0.85}px,-70vh, 0) scale(1.1); opacity: 0.6; }
  100% { transform: translate3d(${sway}px,        -88vh, 0) scale(0.6); opacity: 0;   }
}`;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div
        className="absolute pointer-events-none select-none z-50 flex items-center justify-center p-2.5 rounded-full shadow-2xl backdrop-blur-sm"
        style={{
          left: `${x}%`,
          bottom: '8px',
          backgroundColor: item.bg,
          border: `1.5px solid ${item.border}`,
          boxShadow: `0 0 16px ${item.color}50`,
          willChange: 'transform, opacity',
          animation: `${keyframeName} ${duration}ms cubic-bezier(0.22, 0.61, 0.36, 1) forwards`,
        }}
      >
        <Icon style={{ width: `${size}rem`, height: `${size}rem`, color: item.color }} />
      </div>
    </>
  );
}

// ── Main component ────────────────────────────────────────────
export function EmojiReactions({ roomCode, sessionId, guestName }: EmojiReactionsProps) {
  const [particles, setParticles] = useState<FloatingParticleData[]>([]);

  const channelRef  = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);
  const supabaseRef = useRef(createClient());

  const removeParticle = useCallback((key: string) => {
    setParticles((prev) => prev.filter((p) => p.key !== key));
  }, []);

  const spawnParticle = useCallback((reactionId: ReactionId) => {
    const key      = `${Date.now()}-${uid()}`;
    const x        = 10 + Math.random() * 75;
    const sway     = (Math.random() - 0.5) * 80;
    const size     = 1.3 + Math.random() * 0.5;
    const duration = 1900 + Math.random() * 600;

    setParticles((prev) => [...prev, { key, reactionId, x, sway, size, duration }]);
  }, []);

  // Realtime listener
  useEffect(() => {
    const supabase = supabaseRef.current;
    const channelName = `okekaraoke:reactions:${roomCode}`;
    const channel = supabase.channel(channelName);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'emoji_reaction' }, ({ payload }) => {
        const data = payload as ReactionPayload;
        if (data && data.sender_session !== sessionId) {
          const targetId = data.reaction_id || emojiToId(data.emoji);
          spawnParticle(targetId);
        }
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [roomCode, sessionId, spawnParticle]);

  // Send reaction action
  const sendReaction = useCallback((reactionId: ReactionId) => {
    spawnParticle(reactionId);

    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'emoji_reaction',
        payload: {
          reaction_id: reactionId,
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
        className="absolute inset-0 pointer-events-none overflow-hidden z-40"
        aria-hidden="true"
      >
        {particles.map((p) => (
          <FloatingParticle
            key={p.key}
            animId={p.key}
            reactionId={p.reactionId}
            x={p.x}
            sway={p.sway}
            size={p.size}
            duration={p.duration}
            onDone={() => removeParticle(p.key)}
          />
        ))}
      </div>

      {/* Reaction icon bar */}
      <div
        className="shrink-0 flex items-center justify-around gap-1.5 px-3 py-2 bg-zinc-950/90 backdrop-blur-md border-t border-zinc-800/80 z-30"
      >
        {REACTION_ITEMS.map(({ id, icon: Icon, label, color, bg, border }) => (
          <button
            key={id}
            id={`reaction-btn-${id}`}
            aria-label={`React with ${label}`}
            onClick={() => sendReaction(id)}
            className="w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-150 active:scale-90"
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
            onMouseEnter={(e) => {
              const btn = e.currentTarget as HTMLButtonElement;
              btn.style.background  = bg;
              btn.style.borderColor = border;
              btn.style.transform   = 'scale(1.15)';
              btn.style.boxShadow   = `0 0 12px ${color}40`;
            }}
            onMouseLeave={(e) => {
              const btn = e.currentTarget as HTMLButtonElement;
              btn.style.background  = 'rgba(255, 255, 255, 0.03)';
              btn.style.borderColor = 'rgba(255, 255, 255, 0.08)';
              btn.style.transform   = 'scale(1)';
              btn.style.boxShadow   = 'none';
            }}
          >
            <Icon size={18} style={{ color }} />
          </button>
        ))}
      </div>
    </>
  );
}

