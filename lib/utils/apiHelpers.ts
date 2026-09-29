// ============================================================
// OKEKARAOKE — API Route Helpers
// ============================================================

import { NextResponse } from 'next/server';
import type { ApiResponse } from '@/lib/types';

export function apiSuccess<T>(data: T, status = 200): NextResponse {
  const response: ApiResponse<T> = { success: true, data };
  return NextResponse.json(response, { status });
}

export function apiError(code: string, message: string, status = 400): NextResponse {
  const response: ApiResponse = { success: false, error: { code, message } };
  return NextResponse.json(response, { status });
}

export function validateRoomCode(roomCode: string): string | null {
  const normalized = roomCode.toUpperCase().trim();
  if (!/^[A-Z0-9]{4,8}$/.test(normalized)) {
    return null;
  }
  return normalized;
}

export function validateUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function validateSessionId(sessionId: string): boolean {
  if (typeof sessionId !== 'string') return false;
  const trimmed = sessionId.trim();
  return trimmed.length >= 8 && trimmed.length <= 128;
}
