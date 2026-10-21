// ============================================================
// OKEKARAOKE — GET /api/songs/download
// Downloads real YouTube Karaoke MP4 video + audio files
// Streams directly to client IndexedDB for 100% offline playback
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { Readable } from 'stream';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// Known ffmpeg location on Windows Python environment with fallback
const FFMPEG_PATH =
  'C:\\Users\\MIS-WILBERT\\AppData\\Local\\Programs\\Python\\Python310\\lib\\site-packages\\imageio_ffmpeg\\binaries\\ffmpeg-win-x86_64-v7.1.exe';

function runYtDlp(target: string, outputFile: string): Promise<boolean> {
  return new Promise((resolve) => {
    const args = [
      '-m',
      'yt_dlp',
      '--ffmpeg-location',
      FFMPEG_PATH,
      '-f',
      'bestvideo[height<=720]+bestaudio/best[height<=720]/best',
      '--merge-output-format',
      'mp4',
      '--no-playlist',
      '--socket-timeout',
      '20',
      '--retries',
      '3',
      '-o',
      outputFile,
      target,
    ];

    const child = spawn('python', args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    child.stderr?.on('data', (d) => {
      stderr += d.toString();
    });

    child.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputFile)) {
        resolve(true);
      } else {
        console.warn(`[yt-dlp] download failed for ${target} with code ${code}:`, stderr.slice(-300));
        resolve(false);
      }
    });

    child.on('error', (err) => {
      console.error('[yt-dlp] process spawn error:', err);
      resolve(false);
    });
  });
}

export async function GET(request: NextRequest) {
  const tempFile = path.join(
    os.tmpdir(),
    `okekaraoke_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.mp4`
  );

  try {
    const { searchParams } = new URL(request.url);
    const videoId = (searchParams.get('videoId') || '').trim();
    const songId = (searchParams.get('id') || '').trim();
    const title = (searchParams.get('title') || '').trim();
    const artist = (searchParams.get('artist') || '').trim();

    if (!videoId && !title) {
      return NextResponse.json({ error: 'Missing videoId or title' }, { status: 400 });
    }

    let success = false;

    // 1. First attempt: Direct YouTube video URL if videoId looks like valid YouTube ID
    if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      const directUrl = `https://www.youtube.com/watch?v=${videoId}`;
      success = await runYtDlp(directUrl, tempFile);
    }

    // 2. Second attempt / Fallback: Targeted karaoke search via ytsearch1
    if (!success) {
      const searchQuery = `ytsearch1:${title} ${artist} karaoke`.trim();
      success = await runYtDlp(searchQuery, tempFile);
    }

    if (!success || !fs.existsSync(tempFile)) {
      return NextResponse.json(
        { error: 'Failed to extract video stream from YouTube' },
        { status: 502 }
      );
    }

    const stat = fs.statSync(tempFile);
    const nodeStream = fs.createReadStream(tempFile);

    // Convert Node ReadStream to Web ReadableStream
    const webStream = new ReadableStream({
      start(controller) {
        nodeStream.on('data', (chunk) => controller.enqueue(chunk));
        nodeStream.on('end', () => {
          controller.close();
          // Clean up temp file on completion
          fs.unlink(tempFile, () => {});
        });
        nodeStream.on('error', (err) => {
          controller.error(err);
          fs.unlink(tempFile, () => {});
        });
      },
      cancel() {
        nodeStream.destroy();
        fs.unlink(tempFile, () => {});
      },
    });

    const safeFilename = encodeURIComponent((title || 'karaoke_song').replace(/[/\\?%*:|"<>]/g, '_'));

    return new Response(webStream, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': stat.size.toString(),
        'Content-Disposition': `attachment; filename="${safeFilename}.mp4"`,
        'Cache-Control': 'no-store, must-revalidate',
        'Accept-Ranges': 'bytes',
      },
    });
  } catch (error: any) {
    if (fs.existsSync(tempFile)) {
      fs.unlink(tempFile, () => {});
    }
    console.error('Download stream error:', error);
    return NextResponse.json({ error: error?.message || 'Download failed' }, { status: 500 });
  }
}
