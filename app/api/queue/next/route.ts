// ============================================================
// OKEKARAOKE — POST /api/queue/next
// TV calls this when a song ends to advance to the next song
// ============================================================

import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiSuccess, apiError, validateRoomCode, validateSessionId, validateUUID } from '@/lib/utils/apiHelpers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { room_code, session_id, completed_queue_item_id } = body;

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

    if (completed_queue_item_id && !validateUUID(completed_queue_item_id)) {
      return apiError('INVALID_QUEUE_ITEM', 'Invalid queue item ID.', 400);
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
      return apiError('ROOM_NOT_FOUND', 'This OKEKARAOKE room does not exist or is no longer active.', 404);
    }

    // Verify this session is authorized as a TV or admin for this instance
    const { data: device } = await supabase
      .from('devices')
      .select('device_type')
      .eq('instance_id', instance.id)
      .eq('session_id', session_id)
      .in('device_type', ['tv', 'admin'])
      .single();

    if (!device) {
      return apiError('UNAUTHORIZED', 'Only the TV or admin can advance the queue.', 403);
    }

    // Advance queue atomically
    const { data: result, error: rpcError } = await supabase.rpc('advance_queue_atomic', {
      p_instance_id: instance.id,
      p_completed_queue_item_id: completed_queue_item_id ?? null,
    });

    if (rpcError) {
      console.error('advance_queue_atomic RPC error:', rpcError);
      return apiError('ADVANCE_FAILED', 'Failed to advance queue. Please try again.', 500);
    }

    const resultRow = Array.isArray(result) ? result[0] : result;

    if (!resultRow?.success) {
      return apiError('ADVANCE_FAILED', 'Failed to advance queue.', 500);
    }

    const hasNextSong = !!resultRow.next_queue_item_id;

    // Broadcast appropriate events
    if (hasNextSong) {
      await supabase.channel(`okekaraoke:instance:${normalizedCode}`).send({
        type: 'broadcast',
        event: 'song_started',
        payload: {
          type: 'song_started',
          instance_id: instance.id,
          room_code: normalizedCode,
          queue_item_id: resultRow.next_queue_item_id,
          song_id: resultRow.next_song_id,
          youtube_video_id: resultRow.next_youtube_video_id,
          guest_name: resultRow.next_guest_name,
          position: resultRow.next_position,
          timestamp: new Date().toISOString(),
        },
      });
    } else {
      await supabase.channel(`okekaraoke:instance:${normalizedCode}`).send({
        type: 'broadcast',
        event: 'song_finished',
        payload: {
          type: 'song_finished',
          instance_id: instance.id,
          room_code: normalizedCode,
          queue_item_id: completed_queue_item_id ?? null,
          timestamp: new Date().toISOString(),
        },
      });
    }

    return apiSuccess({
      next_queue_item_id: resultRow.next_queue_item_id ?? null,
      next_song_id: resultRow.next_song_id ?? null,
      next_youtube_video_id: resultRow.next_youtube_video_id ?? null,
      next_guest_name: resultRow.next_guest_name ?? null,
      next_position: resultRow.next_position ?? null,
    });
  } catch (error) {
    console.error('Unexpected error in /api/queue/next:', error);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred.', 500);
  }
}
