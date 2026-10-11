// Synthesizes a 30s, 120 BPM upbeat party soundtrack and mixes the voiceover clips.
// Output: promo/assets/promo-audio.mp3
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SR = 44100, D = 30, N = SR * D;
const dL = new Float32Array(N), dR = new Float32Array(N); // drums & percussion
const mL = new Float32Array(N), mR = new Float32Array(N); // music & bass
const sL = new Float32Array(N), sR = new Float32Array(N); // delay send
const vL = new Float32Array(N), vR = new Float32Array(N); // voiceover
const duck = new Float32Array(N); // sidechain ducking curve for voice

let seed = 42424;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 * 2 - 1; };
const add = (L, R, i, v, pan = 0) => {
  if (i >= 0 && i < N) {
    L[i] += v * (1 - Math.max(0, pan));
    R[i] += v * (1 + Math.min(0, pan));
  }
};
const hz = n => 440 * Math.pow(2, (n - 69) / 12);
const lerp = (a, b, t) => a + (b - a) * t;

/* ---------------- Instruments ---------------- */
function kick(t0, g = 1) {
  let ph = 0; const n = Math.floor(SR * 0.45), j0 = Math.floor(t0 * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR, f = 45 + 130 * Math.exp(-t * 28);
    ph += 2 * Math.PI * f / SR;
    let v = Math.tanh(Math.sin(ph) * 1.7) * Math.exp(-t * 6.8) * g * 0.9;
    if (i < SR * 0.004) v += rnd() * 0.35 * (1 - i / (SR * 0.004)) * g;
    add(dL, dR, j0 + i, v);
  }
}

function clap(t0, g = 0.55) {
  let a = 0, b = 0; const n = Math.floor(SR * 0.32), j0 = Math.floor(t0 * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR, x = rnd();
    a += (x - a) * 0.45; b += (a - b) * 0.06; const bp = a - b;
    const env = t < 0.03 ? Math.exp(-(t % 0.01) * 280) : Math.exp(-(t - 0.03) * 16);
    add(dL, dR, j0 + i, bp * env * g * 1.5, (i % 2 ? 0.15 : -0.15));
    add(sL, sR, j0 + i, bp * env * g * 0.25);
  }
}

function hat(t0, g = 0.18, pan = 0.25, dec = 50) {
  let lp = 0; const n = Math.floor(SR * 0.09), j0 = Math.floor(t0 * SR);
  for (let i = 0; i < n; i++) {
    const x = rnd(); lp += (x - lp) * 0.55;
    add(dL, dR, j0 + i, (x - lp) * Math.exp(-i / SR * dec) * g, pan);
  }
}

function blip(t0, f = 1320, g = 0.22) {
  const n = Math.floor(SR * 0.35), j0 = Math.floor(t0 * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR, v = (Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 18) + Math.sin(2 * Math.PI * 70 * t) * Math.exp(-t * 14) * 0.9) * g;
    add(mL, mR, j0 + i, v); add(sL, sR, j0 + i, v * 0.5);
  }
}

function impact(t0, g = 1) {
  let ph = 0, lp = 0; const n = Math.floor(SR * 1.9), j0 = Math.floor(t0 * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR; ph += 2 * Math.PI * (34 + 44 * Math.exp(-t * 5)) / SR;
    const x = rnd(); lp += (x - lp) * 0.25;
    const v = Math.sin(ph) * Math.exp(-t * 2.5) * 0.9 * g + (x - lp) * Math.exp(-t * 2.2) * 0.3 * g;
    add(dL, dR, j0 + i, v, Math.sin(t * 30) * 0.3);
  }
}

function riser(t0, t1, g = 0.35) {
  let lp = 0; const j0 = Math.floor(t0 * SR), n = Math.floor((t1 - t0) * SR);
  for (let i = 0; i < n; i++) {
    const k = i / n, x = rnd(); lp += (x - lp) * (0.01 + 0.55 * k * k);
    const v = lp * Math.pow(k, 2) * g * 2.2;
    add(mL, mR, j0 + i, v, Math.sin(k * 25) * 0.4);
  }
}

function whoosh(t0, dur = 0.45, g = 0.45) {
  let lp = 0; const j0 = Math.floor(t0 * SR), n = Math.floor(dur * SR);
  for (let i = 0; i < n; i++) {
    const k = i / n, x = rnd(), c = 0.02 + 0.5 * Math.sin(Math.PI * k);
    lp += (x - lp) * c;
    add(dL, dR, j0 + i, lp * Math.sin(Math.PI * k) * g, (k - 0.5) * 1.4);
  }
}

