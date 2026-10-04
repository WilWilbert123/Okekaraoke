/* OkeKaraoke — Motion Reel '26
 * Deterministic 15s motion graphics engine. render(t) is a pure function of time,
 * so the headless renderer can capture frame-perfect 60fps output.
 *
 * Timeline (120 BPM, beat = 0.5s):
 *  S1 0.0–2.0  Ignition   : dot + waveform, kinetic "TAP. QUEUE. SING."
 *  S2 2.0–4.5  Identity   : glossy bubble burst + wordmark build
 *  S3 4.5–8.0  Remote     : phone UI demo — type, search, reserve, fly to queue
 *  S4 7.8–10.5 Live Room  : TV screen, karaoke wipe, neon reactions, chat
 *  S5 10.5–12.5 Kinetic   : 4 beat-cut type treatments
 *  S6 12.5–15  Sign-off   : logo lockup + URL
 */
const W = 1920, H = 1080, DUR = 15, BEAT = 0.5, DIAG = Math.hypot(W, H);
const cv = document.getElementById('c');
const X = cv.getContext('2d');
const T = {
  teal: '#1ad8bf', tealD: '#0e9f8c', navy: '#06231f', bg: '#050608', grey: '#8a929c',
  orange: '#ff7a1a', purple: '#b06bff', pink: '#ff4f8b', yellow: '#ffd23f', white: '#f5f7fa',
};
const F = {
  d: '"Inter","Helvetica Neue",Arial,sans-serif',
  o: '"Outfit","Inter",sans-serif',
  m: '"JetBrains Mono",Menlo,monospace',
};

/* ---------------- math ---------------- */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const p = (t, a, b) => clamp((t - a) / (b - a));
const E = {
  o3: t => 1 - Math.pow(1 - t, 3),
  io3: t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  i3: t => t * t * t,
  oExp: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  iExp: t => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  ioExp: t => (t <= 0 ? 0 : t >= 1 ? 1 : t < .5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
  oBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
};
const spring = (t, f = 1.4, d = 6) => (t <= 0 ? 0 : 1 - Math.exp(-d * t) * Math.cos(f * 2 * Math.PI * t));
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const kickEnv = t => (t >= 2 && t < 12.5 ? Math.exp(-((t - 2) % BEAT) * 9) : 0);
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

/* ---------------- draw helpers ---------------- */
function txt(c, s, x, y, o = {}) {
  const { size = 40, weight = 700, font = F.d, color = '#fff', align = 'left', base = 'alphabetic', ls = 0, alpha = 1 } = o;
  c.save();
  c.globalAlpha *= alpha;
  c.font = `${weight} ${size}px ${font}`;
  c.letterSpacing = ls + 'px';
  c.textAlign = align; c.textBaseline = base; c.fillStyle = color;
  c.fillText(s, x, y);
  c.restore();
}
function tw(c, s, size, weight = 700, font = F.d, ls = 0) {
  c.save(); c.font = `${weight} ${size}px ${font}`; c.letterSpacing = ls + 'px';
  const w = c.measureText(s).width; c.restore(); return w;
}
function pill(c, x, y, w, h, fill, stroke) {
  c.beginPath(); c.roundRect(x, y, w, h, h / 2);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1.5; c.stroke(); }
}
function starPath(c, x, y, r) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
}
function magnifier(c, x, y, r, col, lw = 2.5) {
  c.save(); c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round';
  c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke();
  c.beginPath(); c.moveTo(x + r * .72, y + r * .72); c.lineTo(x + r * 1.5, y + r * 1.5); c.stroke(); c.restore();
}
function flamePath(c, s) {
  c.beginPath();
  c.moveTo(0, s);
  c.bezierCurveTo(-s * .78, s, -s * .85, s * .2, -s * .45, -s * .2);
  c.bezierCurveTo(-s * .2, -s * .5, -s * .12, -s * .8, 0, -s);
  c.bezierCurveTo(s * .3, -s * .6, s * .85, -s * .2, s * .72, s * .4);
  c.bezierCurveTo(s * .62, s * .8, s * .32, s, 0, s);
  c.moveTo(0, s * .82);
  c.bezierCurveTo(-s * .32, s * .82, -s * .36, s * .45, -s * .05, s * .12);
  c.bezierCurveTo(s * .08, s * .35, s * .36, s * .45, s * .3, s * .65);
  c.bezierCurveTo(s * .25, s * .78, s * .15, s * .82, 0, s * .82);
}
function heartPath(c, s) {
  c.beginPath();
  c.moveTo(0, s * .75);
  c.bezierCurveTo(-s * 1.25, -s * .05, -s * .6, -s * .95, 0, -s * .38);
  c.bezierCurveTo(s * .6, -s * .95, s * 1.25, -s * .05, 0, s * .75);
}
function sparklePath(c, s) {
  c.beginPath();
  c.moveTo(0, -s);
  c.quadraticCurveTo(s * .12, -s * .12, s, 0);
  c.quadraticCurveTo(s * .12, s * .12, 0, s);
  c.quadraticCurveTo(-s * .12, s * .12, -s, 0);
  c.quadraticCurveTo(-s * .12, -s * .12, 0, -s);
}
function smilePath(c, s) {
  c.beginPath(); c.arc(0, 0, s * .9, 0, 7);
  c.moveTo(-s * .28 + 3, -s * .2); c.arc(-s * .28, -s * .2, 3, 0, 7);
  c.moveTo(s * .28 + 3, -s * .2); c.arc(s * .28, -s * .2, 3, 0, 7);
  c.moveTo(-s * .45, s * .15); c.quadraticCurveTo(0, s * .65, s * .45, s * .15);
}

/* ---------------- assets ---------------- */
const logo = new Image();
logo.src = '/public/okekaraokelogo.png';
const BUB = {
  white: ['#ffffff', '#e6e9ec', '#b4bac1', '#868d95'],
  grey: ['#e2e5e8', '#a9afb6', '#5d646b', '#33383d'],
  black: ['#8a8f94', '#2a2d31', '#0d0e10', '#000000'],
  teal: ['#d4fff8', '#5eeedb', '#12a893', '#05463e'],
};
const BLURS = [0, 3, 7, 13];
const SPR = {};
let GRAIN = [], VIGNETTE;
function makeBubble(cols) {
  const s = 256, c = mk(s, s), g = c.getContext('2d'), r = 100, cx = 128, cy = 128;
  const gr = g.createRadialGradient(cx - 35, cy - 40, 5, cx, cy, r);
  gr.addColorStop(0, cols[0]); gr.addColorStop(.35, cols[1]); gr.addColorStop(.8, cols[2]); gr.addColorStop(1, cols[3]);
  g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
  const rim = g.createRadialGradient(cx + 30, cy + 40, r * .5, cx, cy, r);
  rim.addColorStop(0, 'rgba(255,255,255,0)'); rim.addColorStop(.85, 'rgba(255,255,255,0)'); rim.addColorStop(1, 'rgba(255,255,255,.35)');
  g.fillStyle = rim; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
  g.save(); g.translate(cx - 38, cy - 46); g.rotate(-.6); g.scale(1, .6);
  const sp = g.createRadialGradient(0, 0, 0, 0, 0, 34);
  sp.addColorStop(0, 'rgba(255,255,255,.95)'); sp.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = sp; g.beginPath(); g.arc(0, 0, 34, 0, 7); g.fill(); g.restore();
  return c;
}
function blurred(src, b) { const c = mk(256, 256), g = c.getContext('2d'); g.filter = `blur(${b}px)`; g.drawImage(src, 0, 0); return c; }
function initAssets() {
  for (const k in BUB) { const base = makeBubble(BUB[k]); SPR[k] = BLURS.map(b => (b ? blurred(base, b) : base)); }
  const R = rng(3);
  for (let n = 0; n < 6; n++) {
    const c = mk(256, 256), g = c.getContext('2d'), id = g.createImageData(256, 256);
    for (let i = 0; i < id.data.length; i += 4) { const v = R() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    g.putImageData(id, 0, 0); GRAIN.push(X.createPattern(c, 'repeat'));
  }
  VIGNETTE = mk(W, H);
  const v = VIGNETTE.getContext('2d'), vg = v.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, DIAG * .62);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.65)');
  v.fillStyle = vg; v.fillRect(0, 0, W, H);
}

