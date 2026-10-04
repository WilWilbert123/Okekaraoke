// Synthesizes a 15s, 120 BPM soundtrack locked to the reel's timeline → showreel/audio.wav
import fs from 'node:fs';
import path from 'node:path';

const SR = 44100, D = 15, N = SR * D;
const dL = new Float32Array(N), dR = new Float32Array(N); // drums
const mL = new Float32Array(N), mR = new Float32Array(N); // music (sidechained)
const sL = new Float32Array(N), sR = new Float32Array(N); // fx send (delay)
let seed = 12345;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 * 2 - 1; };
const add = (L, R, i, v, pan = 0) => { if (i >= 0 && i < N) { L[i] += v * (1 - Math.max(0, pan)); R[i] += v * (1 + Math.min(0, pan)); } };
const hz = n => 440 * Math.pow(2, (n - 69) / 12);

function kick(t0, g = 1) {
  let ph = 0; const n = SR * .45, j0 = Math.floor(t0 * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR, f = 44 + 120 * Math.exp(-t * 30);
    ph += 2 * Math.PI * f / SR;
    let v = Math.tanh(Math.sin(ph) * 1.6) * Math.exp(-t * 6.5) * g * .85;
    if (i < SR * .004) v += rnd() * .35 * (1 - i / (SR * .004)) * g;
    add(dL, dR, j0 + i, v);
  }
}
function clap(t0, g = .5) {
  let a = 0, b = 0; const n = SR * .3, j0 = Math.floor(t0 * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR, x = rnd();
    a += (x - a) * .45; b += (a - b) * .06; const bp = a - b;
    const env = t < .03 ? Math.exp(-(t % .01) * 280) : Math.exp(-(t - .03) * 16);
    add(dL, dR, j0 + i, bp * env * g * 1.6, (i % 2 ? .1 : -.1));
    add(sL, sR, j0 + i, bp * env * g * .3);
  }
}
function hat(t0, g = .18, pan = .2, dec = 45) {
  let lp = 0; const n = SR * .09, j0 = Math.floor(t0 * SR);
  for (let i = 0; i < n; i++) { const x = rnd(); lp += (x - lp) * .55; add(dL, dR, j0 + i, (x - lp) * Math.exp(-i / SR * dec) * g, pan); }
}
function blip(t0, f = 1320, g = .25) {
  const n = SR * .4, j0 = Math.floor(t0 * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR, v = (Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 18) + Math.sin(2 * Math.PI * 70 * t) * Math.exp(-t * 14) * .9) * g;
    add(mL, mR, j0 + i, v); add(sL, sR, j0 + i, v * .6);
  }
}
function impact(t0, g = 1) {
  let ph = 0, lp = 0; const n = SR * 1.8, j0 = Math.floor(t0 * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR; ph += 2 * Math.PI * (32 + 40 * Math.exp(-t * 5)) / SR;
    const x = rnd(); lp += (x - lp) * .25;
    const v = Math.sin(ph) * Math.exp(-t * 2.6) * .9 * g + (x - lp) * Math.exp(-t * 2.2) * .28 * g;
    add(dL, dR, j0 + i, v, Math.sin(t * 40) * .3 * Math.min(1, t * 4));
  }
}
function riser(t0, t1, g = .3) {
  let lp = 0; const j0 = Math.floor(t0 * SR), n = Math.floor((t1 - t0) * SR);
  for (let i = 0; i < n; i++) {
    const k = i / n, x = rnd(); lp += (x - lp) * (.01 + .5 * k * k);
    const v = lp * Math.pow(k, 2) * g * 2;
    add(mL, mR, j0 + i, v, Math.sin(k * 30) * .4);
  }
}
function whoosh(t0, dur = .35, g = .4) {
  let lp = 0; const j0 = Math.floor(t0 * SR), n = Math.floor(dur * SR);
  for (let i = 0; i < n; i++) {
    const k = i / n, x = rnd(), c = .02 + .5 * Math.sin(Math.PI * k);
    lp += (x - lp) * c; add(dL, dR, j0 + i, lp * Math.sin(Math.PI * k) * g, (k - .5) * 1.4);
  }
}
function glitchFx(t0, t1) {
  const j0 = Math.floor(t0 * SR), n = Math.floor((t1 - t0) * SR);
  let hold = 0;
  for (let i = 0; i < n; i++) {
    if (i % 900 === 0) hold = rnd();
    const gate = Math.floor(i / 1400) % 2;
    add(dL, dR, j0 + i, Math.round(hold * 4) / 4 * .22 * gate * (Math.sin(i * .9) > 0 ? 1 : -1), (gate ? .5 : -.5));
  }
}
function bassNote(t0, f, dur = .22, g = .32) {
  let ph = 0, lp = 0; const j0 = Math.floor(t0 * SR), n = Math.floor(dur * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR; ph = (ph + f / SR) % 1;
    const saw = ph * 2 - 1; lp += (saw - lp) * (.04 + .18 * Math.exp(-t * 18));
    const env = Math.min(1, t * 400) * Math.exp(-t * 4) * (i > n - 200 ? (n - i) / 200 : 1);
    add(mL, mR, j0 + i, (lp + Math.sin(2 * Math.PI * f * t) * .5) * env * g);
  }
}
function pad(t0, t1, notes, g = .06, cut0 = .02, cut1 = .02) {
  const j0 = Math.floor(t0 * SR), n = Math.floor((t1 - t0) * SR);
  const ph = notes.flatMap(() => [Math.random(), Math.random()]), lpL = [0], lpR = [0];
  for (let i = 0; i < n; i++) {
    const k = i / n; let l = 0, r = 0;
    notes.forEach((nn, q) => {
      const f = hz(nn);
      ph[q * 2] = (ph[q * 2] + f * 1.003 / SR) % 1; ph[q * 2 + 1] = (ph[q * 2 + 1] + f * .997 / SR) % 1;
      l += ph[q * 2] * 2 - 1; r += ph[q * 2 + 1] * 2 - 1;
    });
    const c = lerp(cut0, cut1, k);
    lpL[0] += (l - lpL[0]) * c; lpR[0] += (r - lpR[0]) * c;
    const env = Math.min(1, k * n / (SR * .08)) * Math.min(1, (n - i) / (SR * .08));
    add(mL, mR, j0 + i, lpL[0] * env * g, -.3); add(mL, mR, j0 + i, lpR[0] * env * g, .3);
  }
}
function pluck(t0, f, g = .16, pan = 0) {
  const n = SR * .6, j0 = Math.floor(t0 * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR, v = (Math.sin(2 * Math.PI * f * t) + .35 * Math.sin(4 * Math.PI * f * t) * Math.exp(-t * 12)) * Math.exp(-t * 7) * Math.min(1, t * 2000) * g;
    add(mL, mR, j0 + i, v, pan); add(sL, sR, j0 + i, v * .7);
  }
}
const lerp = (a, b, t) => a + (b - a) * t;

