// ============================================================
// OKEKARAOKE — POST /api/queue/reserve
// Atomically adds a song (by code or YouTube ID) to an instance queue
// ============================================================

import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiSuccess, apiError, validateRoomCode, validateSessionId } from '@/lib/utils/apiHelpers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { room_code, song_code, youtube_video_id, title, artist, thumbnail_url, guest_session_id, guest_name } = body;

    if (!room_code) {
      return apiError('MISSING_ROOM_CODE', 'Room code is required.', 400);
    }

    const normalizedCode = validateRoomCode(room_code);
    if (!normalizedCode) {
      return apiError('INVALID_ROOM_CODE', 'Invalid room code format.', 400);
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
      .maybeSingle();

    if (!instance) {
      return apiError('ROOM_NOT_FOUND', 'This OKEKARAOKE room does not exist or is no longer active.', 404);
    }

    // Verify device is associated with this instance
    const { data: device } = await supabase
      .from('devices')
      .select('id')
      .eq('instance_id', instance.id)
      .eq('session_id', guest_session_id)
      .maybeSingle();

    if (!device) {
      await supabase.from('devices').upsert({
        instance_id: instance.id,
        device_type: 'remote',
        session_id: guest_session_id,
        device_name: guest_name ?? 'Guest',
        is_online: true,
        last_seen_at: new Date().toISOString(),
      }, { onConflict: 'instance_id,session_id' });
    }

    let song: { id: string; title: string; artist: string; code: string } | null = null;

    // 1. Check by song_code if provided and not 'YT'
    if (song_code && song_code !== 'YT') {
      const { data: existingSong } = await supabase
        .from('songs')
        .select('id, title, artist, code')
        .eq('code', song_code.trim())
        .eq('is_active', true)
        .maybeSingle();
      song = existingSong;
    }

    // 2. Check by youtube_video_id or create new song if it's a YouTube search result
    if (!song && youtube_video_id) {
      const { data: existingYtSong } = await supabase
        .from('songs')
        .select('id, title, artist, code')
        .eq('youtube_video_id', youtube_video_id.trim())
        .maybeSingle();

      if (existingYtSong) {
        song = existingYtSong;
      } else {
        // Generate a unique 5-digit song code for the new YouTube song
        const newCode = 'YT' + String(Math.floor(1000 + Math.random() * 9000));
        const { data: newSong, error: createError } = await supabase
          .from('songs')
          .insert({
            code: newCode,
            title: title ?? 'YouTube Karaoke Track',
            artist: artist ?? 'YouTube',
            youtube_video_id: youtube_video_id.trim(),
            thumbnail_url: thumbnail_url ?? `https://img.youtube.com/vi/${youtube_video_id}/mqdefault.jpg`,
            category: 'YouTube',
            language: 'Tagalog/English',
            song_type: 'Karaoke',
            duration_seconds: 240,
            is_active: true,
          })
          .select('id, title, artist, code')
          .maybeSingle();

        if (createError) {
          console.error('Error creating YouTube song record:', createError);
          return apiError('SONG_CREATE_FAILED', 'Failed to prepare song for queue.', 500);
        }

        song = newSong;
      }
    }

    if (!song) {
      return apiError('SONG_NOT_FOUND', 'Song not found. Please check the song code or search again.', 404);
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
      song: { title: song.title, artist: song.artist, code: song.code },
    }, 201);
  } catch (error) {
    console.error('Unexpected error in /api/queue/reserve:', error);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred.', 500);
  }
}
