// ============================================================
// OKEKARAOKE — POST /api/queue/control
// Playback Control: Pause / Resume currently playing song.
// Strictly enforces "Your Song, Your Rule": Only the singer who
// reserved the song (or room host) can pause/resume it.
// ============================================================

import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { broadcastRealtime } from '@/lib/supabase/realtime';
import { apiSuccess, apiError, validateRoomCode, validateSessionId } from '@/lib/utils/apiHelpers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { room_code, session_id, action, queue_item_id } = body;

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

    if (action !== 'pause' && action !== 'resume') {
      return apiError('INVALID_ACTION', 'Action must be pause or resume.', 400);
    }

    const supabase = createAdminClient();

    // 1. Find active room instance
    const { data: instance } = await supabase
      .from('instances')
      .select('id, owner_session_id')
      .ilike('room_code', normalizedCode)
      .eq('status', 'active')
      .maybeSingle();

    if (!instance) {
      return apiError('ROOM_NOT_FOUND', 'Room not found or no longer active.', 404);
    }

    // 2. Fetch currently playing song in this room
    const { data: currentSong } = await supabase
      .from('queue_items')
      .select('id, guest_session_id, guest_name')
      .eq('instance_id', instance.id)
      .eq('status', 'playing')
      .maybeSingle();

    if (!currentSong) {
      return apiError('NO_SONG_PLAYING', 'No song is currently playing in this room.', 400);
    }

    if (queue_item_id && currentSong.id !== queue_item_id) {
      return apiError('SONG_MISMATCH', 'The target song is no longer playing.', 400);
    }

    // 3. YOUR SONG, YOUR RULE permission check:
    // Only the guest who reserved the song OR the room owner can control playback!
    const isSongOwner = currentSong.guest_session_id === session_id;
    const isRoomOwner = instance.owner_session_id === session_id;

    if (!isSongOwner && !isRoomOwner) {
      const singerName = currentSong.guest_name || 'the singer who reserved this song';
      return apiError(
        'UNAUTHORIZED_CONTROL',
        `Only ${singerName} can pause or play this song.`,
        403
      );
    }

    // 4. Broadcast realtime control event to TV and all remotes in room
    await broadcastRealtime(normalizedCode, 'playback_control', {
      type: 'playback_control',
      action,
      queue_item_id: currentSong.id,
      guest_session_id: session_id,
      guest_name: currentSong.guest_name,
      timestamp: new Date().toISOString(),
    });

    return apiSuccess({
      action,
      queue_item_id: currentSong.id,
      message: `Playback ${action}d successfully.`,
    });
  } catch (err: any) {
    console.error('[Queue Control API Error]:', err);
    return apiError('SERVER_ERROR', 'Internal server error.', 500);
  }
}