/* ---------------- bubble fields ---------------- */
function makeField(n, seed, types) {
  const R = rng(seed), a = [];
  for (let i = 0; i < n; i++) {
    const d = R();
    a.push({ x: (R() * 2 - 1) * 1.15, y: (R() * 2 - 1) * 1.1, d, r: lerp(72, 22, d) * (0.7 + R() * .6),
      type: types[Math.floor(R() * types.length)], ph: R() * 6.28, del: R() * .35 });
  }
  return a.sort((a, b) => b.d - a.d);
}
const FIELD2 = makeField(48, 7, ['white', 'white', 'grey', 'grey', 'black', 'teal']);
const FIELD6 = makeField(26, 21, ['grey', 'black', 'teal', 'white']);
function drawField(c, f, t, o = {}) {
  const { introT = 1, alpha = 1, camX = 0, camY = 0, near = null, pulse = 0, cx = W / 2, cy = H / 2 } = o;
  for (const b of f) {
    const isNear = b.d <= .18;
    if (near === true && !isNear) continue;
    if (near === false && isNear) continue;
    const k = E.oExp(clamp((introT - b.del) / .9));
    if (k <= 0) continue;
    const par = 1.3 - b.d;
    const fx = W / 2 + b.x * W * .5 + Math.cos(t * .5 + b.ph) * 18 + camX * par;
    const fy = H / 2 + b.y * H * .5 + Math.sin(t * .6 + b.ph) * 22 + camY * par;
    const x = lerp(cx, fx, k), y = lerp(cy, fy, k);
    const r = b.r * (.2 + .8 * k) * (1 + pulse * .07 * (1 - b.d)) * (isNear ? 1.9 : 1);
    const bi = Math.min(3, Math.floor(Math.abs(b.d - .45) * 7.5));
    c.globalAlpha = alpha * Math.min(1, k * 2);
    const S = 2.56 * r;
    c.drawImage(SPR[b.type][bi], x - S / 2, y - S / 2, S, S);
  }
  c.globalAlpha = 1;
}

/* ---------------- wordmark ---------------- */
function wordmark(c, x, y, size, align, fn) {
  const s = 'OKEKARAOKE';
  c.save(); c.font = `800 ${size}px ${F.o}`; c.letterSpacing = '0px';
  const ws = [...s].map(ch => c.measureText(ch).width);
  const total = ws.reduce((a, b) => a + b, 0);
  let cx = align === 'center' ? x - total / 2 : x;
  for (let i = 0; i < s.length; i++) {
    const L = fn ? fn(i) : {};
    const a = L.a ?? 1;
    if (a > 0) {
      c.save(); c.globalAlpha *= a;
      c.translate(cx + ws[i] / 2 + (L.dx || 0), y + (L.dy || 0));
      c.rotate(L.rot || 0); c.scale(L.s ?? 1, L.s ?? 1);
      c.fillStyle = i < 3 ? T.teal : T.white; c.textAlign = 'center';
      if (i < 3) { c.shadowColor = 'rgba(26,216,191,.55)'; c.shadowBlur = L.glow ?? 30; }
      c.fillText(s[i], 0, 0); c.restore();
    }
    cx += ws[i];
  }
  c.restore();
  return total;
}
function wordmarkWidth(c, size) { return tw(c, 'OKEKARAOKE', size, 800, F.o); }

/* ======================= S1 — IGNITION ======================= */
const S1_WORDS = ['TAP', 'QUEUE', 'SING'];
const S1_START = [0.5, 1.0, 1.5];
const S1_END = [0.95, 1.45, 1.78];
function s1Target(c, i) {
  if (i < 0) return [W / 2, H / 2, 12];
  const size = 230, w = tw(c, S1_WORDS[i], size, 900, F.d, -8), r = 24;
  const total = w + 14 + 2 * r, sx = W / 2 - total / 2;
  return [sx + w + 14 + r, H / 2 + size * .36 - r, r];
}
function S1(c, t) {
  c.fillStyle = T.bg; c.fillRect(0, 0, W, H);
  const gl = c.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 900);
  gl.addColorStop(0, `rgba(26,216,191,${.05 + .05 * p(t, 0, 2)})`); gl.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = gl; c.fillRect(0, 0, W, H);

  // design guides — crosshair + ruler ticks
  const gk = E.oExp(p(t, 0, .6));
  c.save(); c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(W / 2 - W / 2 * gk, H / 2); c.lineTo(W / 2 + W / 2 * gk, H / 2);
  c.moveTo(W / 2, H / 2 - H / 2 * gk); c.lineTo(W / 2, H / 2 + H / 2 * gk); c.stroke();
  for (let i = -20; i <= 20; i++) {
    const x = W / 2 + i * 48; if (Math.abs(i * 48) > W / 2 * gk) continue;
    c.beginPath(); c.moveTo(x, H / 2 - (i % 5 ? 4 : 10)); c.lineTo(x, H / 2 + (i % 5 ? 4 : 10)); c.stroke();
  }
  c.restore();

  let env = 0; for (const s of S1_START) if (t >= s) env = Math.max(env, Math.exp(-(t - s) * 8));

  // waveform
  const wl = E.oExp(p(t, .2, .9)) * W * .56;
  if (wl > 2) {
    const amp = 26 + 70 * env;
    const layers = [[T.teal, 0, .9, 3], [T.purple, 1.7, .55, 2], ['#ffffff', 3.1, .3, 1.5]];
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const [col, ph, al, lw] of layers) {
      c.beginPath();
      for (let x = -wl; x <= wl; x += 5) {
        const n = Math.abs(x) / wl, e = Math.pow(1 - n, 1.6);
        const y = H / 2 + e * amp * Math.sin(x * .017 + t * 9 + ph) * Math.cos(x * .0042 - t * 3 + ph * .3);
        x === -wl ? c.moveTo(W / 2 + x, y) : c.lineTo(W / 2 + x, y);
      }
      c.strokeStyle = col; c.globalAlpha = al; c.lineWidth = lw; c.shadowColor = col; c.shadowBlur = 18; c.stroke();
    }
    c.restore();
  }

  // words (masked per-char rise)
  const size = 230;
  for (let i = 0; i < 3; i++) {
    const s = S1_START[i], end = S1_END[i];
    if (t < s || t > end) continue;
    const word = S1_WORDS[i];
    const w = tw(c, word, size, 900, F.d, -8), r = 24, total = w + 14 + 2 * r, sx = W / 2 - total / 2;
    const base = H / 2 + size * .36;
    c.save();
    c.beginPath(); c.rect(0, base - size * .9, W, size * 1.08); c.clip();
    c.font = `900 ${size}px ${F.d}`; c.letterSpacing = '-8px'; c.fillStyle = T.white;
    const ex = E.i3(p(t, end - .1, end));
    for (let j = 0; j < word.length; j++) {
      const kk = E.oExp(p(t, s + j * .025, s + j * .025 + .3));
      const dy = (1 - kk) * size * .95 - ex * size * 1.05;
      const xoff = tw(c, word.slice(0, j), size, 900, F.d, -8);
      c.fillText(word[j], sx + xoff, base + dy);
    }
    c.restore();
  }

  // the dot — punctuation that travels
  const keys = [0, ...S1_START, 1.8], idx = [-1, 0, 1, 2, -1];
  let k = 0; for (let i = 0; i < keys.length; i++) if (t >= keys[i]) k = i;
  const from = s1Target(c, idx[Math.max(0, k - 1)]), to = s1Target(c, idx[k]);
  const e = k === 0 ? 1 : E.oExp(p(t, keys[k], keys[k] + .2));
  const dx = lerp(from[0], to[0], e), dy = lerp(from[1], to[1], e);
  let dr = lerp(from[2], to[2], e) * E.oBack(p(t, .05, .4)) * (1 + .35 * Math.exp(-(t - keys[k]) * 10));
  c.save(); c.fillStyle = T.teal; c.shadowColor = T.teal; c.shadowBlur = 40;
  c.beginPath(); c.arc(dx, dy, dr, 0, 7); c.fill(); c.restore();
  // expanding tick ring
  if (k > 0) {
    const rk = p(t, keys[k], keys[k] + .45);
    c.save(); c.strokeStyle = T.teal; c.globalAlpha = (1 - rk) * .6; c.lineWidth = 2;
    c.beginPath(); c.arc(dx, dy, dr + E.oExp(rk) * 120, 0, 7); c.stroke(); c.restore();
  }
}

