'use client';

// ============================================================
// OKEKARAOKE — useRealtime Hook
// Shared, reference-counted Supabase Realtime channel manager
// Prevents channel collisions, unmount-remount race conditions,
// and handles reconnection gracefully.
// ============================================================

import { useEffect, useRef, useCallback, useId } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeEventType } from '@/lib/types';

type RealtimeHandler = (payload: Record<string, unknown>) => void;

interface UseRealtimeOptions {
  roomCode: string | null;
  handlers: Partial<Record<RealtimeEventType, RealtimeHandler>>;
  enabled?: boolean;
}

interface ListenerEntry {
  id: string;
  handlersRef: React.MutableRefObject<Partial<Record<RealtimeEventType, RealtimeHandler>>>;
}

interface ChannelRecord {
  channelName: string;
  channel: ReturnType<ReturnType<typeof createClient>['channel']>;
  refCount: number;
  listeners: Map<string, ListenerEntry>;
  status: 'CLOSED' | 'SUBSCRIBING' | 'SUBSCRIBED' | 'ERROR';
  cleanupTimer: NodeJS.Timeout | null;
  retryTimer: NodeJS.Timeout | null;
  retryCount: number;
}

// Module-level registry: one channel per room code across the client application
const channelRegistry = new Map<string, ChannelRecord>();

const EVENT_TYPES: RealtimeEventType[] = [
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
  'playback_control',
  'playback_sync',
];

function getOrCreateChannelRecord(roomCode: string): ChannelRecord {
  const normalizedKey = roomCode.toUpperCase().trim();
  const existing = channelRegistry.get(normalizedKey);
  if (existing) {
    if (existing.cleanupTimer) {
      clearTimeout(existing.cleanupTimer);
      existing.cleanupTimer = null;
    }
    return existing;
  }

  const supabase = createClient();
  const channelName = `okekaraoke:instance:${normalizedKey}`;

  const channel = supabase.channel(channelName, {
    config: {
      broadcast: { ack: false, self: true },
    },
  });

  const record: ChannelRecord = {
    channelName,
    channel,
    refCount: 0,
    listeners: new Map(),
    status: 'SUBSCRIBING',
    cleanupTimer: null,
    retryTimer: null,
    retryCount: 0,
  };

  // Bind all event listeners once for this channel
  EVENT_TYPES.forEach((eventType) => {
    channel.on(
      'broadcast',
      { event: eventType },
      (msg: { payload?: Record<string, unknown> } & Record<string, unknown>) => {
        const payload = (msg?.payload !== undefined ? msg.payload : msg) as Record<string, unknown>;
        record.listeners.forEach((listener) => {
          try {
            const fn = listener.handlersRef.current[eventType];
            if (fn) {
              fn(payload);
            }
          } catch (err) {
            console.warn(`[Realtime Handler Error] (${eventType}):`, err);
          }
        });
      }
    );
  });

  // Also bind wildcard banner_updated for system-wide broadcasts
  channel.on('broadcast', { event: 'banner_updated' }, (msg: any) => {
    const payload = (msg?.payload !== undefined ? msg.payload : msg) as Record<string, unknown>;
    record.listeners.forEach((listener) => {
      try {
        const fn = listener.handlersRef.current['banner_updated'];
        if (fn) fn(payload);
      } catch (err) {
        console.warn(`[Realtime Handler Error] (banner_updated):`, err);
      }
    });
  });

  const subscribeChannel = () => {
    channel.subscribe((status: string, err?: Error) => {
      if (status === 'SUBSCRIBED') {
        record.status = 'SUBSCRIBED';
        record.retryCount = 0;
        if (record.retryTimer) {
          clearTimeout(record.retryTimer);
          record.retryTimer = null;
        }
        console.log(`[Realtime] Subscribed to ${channelName}`);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        record.status = 'ERROR';
        // Transient transport errors happen during reconnects, tab backgrounding, or sleep.
        // Warn with diagnostic info rather than throwing unhandled console.error
        console.warn(
          `[Realtime] Channel reconnecting for ${channelName} (${status}${
            err?.message ? `: ${err.message}` : ''
          }). Retrying...`
        );

        if (!record.retryTimer && record.refCount > 0) {
          const delay = Math.min(1000 * Math.pow(1.5, record.retryCount), 6000);
          record.retryCount++;
          record.retryTimer = setTimeout(() => {
            record.retryTimer = null;
            if (record.refCount > 0 && record.status !== 'SUBSCRIBED') {
              try {
                const adapter = (channel as unknown as { channelAdapter?: { isClosed?: () => boolean } }).channelAdapter;
                const isClosed = adapter?.isClosed ? adapter.isClosed() : (channel.state === 'closed' || channel.state === 'errored');
                if (isClosed) {
                  subscribeChannel();
                }
              } catch (reErr) {
                console.warn(`[Realtime] Reconnect retry error for ${channelName}:`, reErr);
              }
            }
          }, delay);
        }
      } else if (status === 'CLOSED') {
        record.status = 'CLOSED';
      }
    });
  };

  subscribeChannel();

  channelRegistry.set(normalizedKey, record);
  return record;
}

function releaseChannelRecord(roomCode: string, listenerId: string) {
  const normalizedKey = roomCode.toUpperCase().trim();
  const record = channelRegistry.get(normalizedKey);
  if (!record) return;

  record.listeners.delete(listenerId);
  record.refCount = Math.max(0, record.refCount - 1);

  if (record.refCount === 0) {
    if (record.cleanupTimer) {
      clearTimeout(record.cleanupTimer);
    }

    // 1200ms grace period so React StrictMode or component remount does not churn WebSocket
    record.cleanupTimer = setTimeout(() => {
      record.cleanupTimer = null;
      if (record.refCount <= 0) {
        if (record.retryTimer) {
          clearTimeout(record.retryTimer);
          record.retryTimer = null;
        }
        try {
          const supabase = createClient();
          supabase.removeChannel(record.channel);
        } catch {
          // Ignore cleanup errors
        }
        channelRegistry.delete(normalizedKey);
      }
    }, 1200);
  }
}

export function useRealtime({ roomCode, handlers, enabled = true }: UseRealtimeOptions) {
  const listenerId = useId();
  const handlersRef = useRef(handlers);
  const activeRecordRef = useRef<ChannelRecord | null>(null);

  // Keep handlers ref current without re-subscribing
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!roomCode || !enabled) return;

    const record = getOrCreateChannelRecord(roomCode);
    record.refCount++;
    record.listeners.set(listenerId, {
      id: listenerId,
      handlersRef,
    });
    activeRecordRef.current = record;

    return () => {
      activeRecordRef.current = null;
      releaseChannelRecord(roomCode, listenerId);
    };
  }, [roomCode, enabled, listenerId]);

  const broadcast = useCallback(
    (event: string, payload: Record<string, unknown>) => {
      if (!roomCode) return;
      const normalizedKey = roomCode.toUpperCase().trim();
      const record = channelRegistry.get(normalizedKey);
      if (record?.channel) {
        record.channel
          .send({
            type: 'broadcast',
            event,
            payload,
          })
          .catch((err) => {
            console.warn(`[Realtime Broadcast Error] ${event}:`, err);
          });
      }
    },
    [roomCode]
  );

  return { broadcast, channel: activeRecordRef.current?.channel ?? null };
}
