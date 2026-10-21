// ============================================================
// OKEKARAOKE — GET /api/songs/thumbnail
// Fetches and converts YouTube video thumbnails to Base64 data URLs
// Enables saving thumbnails directly into client IndexedDB for 100% offline viewing
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = (searchParams.get('videoId') || '').trim();
    const customUrl = searchParams.get('url');

    const urlsToTry: string[] = [];
    if (customUrl) {
      urlsToTry.push(customUrl);
    }
    if (videoId) {
      urlsToTry.push(`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`);
      urlsToTry.push(`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`);
      urlsToTry.push(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`);
      urlsToTry.push(`https://img.youtube.com/vi/${videoId}/default.jpg`);
    }

    if (urlsToTry.length === 0) {
      return NextResponse.json({ error: 'Missing videoId or url parameter' }, { status: 400 });
    }

    let response: Response | null = null;
    for (const url of urlsToTry) {
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          },
          cache: 'force-cache',
        });
        if (res.ok) {
          response = res;
          break;
        }
      } catch {
        // try next url
      }
    }

    if (!response) {
      return NextResponse.json({ error: 'Thumbnail not found' }, { status: 404 });
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const dataUrl = `data:${contentType};base64,${base64}`;

    return NextResponse.json({
      dataUrl,
      sizeBytes: arrayBuffer.byteLength,
    });
  } catch (error: any) {
    console.error('Thumbnail fetch error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch thumbnail' }, { status: 500 });
  }
}
