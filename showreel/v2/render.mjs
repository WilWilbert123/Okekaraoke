// OKEKARAOKE Showreel v2 — frame-perfect headless renderer.
// Serves the repo, drives window.renderFrame(t) at 60fps, captures the composited DOM (CSS 3D + canvas)
// via CDP, and pipes JPEG frames into ffmpeg together with the mixed soundtrack.
//
//   node showreel/v2/render.mjs                → full render → showreel/v2/okekaraoke_showreel_v2.mp4
//   node showreel/v2/render.mjs stills 1,3.4,9 → JPEG stills in showreel/v2/stills/
//   node showreel/v2/render.mjs serve          → live preview server (open printed URL, click to play)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '../..');
const HERE = import.meta.dirname;
const FPS = 60, DUR = 25, W = 1920, H = 1080;
const [mode = 'render', arg] = process.argv.slice(2);
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURIComponent(req.url.split('?')[0]);
  if (reqPath === '/favicon.ico') reqPath = '/public/favicon.ico';
  const f = path.join(ROOT, reqPath);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
}).listen(mode === 'serve' ? 4173 : 0);
const port = server.address().port;
const URL_ = `http://localhost:${port}/showreel/v2/index.html`;

if (mode === 'serve') {
  console.log('Preview →', URL_);
} else {
  const { default: puppeteer } = await import('puppeteer-core');
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--hide-scrollbars', '--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none',
      '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--disable-background-timer-throttling'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  page.on('console', m => console.log('[page]', m.text()));
  page.on('pageerror', e => console.error('[page error]', e.message));
  await page.goto(URL_ + '?render=1', { waitUntil: 'networkidle0' });
  await page.waitForFunction('window.__ready === true', { timeout: 60000 });
  const cdp = await page.createCDPSession();

  const grab = async (t, quality = 92) => {
    const b64 = await page.evaluate(t => window.renderFrame(t), t);
    if (b64 && typeof b64 === 'string') {
      return Buffer.from(b64, 'base64');
    }
    const { data } = await cdp.send('Page.captureScreenshot', {
      format: 'jpeg', quality, clip: { x: 0, y: 0, width: W, height: H, scale: 1 }, optimizeForSpeed: true,
    });
    return Buffer.from(data, 'base64');
  };

  if (mode === 'stills') {
    const dir = path.join(HERE, 'stills');
    fs.mkdirSync(dir, { recursive: true });
    for (const t of (arg || '1').split(',').map(Number)) {
      fs.writeFileSync(path.join(dir, `t_${t.toFixed(2)}.jpg`), await grab(t, 88));
    }
    console.log('stills →', dir);
  } else {
    const audio = path.join(HERE, 'audio', 'mix.wav');
    const out = path.join(HERE, 'okekaraoke_showreel_v2.mp4');
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error',
      '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-i', audio,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
      '-r', String(FPS), '-c:a', 'aac', '-b:a', '256k', '-t', String(DUR), '-movflags', '+faststart', out],
      { stdio: ['pipe', 'inherit', 'inherit'] });
    const total = FPS * DUR, t0 = Date.now();
    for (let f = 0; f < total; f++) {
      const buf = await grab(f / FPS);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (f % 120 === 0) console.log(`frame ${f}/${total}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
    console.log('done →', out);
  }
  await browser.close();
  server.close();
}
