// ============================================================
// OKEKARAOKE — Guest Session Management
// Manages anonymous user sessions stored in localStorage
// ============================================================

import type { GuestSession, DeviceType } from '@/lib/types';

const SESSION_KEY = 'okekaraoke_guest_session';

function generateSessionId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function getOrCreateGuestSession(): GuestSession {
  if (typeof window === 'undefined') {
    throw new Error('getOrCreateGuestSession must be called on the client');
  }

  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      const session = JSON.parse(stored) as GuestSession;
      if (session.session_id) {
        return session;
      }
    }
  } catch {
    // Corrupted session — create new
  }

  const session: GuestSession = {
    session_id: generateSessionId(),
    guest_name: null,
    instance_id: null,
    room_code: null,
    device_type: null,
    created_at: new Date().toISOString(),
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function getGuestSession(): GuestSession | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as GuestSession;
  } catch {
    return null;
  }
}

export function updateGuestSession(updates: Partial<GuestSession>): GuestSession {
  const current = getOrCreateGuestSession();
  const updated = { ...current, ...updates };
  localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
  return updated;
}

export function setGuestSessionForInstance(
  instance_id: string,
  room_code: string,
  device_type: DeviceType,
  guest_name?: string
): GuestSession {
  return updateGuestSession({
    instance_id,
    room_code,
    device_type,
    guest_name: guest_name ?? null,
  });
}

export function clearGuestSession(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SESSION_KEY);
  }
}

export function clearGuestInstanceData(): void {
  const session = getGuestSession();
  if (session) {
    updateGuestSession({
      instance_id: null,
      room_code: null,
      device_type: null,
    });
  }
}
