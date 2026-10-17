// ============================================================
// OKEKARAOKE — POST /api/queue/reserve
// Atomically adds a song (by code or YouTube ID) to an instance queue
// ============================================================

import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { broadcastRealtime } from '@/lib/supabase/realtime';
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

    const cleanSongCode = song_code && song_code !== 'YT' ? String(song_code).trim() : null;
    const cleanYtId = !cleanSongCode && youtube_video_id ? String(youtube_video_id).trim() : null;

    // 1. Concurrently look up instance and existing song in 1 parallel network roundtrip
    const [instanceRes, existingSongRes] = await Promise.all([
      supabase
        .from('instances')
        .select('id')
        .ilike('room_code', normalizedCode)
        .eq('status', 'active')
        .maybeSingle(),
      cleanSongCode
        ? supabase
            .from('songs')
            .select('id, title, artist, code, youtube_video_id, thumbnail_url')
            .eq('code', cleanSongCode)
            .eq('is_active', true)
            .maybeSingle()
        : cleanYtId
        ? supabase
            .from('songs')
            .select('id, title, artist, code, youtube_video_id, thumbnail_url')
            .eq('youtube_video_id', cleanYtId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const instance = instanceRes.data;
    if (!instance) {
      return apiError('ROOM_NOT_FOUND', 'This OKEKARAOKE room does not exist or is no longer active.', 404);
    }

    // Auto-register/touch device session asynchronously in background without blocking reservation
    Promise.resolve(
      supabase.from('devices').upsert({
        instance_id: instance.id,
        device_type: 'remote',
        session_id: guest_session_id,
        device_name: guest_name ?? 'Guest',
        is_online: true,
        last_seen_at: new Date().toISOString(),
      }, { onConflict: 'instance_id,session_id' })
    ).catch(() => {});

    let song: { id: string; title: string; artist: string; code: string; youtube_video_id?: string; thumbnail_url?: string } | null = existingSongRes.data ?? null;

    // 2. If song not found yet but youtube_video_id provided, create or lookup
    if (!song && youtube_video_id) {
      const ytId = String(youtube_video_id).trim();
      // Generate a random unique song code
      const newCode = String(Math.floor(10000 + Math.random() * 90000));
      const rawTitle = title ? String(title) : 'YouTube Karaoke Track';
      const rawArtist = artist ? String(artist) : '';
      const { songTitle: cleanTitle, artist: cleanArtist } = extractArtistFromTitle(rawTitle, rawArtist);
      const { data: newSong, error: createError } = await supabase
        .from('songs')
        .insert({
          code: newCode,
          title: cleanTitle.slice(0, 200),
          artist: cleanArtist.slice(0, 200),
          youtube_video_id: ytId,
          thumbnail_url: thumbnail_url ?? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`,
          category: 'YouTube',
          language: 'Tagalog/English',
          song_type: 'Karaoke',
          duration_seconds: 240,
          is_active: true,
        })
        .select('id, title, artist, code, youtube_video_id, thumbnail_url')
        .maybeSingle();

      if (createError) {
        const { data: retryYt } = await supabase
          .from('songs')
          .select('id, title, artist, code, youtube_video_id, thumbnail_url')
          .eq('youtube_video_id', ytId)
          .maybeSingle();
        song = retryYt;
      } else {
        song = newSong;
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

    // 6.5 If no song is currently playing in this instance, auto-advance queue so the 1st song starts playing immediately
    const { data: playingSong } = await supabase
      .from('queue_items')
      .select('id')
      .eq('instance_id', instance.id)
      .eq('status', 'playing')
      .maybeSingle();

    let startedNow = false;
    let startedQueueItemId: string | null = null;

    if (!playingSong) {
      const { data: advanceResult } = await supabase.rpc('advance_queue_atomic', {
        p_instance_id: instance.id,
        p_completed_queue_item_id: null,
      });

      const advRow = Array.isArray(advanceResult) ? advanceResult[0] : advanceResult;
      if (advRow?.success && advRow.next_queue_item_id) {
        startedNow = true;
        startedQueueItemId = advRow.next_queue_item_id;
        // Broadcast song_started so TV & 1-Device phone receive it live & start video immediately
        await broadcastRealtime(normalizedCode, 'song_started', {
          type: 'song_started',
          instance_id: instance.id,
          room_code: normalizedCode,
          queue_item_id: advRow.next_queue_item_id,
          song_id: advRow.next_song_id || song.id,
          song_title: song.title,
          song_artist: song.artist,
          youtube_video_id: advRow.next_youtube_video_id || (song as any).youtube_video_id || youtube_video_id,
          thumbnail_url: (song as any).thumbnail_url || thumbnail_url,
          guest_name: advRow.next_guest_name || guest_name || 'Guest',
          guest_session_id: guest_session_id,
          position: advRow.next_position ?? 1,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // 7. Broadcast Realtime event to TV & all remotes with full details
    await broadcastRealtime(normalizedCode, 'queue_added', {
      type: 'queue_added',
      instance_id: instance.id,
      room_code: normalizedCode,
      queue_item_id: queueItemId,
      position: finalPosition,
      song_id: song.id,
      song_code: song.code,
      song_title: song.title,
      song_artist: song.artist,
      youtube_video_id: (song as any).youtube_video_id || youtube_video_id,
      thumbnail_url: (song as any).thumbnail_url || thumbnail_url,
      guest_name: guest_name ?? 'Guest',
      guest_session_id: guest_session_id,
      timestamp: new Date().toISOString(),
    });

    return apiSuccess({
      queue_item_id: queueItemId,
      position: finalPosition,
      started_now: startedNow,
      current_song: startedNow ? {
        queue_item_id: startedQueueItemId || queueItemId,
        instance_id: instance.id,
        guest_name: guest_name ?? 'Guest',
        guest_session_id: guest_session_id,
        position: 1,
        status: 'playing',
        started_at: new Date().toISOString(),
        reserved_at: new Date().toISOString(),
        song: {
          id: song.id,
          title: song.title,
          artist: song.artist,
          code: song.code,
          youtube_video_id: (song as any).youtube_video_id || youtube_video_id,
          thumbnail_url: (song as any).thumbnail_url || thumbnail_url || `https://img.youtube.com/vi/${(song as any).youtube_video_id || youtube_video_id}/mqdefault.jpg`,
          duration_seconds: 240,
          category: 'YouTube',
          language: 'Karaoke',
          is_active: true,
        },
      } : null,
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
    .replace(/[\(\[](karaoke( track| version| sing along)?|videoke|with lead vocals?|no lead vocals?|with lyrics?|sing along|instrumental)[\)\]]/gi, '')
    .replace(/[\|•·—–]\s*(karaoke( version| track)?|videoke|with lyrics?|sing along|instrumental)\s*$/gi, '')
    .replace(/\bkaraoke( version| track)?\b/gi, '')
    .replace(/\bvideoke\b/gi, '')
    .replace(/\bwith lyrics?\b/gi, '')
    .replace(/\bsing along\b/gi, '')
    .replace(/\blyric video\b/gi, '')
    .replace(/\(official.*?\)/gi, '')
    .replace(/\[official.*?\]/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/[\s\-|·•]+$/, '')
    .trim();

  // Standard YouTube Karaoke format: "Artist - Song Title"
  const dashIdx = clean.indexOf(' - ');
  if (dashIdx !== -1) {
    const leftPart  = clean.slice(0, dashIdx).trim();
    const rightPart = clean.slice(dashIdx + 3).trim();
    if (leftPart.length > 0 && rightPart.length > 0) {
      return { songTitle: rightPart, artist: leftPart };
    }
  }

  // "Artist | Song Title" pattern
  const pipeIdx = clean.indexOf(' | ');
  if (pipeIdx !== -1) {
    const leftPart  = clean.slice(0, pipeIdx).trim();
    const rightPart = clean.slice(pipeIdx + 3).trim();
    if (leftPart.length > 0 && rightPart.length > 0) {
      return { songTitle: rightPart, artist: leftPart };
    }
  }

  return { songTitle: clean || rawTitle, artist: channelTitle || 'YouTube' };
}
