// OKEKARAOKE Showreel v2 — soundtrack, SFX and voice-over mix (25s, 120 BPM, A minor).
// Every SFX is driven by cues.mjs so it lands on the exact frame of its visual hit.
// Output: audio/mix.wav (+ audio/mix.mp3 for preview)
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { buildCues } from './cues.mjs';

const HERE = import.meta.dirname;
const OUT = path.join(HERE, 'audio');
fs.mkdirSync(OUT, { recursive: true });
const TL = JSON.parse(fs.readFileSync(path.join(HERE, 'timeline.json'), 'utf8'));
const WORDS = JSON.parse(fs.readFileSync(path.join(HERE, 'vo', 'words.json'), 'utf8'));
const C = buildCues(TL, WORDS);

const SR = 44100, D = TL.duration, N = SR * D, BEAT = 60 / TL.bpm;
const bus = () => [new Float32Array(N), new Float32Array(N)];
const DR = bus(), BS = bus(), PD = bus(), LD = bus(), FX = bus(), SEND = bus(), VO = bus();
const pump = new Float32Array(N).fill(1); // sidechain from kick
const duck = new Float32Array(N);         // voice ducking target

let seed = 90210;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 * 2 - 1; };
const hz = n => 440 * Math.pow(2, (n - 69) / 12);
const add = (b, i, v, pan = 0) => {
  if (i < 0 || i >= N) return;
  b[0][i] += v * Math.min(1, 1 - pan); b[1][i] += v * Math.min(1, 1 + pan);
};
const S = t => Math.floor(t * SR);

/* ============ DRUMS ============ */
function kick(t0, g = 1, duckIt = true) {
  let ph = 0; const n = S(0.5), j = S(t0);
  for (let i = 0; i < n; i++) {
    const t = i / SR, f = 44 + 150 * Math.exp(-t * 32);
    ph += 2 * Math.PI * f / SR;
    let v = Math.tanh(Math.sin(ph) * 2.0) * Math.exp(-t * 6.2) * g * 0.95;
    if (i < SR * 0.003) v += rnd() * 0.4 * g * (1 - i / (SR * 0.003));
    add(DR, j + i, v);
  }
  if (duckIt) for (let i = 0; i < S(0.42); i++) { // pump curve
    const k = i / S(0.42), d = 1 - 0.75 * Math.pow(1 - k, 2.2);
    if (j + i < N) pump[j + i] = Math.min(pump[j + i], d);
  }
}
function clap(t0, g = 0.5) {
  let a = 0, b = 0; const n = S(0.35), j = S(t0);
  for (let i = 0; i < n; i++) {
    const t = i / SR, x = rnd(); a += (x - a) * 0.5; b += (a - b) * 0.07;
    const env = t < 0.028 ? Math.exp(-(t % 0.0095) * 300) : Math.exp(-(t - 0.028) * 15);
    const v = (a - b) * env * g * 1.6;
    add(DR, j + i, v, i % 2 ? 0.12 : -0.12); add(SEND, j + i, v * 0.35);
  }
}
function hat(t0, g = 0.14, pan = 0.2, dec = 55) {
  let lp = 0; const n = S(0.1), j = S(t0);
  for (let i = 0; i < n; i++) { const x = rnd(); lp += (x - lp) * 0.6; add(DR, j + i, (x - lp) * Math.exp(-i / SR * dec) * g, pan); }
}
function openHat(t0, g = 0.12) { hat(t0, g, -0.15, 9); }
function snare(t0, g = 0.4) {
  let lp = 0; const n = S(0.22), j = S(t0);
  for (let i = 0; i < n; i++) {
    const t = i / SR, x = rnd(); lp += (x - lp) * 0.35;
    add(DR, j + i, ((x - lp) * 0.9 + Math.sin(2 * Math.PI * 190 * t) * 0.5) * Math.exp(-t * 22) * g);
  }
}
function crash(t0, g = 0.28, dur = 2.2) {
  let hp = 0; const n = S(dur), j = S(t0);
  for (let i = 0; i < n; i++) {
    const t = i / SR, x = rnd(); hp += (x - hp) * 0.15;
    const v = (x - hp) * Math.exp(-t * 2.1) * g * (1 + 0.3 * Math.sin(t * 2900));
    add(DR, j + i, v, Math.sin(t * 3) * 0.4); add(SEND, j + i, v * 0.3);
  }
}