/* ======================= S2 — IDENTITY ======================= */
const TAG = 'TURN ANY SCREEN INTO A KARAOKE STAGE';
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&@$*+/<>';
function S2(c, t) {
  const lt = t - 2;
  c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
  const g = c.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 1100);
  g.addColorStop(0, '#16191c'); g.addColorStop(1, '#000'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  const pulse = kickEnv(t);
  c.save();
  const z = 1 + Math.max(0, lt) * .035;
  c.translate(W / 2, H / 2); c.scale(z, z); c.translate(-W / 2, -H / 2);
  drawField(c, FIELD2, t, { introT: lt + .12, near: false, pulse, camX: -lt * 40 });

  // glass plate behind lockup
  const gk = E.oExp(p(lt, .3, 1.0));
  if (gk > 0) {
    c.save(); c.globalAlpha = gk;
    const pw = lerp(200, 1240, gk), ph = lerp(40, 520, E.oExp(p(lt, .4, 1.1)));
    c.beginPath(); c.roundRect(W / 2 - pw / 2, H / 2 - ph / 2 - 20, pw, ph, 40);
    c.fillStyle = 'rgba(10,12,14,.55)'; c.fill();
    c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1.5; c.stroke();
    c.restore();
  }

  // logo
  const ls = spring(clamp(lt - .2), 1.5, 7);
  if (ls > 0 && logo.complete) {
    c.save(); c.translate(W / 2, H / 2 - 150); c.rotate((1 - ls) * .6); c.scale(ls, ls);
    c.strokeStyle = T.teal; c.globalAlpha = .25 + .5 * pulse; c.lineWidth = 2;
    c.beginPath(); c.arc(0, 0, 92 + pulse * 10, 0, 7); c.stroke(); c.globalAlpha = 1;
    const bg = c.createRadialGradient(0, 0, 0, 0, 0, 95); bg.addColorStop(0, 'rgba(255,255,255,.95)'); bg.addColorStop(1, 'rgba(220,240,238,.85)');
    c.fillStyle = bg; c.beginPath(); c.arc(0, 0, 84, 0, 7); c.fill();
    c.drawImage(logo, -95, -92, 190, 190);
    c.restore();
  }

  // wordmark — staggered spring build
  wordmark(c, W / 2, H / 2 + 95, 168, 'center', i => {
    const kk = clamp(lt - .45 - i * .045), sp = spring(kk, 1.4, 6);
    return { dy: (1 - sp) * 150, rot: (1 - sp) * .6 * (i % 2 ? 1 : -1), a: Math.min(1, kk * 6), s: 1 + pulse * .02 };
  });

  // underline sweep
  const uk = E.oExp(p(lt, 1.0, 1.4));
  if (uk > 0) {
    const uw = 940 * uk;
    c.save(); c.fillStyle = T.teal; c.shadowColor = T.teal; c.shadowBlur = 20;
    c.fillRect(W / 2 - uw / 2, H / 2 + 130, uw, 4); c.restore();
  }
  // scramble-decode tagline
  const n = Math.floor(E.o3(p(lt, 1.05, 1.8)) * TAG.length);
  if (lt > 1.05) {
    const R = rng(Math.floor(t * 30));
    let s = '';
    for (let i = 0; i < TAG.length; i++) {
      if (i < n || TAG[i] === ' ') s += TAG[i];
      else if (i < n + 7) s += GLYPHS[Math.floor(R() * GLYPHS.length)];
      else s += ' ';
    }
    txt(c, s, W / 2, H / 2 + 185, { size: 24, weight: 500, font: F.m, color: '#aab3bd', align: 'center', ls: 9 });
  }
  drawField(c, FIELD2, t, { introT: lt + .12, near: true, pulse, camX: -lt * 40 });
  c.restore();
}