function glitchFx(t0, t1) {
  const j0 = Math.floor(t0 * SR), n = Math.floor((t1 - t0) * SR);
  let hold = 0;
  for (let i = 0; i < n; i++) {
    if (i % 800 === 0) hold = rnd();
    const gate = Math.floor(i / 1200) % 2;
    add(dL, dR, j0 + i, Math.round(hold * 4) / 4 * 0.25 * gate * (Math.sin(i * 0.9) > 0 ? 1 : -1), (gate ? 0.4 : -0.4));
  }
}

function bassNote(t0, f, dur = 0.24, g = 0.36) {
  let ph = 0, lp = 0; const j0 = Math.floor(t0 * SR), n = Math.floor(dur * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR; ph = (ph + f / SR) % 1;
    const saw = ph * 2 - 1; lp += (saw - lp) * (0.05 + 0.2 * Math.exp(-t * 16));
    const env = Math.min(1, t * 400) * Math.exp(-t * 4.2) * (i > n - 200 ? (n - i) / 200 : 1);
    add(mL, mR, j0 + i, (lp + Math.sin(2 * Math.PI * f * t) * 0.55) * env * g);
  }
}

function pad(t0, t1, notes, g = 0.07, cut0 = 0.02, cut1 = 0.02) {
  const j0 = Math.floor(t0 * SR), n = Math.floor((t1 - t0) * SR);
  const ph = notes.flatMap(() => [Math.random(), Math.random()]), lpL = [0], lpR = [0];
  for (let i = 0; i < n; i++) {
    const k = i / n; let l = 0, r = 0;
    notes.forEach((nn, q) => {
      const f = hz(nn);
      ph[q * 2] = (ph[q * 2] + f * 1.003 / SR) % 1;
      ph[q * 2 + 1] = (ph[q * 2 + 1] + f * 0.997 / SR) % 1;
      l += ph[q * 2] * 2 - 1; r += ph[q * 2 + 1] * 2 - 1;
    });
    const c = lerp(cut0, cut1, k);
    lpL[0] += (l - lpL[0]) * c; lpR[0] += (r - lpR[0]) * c;
    const env = Math.min(1, k * n / (SR * 0.08)) * Math.min(1, (n - i) / (SR * 0.08));
    add(mL, mR, j0 + i, lpL[0] * env * g, -0.3);
    add(mL, mR, j0 + i, lpR[0] * env * g, 0.3);
  }
}

function pluck(t0, f, g = 0.18, pan = 0) {
  const n = Math.floor(SR * 0.6), j0 = Math.floor(t0 * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR, v = (Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(4 * Math.PI * f * t) * Math.exp(-t * 12)) * Math.exp(-t * 7) * Math.min(1, t * 2000) * g;
    add(mL, mR, j0 + i, v, pan); add(sL, sR, j0 + i, v * 0.6);
  }
}

/* ---------------- Arrangement (30s, 120 BPM) ---------------- */
// 1 beat = 0.5s, 1 bar = 2.0s
console.log('Synthesizing music bed...');

// 0–4s: Hook (Intro, suspense)
pad(0, 3.8, [57, 60, 64, 69], 0.045, 0.005, 0.035); // Am pad
blip(0.15, 1760, 0.25);
for (const s of [0.6, 1.15, 1.7]) { blip(s, 1320, 0.3); kick(s, 0.55); }
glitchFx(2.5, 2.85); // strike FX
whoosh(2.85, 0.55, 0.35);
riser(3.0, 3.95, 0.4);

// 4s: DROP! First big hit
impact(3.95, 1.1);

// Chords: Am (57,60,64), F (53,57,60), C (48,52,55), G (55,59,62)
const chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
const roots = [33, 29, 36, 31];