/* ============ TONAL ============ */
function bass(t0, note, dur = 0.24, g = 0.4) {
  let ph = 0, lp = 0; const f = hz(note), n = S(dur), j = S(t0);
  for (let i = 0; i < n; i++) {
    const t = i / SR; ph = (ph + f / SR) % 1;
    lp += (ph * 2 - 1 - lp) * (0.04 + 0.22 * Math.exp(-t * 18));
    const env = Math.min(1, t * 500) * Math.exp(-t * 3.5) * Math.min(1, (n - i) / 300);
    add(BS, j + i, (lp * 0.7 + Math.sin(2 * Math.PI * f * t) * 0.6) * env * g);
  }
}
function sub(t0, note, dur, g = 0.35) {
  const f = hz(note), n = S(dur), j = S(t0);
  for (let i = 0; i < n; i++) {
    const t = i / SR, env = Math.min(1, t * 8) * Math.min(1, (n - i) / (SR * 0.3));
    add(BS, j + i, Math.sin(2 * Math.PI * f * t) * env * g);
  }
}
function pad(t0, t1, notes, g = 0.05, c0 = 0.02, c1 = 0.04, pan = 0.35) {
  const j = S(t0), n = S(t1 - t0), ph = notes.flatMap(() => [Math.random(), Math.random(), Math.random()]);
  let lL = 0, lR = 0;
  for (let i = 0; i < n; i++) {
    const k = i / n; let l = 0, r = 0;
    notes.forEach((nn, q) => {
      const f = hz(nn);
      ph[q * 3] = (ph[q * 3] + f * 1.004 / SR) % 1; ph[q * 3 + 1] = (ph[q * 3 + 1] + f * 0.996 / SR) % 1;
      ph[q * 3 + 2] = (ph[q * 3 + 2] + f / SR) % 1;
      l += ph[q * 3] * 2 - 1 + (ph[q * 3 + 2] * 2 - 1) * 0.5; r += ph[q * 3 + 1] * 2 - 1 + (ph[q * 3 + 2] * 2 - 1) * 0.5;
    });
    const c = c0 + (c1 - c0) * k; lL += (l - lL) * c; lR += (r - lR) * c;
    const env = Math.min(1, i / (SR * 0.12)) * Math.min(1, (n - i) / (SR * 0.15));
    add(PD, j + i, lL * env * g, -pan); add(PD, j + i, lR * env * g, pan);
  }
}
function pluck(t0, note, g = 0.16, pan = 0) {
  const f = hz(note), n = S(0.5), j = S(t0);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const v = (Math.sin(2 * Math.PI * f * t) + 0.4 * Math.sin(4 * Math.PI * f * t) * Math.exp(-t * 14) + 0.15 * Math.sin(6 * Math.PI * f * t) * Math.exp(-t * 20))
      * Math.exp(-t * 8) * Math.min(1, t * 2500) * g;
    add(LD, j + i, v, pan); add(SEND, j + i, v * 0.55);
  }
}
function bell(t0, note, g = 0.16, pan = 0) { // FM bell for UI chimes
  const f = hz(note), n = S(0.9), j = S(t0);
  for (let i = 0; i < n; i++) {
    const t = i / SR, m = Math.sin(2 * Math.PI * f * 3.5 * t) * 2.2 * Math.exp(-t * 6);
    const v = Math.sin(2 * Math.PI * f * t + m) * Math.exp(-t * 4.5) * Math.min(1, t * 3000) * g;
    add(FX, j + i, v, pan); add(SEND, j + i, v * 0.6);
  }
}