/* ======================= S3 — REMOTE ======================= */
const PW = 440, PH = 900, PSC = .93;
const QUERY = 'welcome to the black parade';
const RESULTS = [
  ['Welcome To The Bl…', 'My Chemical Romance', 'Karaoke'],
  ['My Chemical Roma…', 'Welcome To The Black…', 'Instrumental'],
  ['Welcome to the Bla…', 'My Chemical Romance', 'Karaoke'],
  ['My Chemical Roma…', 'Videoke Bar', 'Karaoke'],
];
const QUEUE = [
  ['241', 'RIVERMAYA', '#c8ff3a', 'PLAYING'],
  ['214', 'Rivermaya', '#6fd3ff', ''],
  ['711', 'TONEEJAY', '#ffe14d', ''],
  ["Ako'y Sayo 'At Ika…", 'First Circle', '#ff9a6b', ''],
];
const PRESS = 2.5;
function drawThumb(c, x, y, s, label, col) {
  c.save(); c.beginPath(); c.roundRect(x, y, s, s, 10); c.clip();
  c.fillStyle = '#050505'; c.fillRect(x, y, s, s);
  const g = c.createLinearGradient(x, y, x, y + s); g.addColorStop(0, 'rgba(255,255,255,.08)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(x, y, s, s);
  txt(c, label.slice(0, 3), x + s / 2, y + s * .62, { size: s * .42, weight: 900, color: col, align: 'center' });
  c.restore();
}
function drawPhone(c, lt) {
  c.save();
  c.shadowColor = 'rgba(26,216,191,.3)'; c.shadowBlur = 90;
  c.fillStyle = '#0b0c0e'; c.beginPath(); c.roundRect(0, 0, PW, PH, 62); c.fill();
  c.shadowBlur = 0; c.strokeStyle = '#3a4047'; c.lineWidth = 3; c.stroke();
  c.beginPath(); c.roundRect(12, 12, PW - 24, PH - 24, 52); c.fillStyle = '#07080a'; c.fill();
  c.save(); c.clip();
  // status bar
  txt(c, '10:21', 46, 52, { size: 17, weight: 600 });
  c.strokeStyle = '#ddd'; c.lineWidth = 1.5; c.beginPath(); c.roundRect(358, 40, 30, 14, 4); c.stroke();
  c.fillStyle = '#ddd'; c.fillRect(361, 43, 19, 8);
  c.fillStyle = '#000'; c.beginPath(); c.roundRect(PW / 2 - 55, 28, 110, 32, 16); c.fill();
  // header
  if (logo.complete) c.drawImage(logo, 22, 72, 50, 50);
  txt(c, 'OKE', 70, 105, { size: 22, weight: 800, font: F.o, color: T.teal });
  txt(c, 'KARAOKE', 70 + tw(c, 'OKE', 22, 800, F.o), 105, { size: 22, weight: 800, font: F.o });
  pill(c, 238, 80, 104, 36, '#16191c', '#2b3035');
  txt(c, 'ROOM', 252, 104, { size: 11, weight: 600, color: T.grey, ls: 1 });
  txt(c, 'S4JC', 294, 105, { size: 15, weight: 800, ls: 1 });
  c.beginPath(); c.arc(390, 98, 19, 0, 7); c.strokeStyle = '#2b3035'; c.lineWidth = 2; c.stroke();
  c.beginPath(); c.arc(390, 98, 6, 0, 7); c.strokeStyle = '#cfd5db'; c.stroke();
  // row 2
  pill(c, 24, 136, 112, 38, '#16191c', '#2b3035'); txt(c, 'Scan TV', 50, 161, { size: 15, weight: 700 });
  pill(c, 146, 136, 126, 38, 'rgba(26,216,191,.14)', 'rgba(26,216,191,.5)'); txt(c, 'Shoutout', 172, 161, { size: 15, weight: 700, color: T.teal });
  pill(c, 320, 136, 96, 38, '#16191c', '#2b3035'); txt(c, 'Wilbert', 338, 161, { size: 15, weight: 700 });
  pill(c, 24, 186, 392, 40, '#0d0f11', '#24282d');
  c.fillStyle = T.teal; c.beginPath(); c.arc(46, 206, 4, 0, 7); c.fill();
  txt(c, 'NOW:', 60, 211, { size: 14, weight: 600, color: T.grey });
  txt(c, '241 · RIVERMAYA', 102, 211, { size: 14, weight: 800 });
  // search bar
  const typing = p(lt, .55, 1.55), nch = Math.floor(typing * QUERY.length);
  const focus = lt > .45 && lt < 1.9;
  c.beginPath(); c.roundRect(24, 244, 392, 58, 29); c.fillStyle = '#16191c'; c.fill();
  c.strokeStyle = focus ? 'rgba(26,216,191,.8)' : '#2b3035'; c.lineWidth = focus ? 2 : 1.5; c.stroke();
  magnifier(c, 54, 270, 9, '#aab3bd');
  const q = QUERY.slice(0, nch);
  txt(c, q || 'Search songs…', 80, 280, { size: 18, weight: 500, color: q ? '#fff' : '#5b636c' });
  if (focus && Math.floor(lt * 4) % 2 === 0) { c.fillStyle = T.teal; c.fillRect(82 + tw(c, q, 18, 500), 262, 2, 24); }
  c.strokeStyle = '#aab3bd'; c.lineWidth = 2; c.beginPath(); c.roundRect(382, 260, 12, 18, 6); c.stroke();
  // chips
  pill(c, 24, 318, 128, 40, '#f5f7fa'); txt(c, '♫  All Songs', 42, 344, { size: 15, weight: 800, color: '#0a0b0d' });
  pill(c, 162, 318, 112, 40, '#1f2328'); txt(c, 'Karaoke', 186, 344, { size: 15, weight: 700, color: '#d0d5da' });
  pill(c, 284, 318, 86, 40, '#1f2328'); txt(c, 'OPM', 312, 344, { size: 15, weight: 700, color: '#d0d5da' });
  pill(c, 380, 318, 80, 40, '#1f2328');
  // results
  const showRes = lt > 1.55;
  if (showRes) txt(c, 'SEARCH RESULTS (14)', 26, 392, { size: 13, weight: 700, color: T.grey, ls: 2, alpha: E.o3(p(lt, 1.55, 1.8)) });
  for (let i = 0; i < 4 && showRes; i++) {
    const ck = clamp((lt - 1.6 - i * .08) / .45);
    if (ck <= 0) continue;
    const y = 412 + i * 108 + (1 - E.oBack(ck)) * 50;
    c.save(); c.globalAlpha = Math.min(1, ck * 2.5);
    c.beginPath(); c.roundRect(24, y, 392, 96, 26); c.fillStyle = '#17191c'; c.fill();
    c.strokeStyle = '#262a2f'; c.lineWidth = 1.5; c.stroke();
    starPath(c, 52, y + 48, 11); c.strokeStyle = '#6b737c'; c.lineWidth = 1.8; c.stroke();
    txt(c, RESULTS[i][0], 78, y + 36, { size: 18, weight: 800 });
    txt(c, RESULTS[i][1], 78, y + 60, { size: 14, weight: 500, color: T.grey });
    pill(c, 78, y + 68, RESULTS[i][2] === 'Karaoke' ? 82 : 108, 22, 'rgba(255,255,255,.04)', '#33383e');
    txt(c, RESULTS[i][2], 90, y + 84, { size: 11, weight: 700, color: '#cfd5db' });
    // reserve button
    const bx = 294, by = y + 27, bw = 108, bh = 42;
    let bs = 1, done = false;
    if (i === 0) {
      bs = 1 - .12 * Math.sin(Math.PI * p(lt, PRESS, PRESS + .16));
      done = lt > PRESS + .1;
    }
    c.save(); c.translate(bx + bw / 2, by + bh / 2); c.scale(bs, bs);
    if (done) {
      pill(c, -bw / 2, -bh / 2, bw, bh, 'rgba(26,216,191,.15)', T.teal);
      txt(c, '✓ QUEUED', 0, 5, { size: 13, weight: 800, color: T.teal, align: 'center' });
    } else {
      c.shadowColor = 'rgba(26,216,191,.5)'; c.shadowBlur = 16;
      pill(c, -bw / 2, -bh / 2, bw, bh, T.teal);
      c.shadowBlur = 0;
      txt(c, '+ RESERVE', 0, 5, { size: 13, weight: 900, color: '#052a25', align: 'center' });
    }
    c.restore();
    if (i === 0 && lt > PRESS) { // ripple
      const rk = p(lt, PRESS, PRESS + .6);
      c.save(); c.beginPath(); c.roundRect(24, y, 392, 96, 26); c.clip();
      c.fillStyle = `rgba(26,216,191,${.35 * (1 - rk)})`;
      c.beginPath(); c.arc(bx + bw / 2, by + bh / 2, E.oExp(rk) * 420, 0, 7); c.fill(); c.restore();
    }
    c.restore();
  }
  // bottom nav
  c.fillStyle = '#07080a'; c.fillRect(12, PH - 116, PW - 24, 104);
  c.fillStyle = '#1d2126'; c.fillRect(12, PH - 116, PW - 24, 1);
  const navY = PH - 70, cols = [72, 170, 270, 368];
  const mine = lt > PRESS + .35 ? 1 : 0, qn = lt > 3.2 ? 5 : 4;
  c.fillStyle = '#fff'; c.beginPath(); c.arc(cols[0], navY, 22, 0, 7); c.fill();
  magnifier(c, cols[0] - 3, navY - 3, 8, '#0a0b0d', 2.5);
  c.strokeStyle = '#9aa2ab'; c.lineWidth = 2;
  c.beginPath(); c.roundRect(cols[1] - 12, navY - 11, 24, 19, 5); c.stroke();
  starPath(c, cols[2], navY, 12); c.stroke();
  for (let j = 0; j < 3; j++) { c.beginPath(); c.moveTo(cols[3] - 12, navY - 8 + j * 7); c.lineTo(cols[3] + 6 - j * 3, navY - 8 + j * 7); c.stroke(); }
  txt(c, 'Search', cols[0], PH - 30, { size: 13, weight: 700, align: 'center' });
  txt(c, 'Chat', cols[1], PH - 30, { size: 13, weight: 600, color: '#9aa2ab', align: 'center' });
  const mk1 = 1 + .35 * Math.exp(-Math.max(0, lt - PRESS - .35) * 10) * (mine ? 1 : 0);
  c.save(); c.translate(cols[2], PH - 34); c.scale(mk1, mk1);
  txt(c, `Mine (${mine})`, 0, 4, { size: 13, weight: 600, color: mine ? T.teal : '#9aa2ab', align: 'center' }); c.restore();
  txt(c, `Queue (${qn})`, cols[3], PH - 30, { size: 13, weight: 600, color: '#9aa2ab', align: 'center' });
  c.restore();
  // glass sheen
  const sh = c.createLinearGradient(0, 0, PW, PH);
  sh.addColorStop(0, 'rgba(255,255,255,.07)'); sh.addColorStop(.35, 'rgba(255,255,255,0)');
  c.fillStyle = sh; c.beginPath(); c.roundRect(12, 12, PW - 24, PH - 24, 52); c.fill();
  c.restore();
}
function maskLine(c, str, x, y, size, inT, outT, lt, o = {}) {
  const kk = E.oExp(p(lt, inT, inT + .55)), ko = E.iExp(p(lt, outT, outT + .3));
  if (kk <= 0 || ko >= 1) return;
  c.save(); c.beginPath(); c.rect(x - 20, y - size * 1.0, 1400, size * 1.28); c.clip();
  txt(c, str, x, y + (1 - kk) * size * 1.15 - ko * size * 1.2, { size, ...o });
  c.restore();
}
function queueRow(c, x, y, w, item, i, o = {}) {
  const h = 78;
  c.beginPath(); c.roundRect(x, y, w, h, 22);
  c.fillStyle = o.hl ? 'rgba(26,216,191,.12)' : 'rgba(18,21,25,.92)'; c.fill();
  c.strokeStyle = item[3] || o.hl ? 'rgba(26,216,191,.7)' : '#232a2e'; c.lineWidth = o.hl ? 2 : 1.5; c.stroke();
  c.fillStyle = '#12302c'; c.beginPath(); c.arc(x + 34, y + h / 2, 16, 0, 7); c.fill();
  if (item[3]) { c.fillStyle = T.teal; c.beginPath(); c.moveTo(x + 29, y + h / 2 - 8); c.lineTo(x + 42, y + h / 2); c.lineTo(x + 29, y + h / 2 + 8); c.fill(); }
  else txt(c, String(i), x + 34, y + h / 2 + 6, { size: 15, weight: 800, color: T.teal, align: 'center' });
  drawThumb(c, x + 62, y + 11, 56, item[0].replace(/[^0-9A-Za-z]/g, '') || 'WTB', item[2]);
  txt(c, item[0], x + 132, y + 36, { size: 19, weight: 800 });
  txt(c, item[1], x + 132, y + 60, { size: 14, weight: 500, color: T.grey });
  if (item[3]) txt(c, item[3], x + w - 22, y + 46, { size: 13, weight: 900, color: '#3bf08a', align: 'right', ls: 1 });
  if (o.hl) { pill(c, x + w - 76, y + 27, 56, 24, T.teal); txt(c, 'NEW', x + w - 48, y + 44, { size: 12, weight: 900, color: '#052a25', align: 'center' }); }
}
function S3(c, t) {
  const lt = t - 4.5;
  c.fillStyle = '#060709'; c.fillRect(0, 0, W, H);
  // dot grid
  c.fillStyle = 'rgba(255,255,255,.09)';
  const ox = (lt * 12) % 48;
  for (let y = 24; y < H; y += 48) for (let x = 24 - ox; x < W; x += 48) c.fillRect(x, y, 2, 2);
  // marquee
  c.save(); c.font = `900 340px ${F.d}`; c.letterSpacing = '-10px';
  c.strokeStyle = 'rgba(255,255,255,.06)'; c.lineWidth = 2;
  const mq = 'SEARCH · RESERVE · SING · ', mw = c.measureText(mq).width, mx = -((lt * 260) % mw);
  c.strokeText(mq + mq, mx, H / 2 + 120); c.restore();
  // glow
  const gg = c.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 620);
  gg.addColorStop(0, 'rgba(26,216,191,.18)'); gg.addColorStop(1, 'rgba(26,216,191,0)');
  c.fillStyle = gg; c.fillRect(0, 0, W, H);

  // left kinetic copy
  const LX = 130;
  maskLine(c, '01 — SEARCH', LX, 360, 20, .5, PRESS - .2, lt, { font: F.m, weight: 700, color: T.teal, ls: 4 });
  maskLine(c, 'Find any', LX, 460, 96, .6, PRESS - .2, lt, { weight: 900, ls: -3 });
  maskLine(c, 'song.', LX, 560, 96, .68, PRESS - .2, lt, { weight: 900, ls: -3, color: T.teal });
  maskLine(c, 'Live search, right from your phone.', LX, 620, 24, .8, PRESS - .2, lt, { weight: 500, color: T.grey });
  maskLine(c, '02 — RESERVE', LX, 360, 20, PRESS + .05, 9, lt, { font: F.m, weight: 700, color: T.teal, ls: 4 });
  maskLine(c, 'One tap.', LX, 460, 96, PRESS + .1, 9, lt, { weight: 900, ls: -3 });
  maskLine(c, 'Queued.', LX, 560, 96, PRESS + .17, 9, lt, { weight: 900, ls: -3, color: T.teal });
  maskLine(c, 'Synced to every screen in the room.', LX, 620, 24, PRESS + .25, 9, lt, { weight: 500, color: T.grey });

  // right queue panel
  const QX = 1330, QY = 258, QW = 470;
  const pk = E.oExp(p(lt, .6, 1.1));
  if (pk > 0) {
    c.save(); c.globalAlpha = pk;
    c.fillStyle = T.teal; c.beginPath(); c.arc(QX + 8, QY + 6, 5, 0, 7); c.fill();
    txt(c, 'ROOM QUEUE', QX + 24, QY + 13, { size: 17, weight: 700, font: F.m, color: '#cfd5db', ls: 4 });
    c.restore();
  }
  for (let i = 0; i < 4; i++) {
    const rk = E.oExp(p(lt, .7 + i * .08, 1.3 + i * .08));
    if (rk <= 0) continue;
    c.save(); c.globalAlpha = rk; c.translate((1 - rk) * 120, 0);
    queueRow(c, QX, QY + 36 + i * 90, QW, QUEUE[i], i);
    c.restore();
  }
  const NEWT = 3.2;
  const target = [QX + QW / 2, QY + 36 + 4 * 90 + 39];
  if (lt > NEWT) {
    const nk = spring(clamp(lt - NEWT), 1.2, 7);
    c.save(); c.translate(target[0], target[1]); c.scale(lerp(.85, 1, nk), lerp(.85, 1, nk)); c.translate(-target[0], -target[1]);
    c.shadowColor = 'rgba(26,216,191,.6)'; c.shadowBlur = 40 * Math.exp(-(lt - NEWT) * 3);
    queueRow(c, QX, QY + 36 + 4 * 90, QW, ['Welcome To The Bl…', 'My Chemical Romance', '#ff4f8b', ''], 4, { hl: true });
    c.restore();
  }

  // phone
  const ek = E.oExp(p(lt, 0, .95));
  const py = lerp(H + 760, H / 2 + 6, ek) + Math.sin(lt * 2.2) * 6;
  const ang = (1 - ek) * 1.1, rot = (1 - ek) * -.25 + Math.sin(lt * 1.3) * .012;
  c.save(); c.translate(W / 2, py); c.rotate(rot);
  c.transform(Math.cos(ang), Math.sin(ang) * .3, 0, 1, 0, 0); c.scale(PSC, PSC);
  c.translate(-PW / 2, -PH / 2); drawPhone(c, lt); c.restore();

  // fly-out card with motion trail
  const FS = PRESS + .12, FE = NEWT;
  if (lt > FS && lt < FE + .05) {
    const start = [W / 2 + (348 - PW / 2) * PSC, H / 2 + 6 + (460 - PH / 2) * PSC];
    for (let g = 5; g >= 0; g--) {
      const fk = E.io3(p(lt - g * .025, FS, FE));
      if (fk <= 0) continue;
      const x = lerp(start[0], target[0], fk), y = lerp(start[1], target[1], fk) - Math.sin(fk * Math.PI) * 220;
      c.save(); c.globalAlpha = g ? .12 * (6 - g) / 6 : 1; c.translate(x, y);
      c.rotate(Math.sin(fk * Math.PI) * -.18); const s = lerp(.6, 1, fk); c.scale(s, s);
      c.shadowColor = T.teal; c.shadowBlur = g ? 0 : 30;
      c.beginPath(); c.roundRect(-170, -32, 340, 64, 32); c.fillStyle = '#0f1416'; c.fill();
      c.strokeStyle = T.teal; c.lineWidth = 2; c.stroke(); c.shadowBlur = 0;
      txt(c, '♫  Welcome To The Black Parade', 0, 7, { size: 18, weight: 800, align: 'center' });
      c.restore();
    }
  }
}

