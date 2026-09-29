// ============================================================
// OKEKARAOKE — GET /api/songs/search
// Searches both database catalog and live YouTube for karaoke tracks
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

    // 1. Search local Supabase database table
    let dbQuery = supabase
      .from('songs')
      .select('id, code, title, artist, youtube_video_id, thumbnail_url, category, language, song_type, duration_seconds', { count: 'exact' })
      .eq('is_active', true)
      .order('title', { ascending: true })
      .range(offset, offset + limit - 1);

    if (query) {
      if (/^\d+$/.test(query)) {
        dbQuery = dbQuery.ilike('code', `%${query}%`);
      } else {
        dbQuery = dbQuery.or(`title.ilike.%${query}%,artist.ilike.%${query}%`);
      }
    }

    if (category) dbQuery = dbQuery.eq('category', category);
    if (language) dbQuery = dbQuery.eq('language', language);
    if (song_type) dbQuery = dbQuery.eq('song_type', song_type);

    const { data: dbSongs } = await dbQuery;
    const localSongs = dbSongs ?? [];

    // 2. If query exists and it's not a numeric code search, fetch YouTube results
    let youtubeResults: any[] = [];
    if (query && !/^\d+$/.test(query)) {
      try {
        const origin = request.headers.get('origin') || request.nextUrl.origin;
        const ytRes = await fetch(`${origin}/api/youtube/search?q=${encodeURIComponent(query)}`, {
          cache: 'no-store',
        });
        if (ytRes.ok) {
          const ytJson = await ytRes.json();
          if (ytJson.success && Array.isArray(ytJson.data?.results)) {
            // Filter out video IDs already in local database
            const existingVideoIds = new Set(localSongs.map((s) => s.youtube_video_id));

            youtubeResults = ytJson.data.results
              .filter((y: any) => !existingVideoIds.has(y.video_id))
              .map((y: any) => {
                const { songTitle, artist } = extractArtistFromTitle(y.title, y.channel_title);
                return {
                  id: `yt_${y.video_id}`,
                  code: 'YT',
                  title: songTitle,
                  artist,
                  youtube_video_id: y.video_id,
                  thumbnail_url: y.thumbnail_url,
                  category: 'YouTube',
                  language: 'Tagalog/English',
                  song_type: 'Karaoke',
                  duration_seconds: 240,
                  is_youtube_result: true,
                };
              });
          }
        }
      } catch (err) {
        console.error('YouTube search fallback error:', err);
      }
    }

    const combinedSongs = [...localSongs, ...youtubeResults];

    return apiSuccess({
      songs: combinedSongs,
      total: combinedSongs.length,
      page,
      limit,
      total_pages: 1,
    });
  } catch (error) {
    console.error('Unexpected error in /api/songs/search:', error);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred.', 500);
  }
}

// ─── Extract real artist from karaoke video title ────────────────────────────
// Most karaoke titles follow: "Song Title - Artist (Karaoke Version)"
// We parse out the actual artist rather than using the YouTube channel name.
function extractArtistFromTitle(
  rawTitle: string,
  channelTitle: string
): { songTitle: string; artist: string } {
  // Strip common karaoke/version suffixes
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

  // Pattern: "Song - Artist" (split on last " - ")
  const dashIdx = clean.lastIndexOf(' - ');
  if (dashIdx !== -1) {
    const possibleArtist = clean.slice(dashIdx + 3).trim();
    const possibleTitle  = clean.slice(0, dashIdx).trim();
    // Accept as artist if it's reasonable length and not empty
    if (possibleArtist.length > 0 && possibleArtist.length <= 60) {
      return { songTitle: possibleTitle || rawTitle, artist: possibleArtist };
    }
  }

  // Pattern: "Song | Artist" (split on " | ")
  const pipeIdx = clean.lastIndexOf(' | ');
  if (pipeIdx !== -1) {
    const possibleArtist = clean.slice(pipeIdx + 3).trim();
    const possibleTitle  = clean.slice(0, pipeIdx).trim();
    if (possibleArtist.length > 0 && possibleArtist.length <= 60) {
      return { songTitle: possibleTitle || rawTitle, artist: possibleArtist };
    }
  }

  // Fall back to clean title + channel name (better than nothing)
  return { songTitle: clean || rawTitle, artist: channelTitle ?? 'YouTube' };
}
