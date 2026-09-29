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

    // 1. Find active instance
    const { data: instance } = await supabase
      .from('instances')
      .select('id')
      .ilike('room_code', normalizedCode)
      .eq('status', 'active')
      .maybeSingle();

    if (!instance) {
      return apiError('ROOM_NOT_FOUND', 'This OKEKARAOKE room does not exist or is no longer active.', 404);
    }

    // 2. Verify or auto-register device
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

    // 3. Find song by song_code (if valid numeric code)
    if (song_code && song_code !== 'YT') {
      const { data: existingSong } = await supabase
        .from('songs')
        .select('id, title, artist, code')
        .eq('code', String(song_code).trim())
        .eq('is_active', true)
        .maybeSingle();
      song = existingSong;
    }

    // 4. Find or auto-create song by youtube_video_id
    if (!song && youtube_video_id) {
      const cleanYtId = String(youtube_video_id).trim();
      const { data: existingYtSong } = await supabase
        .from('songs')
        .select('id, title, artist, code')
        .eq('youtube_video_id', cleanYtId)
        .maybeSingle();

      if (existingYtSong) {
        song = existingYtSong;
      } else {
        // Generate a random unique song code
        const newCode = String(Math.floor(10000 + Math.random() * 90000));
        const rawTitle = title ? String(title) : 'YouTube Karaoke Track';
        const rawArtist = artist ? String(artist) : '';
        // Extract real artist from the video title; the passed-in artist is
        // often the YouTube channel name (e.g. "Sing King"), not the actual artist.
        const { songTitle: cleanTitle, artist: cleanArtist } = extractArtistFromTitle(rawTitle, rawArtist);
        const { data: newSong, error: createError } = await supabase
          .from('songs')
          .insert({
            code: newCode,
            title: cleanTitle.slice(0, 200),
            artist: cleanArtist.slice(0, 200),
            youtube_video_id: cleanYtId,
            thumbnail_url: thumbnail_url ?? `https://img.youtube.com/vi/${cleanYtId}/mqdefault.jpg`,
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
          // Retry lookup in case of race condition insert
          const { data: retryYt } = await supabase
            .from('songs')
            .select('id, title, artist, code')
            .eq('youtube_video_id', cleanYtId)
            .maybeSingle();
          song = retryYt;
        } else {
          song = newSong;
        }
      }
    }

    if (!song) {
      return apiError('SONG_NOT_FOUND', 'Song not found. Please try searching again.', 404);
    }

    let queueItemId: string | null = null;
    let finalPosition = 1;

    // 5. Attempt RPC reservation first
    const { data: result, error: rpcError } = await supabase.rpc('reserve_song_atomic', {
      p_instance_id: instance.id,
      p_song_id: song.id,
      p_guest_session_id: guest_session_id,
      p_guest_name: guest_name ?? null,
    });

    const resultRow = Array.isArray(result) ? result[0] : result;

    if (!rpcError && resultRow?.success) {
      queueItemId = resultRow.queue_item_id;
      finalPosition = resultRow.position;
    } else {
      // 6. Direct table insert fallback (if RPC function not installed or returned error)
      const { data: maxPosData } = await supabase
        .from('queue_items')
        .select('position')
        .eq('instance_id', instance.id)
        .in('status', ['queued', 'playing'])
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle();

      finalPosition = (maxPosData?.position ?? 0) + 1;

      const { data: queueItem, error: queueError } = await supabase
        .from('queue_items')
        .insert({
          instance_id: instance.id,
          song_id: song.id,
          guest_session_id: guest_session_id,
          guest_name: guest_name ?? 'Guest',
          position: finalPosition,
          status: 'queued',
          reserved_at: new Date().toISOString(),
        })
        .select('id, position')
        .single();

      if (queueError) {
        console.error('Direct queue insert error:', queueError);
        return apiError('RESERVATION_FAILED', 'Failed to add song to queue. Please try again.', 500);
      }

      queueItemId = queueItem.id;

      // Log reservation
      await supabase.from('reservation_logs').insert({
        instance_id: instance.id,
        queue_item_id: queueItemId,
        guest_session_id: guest_session_id,
        action: 'reserved',
        metadata: {
          song_id: song.id,
          song_title: song.title,
          song_artist: song.artist,
          position: finalPosition,
        },
      });
    }

    // 7. Broadcast Realtime event to TV
    await supabase.channel(`okekaraoke:instance:${normalizedCode}`).send({
      type: 'broadcast',
      event: 'queue_added',
      payload: {
        type: 'queue_added',
        instance_id: instance.id,
        room_code: normalizedCode,
        queue_item_id: queueItemId,
        position: finalPosition,
        song_title: song.title,
        song_artist: song.artist,
        guest_name: guest_name ?? null,
        timestamp: new Date().toISOString(),
      },
    });

    return apiSuccess({
      queue_item_id: queueItemId,
      position: finalPosition,
      song: { title: song.title, artist: song.artist, code: song.code },
    }, 201);
  } catch (error) {
    console.error('Unexpected error in /api/queue/reserve:', error);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred.', 500);
  }
}

// ─── Extract real artist from karaoke video title ────────────────────────────
function extractArtistFromTitle(
  rawTitle: string,
  channelTitle: string
): { songTitle: string; artist: string } {
  const clean = rawTitle
    .replace(/\(karaoke version\)/gi, '')
    .replace(/\[karaoke version\]/gi, '')
    .replace(/\(karaoke\)/gi, '')
    .replace(/\[karaoke\]/gi, '')
    .replace(/karaoke version/gi, '')
    .replace(/\(with lyrics?\)/gi, '')
    .replace(/\[with lyrics?\]/gi, '')
    .replace(/with lyrics?/gi, '')
    .replace(/\(instrumental\)/gi, '')
    .replace(/\(sing along\)/gi, '')
    .replace(/sing along/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // "Song - Artist" pattern
  const dashIdx = clean.lastIndexOf(' - ');
  if (dashIdx !== -1) {
    const possibleArtist = clean.slice(dashIdx + 3).trim();
    const possibleTitle  = clean.slice(0, dashIdx).trim();
    if (possibleArtist.length > 0 && possibleArtist.length <= 60) {
      return { songTitle: possibleTitle || rawTitle, artist: possibleArtist };
    }
  }

  // "Song | Artist" pattern
  const pipeIdx = clean.lastIndexOf(' | ');
  if (pipeIdx !== -1) {
    const possibleArtist = clean.slice(pipeIdx + 3).trim();
    const possibleTitle  = clean.slice(0, pipeIdx).trim();
    if (possibleArtist.length > 0 && possibleArtist.length <= 60) {
      return { songTitle: possibleTitle || rawTitle, artist: possibleArtist };
    }
  }

  return { songTitle: clean || rawTitle, artist: channelTitle || 'YouTube' };
}
