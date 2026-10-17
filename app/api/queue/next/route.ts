// ============================================================
// OKEKARAOKE — POST /api/queue/next
// TV calls this when a song ends to advance to the next song
// ============================================================

import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { broadcastRealtime } from '@/lib/supabase/realtime';
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

    // Ensure caller is registered in devices table (touch/upsert)
    await supabase.from('devices').upsert(
      {
        instance_id: instance.id,
        device_type: 'tv',
        session_id: session_id,
        device_name: 'TV Screen',
        is_online: true,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'instance_id,session_id' }
    );

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

    // Broadcast appropriate events in real time to all room participants
    if (hasNextSong) {
      let nextGuestSessionId = '';
      let nextSongTitle = '';
      let nextSongArtist = '';
      let nextThumbnailUrl = '';

      const { data: nextItemData } = await supabase
        .from('queue_items')
        .select('guest_session_id, songs(title, artist, thumbnail_url)')
        .eq('id', resultRow.next_queue_item_id)
        .maybeSingle();

      if (nextItemData) {
        nextGuestSessionId = nextItemData.guest_session_id || '';
        const songObj = Array.isArray(nextItemData.songs) ? nextItemData.songs[0] : nextItemData.songs;
        nextSongTitle = (songObj as any)?.title || '';
        nextSongArtist = (songObj as any)?.artist || '';
        nextThumbnailUrl = (songObj as any)?.thumbnail_url || '';
      }

      await broadcastRealtime(normalizedCode, 'song_started', {
        type: 'song_started',
        instance_id: instance.id,
        room_code: normalizedCode,
        queue_item_id: resultRow.next_queue_item_id,
        song_id: resultRow.next_song_id,
        song_title: nextSongTitle,
        song_artist: nextSongArtist,
        thumbnail_url: nextThumbnailUrl,
        youtube_video_id: resultRow.next_youtube_video_id,
        guest_name: resultRow.next_guest_name,
        guest_session_id: nextGuestSessionId,
        position: resultRow.next_position,
        timestamp: new Date().toISOString(),
      });
      await broadcastRealtime(normalizedCode, 'queue_updated', {
        instance_id: instance.id,
        room_code: normalizedCode,
        timestamp: new Date().toISOString(),
      });
    } else {
      await broadcastRealtime(normalizedCode, 'song_finished', {
        type: 'song_finished',
        instance_id: instance.id,
        room_code: normalizedCode,
        queue_item_id: completed_queue_item_id ?? null,
        timestamp: new Date().toISOString(),
      });
      await broadcastRealtime(normalizedCode, 'queue_updated', {
        instance_id: instance.id,
        room_code: normalizedCode,
        timestamp: new Date().toISOString(),
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
