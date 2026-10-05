// ============================================================
// OKEKARAOKE — GET /api/songs/route.ts
// Lists songs with optional pagination (for admin)
// ============================================================

import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiSuccess, apiError } from '@/lib/utils/apiHelpers';

// Cache the song list for 5 minutes — the catalog rarely changes mid-session.
// Admins can force-refresh via the dashboard Refresh button.
// NOTE: POST (add song) is always dynamic and bypasses this cache.
export const revalidate = 300;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(1000, Math.max(1, parseInt(searchParams.get('limit') ?? '500', 10)));
    const offset = (page - 1) * limit;
    const includeInactive = searchParams.get('include_inactive') === 'true';

    const supabase = createAdminClient();

    let query = supabase
      .from('songs')
      .select('*', { count: 'exact' })
      .order('title', { ascending: true })
      .range(offset, offset + limit - 1);

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data: songs, error, count } = await query;

    if (error) {
      console.error('Songs list error:', error);
      return apiError('FETCH_FAILED', 'Failed to fetch songs.', 500);
    }

    return apiSuccess({
      songs: songs ?? [],
      total: count ?? 0,
      page,
      limit,
      total_pages: Math.ceil((count ?? 0) / limit),
    });
  } catch (error) {
    console.error('Unexpected error in /api/songs:', error);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred.', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return apiError('INVALID_BODY', 'Request body is required.', 400);
    }

    const { code, title, artist, youtube_video_id, thumbnail_url, category, language, song_type, keywords, duration_seconds } = body;

    if (!code || !title || !artist) {
      return apiError('MISSING_FIELDS', 'Code, title, and artist are required.', 400);
    }

    const supabase = createAdminClient();

    const { data: song, error } = await supabase
      .from('songs')
      .insert({
        code: code.toString().trim(),
        title: title.trim(),
        artist: artist.trim(),
        youtube_video_id: youtube_video_id ?? null,
        thumbnail_url: thumbnail_url ?? null,
        category: category ?? null,
        language: language ?? null,
        song_type: song_type ?? null,
        keywords: keywords ?? [],
        duration_seconds: duration_seconds ?? null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return apiError('DUPLICATE_CODE', 'A song with this code already exists.', 409);
      }
      console.error('Song create error:', error);
      return apiError('CREATE_FAILED', 'Failed to create song.', 500);
    }

    return apiSuccess({ song }, 201);
  } catch (error) {
    console.error('Unexpected error in POST /api/songs:', error);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred.', 500);
  }
}
