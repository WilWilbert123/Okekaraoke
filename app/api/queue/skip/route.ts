// ============================================================
// OKEKARAOKE — POST /api/queue/skip
// Allows TV host, admin, OR song owner to stop/skip a song
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

    // 1. Find active instance
    const { data: instance } = await supabase
      .from('instances')
      .select('id')
      .ilike('room_code', normalizedCode)
      .eq('status', 'active')
      .maybeSingle();

    if (!instance) {
      return apiError('ROOM_NOT_FOUND', 'Room not found.', 404);
    }

    // 2. Fetch the target queue item
    const { data: queueItem } = await supabase
      .from('queue_items')
      .select('id, guest_session_id, status')
      .eq('id', queue_item_id)
      .eq('instance_id', instance.id)
      .maybeSingle();

    if (!queueItem) {
      return apiError('ITEM_NOT_FOUND', 'Target song was not found in the queue.', 404);
    }

    // 3. Verify authorization: TV device, Admin, OR the song owner themselves
    const isSongOwner = queueItem.guest_session_id === session_id;

    const { data: device } = await supabase
      .from('devices')
      .select('device_type')
      .eq('instance_id', instance.id)
      .eq('session_id', session_id)
      .in('device_type', ['tv', 'admin'])
      .maybeSingle();

    const isHostOrAdmin = !!device;

    if (!isSongOwner && !isHostOrAdmin) {
      return apiError('UNAUTHORIZED', 'You can only stop or skip your own songs.', 403);
    }

    let nextQueueItemId: string | null = null;
    let nextYoutubeVideoId: string | null = null;

    // 4. Try RPC skip first
    const { data: result, error: rpcError } = await supabase.rpc('skip_queue_item_atomic', {
      p_instance_id: instance.id,
      p_queue_item_id: queue_item_id,
    });

    const resultRow = Array.isArray(result) ? result[0] : result;

    if (!rpcError && resultRow?.success) {
      nextQueueItemId = resultRow.next_queue_item_id ?? null;
      nextYoutubeVideoId = resultRow.next_youtube_video_id ?? null;
    } else {
      // 5. Direct DB update fallback
      await supabase
        .from('queue_items')
        .update({ status: 'skipped', cancelled_at: new Date().toISOString() })
        .eq('id', queue_item_id)
        .eq('instance_id', instance.id);

      // Advance to next song in queue
      const { data: nextItem } = await supabase
        .from('queue_items')
        .select('id, song_id, guest_name, position, songs(id, youtube_video_id)')
        .eq('instance_id', instance.id)
        .eq('status', 'queued')
        .order('position', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (nextItem) {
        await supabase
          .from('queue_items')
          .update({ status: 'playing', started_at: new Date().toISOString() })
          .eq('id', nextItem.id);

        const songObj = Array.isArray(nextItem.songs) ? nextItem.songs[0] : nextItem.songs;
        nextQueueItemId = nextItem.id;
        nextYoutubeVideoId = songObj?.youtube_video_id ?? null;
      }
    }

    // 6. Broadcast Realtime event
    await supabase.channel(`okekaraoke:instance:${normalizedCode}`).send({
      type: 'broadcast',
      event: nextQueueItemId ? 'song_started' : 'song_skipped',
      payload: {
        type: nextQueueItemId ? 'song_started' : 'song_skipped',
        instance_id: instance.id,
        room_code: normalizedCode,
        skipped_queue_item_id: queue_item_id,
        queue_item_id: nextQueueItemId,
        youtube_video_id: nextYoutubeVideoId,
        timestamp: new Date().toISOString(),
      },
    });

    return apiSuccess({
      skipped: true,
      next_queue_item_id: nextQueueItemId,
      next_youtube_video_id: nextYoutubeVideoId,
    });
  } catch (error) {
    console.error('Unexpected error in /api/queue/skip:', error);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred.', 500);
  }
}