/* ======================= S4 — LIVE ROOM ======================= */
const L1 = 'Every voice becomes the chorus', L2 = 'sing it loud — the night is ours';
const TICK = 'UP NEXT ▸  214 · Rivermaya   ✦   711 · TONEEJAY   ✦   Ako\'y Sayo \'At Ikaw Lamang · First Circle   ✦   ALL OR NOTHING · O-TOWN   ✦   Banyo Queen · Andrew E.   ✦   ';
const PARTS = (() => {
  const R = rng(42), a = [];
  for (let i = 0; i < 30; i++) a.push({ type: Math.floor(R() * 4), x: 120 + R() * 1680, ts: .05 + R() * 2.3, sp: 300 + R() * 260, s: 20 + R() * 22, ph: R() * 6 });
  return a;
})();
const PCOL = [T.orange, T.pink, T.yellow, T.purple];
const QR = (() => { const R = rng(9), g = []; for (let i = 0; i < 441; i++) g.push(R() > .5); return g; })();
function drawQR(c, x, y, s) {
  c.fillStyle = '#fff'; c.beginPath(); c.roundRect(x - 8, y - 8, s + 16, s + 16, 10); c.fill();
  const m = s / 21; c.fillStyle = '#0a0b0d';
  for (let i = 0; i < 21; i++) for (let j = 0; j < 21; j++) {
    const fin = (i < 7 && j < 7) || (i > 13 && j < 7) || (i < 7 && j > 13);
    if (fin) {
      const li = i % 14, lj = j % 14, a = Math.max(Math.abs(li - 3), Math.abs(lj - 3));
      if (a === 3 || a <= 1) c.fillRect(x + i * m, y + j * m, m + .5, m + .5);
    } else if (QR[i * 21 + j]) c.fillRect(x + i * m, y + j * m, m + .5, m + .5);
  }
}
function chatBubble(c, x, y, text, style, k, name) {
  if (k <= 0) return;
  const s = spring(k, 1.3, 6);
  const [bg, fg] = { white: ['#f5f7fa', '#0a0b0d'], teal: [T.teal, '#062b26'], dark: ['#1b1f24', '#ffffff'] }[style];
  c.save(); c.font = `700 28px ${F.d}`; c.letterSpacing = '0px';
  const w = c.measureText(text).width + 56, h = 66;
  c.translate(x, y); c.scale(s, s); c.globalAlpha = Math.min(1, k * 4);
  c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 30; c.shadowOffsetY = 10;
  c.fillStyle = bg; c.beginPath(); c.roundRect(-w, -h, w, h, [30, 30, 8, 30]); c.fill();
  c.shadowColor = 'transparent';
  if (style === 'dark') { c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1.5; c.stroke(); }
  txt(c, text, -w + 28, -h / 2 + 10, { size: 28, weight: 700, color: fg });
  if (name) txt(c, name, -10, -h - 14, { size: 15, weight: 500, color: '#9aa3ad', font: F.m, align: 'right' });
  c.restore();
}
function S4(c, t) {
  const lt = t - 7.8;
  c.fillStyle = '#05060a'; c.fillRect(0, 0, W, H);
  const blobs = [[T.purple, .25, .3, .9], [T.teal, .75, .7, 1.1], [T.pink, .6, .2, .7]];
  for (const [col, bx, by, sp] of blobs) {
    const x = W * (bx + .08 * Math.sin(lt * sp)), y = H * (by + .08 * Math.cos(lt * sp * 1.3));
    const g = c.createRadialGradient(x, y, 0, x, y, 700); g.addColorStop(0, col + '33'); g.addColorStop(1, col + '00');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }
  const kick = kickEnv(t);
  const TW = 1180, TH = 664, s = lerp(.93, 1, E.o3(p(lt, 0, 2.7)));
  c.save(); c.translate(W / 2, H / 2 - 20); c.scale(s, s);
  // stand + floor glow
  c.fillStyle = '#0c0e11'; c.beginPath(); c.moveTo(-60, TH / 2); c.lineTo(60, TH / 2); c.lineTo(110, TH / 2 + 60); c.lineTo(-110, TH / 2 + 60); c.fill();
  c.shadowColor = `rgba(26,216,191,${.35 + .35 * kick})`; c.shadowBlur = 80 + 40 * kick;
  c.fillStyle = '#0c0e11'; c.beginPath(); c.roundRect(-TW / 2, -TH / 2, TW, TH, 26); c.fill();
  c.shadowBlur = 0; c.strokeStyle = '#2b3036'; c.lineWidth = 2; c.stroke();
  const sx = -TW / 2 + 16, sy = -TH / 2 + 16, sw = TW - 32, sh = TH - 32;
  c.save(); c.beginPath(); c.roundRect(sx, sy, sw, sh, 14); c.clip(); c.translate(sx, sy);
  c.fillStyle = '#0a0612'; c.fillRect(0, 0, sw, sh);
  const sb = [['#5b2bff', .3, .45, 1], ['#ff2f7d', .75, .35, 1.3], [T.teal, .55, .8, .8], ['#2b6bff', .1, .9, 1.6]];
  for (const [col, bx, by, sp] of sb) {
    const x = sw * (bx + .15 * Math.sin(lt * sp + bx * 5)), y = sh * (by + .12 * Math.cos(lt * sp * 1.2));
    const g = c.createRadialGradient(x, y, 0, x, y, 480); g.addColorStop(0, col + 'aa'); g.addColorStop(1, col + '00');
    c.fillStyle = g; c.fillRect(0, 0, sw, sh);
  }
  c.fillStyle = 'rgba(4,5,10,.45)'; c.fillRect(0, 0, sw, sh);
  // EQ
  const nb = 56, bw = sw / nb;
  const eg = c.createLinearGradient(0, sh - 260, 0, sh - 56); eg.addColorStop(0, T.purple); eg.addColorStop(1, T.teal);
  c.fillStyle = eg; c.globalAlpha = .5;
  for (let i = 0; i < nb; i++) {
    const h = (.2 + .8 * Math.abs(Math.sin(i * .7 + lt * 6) * Math.sin(i * .23 - lt * 3.3))) * (50 + 150 * kick);
    c.beginPath(); c.roundRect(i * bw + bw * .2, sh - 60 - h, bw * .6, h, 4); c.fill();
  }
  c.globalAlpha = 1;
  // now playing
  pill(c, 30, 28, 230, 36, 'rgba(0,0,0,.45)', 'rgba(255,255,255,.12)');
  c.fillStyle = '#ff3b5c'; c.globalAlpha = .6 + .4 * Math.sin(lt * 10); c.beginPath(); c.arc(52, 46, 6, 0, 7); c.fill(); c.globalAlpha = 1;
  txt(c, 'NOW PLAYING', 68, 52, { size: 15, weight: 700, font: F.m, ls: 3 });
  txt(c, '241', 32, 118, { size: 46, weight: 900 });
  txt(c, 'RIVERMAYA · requested by Wilbert', 32, 150, { size: 18, weight: 600, color: '#c9d0d8' });
  drawQR(c, sw - 128, 34, 94);
  txt(c, 'JOIN · S4JC', sw - 81, 160, { size: 13, weight: 700, font: F.m, ls: 2, align: 'center', color: '#e6e9ec' });
  // lyrics with karaoke wipe
  const l1k = E.oExp(p(lt, .1, .6));
  c.save(); c.globalAlpha = l1k; c.translate(0, (1 - l1k) * 40);
  c.font = `800 66px ${F.d}`; c.letterSpacing = '-1px'; c.textAlign = 'left';
  const l1w = c.measureText(L1).width, lx = sw / 2 - l1w / 2, ly = sh / 2 + 10;
  c.fillStyle = '#fff'; c.fillText(L1, lx, ly);
  const x01 = p(lt, .45, 2.3), seg = 8, wp = (Math.floor(x01 * seg) + E.o3((x01 * seg) % 1)) / seg;
  c.save(); c.beginPath(); c.rect(lx - 4, ly - 70, l1w * Math.min(1, wp) + 4, 100); c.clip();
  c.fillStyle = T.teal; c.shadowColor = T.teal; c.shadowBlur = 24; c.fillText(L1, lx, ly); c.restore();
  c.restore();
  txt(c, L2, sw / 2, sh / 2 + 80, { size: 38, weight: 600, color: 'rgba(255,255,255,.6)', align: 'center', alpha: E.o3(p(lt, .3, .8)) });
  // ticker
  c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(0, sh - 56, sw, 56);
  c.fillStyle = T.teal; c.fillRect(0, sh - 56, sw, 2);
  c.save(); c.font = `500 19px ${F.m}`; c.letterSpacing = '2px'; c.fillStyle = '#dfe4e9';
  const tkw = c.measureText(TICK).width, tx = -((lt * 240) % tkw);
  c.fillText(TICK + TICK, tx + 20, sh - 21); c.restore();
  // glare
  const gl = c.createLinearGradient(0, 0, sw, sh); gl.addColorStop(0, 'rgba(255,255,255,.08)'); gl.addColorStop(.4, 'rgba(255,255,255,0)');
  c.fillStyle = gl; c.fillRect(0, 0, sw, sh);
  c.restore();
  c.restore();

  // queue counter card (overlapping TV, left)
  const qk = spring(clamp(lt - .25), 1.2, 6);
  if (qk > 0) {
    c.save(); c.translate(270, 790); c.scale(qk, qk); c.translate(-160, -85);
    c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 40;
    c.beginPath(); c.roundRect(0, 0, 320, 170, 28); c.fillStyle = 'rgba(14,17,20,.9)'; c.fill();
    c.shadowBlur = 0; c.strokeStyle = 'rgba(255,255,255,.1)'; c.lineWidth = 1.5; c.stroke();
    txt(c, 'IN QUEUE', 28, 44, { size: 15, weight: 700, font: F.m, ls: 4, color: T.grey });
    const f = E.o3(p(lt, .4, 1.8)) * 8, n = Math.floor(f), fr = f - n;
    c.save(); c.beginPath(); c.rect(20, 56, 160, 100); c.clip();
    txt(c, String(1 + n), 28, 140 - fr * 100, { size: 92, weight: 900, color: T.teal });
    if (n < 8) txt(c, String(2 + n), 28, 240 - fr * 100, { size: 92, weight: 900, color: T.teal });
    c.restore();
    txt(c, 'songs', 150, 138, { size: 24, weight: 600, color: '#cfd5db' });
    c.restore();
  }
  // chat
  chatBubble(c, 1790, 330, 'Yowwww', 'white', clamp((lt - .45) / .8), 'You · 10:21 PM');
  chatBubble(c, 1740, 480, 'Next song is mine 🎤', 'teal', clamp((lt - .95) / .8), 'Mika');
  chatBubble(c, 1810, 630, 'Shoutout kay Wilbert! 📣', 'dark', clamp((lt - 1.45) / .8), 'Jun');

  // neon reactions
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
  for (const q of PARTS) {
    const a = lt - q.ts; if (a <= 0) continue;
    const y = H + 60 - a * q.sp; if (y < -80) continue;
    const x = q.x + Math.sin(a * 3 + q.ph) * 30;
    const sc = E.oBack(clamp(a / .3)), al = clamp((y + 40) / 300);
    const col = PCOL[q.type];
    c.save(); c.translate(x, y); c.rotate(Math.sin(a * 2 + q.ph) * .25); c.scale(sc, sc); c.globalAlpha = al;
    c.strokeStyle = col; c.lineWidth = 4; c.shadowColor = col; c.shadowBlur = 22;
    [flamePath, heartPath, smilePath, sparklePath][q.type](c, q.s);
    c.stroke(); c.restore();
  }
  c.restore();
}