/* ---------------- arrangement ---------------- */
// S1 — intro (0–2)
pad(0, 2.05, [57, 60, 64, 69], .045, .006, .05);           // Am, filter opening
blip(0.08, 1760, .18);
for (const s of [.5, 1.0, 1.5]) { blip(s, 1320, .3); kick(s, .45); }
riser(1.1, 2.0, .35);
// main groove (2–12.5)
const chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]; // Am F C G
const roots = [33, 29, 36, 31];
impact(2.0, 1);
for (let b = 0; b < 21; b++) {
  const t = 2 + b * .5;
  kick(t);
  if (b % 2) clap(t, .5);
  hat(t + .25, .2, .25);
  if (t >= 10.5) { hat(t + .125, .12, -.3, 70); hat(t + .375, .12, -.3, 70); }
}
for (let bar = 0; bar < 6; bar++) {
  const t0 = 2 + bar * 2; if (t0 >= 12.5) break;
  const ci = bar % 4, t1 = Math.min(12.5, t0 + 2);
  pad(t0, t1, chords[ci].map(n => n + 12), .035, .04, .07);
  for (let e = 0; e < 16; e++) { const t = t0 + e * .125 + .0625; if (t < t1 - .05) bassNote(t, hz(roots[ci] + (e % 4 === 3 ? 12 : 0)), .11, .3); }
}
// transition fx
whoosh(4.2, .32, .5); impact(4.5, .55);
for (let i = 0; i < 6; i++) pluck(6.95 + i * .0625, hz([76, 79, 83, 88, 91, 95][i]), .09, (i % 2 ? .4 : -.4)); // reserve "tap" sparkle
whoosh(7.7, .35, .55); impact(8.0, .5);
glitchFx(10.33, 10.5); riser(9.9, 10.5, .25); impact(10.5, .6);
for (const t of [10.5, 11, 11.5, 12]) { pad(t, t + .2, [69, 72, 76, 81], .07, .25, .05); }
riser(12.0, 12.5, .3); whoosh(12.3, .2, .5);
// S6 — sign-off (12.5–15)
impact(12.5, 1.1);
pad(12.5, 15, [48, 55, 64, 67, 72], .05, .09, .015);         // Cmaj(add9) resolve
const arp = [72, 76, 79, 84, 79, 76, 84, 88, 91, 88, 84, 79, 76, 72];
arp.forEach((n, i) => pluck(12.5 + i * .125, hz(n), .13 * (1 - i / 18), (i % 2 ? .45 : -.45)));
kick(13.0, .35); kick(14.0, .3); blip(14.1, 1760, .15);