/* ============ SFX ============ */
function impact(t0, g = 1) {
  let ph = 0, lp = 0; const n = S(2.4), j = S(t0);
  for (let i = 0; i < n; i++) {
    const t = i / SR; ph += 2 * Math.PI * (30 + 60 * Math.exp(-t * 6)) / SR;
    const x = rnd(); lp += (x - lp) * 0.2;
    const v = Math.tanh(Math.sin(ph) * 1.6) * Math.exp(-t * 2.0) * g + (x - lp) * Math.exp(-t * 3) * 0.35 * g;
    add(FX, j + i, v * 0.9, Math.sin(t * 20) * 0.25);
  }
}
function riser(t0, t1, g = 0.3) {
  let lp = 0, ph = 0; const j = S(t0), n = S(t1 - t0);
  for (let i = 0; i < n; i++) {
    const k = i / n, x = rnd(); lp += (x - lp) * (0.008 + 0.5 * k * k);
    ph += 2 * Math.PI * (200 + 1400 * k * k) / SR;
    const v = (lp * 1.8 + Math.sin(ph) * 0.25 * k) * k * k * g;
    add(FX, j + i, v, Math.sin(k * 30) * 0.5 * k);
  }
}
function revCymbal(t0, t1, g = 0.3) {
  let hp = 0; const j = S(t0), n = S(t1 - t0);
  for (let i = 0; i < n; i++) { const k = i / n, x = rnd(); hp += (x - hp) * 0.2; add(FX, j + i, (x - hp) * Math.pow(k, 3) * g, (k - 0.5) * 0.6); }
}
function whoosh(t0, dur = 0.45, g = 0.4, dir = 1) {
  let lp = 0, bp = 0; const j = S(t0), n = S(dur);
  for (let i = 0; i < n; i++) {
    const k = i / n, x = rnd(), c = 0.015 + 0.35 * Math.sin(Math.PI * k);
    lp += (x - lp) * c; bp += (lp - bp) * 0.08;
    add(FX, j + i, (lp - bp) * Math.pow(Math.sin(Math.PI * k), 1.5) * g * 2.2, (k - 0.5) * 1.6 * dir);
  }
}
function tick(t0, g = 0.12, f = 3200) {
  const n = S(0.03), j = S(t0);
  for (let i = 0; i < n; i++) { const t = i / SR; add(FX, j + i, (Math.sin(2 * Math.PI * f * t) * 0.6 + rnd() * 0.4) * Math.exp(-t * 260) * g, 0.1); }
}
function tap(t0, g = 0.35) {
  const n = S(0.12), j = S(t0);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    add(FX, j + i, (Math.sin(2 * Math.PI * (900 * Math.exp(-t * 30) + 180) * t) * Math.exp(-t * 45) + rnd() * Math.exp(-t * 400) * 0.5) * g);
  }
}
function pop(t0, f = 600, g = 0.28, pan = 0) {
  let ph = 0; const n = S(0.14), j = S(t0);
  for (let i = 0; i < n; i++) {
    const t = i / SR; ph += 2 * Math.PI * f * (1 + 1.8 * Math.exp(-t * 40)) / SR;
    add(FX, j + i, Math.sin(ph) * Math.exp(-t * 30) * Math.min(1, t * 4000) * g, pan);
  }
}
function shimmer(t0, g = 0.12, dur = 1.6) {
  const notes = [81, 84, 88, 93, 96], j = S(t0), n = S(dur);
  for (let i = 0; i < n; i++) {
    const t = i / SR; let v = 0;
    notes.forEach((nn, q) => { const d = q * 0.045; if (t > d) v += Math.sin(2 * Math.PI * hz(nn) * (t - d)) * Math.exp(-(t - d) * 3.2); });
    add(FX, j + i, v * g * 0.4, Math.sin(t * 9) * 0.5); add(SEND, j + i, v * g * 0.3);
  }
}
function crtOff(t0, g = 0.45) {
  let ph = 0; const n = S(0.7), j = S(t0);
  for (let i = 0; i < n; i++) {
    const t = i / SR; ph += 2 * Math.PI * (2400 * Math.exp(-t * 7) + 60) / SR;
    const v = (Math.sin(ph) * 0.7 * Math.exp(-t * 3) + rnd() * 0.5 * Math.exp(-t * 12)) * g;
    add(FX, j + i, v, Math.sin(t * 40) * 0.2);
  }
}
function powerOn(t0, g = 0.35) {
  let ph = 0; const n = S(0.9), j = S(t0);
  for (let i = 0; i < n; i++) {
    const t = i / SR; ph += 2 * Math.PI * (55 + 220 * (1 - Math.exp(-t * 5))) / SR;
    add(FX, j + i, Math.tanh(Math.sin(ph) * 1.5) * Math.min(1, t * 20) * Math.exp(-t * 3.5) * g);
  }
}
function glitch(t0, t1, g = 0.18) {
  const j = S(t0), n = S(t1 - t0); let hold = 0;
  for (let i = 0; i < n; i++) {
    if (i % 700 === 0) hold = rnd();
    const gate = Math.floor(i / 1100) % 2;
    add(FX, j + i, Math.round(hold * 3) / 3 * g * gate * Math.sign(Math.sin(i * 0.7)), gate ? 0.5 : -0.5);
  }
}
function lightClunk(t0) { // stage spotlight slamming on
  impact(t0, 0.55); tap(t0, 0.4);
  let lp = 0; const n = S(1.2), j = S(t0);
  for (let i = 0; i < n; i++) { const t = i / SR, x = rnd(); lp += (x - lp) * 0.02; add(FX, j + i, lp * Math.exp(-t * 2.5) * 0.6); }
}