/* ======================= S5 — KINETIC ======================= */
function S5(c, t) {
  const lt = t - 10.5, idx = Math.min(3, Math.floor(lt / .5)), k = clamp((lt - idx * .5) / .5);
  const content = () => {
    if (idx === 0) {
      c.fillStyle = T.teal; c.fillRect(0, 0, W, H);
      c.strokeStyle = 'rgba(6,35,31,.18)'; c.lineWidth = 3;
      for (let i = 0; i < 5; i++) { const r = ((k * 1.2 + i * .25) % 1.25) * 900; c.beginPath(); c.arc(W / 2, H / 2, r, 0, 7); c.stroke(); }
      const size = 300, base = H / 2 + size * .36, mid = H / 2, e = E.oExp(clamp(k * 2.4));
      c.save(); c.beginPath(); c.rect(0, 0, W, mid); c.clip();
      txt(c, 'SEARCH', W / 2 - (1 - e) * W * .7, base, { size, weight: 900, color: T.navy, align: 'center', ls: -12 }); c.restore();
      c.save(); c.beginPath(); c.rect(0, mid, W, H); c.clip();
      txt(c, 'SEARCH', W / 2 + (1 - e) * W * .7, base, { size, weight: 900, color: T.navy, align: 'center', ls: -12 }); c.restore();
      c.fillStyle = T.navy; c.fillRect(W / 2 - 700 * e, mid - 1, 1400 * e, 3);
      txt(c, 'FIND ANY SONG IN SECONDS', W / 2, base + 90, { size: 24, weight: 700, font: F.m, color: T.navy, align: 'center', ls: 10, alpha: E.o3(p(k, .3, .7)) });
    } else if (idx === 1) {
      c.fillStyle = T.bg; c.fillRect(0, 0, W, H);
      for (let j = 0; j < 16; j++) {
        const a = j / 16 * Math.PI * 2 + .2, d = lerp(120, 1100, E.oExp(k));
        c.save(); c.translate(W / 2 + Math.cos(a) * d, H / 2 + Math.sin(a) * d * .62); c.rotate(k * 3 + j);
        c.globalAlpha = 1 - k; c.fillStyle = T.teal; c.fillRect(-18, -5, 36, 10); c.fillRect(-5, -18, 10, 36); c.restore();
      }
      const size = 250, word = 'RESERVE', w = tw(c, word, size, 900, F.d, -8);
      const bk = E.oExp(clamp(k * 3));
      c.save(); c.strokeStyle = T.teal; c.lineWidth = 6; c.shadowColor = T.teal; c.shadowBlur = 30;
      const bw = (w + 200) * bk, bh = 330;
      c.beginPath(); c.roundRect(W / 2 - bw / 2, H / 2 - bh / 2, bw, bh, bh / 2); c.stroke(); c.restore();
      c.save(); c.font = `900 ${size}px ${F.d}`; c.letterSpacing = '-8px'; c.fillStyle = '#fff';
      for (let i = 0; i < word.length; i++) {
        const lk = E.oBack(clamp((k - i * .035) * 4), 2.2), xo = tw(c, word.slice(0, i), size, 900, F.d, -8), cw = tw(c, word[i], size, 900, F.d, -8);
        if (lk <= 0) continue;
        c.save(); c.translate(W / 2 - w / 2 + xo + cw / 2, H / 2 + size * .36 - size * .36); c.scale(lk, lk);
        c.fillText(word[i], -cw / 2, size * .36); c.restore();
      }
      c.restore();
    } else if (idx === 2) {
      c.fillStyle = '#0a0c0f'; c.fillRect(0, 0, W, H);
      c.save(); c.translate(W / 2, H / 2); c.rotate(-.12); c.translate(-W / 2, -H / 2);
      c.font = `900 170px ${F.d}`; c.letterSpacing = '-4px';
      const row = 'QUEUE  ·  QUEUE  ·  QUEUE  ·  QUEUE  ·  ', rw = c.measureText(row).width;
      for (let r = 0; r < 9; r++) {
        const y = -160 + r * 175, dir = r % 2 ? 1 : -1;
        const x = -(((r * 337 + dir * E.o3(k) * 700) % rw) + rw) % rw;
        if (r === 4) {
          c.fillStyle = T.teal; c.shadowColor = T.teal; c.shadowBlur = 30; c.fillText(row + row + row, x - rw, y); c.shadowBlur = 0;
        } else {
          c.strokeStyle = `rgba(255,255,255,${.1 + .08 * (r % 3)})`; c.lineWidth = 2; c.strokeText(row + row + row, x - rw, y);
        }
      }
      c.restore();
    } else {
      c.fillStyle = T.white; c.fillRect(0, 0, W, H);
      const e = E.oExp(k);
      c.save(); c.strokeStyle = '#0a0b0d'; c.lineWidth = 7; c.lineCap = 'round';
      for (let j = 0; j < 40; j++) {
        const a = j / 40 * Math.PI * 2 + k * .3, r0 = lerp(120, 560, e), r1 = r0 + lerp(0, 900, e) * (j % 2 ? .6 : 1);
        c.beginPath(); c.moveTo(W / 2 + Math.cos(a) * r0, H / 2 + Math.sin(a) * r0); c.lineTo(W / 2 + Math.cos(a) * r1, H / 2 + Math.sin(a) * r1); c.stroke();
      }
      c.restore();
      const s = lerp(1.4, 1, E.oExp(clamp(k * 3))), off = (1 - E.oExp(clamp(k * 2.2))) * 34 + 5;
      c.save(); c.translate(W / 2, H / 2); c.scale(s, s); c.translate(-W / 2, -H / 2);
      c.globalCompositeOperation = 'multiply';
      const o = { size: 250, weight: 900, align: 'center', ls: -8 };
      txt(c, 'SHOUTOUT', W / 2 - off, H / 2 + 90, { ...o, color: T.teal });
      txt(c, 'SHOUTOUT', W / 2 + off, H / 2 + 90 + off * .3, { ...o, color: T.pink });
      c.globalCompositeOperation = 'source-over';
      txt(c, 'SHOUTOUT', W / 2, H / 2 + 90, { ...o, color: '#0a0b0d' });
      c.restore();
    }
    txt(c, `0${idx + 1} / 04`, 150, 210, { size: 18, weight: 700, font: F.m, ls: 4, color: idx === 0 || idx === 3 ? '#0a0b0d' : '#ffffff', alpha: .7 });
  };
  if (lt >= 1.8) {
    c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
    const r = DIAG * .6 * (1 - E.i3(p(lt, 1.8, 2.0)));
    c.save(); c.beginPath(); c.arc(W / 2, H / 2, Math.max(.1, r), 0, 7); c.clip(); content(); c.restore();
    c.save(); c.strokeStyle = T.teal; c.lineWidth = 8; c.shadowColor = T.teal; c.shadowBlur = 30;
    c.beginPath(); c.arc(W / 2, H / 2, Math.max(.1, r), 0, 7); c.stroke(); c.restore();
  } else content();
}