// 4.0 – 16.0s: Remote groove (6 bars = 12s)
for (let b = 0; b < 6; b++) {
  const tBar = 4.0 + b * 2.0;
  const cIdx = b % 4;
  pad(tBar, tBar + 1.95, chords[cIdx], 0.04, 0.03, 0.035);

  // Drum pattern (four-on-the-floor kick, claps on 2 and 4)
  for (let beat = 0; beat < 4; beat++) {
    const tBeat = tBar + beat * 0.5;
    kick(tBeat, 0.85);
    if (beat === 1 || beat === 3) clap(tBeat, 0.55);
    hat(tBeat, 0.14, 0.2);
    hat(tBeat + 0.25, 0.18, -0.2); // upbeat hat
  }

  // Funky bassline
  const rootHz = hz(roots[cIdx] + 12);
  bassNote(tBar + 0.0, rootHz, 0.25, 0.42);
  bassNote(tBar + 0.5, rootHz, 0.22, 0.38);
  bassNote(tBar + 0.75, rootHz * 1.5, 0.18, 0.32);
  bassNote(tBar + 1.0, rootHz, 0.24, 0.4);
  bassNote(tBar + 1.5, rootHz * 1.25, 0.22, 0.35);
  bassNote(tBar + 1.75, rootHz * 1.5, 0.18, 0.32);

  // Plucks on off-beats
  pluck(tBar + 0.25, hz(chords[cIdx][1] + 12), 0.15, -0.3);
  pluck(tBar + 0.75, hz(chords[cIdx][2] + 12), 0.15, 0.3);
  pluck(tBar + 1.25, hz(chords[cIdx][0] + 12), 0.15, -0.2);
}

// Transitions at scene boundaries
whoosh(6.8, 0.4, 0.3);
whoosh(9.8, 0.4, 0.3);
whoosh(12.8, 0.4, 0.3);
riser(15.2, 16.0, 0.35);

// 16.0 – 20.0s: Solo TV Breakdown (2 bars = 4s)
// Drums drop out for clarity, glowing synths
pad(16.0, 19.9, [53, 57, 60, 65], 0.06, 0.04, 0.05); // Fmaj7
bassNote(16.0, hz(29 + 12), 1.2, 0.4);
bassNote(18.0, hz(31 + 12), 1.2, 0.4);
for (let beat = 0; beat < 8; beat++) {
  const tBeat = 16.0 + beat * 0.5;
  if (beat % 2 === 0) kick(tBeat, 0.45);
  hat(tBeat + 0.25, 0.12, 0.3);
}

// 20.0 – 24.0s: Solo TV zoom & build (2 bars = 4s)
pad(20.0, 23.8, [57, 60, 64, 67], 0.05, 0.03, 0.06);
for (let beat = 0; beat < 8; beat++) {
  const tBeat = 20.0 + beat * 0.5;
  kick(tBeat, 0.75);
  if (beat % 2 === 1) clap(tBeat, 0.45);
  hat(tBeat, 0.15, -0.2);
  hat(tBeat + 0.25, 0.18, 0.2);
}
whoosh(19.8, 0.5, 0.4); // zoom whoosh
riser(22.2, 23.95, 0.5); // big snare riser into CTA

// 24.0s: SECOND DROP! CTA Celebration hit
impact(23.95, 1.2);
blip(24.0, 2640, 0.35);

// 24.0 – 30.0s: Outro chorus (3 bars = 6s)
for (let b = 0; b < 3; b++) {
  const tBar = 24.0 + b * 2.0;
  pad(tBar, Math.min(29.8, tBar + 1.95), chords[b % 4], 0.045, 0.03, 0.035);
  for (let beat = 0; beat < 4; beat++) {
    const tBeat = tBar + beat * 0.5;
    if (tBeat < 29.2) {
      kick(tBeat, 0.85);
      if (beat === 1 || beat === 3) clap(tBeat, 0.6);
      hat(tBeat, 0.16, 0.2);
      hat(tBeat + 0.25, 0.2, -0.2);
    }
  }
  const rootHz = hz(roots[b % 4] + 12);
  if (tBar < 29.0) {
    bassNote(tBar + 0.0, rootHz, 0.25, 0.42);
    bassNote(tBar + 0.5, rootHz, 0.22, 0.38);
    bassNote(tBar + 1.0, rootHz, 0.24, 0.4);
    bassNote(tBar + 1.5, rootHz * 1.5, 0.2, 0.35);
  }
}
// Final chord hit
pad(29.0, 30.0, [57, 64, 69], 0.05, 0.03, 0.01);

/* ---------------- Load & Mix Voiceover ---------------- */
console.log('Loading voiceover clips...');
const voLines = [
  { name: 'l1', start: 0.5 },
  { name: 'l2', start: 4.2 },
  { name: 'l3', start: 7.2 },
  { name: 'l4', start: 10.3 },
  { name: 'l5', start: 13.3 },
  { name: 'l6', start: 16.3 },
  { name: 'l7', start: 20.2 },
  { name: 'l8', start: 24.6 }
];

