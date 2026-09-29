// ============================================================
// OKEKARAOKE — GET /api/youtube/search
// Keyless YouTube search parsing directly from YouTube search results
// ============================================================

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/utils/apiHelpers';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let query = searchParams.get('q')?.trim() ?? '';

    if (!query) {
      return apiError('MISSING_QUERY', 'Search query is required.', 400);
    }

    // Append 'karaoke' or 'videoke' if not present to prioritize karaoke tracks
    const searchQuery = /karaoke|videoke|instrumental|sing along/i.test(query)
      ? query
      : `${query} karaoke`;

    // Fetch public search page HTML from YouTube
    // sp=EgIQAQ%3D%3D filters to videos only (no playlists, channels, shorts)
    const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}&sp=EgIQAQ%3D%3D`;
    const response = await fetch(ytUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      next: { revalidate: 300 }, // Cache search results for 5 minutes
    });

    if (!response.ok) {
      return apiError('YOUTUBE_FETCH_ERROR', 'Failed to fetch YouTube search page.', 502);
    }

    const html = await response.text();
    
    // Extract ytInitialData JSON object from YouTube response
    const jsonMatch = html.match(/var ytInitialData = ({[\s\S]*?});<\/script>/) ||
                      html.match(/window\["ytInitialData"\] = ({[\s\S]*?});/);

    const results: Array<{
      video_id: string;
      title: string;
      channel_title: string;
      thumbnail_url: string;
      duration?: string;
    }> = [];

    if (jsonMatch && jsonMatch[1]) {
      try {
        const data = JSON.parse(jsonMatch[1]);
        const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
        
        if (Array.isArray(contents)) {
          for (const section of contents) {
            const items = section?.itemSectionRenderer?.contents;
            if (Array.isArray(items)) {
              for (const item of items) {
                const video = item?.videoRenderer;
                if (video && video.videoId) {
                  const videoId = video.videoId;
                  const title = video.title?.runs?.[0]?.text ?? 'Unknown Title';
                  const channelTitle = video.ownerText?.runs?.[0]?.text ?? 'YouTube';
                  const thumbnail = video.thumbnail?.thumbnails?.slice(-1)?.[0]?.url ?? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
                  const duration = video.lengthText?.simpleText ?? '';

                  results.push({
                    video_id: videoId,
                    title,
                    channel_title: channelTitle,
                    thumbnail_url: thumbnail,
                    duration,
                  });

                  if (results.length >= 20) break;
                }
              }
            }
            if (results.length >= 20) break;
          }
        }
      } catch (e) {
        console.error('Error parsing ytInitialData JSON:', e);
      }
    }

    // Fallback: parse video ID links regex if ytInitialData parsing failed
    if (results.length === 0) {
      const videoRegex = /\/watch\?v=([a-zA-Z0-9_-]{11})/g;
      const seenIds = new Set<string>();
      let match;

      while ((match = videoRegex.exec(html)) !== null && results.length < 15) {
        const videoId = match[1];
        if (!seenIds.has(videoId)) {
          seenIds.add(videoId);
          results.push({
            video_id: videoId,
            title: `${query} (Videoke Track)`,
            channel_title: 'YouTube',
            thumbnail_url: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
          });
        }
      }
    }

    // Filter out videos that have embedding disabled using YouTube's free oEmbed API.
    // oEmbed returns 401 for embed-disabled videos — no API key required.
    const embeddableResults = await filterEmbeddable(results);

    return apiSuccess({ results: embeddableResults });
  } catch (error) {
    console.error('Unexpected error in /api/youtube/search:', error);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred.', 500);
  }
}

// ─── Embeddability filter ────────────────────────────────────────────────────
// YouTube's oEmbed endpoint returns 401 when a video has embedding disabled.
// We check all results in parallel and drop any that are blocked.
async function filterEmbeddable(
  results: Array<{ video_id: string; title: string; channel_title: string; thumbnail_url: string; duration?: string }>
) {
  if (results.length === 0) return results;

  const checks = await Promise.allSettled(
    results.map(async (result) => {
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${result.video_id}&format=json`;
      const res = await fetch(oembedUrl, {
        // Short timeout — we don't want slow checks to delay search results
        signal: AbortSignal.timeout(4000),
        next: { revalidate: 3600 }, // Cache embeddability for 1 hour
      });
      // 200 = embeddable, 401 = embedding disabled, 404 = video doesn't exist
      return { result, embeddable: res.ok };
    })
  );

  return checks
    .filter((outcome) => outcome.status === 'fulfilled' && outcome.value.embeddable)
    .map((outcome) => (outcome as PromiseFulfilledResult<{ result: typeof results[0]; embeddable: boolean }>).value.result);
}