/* ============ ARRANGEMENT ============ */
console.log('Composing…');
// Am – F – C – G  (i–VI–III–VII)
const CH = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 60], [55, 59, 62, 66]];
const RT = [33, 29, 36, 31];
const ARP = [[69, 72, 76, 72], [69, 72, 77, 72], [67, 72, 76, 72], [67, 71, 74, 71]];

// --- 01 HOOK (0–3): cinematic intro
impact(0.0, 0.5); sub(0.0, 33, 3.0, 0.22);
pad(0.0, 3.0, [45, 57, 60, 64], 0.05, 0.004, 0.03);
for (const t of C.hookWords) pluck(t, 81, 0.07, 0.3);
lightClunk(C.spotlight);
crash(C.spotlight, 0.12, 1.6);
riser(1.6, 3.0, 0.32); revCymbal(2.0, 3.0, 0.3);
glitch(2.72, 2.92, 0.14);
for (const t of [2.0, 2.25, 2.5, 2.625, 2.75, 2.8125, 2.875, 2.9375]) snare(t, 0.12 + (t - 2) * 0.35);

// --- DROP 1 (3.0)
impact(C.drop1, 1.1); crash(C.drop1, 0.3); shimmer(C.drop1, 0.14);
pop(C.logoLand, 340, 0.4); bell(C.logoLand, 81, 0.14);
'OKEKARAOKE'.split('').forEach((_, i) => pluck(C.lettersStart + i * C.letterStep, [69, 72, 76, 79, 81, 84, 88, 91, 93, 96][i], 0.07, (i - 4.5) / 6));

// --- Groove 3.0 – 17.0
function bar(t, ci, { kickOn = true, clapOn = true, hats = true, bassOn = true, arp = true, padG = 0.045 } = {}) {
  pad(t, t + 4 * BEAT - 0.02, CH[ci], padG, 0.025, 0.04);
  for (let b = 0; b < 4; b++) {
    const tb = t + b * BEAT;
    if (kickOn) kick(tb, 0.9);
    if (clapOn && (b === 1 || b === 3)) clap(tb, 0.5);
    if (hats) { hat(tb + BEAT / 2, 0.15, -0.2); hat(tb + BEAT / 4, 0.06, 0.3); hat(tb + 3 * BEAT / 4, 0.06, 0.3); }
  }
  if (hats) openHat(t + 3.5 * BEAT, 0.09);
  if (bassOn) {
    const r = RT[ci] + 12;
    [[0.5, 0], [1.0, 0], [1.5, 12], [2.5, 0], [3.0, 7], [3.5, 12]].forEach(([b, o]) => bass(t + b * BEAT, r + o, 0.22, 0.38));
  }
  if (arp) for (let s = 0; s < 8; s++) pluck(t + s * BEAT / 2 + BEAT / 4, ARP[ci][s % 4], 0.075, s % 2 ? 0.35 : -0.35);
}
bar(3.0, 0, { arp: false, clapOn: false });
for (let k = 0, t = 5.0; t < 17.0 - 1e-6; t += 4 * BEAT, k++) bar(t, (k + 1) % 4, { arp: t >= 5.0 });

