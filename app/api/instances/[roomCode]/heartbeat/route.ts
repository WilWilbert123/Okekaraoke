// ============================================================
// OKEKARAOKE — POST /api/instances/[roomCode]/heartbeat
// TV sends periodic heartbeat to indicate it's online
// ============================================================

import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiSuccess, apiError, validateRoomCode, validateSessionId } from '@/lib/utils/apiHelpers';

interface RouteContext {
  params: Promise<{ roomCode: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { roomCode } = await context.params;
    const body = await request.json().catch(() => ({}));
    const { session_id, device_type = 'tv' } = body;

    const normalizedCode = validateRoomCode(roomCode);
    if (!normalizedCode) {
      return apiError('INVALID_ROOM_CODE', 'Invalid room code format.', 400);
    }

    if (!session_id || !validateSessionId(session_id)) {
      return apiError('INVALID_SESSION', 'A valid session ID is required.', 400);
    }

    const supabase = createAdminClient();

    // Find active instance
    const { data: instance } = await supabase
      .from('instances')
      .select('id')
      .ilike('room_code', normalizedCode)
      .eq('status', 'active')
      .single();

    if (!instance) {
      return apiError('ROOM_NOT_FOUND', 'Room not found.', 404);
    }

    // Update device heartbeat
    const now = new Date().toISOString();
    await supabase
      .from('devices')
      .upsert({
        instance_id: instance.id,
        device_type,
        session_id,
        is_online: true,
        last_seen_at: now,
      }, {
        onConflict: 'instance_id,session_id',
      });

    return apiSuccess({ alive: true, timestamp: now });
  } catch (error) {
    console.error('Unexpected error in /api/instances/[roomCode]/heartbeat:', error);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred.', 500);
  }
}
