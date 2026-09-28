// ============================================================
// OKEKARAOKE — POST /api/queue/reserve
// Atomically adds a song to an instance's queue
// ============================================================

import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiSuccess, apiError, validateRoomCode, validateSessionId } from '@/lib/utils/apiHelpers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { room_code, song_code, guest_session_id, guest_name } = body;

    if (!room_code) {
      return apiError('MISSING_ROOM_CODE', 'Room code is required.', 400);
    }

    const normalizedCode = validateRoomCode(room_code);
    if (!normalizedCode) {
      return apiError('INVALID_ROOM_CODE', 'Invalid room code format.', 400);
    }

    if (!song_code || typeof song_code !== 'string') {
      return apiError('MISSING_SONG_CODE', 'Song code is required.', 400);
    }

    if (!guest_session_id || !validateSessionId(guest_session_id)) {
      return apiError('INVALID_SESSION', 'A valid guest session ID is required.', 400);
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

    // Verify device is associated with this instance
    const { data: device } = await supabase
      .from('devices')
      .select('id')
      .eq('instance_id', instance.id)
      .eq('session_id', guest_session_id)
      .single();

    if (!device) {
      // Auto-register as remote if not found (graceful join)
      await supabase.from('devices').upsert({
        instance_id: instance.id,
        device_type: 'remote',
        session_id: guest_session_id,
        device_name: guest_name ?? 'Guest',
        is_online: true,
        last_seen_at: new Date().toISOString(),
      }, { onConflict: 'instance_id,session_id' });
    }

    // Find song by code
    const { data: song } = await supabase
      .from('songs')
      .select('id, title, artist')
      .eq('code', song_code.trim())
      .eq('is_active', true)
      .single();

    if (!song) {
      return apiError('SONG_NOT_FOUND', 'Song not found. Please check the song code.', 404);
    }

    // Call atomic reservation function
    const { data: result, error: rpcError } = await supabase.rpc('reserve_song_atomic', {
      p_instance_id: instance.id,
      p_song_id: song.id,
      p_guest_session_id: guest_session_id,
      p_guest_name: guest_name ?? null,
    });

    if (rpcError) {
      console.error('reserve_song_atomic RPC error:', rpcError);
      return apiError('RESERVATION_FAILED', 'Failed to reserve song. Please try again.', 500);
    }

    const resultRow = Array.isArray(result) ? result[0] : result;

    if (!resultRow?.success) {
      return apiError(
        resultRow?.error_code ?? 'RESERVATION_FAILED',
        resultRow?.error_message ?? 'Failed to reserve song.',
        400
      );
    }

    // Broadcast realtime event
    await supabase.channel(`okekaraoke:instance:${normalizedCode}`).send({
      type: 'broadcast',
      event: 'queue_added',
      payload: {
        type: 'queue_added',
        instance_id: instance.id,
        room_code: normalizedCode,
        queue_item_id: resultRow.queue_item_id,
        position: resultRow.position,
        song_title: song.title,
        song_artist: song.artist,
        guest_name: guest_name ?? null,
        timestamp: new Date().toISOString(),
      },
    });

    return apiSuccess({
      queue_item_id: resultRow.queue_item_id,
      position: resultRow.position,
      song: { title: song.title, artist: song.artist },
    }, 201);
  } catch (error) {
    console.error('Unexpected error in /api/queue/reserve:', error);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred.', 500);
  }
}