// 02→03 TV morph + power-on
whoosh(C.tvMorphStart, 0.55, 0.42); powerOn(C.tvMorphEnd - 0.05, 0.3); crash(5.0, 0.16);
// phones fly in
[0, 0.11, 0.22].forEach((d, i) => whoosh(C.phonesIn + d, 0.4, 0.3, i - 1));
// beams / packets
for (let i = 0; i < 6; i++) bell(C.beams + i * 0.1, 76 + i * 2, 0.06, (i % 2 ? 0.5 : -0.5));
bell(C.toast, 88, 0.16); bell(C.toast + 0.08, 93, 0.12);
riser(C.zoomOut - 0.3, 9.0, 0.26); whoosh(C.zoomOut, 0.45, 0.45);

// 04 SEARCH
impact(9.0, 0.45);
C.query.split('').forEach((_, i) => tick(C.typeStart + i * C.typeStep, 0.14, 2800 + (i % 3) * 300));
shimmer(C.resultsGlow, 0.06, 0.8);
whoosh(C.tap - 0.22, 0.22, 0.18);
tap(C.tap, 0.45); bell(C.tap + 0.05, 84, 0.16); bell(C.tap + 0.13, 91, 0.13);
whoosh(C.tap + 0.15, 0.5, 0.3, 1);
whoosh(C.flip, 0.45, 0.4, -1);

// 05 QUEUE
for (let i = 0; i < 5; i++) pop(C.rowsStart + i * C.rowStep, 420 + i * 90, 0.3, (i - 2) / 4);
bell(C.liveWord, 81, 0.12);
shimmer(C.explode, 0.07, 1.0);
whoosh(C.whip, 0.42, 0.5, 1);

// 06 CHAT
C.bubbles.forEach((t, i) => pop(t, 700 + i * 70, 0.3, i % 2 ? 0.45 : -0.45));
shimmer(C.emojiBurst, 0.12, 1.3);
for (let i = 0; i < 18; i++) pop(C.emojiBurst + 0.05 + i * 0.055, 900 + (i * 137) % 700, 0.1, ((i * 53) % 10) / 5 - 1);
riser(16.3, 17.0, 0.22);

// 07 SOLO — breakdown → build
pad(17.0, 19.0, [53, 57, 60, 64, 69], 0.06, 0.02, 0.05);
sub(17.0, 29, 2.0, 0.3);
glitch(C.noTv[1] - 0.05, C.noTv[1] + 0.1, 0.12);
crtOff(C.crtOff, 0.5);
whoosh(C.phoneRise, 0.6, 0.35);
bell(C.goSolo[1], 81, 0.12);
whoosh(C.expand - 0.05, 0.7, 0.4);
for (let t = 19.0; t < 21.0 - 1e-6; t += 4 * BEAT) {
  pad(t, t + 4 * BEAT, CH[t < 20 ? 3 : 2].map(n => n + 0), 0.05, 0.03, 0.07);
  for (let b = 0; b < 4; b++) kick(t + b * BEAT, 0.7);
  bass(t, RT[t < 20 ? 3 : 2] + 12, 0.9, 0.35);
}
// snare roll accelerating
for (let t = 19.0, step = 0.25; t < 20.95; t += step) { snare(t, 0.1 + (t - 19) * 0.12); if (t > 20.0) step = 0.125; if (t > 20.5) step = 0.0625; }
riser(19.0, 21.0, 0.42); revCymbal(20.2, 21.0, 0.35);

// --- DROP 2 (21.0) — sign-off
impact(C.drop2, 1.2); crash(C.drop2, 0.32); shimmer(C.iconSlam, 0.15, 2.0);
'OKEKARAOKE'.split('').forEach((_, i) => pluck(C.outroLetters + i * C.outroStep, [69, 72, 76, 79, 81, 84, 88, 91, 93, 96][i], 0.06, (i - 4.5) / 6));
bell(C.yourNight[1], 84, 0.1); bell(C.yourStage[1], 88, 0.13);
for (let k = 0, t = 21.0; t < 24.0 - 1e-6; t += 4 * BEAT, k++) bar(t, k % 4, { padG: 0.05 });
// final chord + tail
pad(24.0, 25.0, [45, 57, 64, 69, 72], 0.06, 0.04, 0.01);
kick(24.0, 1.0, false); crash(24.0, 0.25, 1.0); sub(24.0, 33, 1.0, 0.3); bell(24.0, 93, 0.12);

