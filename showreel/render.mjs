// Headless frame-perfect renderer: serves the repo, drives reel.js at 60fps, pipes frames into ffmpeg.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(import.meta.dirname, '..');
const FPS = 60, DUR = 15;
const ONLY = process.argv[2]; // optional: comma list of times → stills (e.g. "1.2,3.4")
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.wav': 'audio/wav' };

const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const port = server.address().port;

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true, args: ['--hide-scrollbars', '--force-color-profile=srgb'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
page.on('console', m => console.log('[page]', m.text()));
page.on('pageerror', e => console.error('[page error]', e.message));
await page.goto(`http://localhost:${port}/showreel/index.html?render=1`, { waitUntil: 'networkidle0' });
await page.waitForFunction('window.__ready === true', { timeout: 30000 });

if (ONLY) {
  fs.mkdirSync(path.join(import.meta.dirname, 'stills'), { recursive: true });
  for (const t of ONLY.split(',').map(Number)) {
    const b64 = await page.evaluate(t => window.renderFrame(t, .9), t);
    fs.writeFileSync(path.join(import.meta.dirname, 'stills', `t_${t.toFixed(2)}.jpg`), Buffer.from(b64, 'base64'));
  }
  console.log('stills done');
} else {
  const out = path.join(import.meta.dirname, 'okekaraoke_showreel.mp4');
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-i', path.join(import.meta.dirname, 'audio.wav'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const total = FPS * DUR, t0 = Date.now();
  for (let f = 0; f < total; f++) {
    const b64 = await page.evaluate(t => window.renderFrame(t), f / FPS);
    if (!ff.stdin.write(Buffer.from(b64, 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 60 === 0) console.log(`frame ${f}/${total}  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log('done →', out);
}
await browser.close();
server.close();
