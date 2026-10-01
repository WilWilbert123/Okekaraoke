// ============================================================
// OKEKARAOKE — POST /api/queue/stop
// Stops the currently playing song and advances to next song.
// Reliable & robust: allows any guest in the room to stop the playing song.
// ============================================================

import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { broadcastRealtime } from '@/lib/supabase/realtime';
import { apiSuccess, apiError, validateRoomCode, validateSessionId } from '@/lib/utils/apiHelpers';

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
      return apiError('ROOM_NOT_FOUND', 'Room not found.', 404);
    }

    // 2. Find target song to stop in DB
    let targetItem: { id: string; status: string; guest_session_id: string | null } | null = null;

    const { data: playingItem } = await supabase
      .from('queue_items')
      .select('id, status, guest_session_id')
      .eq('instance_id', instance.id)
      .eq('status', 'playing')
      .maybeSingle();

    if (playingItem) {
      targetItem = playingItem;
    } else if (clientQueueItemId) {
      const { data: clientItem } = await supabase
        .from('queue_items')
        .select('id, status, guest_session_id')
        .eq('id', clientQueueItemId)
        .eq('instance_id', instance.id)
        .in('status', ['playing', 'queued'])
        .maybeSingle();
      targetItem = clientItem ?? null;
    }

    if (!targetItem) {
      return apiError('NOTHING_PLAYING', 'No active song to stop in this room.', 404);
    }

    // 2.5 Ensure caller is the owner of the song OR a TV device
    const { data: device } = await supabase
      .from('devices')
      .select('device_type')
      .eq('instance_id', instance.id)
      .eq('session_id', session_id)
      .maybeSingle();

    const isTV = device?.device_type === 'tv';
    const isOwner = targetItem.guest_session_id === session_id;

    if (!isTV && !isOwner) {
      return apiError('UNAUTHORIZED', 'You can only stop or skip your own songs.', 403);
    }

    // 3. Mark target song as completed
    const nowIso = new Date().toISOString();
    await supabase
      .from('queue_items')
      .update({ status: 'completed', completed_at: nowIso })
      .eq('id', targetItem.id)
      .eq('instance_id', instance.id);

    // 4. Find next queued song
    const { data: nextItem } = await supabase
      .from('queue_items')
      .select('id, song_id, guest_name, position, songs(id, youtube_video_id)')
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

    // 5. Broadcast Realtime event
    const eventName = nextQueueItemId ? 'song_started' : 'song_finished';
    await broadcastRealtime(normalizedCode, eventName, {
      type: eventName,
      instance_id: instance.id,
      room_code: normalizedCode,
      stopped_queue_item_id: targetItem.id,
      queue_item_id: nextQueueItemId,
      youtube_video_id: nextYoutubeVideoId,
      timestamp: nowIso,
    });

    return apiSuccess({
      stopped: true,
      stopped_queue_item_id: targetItem.id,
      next_queue_item_id: nextQueueItemId,
      next_youtube_video_id: nextYoutubeVideoId,
    });
  } catch (error) {
    console.error('Unexpected error in /api/queue/stop:', error);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred.', 500);
  }
}
