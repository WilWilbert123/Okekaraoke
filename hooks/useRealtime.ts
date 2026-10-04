'use client';

// ============================================================
// OKEKARAOKE — useRealtime Hook
// Subscribes to instance-scoped Supabase Realtime channel
// ============================================================

import { useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeEventType } from '@/lib/types';

type RealtimeHandler = (payload: Record<string, unknown>) => void;

interface UseRealtimeOptions {
  roomCode: string | null;
  handlers: Partial<Record<RealtimeEventType, RealtimeHandler>>;
  enabled?: boolean;
}

export function useRealtime({ roomCode, handlers, enabled = true }: UseRealtimeOptions) {
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);
  const handlersRef = useRef(handlers);

  // Keep handlers ref current without re-subscribing
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  const subscribe = useCallback(() => {
    if (!roomCode || !enabled) return;

    const supabase = createClient();
    const channelName = `okekaraoke:instance:${roomCode.toUpperCase()}`;

    // Clean up existing subscription first
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase.channel(channelName);

    // Subscribe to all broadcast events on this channel
    const eventTypes: RealtimeEventType[] = [
      'queue_added',
      'queue_removed',
      'queue_updated',
      'song_started',
      'song_finished',
      'song_skipped',
      'instance_updated',
      'tv_online',
      'tv_offline',
      'remote_joined',
      'remote_left',
      'banner_updated',
      'shoutout_broadcast',
    ];

    eventTypes.forEach((eventType) => {
      channel.on('broadcast', { event: eventType }, (payload: { payload: Record<string, unknown> }) => {
        const handler = handlersRef.current[eventType];
        if (handler) {
          handler(payload.payload as Record<string, unknown>);
        }
      });
    });

    // Also listen to global broadcast channel for system-wide events like banner updates
    channel.on('broadcast', { event: 'banner_updated' }, (payload: { payload: Record<string, unknown> }) => {
      const handler = handlersRef.current['banner_updated'];
      if (handler) {
        handler(payload.payload as Record<string, unknown>);
      }
    });


    channel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[Realtime] Subscribed to ${channelName}`);
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`[Realtime] Error on channel ${channelName}`);
      }
    });

    channelRef.current = channel;
  }, [roomCode, enabled]);

  useEffect(() => {
    try {
      subscribe();
    } catch (err) {
      console.error('[Realtime] Subscription error:', err);
    }

    return () => {
      try {
        const supabase = createClient();
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }
      } catch (err) {
        console.error('[Realtime] Cleanup error:', err);
      }
    };
  }, [subscribe]);
}
