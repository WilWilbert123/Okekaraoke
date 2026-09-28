// ============================================================
// OKEKARAOKE — GET /api/songs/search
// Searches the song catalog by title, artist, code, or keywords
// ============================================================

import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiSuccess, apiError } from '@/lib/utils/apiHelpers';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim() ?? '';
    const category = searchParams.get('category') ?? '';
    const language = searchParams.get('language') ?? '';
    const song_type = searchParams.get('song_type') ?? '';
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const offset = (page - 1) * limit;

    if (!query && !category && !language && !song_type) {
      return apiError('MISSING_QUERY', 'At least one search parameter is required.', 400);
    }

    const supabase = createAdminClient();

    let dbQuery = supabase
      .from('songs')
      .select('id, code, title, artist, youtube_video_id, thumbnail_url, category, language, song_type, duration_seconds', { count: 'exact' })
      .eq('is_active', true)
      .order('title', { ascending: true })
      .range(offset, offset + limit - 1);

    // Search by text
    if (query) {
      // Search by code first (exact match)
      if (/^\d+$/.test(query)) {
        dbQuery = dbQuery.ilike('code', `%${query}%`);
      } else {
        // Full-text search on title and artist
        dbQuery = dbQuery.or(`title.ilike.%${query}%,artist.ilike.%${query}%`);
      }
    }

    if (category) dbQuery = dbQuery.eq('category', category);
    if (language) dbQuery = dbQuery.eq('language', language);
    if (song_type) dbQuery = dbQuery.eq('song_type', song_type);

    const { data: songs, error, count } = await dbQuery;

    if (error) {
      console.error('Song search error:', error);
      return apiError('SEARCH_FAILED', 'Song search failed. Please try again.', 500);
    }

    return apiSuccess({
      songs: songs ?? [],
      total: count ?? 0,
      page,
      limit,
      total_pages: Math.ceil((count ?? 0) / limit),
    });
  } catch (error) {
    console.error('Unexpected error in /api/songs/search:', error);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred.', 500);
  }
}
