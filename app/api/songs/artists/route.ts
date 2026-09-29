// ============================================================
// OKEKARAOKE — GET /api/songs/artists
// Returns distinct artists A-Z with song count
// ?artist=<name> returns all songs by that artist
// ============================================================

import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiSuccess, apiError } from '@/lib/utils/apiHelpers';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const artist = searchParams.get('artist')?.trim() ?? '';

    const supabase = createAdminClient();

    // If artist param provided — return songs for that artist
    if (artist) {
      const { data: songs, error } = await supabase
        .from('songs')
        .select('id, code, title, artist, youtube_video_id, thumbnail_url, category, language, song_type, duration_seconds')
        .eq('is_active', true)
        .ilike('artist', artist)
        .order('title', { ascending: true });

      if (error) {
        console.error('Artist songs fetch error:', error);
        return apiError('FETCH_FAILED', 'Failed to fetch songs for artist.', 500);
      }

      return apiSuccess({ songs: songs ?? [] });
    }

    // Otherwise return distinct artists with song count, sorted A-Z
    const { data, error } = await supabase
      .from('songs')
      .select('artist')
      .eq('is_active', true)
      .order('artist', { ascending: true });

    if (error) {
      console.error('Artists fetch error:', error);
      return apiError('FETCH_FAILED', 'Failed to fetch artists.', 500);
    }

    // Aggregate counts client-side
    const artistMap = new Map<string, number>();
    for (const row of data ?? []) {
      if (row.artist) {
        const key = row.artist.trim();
        artistMap.set(key, (artistMap.get(key) ?? 0) + 1);
      }
    }

    const artists = Array.from(artistMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return apiSuccess({ artists });
  } catch (error) {
    console.error('Unexpected error in /api/songs/artists:', error);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred.', 500);
  }
}
