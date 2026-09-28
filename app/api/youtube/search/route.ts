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
    const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
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

                  if (results.length >= 15) break;
                }
              }
            }
            if (results.length >= 15) break;
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

    return apiSuccess({ results });
  } catch (error) {
    console.error('Unexpected error in /api/youtube/search:', error);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred.', 500);
  }
}

