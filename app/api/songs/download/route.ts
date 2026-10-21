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

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

let cachedFfmpegPath: string | null = null;
let cachedPythonCmd: string | null = null;

// Universal check to see if a command is installed on the host system (Linux, Mac, or Windows)
function isCommandAvailable(cmd: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const child = spawn(cmd, ['-version'], {
        windowsHide: true,
        stdio: 'ignore',
      });
      child.on('close', (code) => resolve(code === 0));
      child.on('error', () => resolve(false));
    } catch {
      resolve(false);
    }
  });
}

// Discover available python executable that has yt_dlp installed
async function getPythonExecutable(): Promise<string | null> {
  if (cachedPythonCmd) return cachedPythonCmd;

  const candidates = ['python', 'python3', 'py'];
  for (const cmd of candidates) {
    const works = await new Promise<boolean>((resolve) => {
      try {
        const child = spawn(cmd, ['-m', 'yt_dlp', '--version'], {
          windowsHide: true,
          stdio: 'ignore',
        });
        child.on('close', (code) => resolve(code === 0));
        child.on('error', () => resolve(false));
      } catch {
        resolve(false);
      }
    });

    if (works) {
      cachedPythonCmd = cmd;
      return cmd;
    }
  }

  return null;
}

// Universal dynamic ffmpeg binary locator without hardcoding user profile paths
async function getDynamicFfmpegPath(pythonCmd: string): Promise<string | null> {
  if (cachedFfmpegPath && fs.existsSync(cachedFfmpegPath)) {
    return cachedFfmpegPath;
  }

  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    cachedFfmpegPath = process.env.FFMPEG_PATH;
    return cachedFfmpegPath;
  }

  // 1. Query python's imageio_ffmpeg dynamically (works on all user accounts and operating systems)
  try {
    const pyPath = await new Promise<string | null>((resolve) => {
      const child = spawn(pythonCmd, ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      let out = '';
      child.stdout?.on('data', (d) => (out += d.toString()));
      child.on('close', (code) => {
        const trimmed = out.trim();
        if (code === 0 && trimmed && fs.existsSync(trimmed)) {
          resolve(trimmed);
        } else {
          resolve(null);
        }
      });
      child.on('error', () => resolve(null));
    });

    if (pyPath) {
      cachedFfmpegPath = pyPath;
      return pyPath;
    }
  } catch {}

  // 2. Check system PATH
  const inPath = await isCommandAvailable('ffmpeg');
  if (inPath) {
    cachedFfmpegPath = 'ffmpeg';
    return 'ffmpeg';
  }

  // 3. Check standard locations
  const standardLocations = [
    path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'ffmpeg', 'bin', 'ffmpeg.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'ffmpeg', 'bin', 'ffmpeg.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'ffmpeg', 'bin', 'ffmpeg.exe'),
    path.join(process.env.USERPROFILE || '', 'scoop', 'shims', 'ffmpeg.exe'),
    path.join(process.env.ALLUSERSPROFILE || '', 'chocolatey', 'bin', 'ffmpeg.exe'),
    '/usr/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
    '/opt/homebrew/bin/ffmpeg',
  ];

  for (const loc of standardLocations) {
    if (loc && fs.existsSync(loc)) {
      cachedFfmpegPath = loc;
      return loc;
    }
  }

  return null;
}

async function runYtDlp(target: string, outputFile: string): Promise<boolean> {
  const pythonCmd = await getPythonExecutable();
  if (!pythonCmd) {
    console.warn('[yt-dlp] Python with yt_dlp module is not available on host system.');
    return false;
  }

  const ffmpegLocation = await getDynamicFfmpegPath(pythonCmd);

  return new Promise((resolve) => {
    try {
      const args = [
        '-m',
        'yt_dlp',
        ...(ffmpegLocation ? ['--ffmpeg-location', ffmpegLocation] : []),
        '-f',
        ffmpegLocation
          ? 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720]/best'
          : 'best[height<=720][ext=mp4]/best[ext=mp4]/best',
        '--merge-output-format',
        'mp4',
        '--no-playlist',
        '--socket-timeout',
        '30',
        '--retries',
        '3',
        '-o',
        outputFile,
        target,
      ];

      const child = spawn(pythonCmd, args, {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderr = '';
      child.stderr?.on('data', (d) => {
        stderr += d.toString();
      });

      child.on('close', (code) => {
        if (code === 0 && fs.existsSync(outputFile)) {
          const stat = fs.statSync(outputFile);
          if (stat.size > 50000) {
            resolve(true);
            return;
          }
        }
        console.warn(`[yt-dlp] download failed for "${target}" (code ${code}):`, stderr.slice(-400));
        resolve(false);
      });

      child.on('error', (err) => {
        console.warn('[yt-dlp] process spawn error:', err.message);
        resolve(false);
      });
    } catch {
      resolve(false);
    }
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
    const title = (searchParams.get('title') || '').trim();
    const artist = (searchParams.get('artist') || '').trim();

    if (!videoId && !title) {
      return NextResponse.json({ error: 'Missing videoId or title parameter' }, { status: 400 });
    }

    let success = false;
    const pythonCmd = await getPythonExecutable();

    if (pythonCmd) {
      // 1. Direct YouTube video URL if videoId is valid
      if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
        const directUrl = `https://www.youtube.com/watch?v=${videoId}`;
        success = await runYtDlp(directUrl, tempFile);
      }

      // 2. Fallback: targeted search via ytsearch1
      if (!success && (title || artist)) {
        const searchQuery = `ytsearch1:${title} ${artist} karaoke`.trim();
        success = await runYtDlp(searchQuery, tempFile);
      }

      // 3. Fallback: title karaoke search
      if (!success && title) {
        const searchQuery = `ytsearch1:${title} karaoke`.trim();
        success = await runYtDlp(searchQuery, tempFile);
      }
    }

    // ── Delivery of Real MP4 Video + Audio ──
    if (success && fs.existsSync(tempFile)) {
      const stat = fs.statSync(tempFile);
      const nodeStream = fs.createReadStream(tempFile);

      const webStream = new ReadableStream({
        start(controller) {
          nodeStream.on('data', (chunk) => controller.enqueue(chunk));
          nodeStream.on('end', () => {
            controller.close();
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
    }

    // Never return fake/synthetic audio
    if (fs.existsSync(tempFile)) {
      fs.unlink(tempFile, () => {});
    }

    return NextResponse.json(
      {
        error: 'Failed to download authentic YouTube video. Please ensure the song is available and try again.',
      },
      { status: 502 }
    );
  } catch (error: any) {
    if (fs.existsSync(tempFile)) {
      fs.unlink(tempFile, () => {});
    }
    console.error('[Download API] Error:', error);

    return NextResponse.json(
      {
        error: error?.message || 'Server error while downloading karaoke video.',
      },
      { status: 500 }
    );
  }
}