// Convert high-quality neural voiceover mp3 to raw pcm via ffmpeg and read
for (const line of voLines) {
  const mp3Path = path.join(__dirname, 'vo', `${line.name}.mp3`);
  const rawPath = path.join(__dirname, 'vo', `${line.name}.raw`);
  execSync(`ffmpeg -y -v error -i "${mp3Path}" -f s16le -ar ${SR} -ac 1 "${rawPath}"`);
  const buf = fs.readFileSync(rawPath);
  const count = buf.length / 2;
  const startSample = Math.floor(line.start * SR);

  // Mark ducking envelope (lower music volume during voice)
  const padSamples = Math.floor(SR * 0.1);
  const duckStart = Math.max(0, startSample - padSamples);
  const duckEnd = Math.min(N, startSample + count + padSamples);
  for (let i = duckStart; i < duckEnd; i++) {
    duck[i] = 1.0;
  }

  // Mix voice into vL and vR (centered, punchy gain)
  for (let i = 0; i < count; i++) {
    const sIdx = startSample + i;
    if (sIdx >= N) break;
    const sample = buf.readInt16LE(i * 2) / 32768.0;
    vL[sIdx] += sample * 1.15;
    vR[sIdx] += sample * 1.15;
  }
}

// Smooth ducking envelope
let smoothDuck = 0;
for (let i = 0; i < N; i++) {
  smoothDuck += (duck[i] - smoothDuck) * 0.003;
  duck[i] = smoothDuck;
}

/* ---------------- Master Mix & Render WAV ---------------- */
console.log('Mastering audio...');
const outWav = path.join(__dirname, 'assets', 'promo-audio.wav');
const wavHeader = Buffer.alloc(44);
const totalDataBytes = N * 2 * 2; // 16-bit stereo

wavHeader.write('RIFF', 0);
wavHeader.writeUInt32LE(totalDataBytes + 36, 4);
wavHeader.write('WAVE', 8);
wavHeader.write('fmt ', 12);
wavHeader.writeUInt32LE(16, 16); // PCM chunk size
wavHeader.writeUInt16LE(1, 20);  // Format: PCM
wavHeader.writeUInt16LE(2, 22);  // Channels: 2
wavHeader.writeUInt32LE(SR, 24); // Sample rate
wavHeader.writeUInt32LE(SR * 4, 28); // Byte rate
wavHeader.writeUInt16LE(4, 32);  // Block align
wavHeader.writeUInt16LE(16, 34); // Bits per sample
wavHeader.write('data', 36);
wavHeader.writeUInt32LE(totalDataBytes, 40);

const pcmBuf = Buffer.alloc(totalDataBytes);
let pcmOffset = 0;

for (let i = 0; i < N; i++) {
  // Apply ducking to music & drums when voice is speaking (-4.5dB duck)
  const musicAtten = 1.0 - duck[i] * 0.42;

  // Delay send processing (reverb / echo for percussion)
  let dL_send = 0, dR_send = 0;
  const dIdx1 = i - Math.floor(SR * 0.25);
  const dIdx2 = i - Math.floor(SR * 0.375);
  if (dIdx1 >= 0) { dL_send += sL[dIdx1] * 0.25; dR_send += sR[dIdx1] * 0.25; }
  if (dIdx2 >= 0) { dL_send += sR[dIdx2] * 0.15; dR_send += sL[dIdx2] * 0.15; }

  // Sum channels
  let l = (dL[i] + mL[i] + dL_send) * musicAtten + vL[i];
  let r = (dR[i] + mR[i] + dR_send) * musicAtten + vR[i];

  // Soft clip limiter
  l = Math.tanh(l * 1.05) * 0.96;
  r = Math.tanh(r * 1.05) * 0.96;

  // Write 16-bit PCM
  const sL16 = Math.max(-32768, Math.min(32767, Math.floor(l * 32767)));
  const sR16 = Math.max(-32768, Math.min(32767, Math.floor(r * 32767)));
  pcmBuf.writeInt16LE(sL16, pcmOffset);
  pcmBuf.writeInt16LE(sR16, pcmOffset + 2);
  pcmOffset += 4;
}

fs.writeFileSync(outWav, Buffer.concat([wavHeader, pcmBuf]));
console.log('Wrote WAV:', outWav);

// Convert to 96kbps MP3 for compact delivery (~360KB)
const outMp3 = path.join(__dirname, 'assets', 'promo-audio.mp3');
execSync(`ffmpeg -y -v error -i "${outWav}" -b:a 96k -ar 44100 "${outMp3}"`);
console.log('Wrote MP3:', outMp3, (fs.statSync(outMp3).size / 1024).toFixed(1) + ' KB');
