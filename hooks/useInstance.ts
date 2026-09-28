'use client';

// ============================================================
// OKEKARAOKE — useInstance Hook
// Manages the current OKEKARAOKE instance state
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import type { InstanceState, ConnectionStatus } from '@/lib/types';

interface UseInstanceOptions {
  roomCode: string;
  pollingIntervalMs?: number;
}

interface UseInstanceResult {
  state: InstanceState | null;
  loading: boolean;
  error: string | null;
  connectionStatus: ConnectionStatus;
  refresh: () => Promise<void>;
}

export function useInstance({ roomCode, pollingIntervalMs = 0 }: UseInstanceOptions): UseInstanceResult {
  const [state, setState] = useState<InstanceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('reconnecting');

  const fetchState = useCallback(async () => {
    if (!roomCode) return;

    try {
      const response = await fetch(`/api/instances/${roomCode}/state`);
      const json = await response.json();

      if (!response.ok || !json.success) {
        const errorMessage = json.error?.message ?? 'Failed to load room state.';
        setError(errorMessage);
        setConnectionStatus('offline');
        return;
      }

      setState(json.data as InstanceState);
      setError(null);
      setConnectionStatus('connected');
    } catch {
      setError('Connection failed. Check your network.');
      setConnectionStatus('offline');
    } finally {
      setLoading(false);
    }
  }, [roomCode]);

  const refresh = useCallback(async () => {
    setConnectionStatus('reconnecting');
    await fetchState();
  }, [fetchState]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  useEffect(() => {
    if (!pollingIntervalMs) return;

    const interval = setInterval(fetchState, pollingIntervalMs);
    return () => clearInterval(interval);
  }, [fetchState, pollingIntervalMs]);

  // Monitor online/offline browser events
  useEffect(() => {
    const handleOnline = () => {
      setConnectionStatus('reconnecting');
      fetchState();
    };
    const handleOffline = () => {
      setConnectionStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchState]);

  return { state, loading, error, connectionStatus, refresh };
}
