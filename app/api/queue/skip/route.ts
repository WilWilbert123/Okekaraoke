// ============================================================
// OKEKARAOKE — POST /api/queue/skip
// Stops the target song and advances to the next one in queue.
// Gracefully clears room state if nothing is left playing.
// ============================================================

import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { broadcastRealtime } from '@/lib/supabase/realtime';
import { apiSuccess, apiError, validateRoomCode, validateSessionId, validateUUID } from '@/lib/utils/apiHelpers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { room_code, session_id, queue_item_id: clientQueueItemId } = body;

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

    const supabase = createAdminClient();

    // 1. Find active room instance
    const { data: instance } = await supabase
      .from('instances')
      .select('id')
      .ilike('room_code', normalizedCode)
      .eq('status', 'active')
      .maybeSingle();

    if (!instance) {
      return apiError('ROOM_NOT_FOUND', 'Room not found or no longer active.', 404);
    }

    const nowIso = new Date().toISOString();

    // Touch device session for this room
    await supabase.from('devices').upsert(
      {
        instance_id: instance.id,
        device_type: 'remote',
        session_id: session_id,
        is_online: true,
        last_seen_at: nowIso,
      },
      { onConflict: 'instance_id,session_id' }
    );

    // 2. Resolve target item to stop:
    //    Priority 1: The specific queue_item_id requested by client
    //    Priority 2: The song currently marked 'playing' in DB
    //    Priority 3: The top queued song
    let targetItem: { id: string; status: string; guest_session_id: string | null } | null = null;

    if (clientQueueItemId && validateUUID(clientQueueItemId)) {
      const { data: clientItem } = await supabase
        .from('queue_items')
        .select('id, status, guest_session_id')
        .eq('id', clientQueueItemId)
        .eq('instance_id', instance.id)
        .maybeSingle();
      if (clientItem) {
        targetItem = clientItem;
      }
    }

    if (!targetItem) {
      const { data: playingItem } = await supabase
        .from('queue_items')
        .select('id, status, guest_session_id')
        .eq('instance_id', instance.id)
        .eq('status', 'playing')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (playingItem) {
        targetItem = playingItem;
      }
    }

    if (!targetItem) {
      const { data: topQueued } = await supabase
        .from('queue_items')
        .select('id, status, guest_session_id')
        .eq('instance_id', instance.id)
        .eq('status', 'queued')
        .order('position', { ascending: true })
        .limit(1)
        .maybeSingle();
      targetItem = topQueued ?? null;
    }

    // 3. Always clean up all 'playing' status rows for this instance
    await supabase
      .from('queue_items')
      .update({ status: 'skipped', cancelled_at: nowIso })
      .eq('instance_id', instance.id)
      .eq('status', 'playing');

    if (targetItem) {
      await supabase
        .from('queue_items')
        .update({ status: 'skipped', cancelled_at: nowIso })
        .eq('id', targetItem.id)
        .eq('instance_id', instance.id);
    }

    // 4. Start next song in queue if available
    const { data: nextItem } = await supabase
      .from('queue_items')
      .select('id, song_id, guest_name, position, songs(id, youtube_video_id, title, artist)')
      .eq('instance_id', instance.id)
      .eq('status', 'queued')
      .order('position', { ascending: true })
      .limit(1)
      .maybeSingle();

    let nextQueueItemId: string | null = null;
    let nextYoutubeVideoId: string | null = null;

    if (nextItem) {
      await supabase
        .from('queue_items')
        .update({ status: 'playing', started_at: nowIso })
        .eq('id', nextItem.id);

      const songObj = Array.isArray(nextItem.songs) ? nextItem.songs[0] : nextItem.songs;
      nextQueueItemId = nextItem.id;
      nextYoutubeVideoId = (songObj as any)?.youtube_video_id ?? null;
    }

    // 5. Broadcast Realtime events to clear UI on all devices
    const eventName = nextQueueItemId ? 'song_started' : 'song_skipped';
    await broadcastRealtime(normalizedCode, eventName, {
      type: eventName,
      instance_id: instance.id,
      room_code: normalizedCode,
      skipped_queue_item_id: targetItem?.id ?? null,
      queue_item_id: nextQueueItemId,
      youtube_video_id: nextYoutubeVideoId,
      timestamp: nowIso,
    });

    if (!nextQueueItemId) {
      await broadcastRealtime(normalizedCode, 'song_finished', {
        type: 'song_finished',
        instance_id: instance.id,
        room_code: normalizedCode,
        queue_item_id: targetItem?.id ?? null,
        timestamp: nowIso,
      });
    }

    return apiSuccess({
      skipped: true,
      skipped_queue_item_id: targetItem?.id ?? null,
      next_queue_item_id: nextQueueItemId,
      next_youtube_video_id: nextYoutubeVideoId,
    });
  } catch (error) {
    console.error('Unexpected error in /api/queue/skip:', error);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred.', 500);
  }
}
