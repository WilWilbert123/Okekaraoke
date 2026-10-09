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
  { id: 'fire',   icon: Flame,       label: 'Fire',    color: '#f97316' },
  { id: 'haha',   icon: Smile,       label: 'Haha',    color: '#eab308' },
  { id: 'sad',    icon: Frown,       label: 'Sad',     color: '#38bdf8' },
  { id: 'wow',    icon: Sparkles,    label: 'Wow',     color: '#a855f7' },
  { id: 'cheers', icon: PartyPopper, label: 'Cheers',  color: '#f59e0b' },
  { id: 'love',   icon: Heart,       label: 'Love',    color: '#ec4899' },
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
  0%   { opacity: 0; transform: translate3d(0px, 0px, 0) scale(0.9); }
  10%  { opacity: 1; transform: translate3d(${sway * 0.1}px, -8vh, 0) scale(1); }
  85%  { opacity: 1; transform: translate3d(${sway * 0.85}px, -75vh, 0) scale(1); }
  100% { opacity: 0; transform: translate3d(${sway}px, -88vh, 0) scale(0.95); }
}`;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div
        className="absolute pointer-events-none select-none z-50 flex items-center justify-center"
        style={{
          left: `${x}%`,
          bottom: '12px',
          willChange: 'transform, opacity',
          animation: `${keyframeName} ${duration}ms linear forwards`,
        }}
      >
        <Icon style={{ width: `${size * 1.4}rem`, height: `${size * 1.4}rem`, color: item.color, filter: `drop-shadow(0 0 8px ${item.color}90)` }} />
      </div>
    </>
  );
}

// ── Main component ────────────────────────────────────────────
export function EmojiReactions({ roomCode, sessionId, guestName }: EmojiReactionsProps) {
  const [particles, setParticles] = useState<FloatingParticleData[]>([]);

  const channelRef  = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);
  const supabaseRef = useRef(createClient());
  const queueRef = useRef<Array<ReactionId>>([]);
  const isProcessingRef = useRef<boolean>(false);

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

  const processQueue = useCallback(() => {
    if (queueRef.current.length === 0) {
      isProcessingRef.current = false;
      return;
    }

    isProcessingRef.current = true;
    const nextId = queueRef.current.shift();
    if (nextId) {
      spawnParticle(nextId);
    }

    const delay = 160 + Math.random() * 80;
    setTimeout(processQueue, delay);
  }, [spawnParticle]);

  const enqueueParticle = useCallback((reactionId: ReactionId) => {
    if (queueRef.current.length < 30) {
      queueRef.current.push(reactionId);
    }
    if (!isProcessingRef.current) {
      processQueue();
    }
  }, [processQueue]);

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
          enqueueParticle(targetId);
        }
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [roomCode, sessionId, enqueueParticle]);

  // Send reaction action
  const sendReaction = useCallback((reactionId: ReactionId) => {
    enqueueParticle(reactionId);

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
  }, [sessionId, guestName, enqueueParticle]);

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

      {/* Reaction icon bar — Pure Icon Only (No circle background, border, or glow on click) */}
      <div
        className="shrink-0 flex items-center justify-around gap-1 px-3 py-2.5 bg-zinc-950/90 backdrop-blur-md border-t border-zinc-800/80 z-30"
      >
        {REACTION_ITEMS.map(({ id, icon: Icon, label, color }) => (
          <button
            key={id}
            id={`reaction-btn-${id}`}
            aria-label={`React with ${label}`}
            onClick={() => sendReaction(id)}
            className="flex-1 py-1 flex items-center justify-center transition-transform duration-150 active:scale-125 hover:scale-110 outline-none select-none bg-transparent"
          >
            <Icon size={24} style={{ color, filter: `drop-shadow(0 0 6px ${color}60)` }} />
          </button>
        ))}
      </div>
    </>
  );
}

