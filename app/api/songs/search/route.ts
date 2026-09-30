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

    // If no specific query is provided, return default active database catalog songs
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

            // ── Keep genuine karaoke/videoke tracks ───────────────────────────
            // Strategy: accept if the TITLE OR CHANNEL NAME contains a karaoke
            // indicator. Many top channels (Sing King, KaraFun, Zoom Karaoke)
            // put "karaoke" in their channel name, NOT the video title.
            // Still reject definitively non-karaoke content.
            const KARAOKE_TITLE = /karaoke|videoke|instrumental(?!\s*cover)|sing.?along|minus.?one/i;
            const KARAOKE_CHANNEL = /karaoke|videoke|sing\s*king|karafun|zoom\s*karaoke|sunfly|stingray|sound\s*choice|my\s*karaoke|pinoy\s*karaoke|opm\s*karaoke|sing2piano|mr\.?\s*karaoke/i;
            // Definitively NOT karaoke — drop these even if channel is karaoke
            const NOT_KARAOKE = /\bofficial\s*(music\s*)?video\b|\blive\s*(at|from|in|performance)\b|\bconcert\b/i;

            youtubeResults = ytJson.data.results
              .filter((y: any) => {
                if (existingVideoIds.has(y.video_id)) return false;
                // Reject clearly non-karaoke content
                if (NOT_KARAOKE.test(y.title)) return false;
                // Accept if title OR channel signals karaoke
                return KARAOKE_TITLE.test(y.title) || KARAOKE_CHANNEL.test(y.channel_title);
              })
              .map((y: any) => {
                const { songTitle, artist } = extractArtistFromTitle(y.title, y.channel_title);
                const song_type = detectSongType(y.title);
                return {
                  id: `yt_${y.video_id}`,
                  code: 'YT',
                  title: songTitle,
                  artist,
                  youtube_video_id: y.video_id,
                  thumbnail_url: y.thumbnail_url,
                  category: 'YouTube',
                  language: 'Tagalog/English',
                  song_type,
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
// Karaoke video titles follow different formats. We try multiple patterns in
// priority order to extract the real performing artist, not the channel name.
//
// Common patterns:
//   "Song Title - Artist (Karaoke Version)"
//   "Artist - Song Title | karaoke"
//   "Song Title | Artist | karaoke"
//   "Song - Artist (with lyrics)"
//   "Artist · Song Title karaoke"
//
function extractArtistFromTitle(
  rawTitle: string,
  channelTitle: string
): { songTitle: string; artist: string } {

  // ── Blocklist: known karaoke channel names that are NOT real artists
  const CHANNEL_BLOCKLIST = new Set([
    'karaoke', 'karaoke version', 'videoke', 'sing king', 'sing2piano',
    'stingray karaoke', 'zoom karaoke', 'sunfly karaoke', 'sound choice',
    'karafun', 'mr karaoke', 'karaoke hits', 'karaoke channel',
    'karaoke bar', 'my karaoke', 'best karaoke', 'top karaoke',
    'official karaoke', 'pinoy karaoke', 'opm karaoke', 'okekaraoke',
    'lyrics video', 'lyric video', 'official lyrics', 'official video',
    'music video', 'official music video', 'vevo', 'youtube',
    'hd karaoke', '4k karaoke', 'karaoke 4k', 'karaoke hd',
  ]);

  // ── Helper: is a string a plausible artist name?
  const isPlausibleArtist = (s: string) => {
    const lower = s.toLowerCase().trim();
    if (!s || s.length < 2 || s.length > 80) return false;
    if (CHANNEL_BLOCKLIST.has(lower)) return false;
    // Reject strings that are mostly numbers or punctuation
    if (/^\d+$/.test(s)) return false;
    return true;
  };

  // ── Step 1: Strip all karaoke/metadata suffixes from the title
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
    // Remove trailing punctuation left over after strip
    .replace(/[\s\-|·•]+$/, '')
    .trim();

  // ── Step 2: Try dash separator (" - ") ─────────────────────────────────────────
  // Standard format on YouTube is "Artist - Song Title".
  // Therefore, left = Artist, right = Song Title.
  {
    const parts = clean.split(' - ');
    if (parts.length >= 2) {
      const left = parts[0].trim();
      const right = parts.slice(1).join(' - ').trim();

      if (isPlausibleArtist(left) || isPlausibleArtist(right)) {
        // Standard YouTube format: Artist - Song Title
        return { songTitle: right, artist: left };
      }
    }
  }


  // ── Step 3: Try "Song | Artist" split (pipe separator)
  {
    const idx = clean.lastIndexOf(' | ');
    if (idx !== -1) {
      const right = clean.slice(idx + 3).trim();
      const left  = clean.slice(0, idx).trim();
      if (isPlausibleArtist(right) && left.length > 0) {
        return { songTitle: left, artist: right };
      }
    }
    // Also try first pipe for "Artist | Song"
    const firstPipe = clean.indexOf(' | ');
    if (firstPipe !== -1) {
      const left  = clean.slice(0, firstPipe).trim();
      const right = clean.slice(firstPipe + 3).trim();
      if (isPlausibleArtist(left) && right.length > 0) {
        return { songTitle: right, artist: left };
      }
    }
  }

  // ── Step 4: Try "Song · Artist" or "Song • Artist" (bullet/dot separators)
  {
    const bulletMatch = clean.match(/^(.+?)\s[·•]\s(.+)$/);
    if (bulletMatch) {
      const [, left, right] = bulletMatch;
      if (isPlausibleArtist(right) && left.length > 0) {
        return { songTitle: left.trim(), artist: right.trim() };
      }
    }
  }

  // ── Step 5: If the channel name is NOT a blocklisted karaoke channel,
  //    use it as the artist (it's often the band/artist's own channel)
  if (isPlausibleArtist(channelTitle)) {
    return { songTitle: clean || rawTitle, artist: channelTitle };
  }

  // ── Final fallback: just return the clean title, no artist
  return { songTitle: clean || rawTitle, artist: 'Various Artists' };
}

function detectSongType(rawTitle: string): string {
  const lower = rawTitle.toLowerCase();
  if (lower.includes('piano')) return 'Piano Karaoke';
  if (lower.includes('acoustic')) return 'Acoustic Karaoke';
  if (lower.includes('full band')) return 'Full Band Karaoke';
  if (lower.includes('instrumental')) return 'Instrumental';
  if (lower.includes('videoke')) return 'Videoke';
  if (lower.includes('hd karaoke') || lower.includes('hq karaoke')) return 'HD Karaoke';
  return 'Karaoke';
}