/* ======================= S6 — SIGN-OFF ======================= */
const TAGLINE = 'Turn any screen into a karaoke stage.';
function S6(c, t) {
  const lt = t - 12.5;
  c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
  const gg = c.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 1000);
  gg.addColorStop(0, `rgba(26,216,191,${.12 * E.o3(p(lt, 0, 1))})`); gg.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = gg; c.fillRect(0, 0, W, H);
  drawField(c, FIELD6, t, { introT: lt * .8, alpha: .4, camX: -lt * 50 });

  const ws = 140, ww = wordmarkWidth(c, ws);
  const groupW = 200 + 24 + ww;
  const lfx = W / 2 - groupW / 2 + 100;
  const mk = E.ioExp(p(lt, .55, 1.15));
  const lx = lerp(W / 2, lfx, mk), ly = H / 2 - 60;
  const lsz = lerp(300, 210, mk);

  // ripples
  for (const r0 of [0, .5, 1.0]) {
    const rk = p(lt, r0, r0 + 1.3); if (rk <= 0 || rk >= 1) continue;
    c.save(); c.strokeStyle = T.teal; c.globalAlpha = (1 - rk) * .5; c.lineWidth = 2;
    c.beginPath(); c.arc(lx, ly, 120 + E.oExp(rk) * 900, 0, 7); c.stroke(); c.restore();
  }
  // wordmark sliding out from behind the logo
  const wk = E.oExp(p(lt, .8, 1.5));
  if (wk > 0) {
    c.save(); c.beginPath(); c.rect(lx + lsz * .38, 0, W, H); c.clip();
    wordmark(c, lfx + 124 - (1 - wk) * 320, ly + ws * .36, ws, 'left', () => ({ glow: 26 }));
    c.restore();
  }
  // logo badge with circular reveal
  const rv = E.oExp(p(lt, .05, .6)), sp = spring(clamp(lt - .05), 1.3, 6);
  if (rv > 0 && logo.complete) {
    c.save(); c.translate(lx, ly); c.rotate((1 - sp) * -.5);
    c.shadowColor = 'rgba(26,216,191,.5)'; c.shadowBlur = 60;
    const bgR = lsz * .44 * sp;
    const bg = c.createRadialGradient(0, -bgR * .3, 0, 0, 0, bgR); bg.addColorStop(0, '#ffffff'); bg.addColorStop(1, '#d5ece8');
    c.fillStyle = bg; c.beginPath(); c.arc(0, 0, bgR, 0, 7); c.fill(); c.shadowBlur = 0;
    c.beginPath(); c.arc(0, 0, bgR, 0, 7); c.clip();
    const ls = lsz * .78 * sp; c.drawImage(logo, -ls / 2, -ls / 2 + ls * .01, ls, ls);
    c.restore();
  }
  // tagline — word-by-word blur rise
  const words = TAGLINE.split(' ');
  c.save(); c.font = `500 36px ${F.d}`; c.letterSpacing = '0px';
  const full = c.measureText(TAGLINE).width; let x = W / 2 - full / 2;
  for (let i = 0; i < words.length; i++) {
    const wk2 = E.oExp(p(lt, 1.15 + i * .05, 1.65 + i * .05));
    const w = c.measureText(words[i] + ' ').width;
    if (wk2 > 0) {
      c.save(); c.globalAlpha = wk2; c.filter = `blur(${(1 - wk2) * 8}px)`;
      c.fillStyle = '#c9d1d9'; c.fillText(words[i], x, H / 2 + 105 + (1 - wk2) * 24); c.restore();
    }
    x += w;
  }
  c.restore();
  // URL pill with shimmer
  const uk = E.oBack(p(lt, 1.4, 1.85));
  if (uk > 0) {
    const url = 'okekaraoke.sbs', uw = tw(c, url, 30, 700, F.m, 2) + 96, uh = 66;
    c.save(); c.translate(W / 2, H / 2 + 195); c.scale(uk, uk);
    c.beginPath(); c.roundRect(-uw / 2, -uh / 2, uw, uh, uh / 2);
    c.fillStyle = 'rgba(26,216,191,.1)'; c.fill(); c.strokeStyle = T.teal; c.lineWidth = 2; c.stroke();
    c.clip();
    const sk = p(lt, 1.75, 2.25), shx = lerp(-uw, uw, sk);
    const shg = c.createLinearGradient(shx - 80, 0, shx + 80, 0);
    shg.addColorStop(0, 'rgba(255,255,255,0)'); shg.addColorStop(.5, 'rgba(255,255,255,.35)'); shg.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = shg; c.fillRect(-uw / 2, -uh / 2, uw, uh);
    txt(c, url, -14, 11, { size: 30, weight: 700, font: F.m, color: T.teal, align: 'center', ls: 2 });
    txt(c, '→', uw / 2 - 40, 10, { size: 28, weight: 700, color: T.teal, align: 'center' });
    c.restore();
  }
  txt(c, '© 2026 WILBERT GAMIS', W / 2, H - 110, { size: 14, weight: 500, font: F.m, ls: 4, color: '#59616a', align: 'center', alpha: E.o3(p(lt, 1.8, 2.2)) });
}

