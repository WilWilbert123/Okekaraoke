// ============================================================
// OKEKARAOKE — GET /api/songs/code/[code]
// Looks up a song by its numeric code
// ============================================================

import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiSuccess, apiError } from '@/lib/utils/apiHelpers';

interface RouteContext {
  params: Promise<{ code: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { code } = await context.params;

    if (!code || code.trim().length === 0) {
      return apiError('MISSING_CODE', 'Song code is required.', 400);
    }

    const supabase = createAdminClient();

    const { data: song, error } = await supabase
      .from('songs')
      .select('id, code, title, artist, youtube_video_id, thumbnail_url, category, language, song_type, duration_seconds')
      .eq('code', code.trim())
      .eq('is_active', true)
      .single();

    if (error || !song) {
      return apiError('SONG_NOT_FOUND', 'Song not found. Please check the song code.', 404);
    }

    return apiSuccess({ song });
  } catch (error) {
    console.error('Unexpected error in /api/songs/code/[code]:', error);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred.', 500);
  }
}
