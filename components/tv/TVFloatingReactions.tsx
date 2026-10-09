'use client';

// ============================================================
// OKEKARAOKE — TV Floating Reactions Layer
// Uses ONE shared CSS keyframe + CSS custom properties per particle
// so 5-10 users spamming reactions won't inject dozens of <style> tags.
// Hard cap at MAX_PARTICLES to prevent memory issues.
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { Flame, Smile, Frown, Sparkles, PartyPopper, Heart } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const MAX_PARTICLES = 20;

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

// Shared keyframe — smooth linear float up matching TV shoutout overlay without scale bounce
const SHARED_KEYFRAME_CSS = `
@keyframes tv-float-up {
  0%   { opacity: 0; transform: translate3d(0, 0, 0) scale(0.9); }
  8%   { opacity: 1; transform: translate3d(calc(var(--sway) * 0.1), -8vh, 0) scale(1); }
  88%  { opacity: 1; transform: translate3d(calc(var(--sway) * 0.9), -85vh, 0) scale(1); }
  100% { opacity: 0; transform: translate3d(var(--sway), -95vh, 0) scale(0.95); }
}`;

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
  reactionId, x, sway, size, duration, senderName, onDone,
}: Omit<TVParticle, 'key'> & { onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, duration + 80);
    return () => clearTimeout(timer);
  }, [duration, onDone]);

  const item = REACTION_ITEMS.find((r) => r.id === reactionId) || REACTION_ITEMS[0];
  const Icon = item.icon;

  return (
    <div
      className="absolute pointer-events-none select-none flex flex-col items-center gap-1"
      style={{
        left: `${x}%`,
        bottom: '24px',
        willChange: 'transform, opacity',
        // CSS custom property drives the sway — no per-particle <style> tag needed
        ['--sway' as string]: `${sway}px`,
        animation: `tv-float-up ${duration}ms linear forwards`,
      }}
    >
      <Icon
        style={{
          width: `${size}rem`,
          height: `${size}rem`,
          color: item.color,
          filter: `drop-shadow(0 0 10px ${item.color}90)`,
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
            fontSize: '0.65rem',
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
  );
}

interface TVFloatingReactionsProps {
  roomCode: string;
}

export function TVFloatingReactions({ roomCode }: TVFloatingReactionsProps) {
  const [particles, setParticles] = useState<TVParticle[]>([]);
  const supabaseRef = useRef(createClient());
  const queueRef = useRef<Array<{ reactionId: ReactionId; senderName: string }>>([]);
  const isProcessingRef = useRef<boolean>(false);

  const removeParticle = useCallback((key: string) => {
    setParticles((prev) => prev.filter((p) => p.key !== key));
  }, []);

  const spawnParticle = useCallback((reactionId: ReactionId, senderName: string) => {
    const key      = `tv-${Date.now()}-${uid()}`;
    // Restrict floating reactions strictly to the right side of the TV screen (82% to 94%)
    const x        = 82 + Math.random() * 12;
    const sway     = (Math.random() - 0.5) * 35;
    const size     = 1.4 + Math.random() * 0.6;
    const duration = 2400 + Math.random() * 800;
    setParticles((prev) => {
      // Hard cap: drop oldest particles if over limit
      const trimmed = prev.length >= MAX_PARTICLES ? prev.slice(prev.length - MAX_PARTICLES + 1) : prev;
      return [...trimmed, { key, reactionId, x, sway, size, duration, senderName }];
    });
  }, []);

  const processQueue = useCallback(() => {
    if (queueRef.current.length === 0) {
      isProcessingRef.current = false;
      return;
    }

    isProcessingRef.current = true;
    const nextItem = queueRef.current.shift();
    if (nextItem) {
      spawnParticle(nextItem.reactionId, nextItem.senderName);
    }

    // Stagger delay between consecutive floating particles (180ms - 260ms) like TikTok/IG live stream
    const delay = 180 + Math.random() * 80;
    setTimeout(processQueue, delay);
  }, [spawnParticle]);

  const enqueueReaction = useCallback((reactionId: ReactionId, senderName: string) => {
    if (queueRef.current.length < 50) {
      queueRef.current.push({ reactionId, senderName });
    }
    if (!isProcessingRef.current) {
      processQueue();
    }
  }, [processQueue]);

  useEffect(() => {
    const supabase = supabaseRef.current;
    const channelName = `okekaraoke:reactions:${roomCode}`;
    const channel = supabase.channel(channelName);

    channel
      .on('broadcast', { event: 'emoji_reaction' }, ({ payload }) => {
        const reactionId: ReactionId = payload?.reaction_id || emojiToId(payload?.emoji);
        const senderName: string = payload?.sender_name || 'Guest';
        enqueueReaction(reactionId, senderName);
      })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [roomCode, enqueueReaction]);

  if (particles.length === 0) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 45 }}
      aria-hidden="true"
    >
      {/* Single shared keyframe injected once — no per-particle <style> tags */}
      <style dangerouslySetInnerHTML={{ __html: SHARED_KEYFRAME_CSS }} />
      {particles.map((p) => (
        <TVParticleItem
          key={p.key}
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