/* ======================= COMPOSITOR ======================= */
const bufA = mk(W, H), bufB = mk(W, H), cA = bufA.getContext('2d'), cB = bufB.getContext('2d');
const bufC = mk(W, H), cC = bufC.getContext('2d');
const SCENES = [[0, '01 / IGNITION'], [2, '02 / IDENTITY'], [4.5, '03 / REMOTE'], [7.9, '04 / LIVE ROOM'], [10.5, '05 / KINETIC'], [12.5, '06 / SIGN-OFF']];
const HITS = [2, 4.5, 8.0, 10.5, 12.5];
function glitch(g, t) {
  cB.drawImage(bufA, 0, 0);
  const R = rng(Math.floor(t * 60) + 7);
  for (let i = 0; i < 14; i++) {
    const y = R() * H, h = 8 + R() * 130, off = (R() * 2 - 1) * 260 * g;
    cA.drawImage(bufB, 0, y, W, h, off, y, W, h);
  }
  cA.save(); cA.globalCompositeOperation = 'screen';
  for (let i = 0; i < 6; i++) { cA.fillStyle = i % 2 ? `rgba(26,216,191,${.35 * g})` : `rgba(255,79,139,${.3 * g})`; cA.fillRect(0, R() * H, W, 4 + R() * 40); }
  cA.restore();
  if (g > .5 && Math.floor(t * 60) % 4 === 0) { cA.save(); cA.globalCompositeOperation = 'difference'; cA.fillStyle = '#fff'; cA.fillRect(0, 0, W, H); cA.restore(); }
}
function render(t) {
  let zoom = 1, blur = 0, flash = 0;
  // ---- scene selection + transitions
  if (t < 1.8) S1(cA, t);
  else if (t < 2.15) { // iris: teal ring then reveal
    S1(cA, t); S2(cB, t);
    const R1 = Math.max(24, DIAG * .6 * E.io3(p(t, 1.8, 2.02)));
    const R2 = DIAG * .6 * E.io3(p(t, 1.93, 2.15));
    cA.save(); cA.fillStyle = T.teal; cA.beginPath(); cA.arc(W / 2, H / 2, R1, 0, 7); cA.fill();
    if (R2 > 0) { cA.beginPath(); cA.arc(W / 2, H / 2, R2, 0, 7); cA.clip(); cA.drawImage(bufB, 0, 0); }
    cA.restore();
  } else if (t < 4.5) {
    S2(cA, t);
    if (t > 4.3) { const k = E.iExp(p(t, 4.3, 4.5)); zoom = 1 + k * 5; blur = k * 24; flash = p(t, 4.42, 4.5) * .9; }
  } else if (t < 7.75) {
    S3(cA, t);
    if (t < 4.78) { const k = E.oExp(p(t, 4.5, 4.78)); zoom = lerp(1.3, 1, k); blur = (1 - k) * 18; flash = (1 - p(t, 4.5, 4.62)) * .9; }
  } else if (t < 8.1) { // strip slide
    S3(cA, t); S4(cB, t);
    cC.clearRect(0, 0, W, H);
    const n = 9, sh = H / n;
    for (let i = 0; i < n; i++) {
      const d = .025 * i, k = E.ioExp(p(t, 7.75 + d, 7.98 + d)), dir = i % 2 ? 1 : -1;
      cC.drawImage(bufA, 0, i * sh, W, sh, -dir * W * k, i * sh, W, sh);
      cC.drawImage(bufB, 0, i * sh, W, sh, dir * W * (1 - k), i * sh, W, sh);
    }
    cA.clearRect(0, 0, W, H); cA.drawImage(bufC, 0, 0);
  } else if (t < 10.5) {
    S4(cA, t);
    if (t >= 10.35) glitch(E.i3(p(t, 10.35, 10.5)) + .2, t);
  } else if (t < 12.5) {
    S5(cA, t);
    if (t < 10.6) glitch(1 - p(t, 10.5, 10.6), t);
    if (t > 12.3) { const k = E.iExp(p(t, 12.3, 12.5)); zoom = 1 + k * 4; blur = k * 16; flash = p(t, 12.4, 12.5) * .9; }
  } else {
    S6(cA, t);
    if (t < 12.8) { const k = E.oExp(p(t, 12.5, 12.8)); zoom = lerp(1.5, 1, k); blur = (1 - k) * 16; flash = (1 - p(t, 12.5, 12.65)) * .9; }
  }

  // ---- camera: kick shake + impact punch
  const ke = kickEnv(t), R = rng(Math.floor((t - 2) / BEAT) + 99);
  const shx = (R() * 2 - 1) * 7 * ke, shy = (R() * 2 - 1) * 7 * ke;
  for (const h of HITS) if (t >= h) zoom += .045 * Math.exp(-(t - h) * 8);
  zoom += .008 * ke;

  X.setTransform(1, 0, 0, 1, 0, 0);
  X.globalCompositeOperation = 'source-over'; X.globalAlpha = 1; X.filter = 'none';
  X.fillStyle = '#000'; X.fillRect(0, 0, W, H);
  X.save(); X.translate(W / 2 + shx, H / 2 + shy); X.scale(zoom, zoom); X.translate(-W / 2, -H / 2);
  if (blur > .3) X.filter = `blur(${blur}px)`;
  X.drawImage(bufA, 0, 0); X.restore();
  if (flash > 0) { X.fillStyle = `rgba(255,255,255,${flash})`; X.fillRect(0, 0, W, H); }

  // ---- post: vignette, grain, HUD
  X.drawImage(VIGNETTE, 0, 0);
  X.save(); X.globalCompositeOperation = 'overlay'; X.globalAlpha = .09;
  const gi = Math.floor(t * 30) % GRAIN.length, gR = rng(Math.floor(t * 30));
  X.translate(-gR() * 256, -gR() * 256); X.fillStyle = GRAIN[gi]; X.fillRect(0, 0, W + 512, H + 512); X.restore();
  hud(t);
  // final fade
  const fo = p(t, 14.8, 15);
  if (fo > 0) { X.fillStyle = `rgba(0,0,0,${fo})`; X.fillRect(0, 0, W, H); }
}
const pad = n => String(n).padStart(2, '0');
function hud(t) {
  const a = p(t, .3, .8) * (1 - p(t, 14.4, 14.8));
  if (a <= 0) return;
  X.save(); X.globalAlpha = a * .8; X.globalCompositeOperation = 'difference';
  X.strokeStyle = '#fff'; X.fillStyle = '#fff'; X.lineWidth = 2;
  const m = 56, L = 26;
  for (const [x, y, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) {
    X.beginPath(); X.moveTo(x, y + sy * L); X.lineTo(x, y); X.lineTo(x + sx * L, y); X.stroke();
  }
  X.font = `500 15px ${F.m}`; X.letterSpacing = '3px'; X.textBaseline = 'middle';
  X.textAlign = 'left'; X.fillText('OKEKARAOKE — MOTION REEL ’26', m + 40, m + 12);
  let label = SCENES[0][1]; for (const [s, l] of SCENES) if (t >= s) label = l;
  X.fillText(label, m + 40, H - m - 12);
  X.textAlign = 'right';
  X.fillText(`TC 00:00:${pad(Math.floor(t))}:${pad(Math.floor((t % 1) * 60))}`, W - m - 40, m + 12);
  X.globalAlpha = a * .3; X.fillRect(W - m - 40 - 240, H - m - 13, 240, 2);
  X.globalAlpha = a * .9; X.fillRect(W - m - 40 - 240, H - m - 14, 240 * (t / DUR), 4);
  X.restore();
}

/* ======================= BOOT ======================= */
const params = new URLSearchParams(location.search);
window.renderFrame = (t, q = .95) => { render(t); return cv.toDataURL('image/jpeg', q).split(',')[1]; };
Promise.all([
  document.fonts.load(`800 100px Outfit`), document.fonts.load(`900 100px Inter`), document.fonts.load(`500 100px Inter`),
  document.fonts.load(`700 100px Inter`), document.fonts.load(`500 20px "JetBrains Mono"`), document.fonts.load(`700 20px "JetBrains Mono"`),
  new Promise(r => { if (logo.complete) r(); else { logo.onload = r; logo.onerror = r; } }),
]).catch(() => {}).then(() => {
  initAssets();
  window.__ready = true;
  if (params.has('render')) { document.getElementById('hint').remove(); render(0); return; }
  if (params.has('t')) { render(parseFloat(params.get('t'))); return; }
  // live preview
  const audio = new Audio('audio.wav');
  let t0 = performance.now();
  cv.addEventListener('click', () => { audio.currentTime = 0; audio.play().catch(() => {}); t0 = performance.now(); document.getElementById('hint').style.opacity = 0; });
  const loop = now => { const t = ((now - t0) / 1000) % DUR; render(t); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
});
