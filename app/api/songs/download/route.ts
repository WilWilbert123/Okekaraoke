// ============================================================
// OKEKARAOKE — GET /api/songs/download
// Downloads authentic YouTube Karaoke MP4 video + audio files
// Compatible with localhost, VPS, and cloud Vercel serverless deployments
// Streams directly to client IndexedDB for 100% offline playback
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs';
import https from 'https';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffmpegStatic = require('ffmpeg-static');

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

interface DownloaderConfig {
  cmd: string;
  prefixArgs: string[];
}

let cachedDownloader: DownloaderConfig | null = null;
let cachedFfmpegPath: string | null = null;

// Universal check to see if a command is executable on the host
function testSpawn(cmd: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const child = spawn(cmd, args, {
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

// Download standalone yt-dlp binary on-demand (for Vercel serverless / Linux cloud environments)
function downloadStandaloneBinary(targetPath: string): Promise<boolean> {
  const isWin = process.platform === 'win32';
  const binName = isWin ? 'yt-dlp.exe' : 'yt-dlp';
  const downloadUrl = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${binName}`;

  function fetchUrl(url: string, redirects = 0): Promise<boolean> {
    if (redirects > 5) return Promise.resolve(false);
    return new Promise((resolve) => {
      https
        .get(url, (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return resolve(fetchUrl(res.headers.location, redirects + 1));
          }
          if (res.statusCode !== 200) {
            return resolve(false);
          }

          const fileStream = fs.createWriteStream(targetPath);
          res.pipe(fileStream);
          fileStream.on('finish', () => {
            fileStream.close();
            try {
              fs.chmodSync(targetPath, 0o755);
            } catch {}
            resolve(true);
          });
          fileStream.on('error', () => {
            try {
              fs.unlinkSync(targetPath);
            } catch {}
            resolve(false);
          });
        })
        .on('error', () => resolve(false));
    });
  }

  return fetchUrl(downloadUrl);
}

// Discover available yt-dlp binary or python module
async function getDownloader(): Promise<DownloaderConfig | null> {
  if (cachedDownloader) return cachedDownloader;

  const localAppData = process.env.LOCALAPPDATA || '';
  const userProfile = process.env.USERPROFILE || '';
  const cwd = process.cwd();

  // 1. Direct standalone/scripts yt-dlp executable
  const directCandidates = [
    'yt-dlp',
    path.join(cwd, 'bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'),
    path.join(localAppData, 'Programs', 'Python', 'Python310', 'Scripts', 'yt-dlp.exe'),
    path.join(userProfile, 'AppData', 'Local', 'Programs', 'Python', 'Python310', 'Scripts', 'yt-dlp.exe'),
    path.join(localAppData, 'Programs', 'Python', 'Python311', 'Scripts', 'yt-dlp.exe'),
    path.join(localAppData, 'Programs', 'Python', 'Python312', 'Scripts', 'yt-dlp.exe'),
    path.join(localAppData, 'Programs', 'yt-dlp', 'yt-dlp.exe'),
    '/usr/local/bin/yt-dlp',
    '/usr/bin/yt-dlp',
    path.join(os.tmpdir(), process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'),
  ];

  for (const candidate of directCandidates) {
    if (candidate.includes(path.sep) && !fs.existsSync(candidate)) continue;
    const ok = await testSpawn(candidate, ['--version']);
    if (ok) {
      cachedDownloader = { cmd: candidate, prefixArgs: [] };
      return cachedDownloader;
    }
  }

  // 2. Python module candidates (python -m yt_dlp)
  const pyCandidates = [
    'python',
    path.join(localAppData, 'Programs', 'Python', 'Python310', 'python.exe'),
    path.join(userProfile, 'AppData', 'Local', 'Programs', 'Python', 'Python310', 'python.exe'),
    'py',
    'python3',
  ];

  for (const py of pyCandidates) {
    if (py.includes(path.sep) && !fs.existsSync(py)) continue;
    const ok = await testSpawn(py, ['-m', 'yt_dlp', '--version']);
    if (ok) {
      cachedDownloader = { cmd: py, prefixArgs: ['-m', 'yt_dlp'] };
      return cachedDownloader;
    }
  }

  // 3. Fallback: On cloud serverless environments (like Vercel / AWS Lambda),
  // acquire the standalone binary into /tmp on-demand
  const tmpBinaryPath = path.join(os.tmpdir(), process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
  if (!fs.existsSync(tmpBinaryPath)) {
    const downloaded = await downloadStandaloneBinary(tmpBinaryPath);
    if (downloaded && fs.existsSync(tmpBinaryPath)) {
      const ok = await testSpawn(tmpBinaryPath, ['--version']);
      if (ok) {
        cachedDownloader = { cmd: tmpBinaryPath, prefixArgs: [] };
        return cachedDownloader;
      }
    }
  } else {
    const ok = await testSpawn(tmpBinaryPath, ['--version']);
    if (ok) {
      cachedDownloader = { cmd: tmpBinaryPath, prefixArgs: [] };
      return cachedDownloader;
    }
  }

  return null;
}

// Universal dynamic ffmpeg binary locator
async function getDynamicFfmpegPath(): Promise<string | null> {
  if (cachedFfmpegPath && fs.existsSync(cachedFfmpegPath)) {
    return cachedFfmpegPath;
  }

  // 1. ffmpeg-static npm package (universal: Windows, Linux/Vercel, macOS)
  if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
    cachedFfmpegPath = ffmpegStatic;
    return cachedFfmpegPath;
  }

  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    cachedFfmpegPath = process.env.FFMPEG_PATH;
    return cachedFfmpegPath;
  }

  const localAppData = process.env.LOCALAPPDATA || '';
  const userProfile = process.env.USERPROFILE || '';

  const candidates = [
    // Python Scripts ffmpeg
    path.join(localAppData, 'Programs', 'Python', 'Python310', 'Scripts', 'ffmpeg.exe'),
    path.join(userProfile, 'AppData', 'Local', 'Programs', 'Python', 'Python310', 'Scripts', 'ffmpeg.exe'),
    // imageio_ffmpeg binaries
    path.join(localAppData, 'Programs', 'Python', 'Python310', 'lib', 'site-packages', 'imageio_ffmpeg', 'binaries', 'ffmpeg.exe'),
    path.join(localAppData, 'Programs', 'Python', 'Python310', 'lib', 'site-packages', 'imageio_ffmpeg', 'binaries', 'ffmpeg-win-x86_64-v7.1.exe'),
    path.join(userProfile, 'AppData', 'Local', 'Programs', 'Python', 'Python310', 'lib', 'site-packages', 'imageio_ffmpeg', 'binaries', 'ffmpeg.exe'),
    path.join(userProfile, 'AppData', 'Local', 'Programs', 'Python', 'Python310', 'lib', 'site-packages', 'imageio_ffmpeg', 'binaries', 'ffmpeg-win-x86_64-v7.1.exe'),
    // System locations
    path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'ffmpeg', 'bin', 'ffmpeg.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'ffmpeg', 'bin', 'ffmpeg.exe'),
    path.join(localAppData, 'Programs', 'ffmpeg', 'bin', 'ffmpeg.exe'),
    path.join(userProfile, 'scoop', 'shims', 'ffmpeg.exe'),
    path.join(process.env.ALLUSERSPROFILE || '', 'chocolatey', 'bin', 'ffmpeg.exe'),
    '/usr/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
    '/opt/homebrew/bin/ffmpeg',
  ];

  for (const loc of candidates) {
    if (loc && fs.existsSync(loc)) {
      cachedFfmpegPath = loc;
      return loc;
    }
  }

  // Test ffmpeg directly in system PATH
  if (await testSpawn('ffmpeg', ['-version'])) {
    cachedFfmpegPath = 'ffmpeg';
    return 'ffmpeg';
  }

  return null;
}

// Clean any leftover temporary files or parts
function cleanupTempFiles(baseFilePath: string) {
  try {
    if (fs.existsSync(baseFilePath)) {
      fs.unlinkSync(baseFilePath);
    }
  } catch {}

  try {
    const dir = path.dirname(baseFilePath);
    const baseName = path.basename(baseFilePath);
    const files = fs.readdirSync(dir);
    for (const f of files) {
      if (f.startsWith(baseName)) {
        try {
          fs.unlinkSync(path.join(dir, f));
        } catch {}
      }
    }
  } catch {}
}

async function runYtDlp(target: string, outputFile: string): Promise<boolean> {
  const downloader = await getDownloader();
  if (!downloader) {
    console.warn('[yt-dlp] Neither yt-dlp nor python with yt_dlp module is available on host system.');
    return false;
  }

  const ffmpegLocation = await getDynamicFfmpegPath();
  const nodeExecutable = process.execPath || 'node';

  return new Promise((resolve) => {
    try {
      const args = [
        ...downloader.prefixArgs,
        ...(ffmpegLocation ? ['--ffmpeg-location', ffmpegLocation] : []),
        '--js-runtimes',
        `node:${nodeExecutable}`,
        '-f',
        ffmpegLocation
          ? 'bestvideo[height<=720][vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720]/best'
          : 'best[height<=720][ext=mp4]/best[ext=mp4]/best',
        '--merge-output-format',
        'mp4',
        '--no-playlist',
        '--socket-timeout',
        '25',
        '--retries',
        '2',
        '--no-part',
        '-o',
        outputFile,
        target,
      ];

      const child = spawn(downloader.cmd, args, {
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
        console.warn(`[yt-dlp] download failed for "${target}" (code ${code}):`, stderr.slice(-300));
        cleanupTempFiles(outputFile);
        resolve(false);
      });

      child.on('error', (err) => {
        console.warn('[yt-dlp] process spawn error:', err.message);
        cleanupTempFiles(outputFile);
        resolve(false);
      });
    } catch {
      cleanupTempFiles(outputFile);
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

    const downloader = await getDownloader();
    if (!downloader) {
      return NextResponse.json(
        { error: 'YouTube downloader engine is initializing or not available on server.' },
        { status: 503 }
      );
    }

    // Clean videoId: strip 'yt_' prefix or extract ID from full URL
    let cleanVideoId = videoId.replace(/^yt_/, '').trim();
    const urlMatch = cleanVideoId.match(/(?:youtu\.be\/|v=|\/embed\/|\/v\/|\/shorts\/)([a-zA-Z0-9_-]{11})/);
    if (urlMatch) {
      cleanVideoId = urlMatch[1];
    }
    const hasValidVideoId = /^[a-zA-Z0-9_-]{11}$/.test(cleanVideoId);

    // Build prioritized targets to guarantee authentic video retrieval
    const targetsToTry: string[] = [];

    // 1. Direct YouTube video URL if ID is present
    if (hasValidVideoId) {
      targetsToTry.push(`https://www.youtube.com/watch?v=${cleanVideoId}`);
    }

    // Clean title and artist to avoid clutter in search
    const cleanTitle = title
      .replace(/\(videoke\s*track\)|\(karaoke\)|\(instrumental\)|\(with\s*lyrics\)/gi, '')
      .trim();
    const cleanArtist = artist.replace(/^youtube$/i, '').trim();

    // 2. High-accuracy karaoke search fallbacks if direct ID is unavailable / blocked
    if (cleanTitle && cleanArtist) {
      targetsToTry.push(`ytsearch1:${cleanTitle} ${cleanArtist} karaoke`);
      targetsToTry.push(`ytsearch1:${cleanTitle} ${cleanArtist} videoke`);
    }
    if (cleanTitle) {
      targetsToTry.push(`ytsearch1:${cleanTitle} karaoke`);
    }
    if (cleanTitle && cleanArtist) {
      targetsToTry.push(`ytsearch1:${cleanTitle} ${cleanArtist}`);
    } else if (cleanTitle) {
      targetsToTry.push(`ytsearch1:${cleanTitle}`);
    }

    let success = false;
    for (const target of targetsToTry) {
      success = await runYtDlp(target, tempFile);
      if (success && fs.existsSync(tempFile)) {
        const stat = fs.statSync(tempFile);
        if (stat.size > 50000) {
          break;
        }
      }
      cleanupTempFiles(tempFile);
      success = false;
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
            cleanupTempFiles(tempFile);
          });
          nodeStream.on('error', (err) => {
            controller.error(err);
            cleanupTempFiles(tempFile);
          });
        },
        cancel() {
          nodeStream.destroy();
          cleanupTempFiles(tempFile);
        },
      });

      const safeFilename = encodeURIComponent(
        (cleanTitle || title || 'karaoke_song').replace(/[/\\?%*:|"<>]/g, '_')
      );

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

    cleanupTempFiles(tempFile);

    return NextResponse.json(
      {
        error: 'Failed to download authentic YouTube video. Please ensure the song is available and try again.',
      },
      { status: 502 }
    );
  } catch (error: any) {
    cleanupTempFiles(tempFile);
    console.error('[Download API] Error:', error);

    return NextResponse.json(
      {
        error: error?.message || 'Server error while downloading karaoke video.',
      },
      { status: 500 }
    );
  }
}
