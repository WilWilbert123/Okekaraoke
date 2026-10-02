'use client';

// ============================================================
// OKEKARAOKE — useHeartbeat Hook
// Sends periodic heartbeat from TV to server
// ============================================================

import { useEffect, useRef } from 'react';

interface UseHeartbeatOptions {
  roomCode: string | null;
  sessionId: string | null;
  deviceType?: 'tv' | 'remote' | 'admin';
  deviceName?: string;
  intervalMs?: number;
  enabled?: boolean;
}

export function useHeartbeat({
  roomCode,
  sessionId,
  deviceType = 'tv',
  deviceName,
  intervalMs = 30000,
  enabled = true,
}: UseHeartbeatOptions) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sendHeartbeat = async () => {
    if (!roomCode || !sessionId) return;

    try {
      await fetch(`/api/instances/${roomCode}/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          device_type: deviceType,
          device_name: deviceName || undefined,
        }),
      });
    } catch {
      // Silently fail — connection status is handled elsewhere
    }
  };

  useEffect(() => {
    if (!enabled || !roomCode || !sessionId) return;

    // Send immediately
    sendHeartbeat();

    // Then on interval (only if tab/screen is active)
    intervalRef.current = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      sendHeartbeat();
    }, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, sessionId, deviceType, intervalMs, enabled]);

  return { sendHeartbeat, triggerHeartbeat: sendHeartbeat };
}
