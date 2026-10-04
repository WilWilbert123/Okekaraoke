'use client';

// ============================================================
// OKEKARAOKE — TV Floating Reactions Layer
// Subscribes to the same `okekaraoke:reactions:{roomCode}` channel
// that EmojiReactions (remote) broadcasts on.
// All users in the room who click an icon will show it here on TV.
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { Flame, Smile, Frown, Sparkles, PartyPopper, Heart } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const REACTION_ITEMS = [
  { id: 'fire',   icon: Flame,       color: '#f97316' },
  { id: 'haha',   icon: Smile,       color: '#eab308' },
  { id: 'sad',    icon: Frown,       color: '#38bdf8' },
  { id: 'wow',    icon: Sparkles,    color: '#a855f7' },
  { id: 'cheers', icon: PartyPopper, color: '#f59e0b' },
  { id: 'love',   icon: Heart,       color: '#ec4899' },
] as const;

type ReactionId = (typeof REACTION_ITEMS)[number]['id'];

interface TVParticle {
  key: string;
  reactionId: ReactionId;
  x: number;
  sway: number;
  size: number;
  duration: number;
  senderName: string;
}

let _uid = 0;
function uid() { return ++_uid; }

function emojiToId(emoji?: string): ReactionId {
  if (emoji === '🔥') return 'fire';
  if (emoji === '😂') return 'haha';
  if (emoji === '😢') return 'sad';
  if (emoji === '😮') return 'wow';
  if (emoji === '🍺') return 'cheers';
  if (emoji === '❤️') return 'love';
  return 'fire';
}

function TVParticleItem({
  reactionId, x, sway, size, duration, senderName, animId, onDone,
}: {
  reactionId: ReactionId;
  x: number;
  sway: number;
  size: number;
  duration: number;
  senderName: string;
  animId: string;
  onDone: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDone, duration + 80);
    return () => clearTimeout(timer);
  }, [duration, onDone]);

  const item = REACTION_ITEMS.find((r) => r.id === reactionId) || REACTION_ITEMS[0];
  const Icon = item.icon;
  const keyframeName = `tv_float_${animId}`;

  const css = `
@keyframes ${keyframeName} {
  0%   { transform: translate3d(0px, 0px, 0) scale(0.3); opacity: 0; }
  12%  { transform: translate3d(${sway * 0.08}px, -5vh, 0) scale(1.2); opacity: 1; }
  45%  { transform: translate3d(${sway * 0.45}px, -42vh, 0) scale(1.35); opacity: 0.95; }
  75%  { transform: translate3d(${sway * 0.8}px, -68vh, 0) scale(1.1); opacity: 0.6; }
  100% { transform: translate3d(${sway}px, -90vh, 0) scale(0.5); opacity: 0; }
}`;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div
        className="absolute pointer-events-none select-none flex flex-col items-center gap-1"
        style={{
          left: `${x}%`,
          bottom: '24px',
          willChange: 'transform, opacity',
          animation: `${keyframeName} ${duration}ms cubic-bezier(0.22, 0.61, 0.36, 1) forwards`,
        }}
      >
        <Icon
          style={{
            width: `${size}rem`,
            height: `${size}rem`,
            color: item.color,
            filter: `drop-shadow(0 0 16px ${item.color}90) drop-shadow(0 0 32px ${item.color}50)`,
          }}
        />
        {senderName && (
          <span
            className="font-black whitespace-nowrap"
            style={{
              background: 'rgba(0,0,0,0.65)',
              backdropFilter: 'blur(6px)',
              border: `1px solid ${item.color}50`,
              color: item.color,
              fontSize: '0.7rem',
              letterSpacing: '0.04em',
              textShadow: `0 0 8px ${item.color}`,
              padding: '2px 8px',
              borderRadius: '9999px',
            }}
          >
            {senderName}
          </span>
        )}
      </div>
    </>
  );
}

interface TVFloatingReactionsProps {
  roomCode: string;
}

export function TVFloatingReactions({ roomCode }: TVFloatingReactionsProps) {
  const [particles, setParticles] = useState<TVParticle[]>([]);
  const supabaseRef = useRef(createClient());

  const removeParticle = useCallback((key: string) => {
    setParticles((prev) => prev.filter((p) => p.key !== key));
  }, []);

  const spawnParticle = useCallback((reactionId: ReactionId, senderName: string) => {
    const key      = `tv-${Date.now()}-${uid()}`;
    const x        = 5 + Math.random() * 85;
    const sway     = (Math.random() - 0.5) * 140;
    const size     = 1.4 + Math.random() * 0.6;
    const duration = 2400 + Math.random() * 800;
    setParticles((prev) => [...prev, { key, reactionId, x, sway, size, duration, senderName }]);
  }, []);

  useEffect(() => {
    const supabase = supabaseRef.current;
    const channelName = `okekaraoke:reactions:${roomCode}`;
    const channel = supabase.channel(channelName);

    channel
      .on('broadcast', { event: 'emoji_reaction' }, ({ payload }) => {
        const reactionId: ReactionId = payload?.reaction_id || emojiToId(payload?.emoji);
        const senderName: string = payload?.sender_name || 'Guest';
        spawnParticle(reactionId, senderName);
      })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [roomCode, spawnParticle]);

  if (particles.length === 0) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 45 }}
      aria-hidden="true"
    >
      {particles.map((p) => (
        <TVParticleItem
          key={p.key}
          animId={p.key}
          reactionId={p.reactionId}
          x={p.x}
          sway={p.sway}
          size={p.size}
          duration={p.duration}
          senderName={p.senderName}
          onDone={() => removeParticle(p.key)}
        />
      ))}
    </div>
  );
}