/* ============ VOICE-OVER ============ */
console.log('Placing voice-over…');
for (const { id, at } of TL.vo) {
  const raw = path.join(OUT, `${id}.f32`);
  execSync(`ffmpeg -y -v error -i "${path.join(HERE, 'vo', id + '.wav')}" -af "highpass=f=80,acompressor=threshold=-20dB:ratio=3:attack=5:release=80:makeup=3,equalizer=f=3500:t=q:w=1.2:g=2" -f f32le -ar ${SR} -ac 1 "${raw}"`);
  const buf = fs.readFileSync(raw), s = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
  let peak = 0; for (const v of s) peak = Math.max(peak, Math.abs(v));
  const g = 0.9 / (peak || 1), j = S(at);
  for (let i = 0; i < s.length; i++) { add(VO, j + i, s[i] * g); add(SEND, j + i, s[i] * g * 0.04); }
  for (let i = S(at - 0.08); i < Math.min(N, j + s.length + S(0.12)); i++) if (i >= 0) duck[i] = 1;
  fs.unlinkSync(raw);
}

/* ============ MASTER ============ */
console.log('Mixing…');
// ducking envelope: fast attack, slow release
let dk = 0;
const dAtt = 1 - Math.exp(-1 / (SR * 0.03)), dRel = 1 - Math.exp(-1 / (SR * 0.25));
// stereo ping-pong delay (dotted 8th) + short room on SEND
const dly = S(BEAT * 0.75), dl = [new Float32Array(N), new Float32Array(N)];
const L = new Float32Array(N), R = new Float32Array(N);
let lpL = 0, lpR = 0;
for (let i = 0; i < N; i++) {
  dk += (duck[i] - dk) * (duck[i] > dk ? dAtt : dRel);
  const musicG = 1 - dk * 0.55;                 // ≈ -7 dB under voice
  const pm = pump[i];
  const iL = i - dly;
  dl[0][i] = SEND[0][i] + (iL >= 0 ? dl[1][iL] * 0.38 : 0);
  dl[1][i] = SEND[1][i] + (iL >= 0 ? dl[0][iL] * 0.38 : 0);
  lpL += ((iL >= 0 ? dl[0][iL] : 0) - lpL) * 0.3; lpR += ((iL >= 0 ? dl[1][iL] : 0) - lpR) * 0.3;
  const music = (k) => DR[k][i] * 0.9 + BS[k][i] * pm + PD[k][i] * (0.35 + 0.65 * pm) + LD[k][i] * (0.6 + 0.4 * pm);
  const fx = k => FX[k][i] * (1 - dk * 0.3);
  L[i] = (music(0) * musicG + fx(0) + lpL * 0.5) * 0.8 + VO[0][i];
  R[i] = (music(1) * musicG + fx(1) + lpR * 0.5) * 0.8 + VO[1][i];
}
// end fade
for (let i = S(24.4); i < N; i++) { const k = 1 - (i - S(24.4)) / (N - S(24.4)); L[i] *= Math.pow(k, 1.5); R[i] *= Math.pow(k, 1.5); }

const pre = path.join(OUT, 'premaster.f32');
const inter = new Float32Array(N * 2);
for (let i = 0; i < N; i++) { inter[i * 2] = L[i]; inter[i * 2 + 1] = R[i]; }
fs.writeFileSync(pre, Buffer.from(inter.buffer));
const wav = path.join(OUT, 'mix.wav');
execSync(`ffmpeg -y -v error -f f32le -ar ${SR} -ac 2 -i "${pre}" -af "acompressor=threshold=-14dB:ratio=2.5:attack=10:release=120:makeup=1.5,loudnorm=I=-14:TP=-1.2:LRA=9,alimiter=limit=0.89" -ar 48000 -c:a pcm_s16le "${wav}"`);
execSync(`ffmpeg -y -v error -i "${wav}" -b:a 192k "${path.join(OUT, 'mix.mp3')}"`);
fs.unlinkSync(pre);
console.log('Wrote', wav);
console.log(execSync(`ffmpeg -hide_banner -i "${wav}" -af ebur128=peak=true -f null - 2>&1 | grep -E "I:|Peak:" | tail -2`).toString());
