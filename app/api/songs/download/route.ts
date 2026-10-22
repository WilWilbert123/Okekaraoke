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
// NOTE: on Linux we MUST use the self-contained PyInstaller build (yt-dlp_linux).
// The plain `yt-dlp` asset is a Python zipapp and fails on Vercel (no python3 installed).
function standaloneBinName(): string {
  if (process.platform === 'win32') return 'yt-dlp.exe';
  if (process.platform === 'darwin') return 'yt-dlp_macos';
  return process.arch === 'arm64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux';
}

function downloadStandaloneBinary(targetPath: string): Promise<boolean> {
  const binName = standaloneBinName();
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
            console.error('[yt-dlp] Binary download HTTP status:', res.statusCode, url);
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
        .on('error', (e) => {
          console.error('[yt-dlp] Binary download network error:', e.message);
          resolve(false);
        });
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
    path.join(os.tmpdir(), standaloneBinName()),
  ];

  for (const candidate of directCandidates) {
    if (candidate.includes(path.sep) && !fs.existsSync(/*turbopackIgnore: true*/ candidate)) continue;
    const ok = await testSpawn(candidate, ['--version']);
    if (ok) {
      console.log('[yt-dlp] Found working candidate:', candidate);
      cachedDownloader = { cmd: candidate, prefixArgs: [] };
      return cachedDownloader;
    } else {
      console.log('[yt-dlp] Candidate not working:', candidate);
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
    if (py.includes(path.sep) && !fs.existsSync(/*turbopackIgnore: true*/ py)) continue;
    console.log('[yt-dlp] Trying python module candidate:', py);
    const ok = await testSpawn(py, ['-m', 'yt_dlp', '--version']);
    if (ok) {
      console.log('[yt-dlp] Found python module:', py);
      cachedDownloader = { cmd: py, prefixArgs: ['-m', 'yt_dlp'] };
      return cachedDownloader;
    } else {
      console.log('[yt-dlp] Python module not working:', py);
    }
  }

  // 3. Fallback: On cloud serverless environments (like Vercel / AWS Lambda),
  // acquire the standalone binary into /tmp on-demand
  const tmpBinaryPath = path.join(os.tmpdir(), standaloneBinName());
  console.log('[yt-dlp] Attempting standalone binary fallback at:', tmpBinaryPath);
  if (!fs.existsSync(tmpBinaryPath)) {
    console.log('[yt-dlp] Binary not found in /tmp — downloading from GitHub...');
    const downloaded = await downloadStandaloneBinary(tmpBinaryPath);
    console.log('[yt-dlp] Binary download result:', downloaded, '| Exists after:', fs.existsSync(tmpBinaryPath));
    if (downloaded && fs.existsSync(tmpBinaryPath)) {
      const ok = await testSpawn(tmpBinaryPath, ['--version']);
      console.log('[yt-dlp] Standalone binary version test result:', ok);
      if (ok) {
        cachedDownloader = { cmd: tmpBinaryPath, prefixArgs: [] };
        return cachedDownloader;
      }
    }
  } else {
    console.log('[yt-dlp] Found existing binary in /tmp, testing...');
    const ok = await testSpawn(tmpBinaryPath, ['--version']);
    console.log('[yt-dlp] Existing /tmp binary version test result:', ok);
    if (ok) {
      cachedDownloader = { cmd: tmpBinaryPath, prefixArgs: [] };
      return cachedDownloader;
    }
  }

  console.error('[yt-dlp] All candidates exhausted — no working yt-dlp found on this host.');
  return null;
}

