// ============================================================
// OKEKARAOKE — GET /api/instances/[roomCode]/state
// Returns the complete authoritative state for an instance
// ============================================================

import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiSuccess, apiError, validateRoomCode } from '@/lib/utils/apiHelpers';

interface RouteContext {
  params: Promise<{ roomCode: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { roomCode } = await context.params;

    const normalizedCode = validateRoomCode(roomCode);
    if (!normalizedCode) {
      return apiError('INVALID_ROOM_CODE', 'Invalid room code format.', 400);
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase.rpc('get_instance_state', {
      p_room_code: normalizedCode,
    });

    if (error) {
      console.error('get_instance_state RPC error:', error);
      return apiError('STATE_FETCH_FAILED', 'Failed to fetch room state.', 500);
    }

    if (!data || (data as Record<string, unknown>).error === 'INSTANCE_NOT_FOUND') {
      return apiError('ROOM_NOT_FOUND', 'This OKEKARAOKE room does not exist or is no longer active.', 404);
    }

    return apiSuccess(data);
  } catch (error) {
    console.error('Unexpected error in /api/instances/[roomCode]/state:', error);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred.', 500);
  }
}
