// ============================================================
// OKEKARAOKE — POST /api/queue/skip
// Admin/TV can skip the currently playing item
// ============================================================

import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiSuccess, apiError, validateRoomCode, validateSessionId, validateUUID } from '@/lib/utils/apiHelpers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { room_code, session_id, queue_item_id } = body;

    if (!room_code) {
      return apiError('MISSING_ROOM_CODE', 'Room code is required.', 400);
    }

    const normalizedCode = validateRoomCode(room_code);
    if (!normalizedCode) {
      return apiError('INVALID_ROOM_CODE', 'Invalid room code format.', 400);
    }

    if (!session_id || !validateSessionId(session_id)) {
      return apiError('INVALID_SESSION', 'A valid session ID is required.', 400);
    }

    if (!queue_item_id || !validateUUID(queue_item_id)) {
      return apiError('INVALID_QUEUE_ITEM', 'A valid queue item ID is required.', 400);
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

    // Verify this session is TV or admin
    const { data: device } = await supabase
      .from('devices')
      .select('device_type')
      .eq('instance_id', instance.id)
      .eq('session_id', session_id)
      .in('device_type', ['tv', 'admin'])
      .single();

    if (!device) {
      return apiError('UNAUTHORIZED', 'Only the TV or admin can skip songs.', 403);
    }

    // Check skip is allowed
    const { data: settings } = await supabase
      .from('instance_settings')
      .select('allow_skip')
      .eq('instance_id', instance.id)
      .single();

    if (settings && !settings.allow_skip && device.device_type !== 'admin') {
      return apiError('SKIP_NOT_ALLOWED', 'Skipping songs is not allowed in this room.', 403);
    }

    // Skip atomically
    const { data: result, error: rpcError } = await supabase.rpc('skip_queue_item_atomic', {
      p_instance_id: instance.id,
      p_queue_item_id: queue_item_id,
    });

    if (rpcError) {
      console.error('skip_queue_item_atomic RPC error:', rpcError);
      return apiError('SKIP_FAILED', 'Failed to skip song. Please try again.', 500);
    }

    const resultRow = Array.isArray(result) ? result[0] : result;

    // Broadcast
    await supabase.channel(`okekaraoke:instance:${normalizedCode}`).send({
      type: 'broadcast',
      event: resultRow?.next_queue_item_id ? 'song_started' : 'song_skipped',
      payload: {
        type: resultRow?.next_queue_item_id ? 'song_started' : 'song_skipped',
        instance_id: instance.id,
        room_code: normalizedCode,
        skipped_queue_item_id: queue_item_id,
        queue_item_id: resultRow?.next_queue_item_id ?? null,
        youtube_video_id: resultRow?.next_youtube_video_id ?? null,
        timestamp: new Date().toISOString(),
      },
    });

    return apiSuccess({
      skipped: true,
      next_queue_item_id: resultRow?.next_queue_item_id ?? null,
      next_youtube_video_id: resultRow?.next_youtube_video_id ?? null,
    });
  } catch (error) {
    console.error('Unexpected error in /api/queue/skip:', error);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred.', 500);
  }
}