// Universal dynamic ffmpeg binary locator
async function getDynamicFfmpegPath(): Promise<string | null> {
  if (cachedFfmpegPath && fs.existsSync(/*turbopackIgnore: true*/ cachedFfmpegPath)) {
    return cachedFfmpegPath;
  }

  // 1. ffmpeg-static npm package (universal: Windows, Linux/Vercel, macOS)
  try {
    // Dynamic require so Turbopack does not fail build if ffmpeg-static binary is absent
    const req = eval('require');
    const staticPkg = req('ffmpeg-static');
    const staticPath = typeof staticPkg === 'string' ? staticPkg : staticPkg?.default;
    if (staticPath && fs.existsSync(/*turbopackIgnore: true*/ staticPath)) {
      cachedFfmpegPath = staticPath;
      return cachedFfmpegPath;
    }
  } catch {
    // ffmpeg-static not available or install script skipped
  }

  if (process.env.FFMPEG_PATH && fs.existsSync(/*turbopackIgnore: true*/ process.env.FFMPEG_PATH)) {
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

let lastYtDlpError = '';

// Optional: YouTube blocks most datacenter IPs (Vercel) with "Sign in to confirm you're not a bot".
// Set env YTDLP_COOKIES to the contents of a Netscape cookies.txt exported from a logged-in browser.
function getCookiesFile(): string | null {
  const raw = process.env.YTDLP_COOKIES;
  if (!raw) return null;
  const p = path.join(os.tmpdir(), 'okekaraoke_yt_cookies.txt');
  try {
    if (!fs.existsSync(p)) fs.writeFileSync(p, raw.replace(/\\n/g, '\n'));
    return p;
  } catch {
    return null;
  }
}

async function runYtDlp(target: string, outputFile: string): Promise<boolean> {
  const downloader = await getDownloader();
  if (!downloader) {
    console.warn('[yt-dlp] Neither yt-dlp nor python with yt_dlp module is available on host system.');
    lastYtDlpError = 'yt-dlp not available';
    return false;
  }
  const cookiesFile = getCookiesFile();

  const ffmpegLocation = await getDynamicFfmpegPath();
  const nodeExecutable = process.execPath || 'node';
  console.log(`[yt-dlp] Using downloader: ${downloader.cmd} ${downloader.prefixArgs.join(' ')}`);
  console.log(`[yt-dlp] ffmpeg location: ${ffmpegLocation || 'not found — using best[ext=mp4] fallback'}`);
  console.log(`[yt-dlp] Target: ${target}`);
  console.log(`[yt-dlp] Output: ${outputFile}`);

  return new Promise((resolve) => {
    try {
      const args = [
        ...downloader.prefixArgs,
        ...(ffmpegLocation ? ['--ffmpeg-location', ffmpegLocation] : []),
        ...(cookiesFile ? ['--cookies', cookiesFile] : []),
        '--no-cache-dir',
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
        console.warn(`[yt-dlp] download failed for "${target}" (code ${code}). Full stderr:`, stderr);
        lastYtDlpError = (stderr.split('\n').filter((l) => /ERROR|WARNING/i.test(l)).slice(-3).join(' | ') || stderr.slice(-400) || `exit code ${code}`).trim();
        cleanupTempFiles(outputFile);
        resolve(false);
      });

      child.on('error', (err) => {
        console.warn('[yt-dlp] process spawn error:', err.message);
        lastYtDlpError = `spawn error: ${err.message}`;
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
      const diagInfo = {
        platform: process.platform,
        arch: process.arch,
        tmpdir: os.tmpdir(),
        cwd: process.cwd(),
        PATH: process.env.PATH || '(not set)',
        nodeVersion: process.version,
      };
      console.error('[yt-dlp] Download engine unavailable. Environment info:', JSON.stringify(diagInfo));
      return NextResponse.json(
        {
          error: 'YouTube downloader engine is not available on this server.',
          details: `Platform: ${process.platform}/${process.arch}, tmpdir: ${os.tmpdir()}. yt-dlp binary could not be found or downloaded. Check server logs for details.`,
        },
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
        details: `yt-dlp: ${lastYtDlpError || 'unknown error'} (host ${process.platform}/${process.arch}, cookies: ${process.env.YTDLP_COOKIES ? 'yes' : 'no'})`,
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