/* ---------------- mix ---------------- */
// sidechain envelope from kick grid
const duck = new Float32Array(N).fill(1);
for (let b = 0; b < 21; b++) { const j0 = Math.floor((2 + b * .5) * SR); for (let i = 0; i < SR * .5 && j0 + i < N; i++) duck[j0 + i] = 1 - .65 * Math.exp(-i / SR * 9); }
// ping-pong delay on send (dotted 8th)
const dl = Math.floor(.375 * SR), fb = .38;
for (let i = dl; i < N; i++) { sL[i] += sR[i - dl] * fb; sR[i] += sL[i - dl] * fb; }
// cheap stereo reverb: 4 combs per side
function combs(inp, delays, g) {
  const out = new Float32Array(N);
  for (const d of delays) { const buf = new Float32Array(N); for (let i = 0; i < N; i++) { buf[i] = inp[i] + (i >= d ? buf[i - d] * g : 0); out[i] += buf[i] * .2; } }
  return out;
}
const mixInL = new Float32Array(N), mixInR = new Float32Array(N);
for (let i = 0; i < N; i++) { mixInL[i] = mL[i] * duck[i] + dL[i] * .15; mixInR[i] = mR[i] * duck[i] + dR[i] * .15; }
const rvL = combs(mixInL, [1557, 1617, 1491, 1422], .8), rvR = combs(mixInR, [1277, 1356, 1188, 1116], .8);
const outL = new Float32Array(N), outR = new Float32Array(N);
let peak = 0;
for (let i = 0; i < N; i++) {
  let l = dL[i] + mL[i] * duck[i] + sL[i] * .55 + rvL[i] * .22;
  let r = dR[i] + mR[i] * duck[i] + sR[i] * .55 + rvR[i] * .22;
  const t = i / SR, fade = Math.min(1, (D - t) / .45);
  l = Math.tanh(l * 1.1) * fade; r = Math.tanh(r * 1.1) * fade;
  outL[i] = l; outR[i] = r; peak = Math.max(peak, Math.abs(l), Math.abs(r));
}
const norm = .89 / peak;
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, outL[i] * norm)) * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, outR[i] * norm)) * 32767), 46 + i * 4);
}
fs.writeFileSync(path.join(import.meta.dirname, 'audio.wav'), buf);
console.log('audio.wav written, peak', peak.toFixed(3));
