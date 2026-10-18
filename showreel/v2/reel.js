// OKEKARAOKE — Motion Showreel '26 (25 Seconds, 1920x1080 @ 60fps)
// Deterministic motion graphics engine synced frame-accurately to cues.mjs,
// ElevenLabs voiceover, and the 120 BPM soundtrack mix.wav.

const W = 1920, H = 1080, DUR = 25.0, BEAT = 0.5;
const cv = document.getElementById('c');
const X = cv.getContext('2d');

// Brand Design Tokens
const T = {
  bg: '#050508',
  surface: '#0d0d14',
  teal: '#2dd4bf',
  tealDark: '#0d9488',
  tealGlow: 'rgba(45, 212, 191, 0.4)',
  white: '#f8fafc',
  grey: '#94a3b8',
  darkGrey: '#334155',
  amber: '#f59e0b',
  purple: '#a855f7',
  pink: '#ec4899',
  green: '#22c55e',
  blue: '#3b82f6',
};

const F = {
  sans: '"Inter", sans-serif',
  display: '"Space Grotesk", sans-serif',
  mono: '"JetBrains Mono", monospace',
};

// Math & Easing utilities
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const p = (t, a, b) => clamp((t - a) / (b - a));

const E = {
  o3: t => 1 - Math.pow(1 - t, 3),
  i3: t => t * t * t,
  io3: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  oExp: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  iExp: t => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  oBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  spring: (t, f = 1.6, d = 7) => (t <= 0 ? 0 : 1 - Math.exp(-d * t) * Math.cos(f * 2 * Math.PI * t)),
};

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// Text helpers
function txt(c, str, x, y, opts = {}) {
  const {
    size = 40, weight = 700, font = F.display, color = '#fff',
    align = 'left', base = 'alphabetic', ls = 0, alpha = 1,
    glow = null, glowColor = T.tealGlow
  } = opts;
  c.save();
  c.globalAlpha *= alpha;
  c.font = `${weight} ${size}px ${font}`;
  c.letterSpacing = ls + 'px';
  c.textAlign = align;
  c.textBaseline = base;
  if (glow) {
    c.shadowColor = glowColor;
    c.shadowBlur = glow;
  }
  c.fillStyle = color;
  c.fillText(str, x, y);
  c.restore();
}

function tw(c, str, size, weight = 700, font = F.display, ls = 0) {
  c.save();
  c.font = `${weight} ${size}px ${font}`;
  c.letterSpacing = ls + 'px';
  const w = c.measureText(str).width;
  c.restore();
  return w;
}

function pill(c, x, y, w, h, fill, stroke, r = h / 2) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1.5; c.stroke(); }
}

// Assets to load
const imgLogo = new Image(); imgLogo.src = '/public/okekaraokelogo.png';
const imgTv = new Image(); imgTv.src = '/promo/assets/tv-view.png';
const imgSearch = new Image(); imgSearch.src = '/promo/assets/remote-search.jpg';
const imgQueue = new Image(); imgQueue.src = '/promo/assets/remote-queue.jpg';
const imgChat = new Image(); imgChat.src = '/promo/assets/remote-chat.jpg';
const imgSolo = new Image(); imgSolo.src = '/promo/assets/solo-tv.jpg';

// Precomputed Grain & Vignette
let VIGNETTE;
const GRAIN = [];

function initAssets() {
  VIGNETTE = mk(W, H);
  const vg = VIGNETTE.getContext('2d');
  const g = vg.createRadialGradient(W / 2, H / 2, W * 0.28, W / 2, H / 2, W * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.7, 'rgba(0,0,0,0.3)');
  g.addColorStop(1, 'rgba(0,0,0,0.85)');
  vg.fillStyle = g;
  vg.fillRect(0, 0, W, H);

  for (let k = 0; k < 6; k++) {
    const gc = mk(256, 256), gg = gc.getContext('2d');
    const id = gg.createImageData(256, 256);
    const d = id.data, r = rng(k * 777 + 1);
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.floor(r() * 255);
      d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = Math.floor(r() * 32);
    }
    gg.putImageData(id, 0, 0);
    GRAIN.push(X.createPattern(gc, 'repeat'));
  }
}

// Particle field helper
const FIELD = [];
{
  const r = rng(42);
  for (let i = 0; i < 180; i++) {
    FIELD.push({
      x: (r() - 0.5) * W * 1.5,
      y: (r() - 0.5) * H * 1.5,
      z: r() * 1200 + 100,
      sz: r() * 3 + 1,
      c: r() > 0.4 ? T.teal : (r() > 0.5 ? T.purple : T.white),
      alpha: r() * 0.6 + 0.2,
      sp: r() * 1.5 + 0.5,
    });
  }
}

function drawStars(c, t, speed = 1) {
  c.save();
  c.translate(W / 2, H / 2);
  for (const st of FIELD) {
    const curZ = ((st.z - t * 140 * speed) % 1200 + 1200) % 1200;
    const k = 600 / (curZ + 1);
    const sx = st.x * k, sy = st.y * k;
    if (Math.abs(sx) < W / 2 + 50 && Math.abs(sy) < H / 2 + 50) {
      const a = (1 - curZ / 1200) * st.alpha;
      c.fillStyle = st.c;
      c.globalAlpha = a;
      c.beginPath();
      c.arc(sx, sy, st.sz * k * 0.8, 0, Math.PI * 2);
      c.fill();
    }
  }
  c.restore();
}

// 3D Device Phone Mockup Drawer
function drawPhone(c, img, x, y, w, h, opts = {}) {
  const {
    rx = 0, ry = 0, rz = 0,
    elevation = 40, glare = true, notch = true,
    borderGlow = null
  } = opts;

  c.save();
  c.translate(x, y);
  c.rotate(rz);
  // Simulating 3D tilt via scale & shear
  c.transform(1, Math.tan(rx), Math.tan(ry), 1, 0, 0);

  // Soft ambient shadow
  c.save();
  c.shadowColor = 'rgba(0, 0, 0, 0.75)';
  c.shadowBlur = elevation * 1.5;
  c.shadowOffsetY = elevation;
  c.fillStyle = '#090a10';
  c.beginPath();
  c.roundRect(-w / 2, -h / 2, w, h, 36);
  c.fill();
  c.restore();

  // Outer bezel
  c.beginPath();
  c.roundRect(-w / 2, -h / 2, w, h, 36);
  c.fillStyle = '#0f111a';
  c.fill();
  c.lineWidth = 4;
  c.strokeStyle = borderGlow || 'rgba(255, 255, 255, 0.12)';
  if (borderGlow) {
    c.shadowColor = borderGlow;
    c.shadowBlur = 24;
  }
  c.stroke();

  // Screen area
  const screenPad = 6;
  const sw = w - screenPad * 2, sh = h - screenPad * 2;
  c.save();
  c.beginPath();
  c.roundRect(-sw / 2, -sh / 2, sw, sh, 30);
  c.clip();

  if (img && img.complete) {
    c.drawImage(img, -sw / 2, -sh / 2, sw, sh);
  } else {
    c.fillStyle = '#050508';
    c.fillRect(-sw / 2, -sh / 2, sw, sh);
  }

  // Dynamic glass glare sweep
  if (glare) {
    const gl = c.createLinearGradient(-sw / 2, -sh / 2, sw / 2, sh / 2);
    gl.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
    gl.addColorStop(0.4, 'rgba(255, 255, 255, 0.03)');
    gl.addColorStop(0.6, 'rgba(255, 255, 255, 0)');
    c.fillStyle = gl;
    c.fillRect(-sw / 2, -sh / 2, sw, sh);
  }

  // Camera punch hole
  if (notch) {
    c.fillStyle = '#000';
    c.beginPath();
    c.arc(0, -sh / 2 + 18, 6, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();

  c.restore();
}

// 3D TV Screen Mockup Drawer
function drawTvScreen(c, x, y, w, h, opts = {}) {
  const { t = 0, scale = 1, glow = T.tealGlow } = opts;

  c.save();
  c.translate(x, y);
  c.scale(scale, scale);

  // Big neon back-wall glow
  const bgGlow = c.createRadialGradient(0, 0, w * 0.2, 0, 0, w * 0.8);
  bgGlow.addColorStop(0, glow);
  bgGlow.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = bgGlow;
  c.fillRect(-w, -h, w * 2, h * 2);

  // TV Outer Frame with metallic border
  c.save();
  c.shadowColor = 'rgba(0, 0, 0, 0.9)';
  c.shadowBlur = 60;
  c.shadowOffsetY = 30;
  c.fillStyle = '#09090e';
  c.beginPath();
  c.roundRect(-w / 2 - 12, -h / 2 - 12, w + 24, h + 24, 20);
  c.fill();
  c.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  c.lineWidth = 2;
  c.stroke();
  c.restore();

  // TV Display
  c.save();
  c.beginPath();
  c.roundRect(-w / 2, -h / 2, w, h, 12);
  c.clip();

  if (imgTv.complete) {
    c.drawImage(imgTv, -w / 2, -h / 2, w, h);
  } else {
    c.fillStyle = '#000';
    c.fillRect(-w / 2, -h / 2, w, h);
  }

  // Live animated equalizer bars overlaid along bottom of TV screen
  const barCount = 36;
  const barW = (w - 80) / barCount;
  for (let i = 0; i < barCount; i++) {
    const k = i / barCount;
    const wave = Math.sin(k * 10 + t * 14) * 0.4 + Math.cos(k * 22 - t * 9) * 0.3 + 0.35;
    const barH = clamp(wave, 0.08, 0.95) * 55;
    const bx = -w / 2 + 40 + i * barW;
    const by = h / 2 - 24;

    const col = k < 0.33 ? T.teal : (k < 0.66 ? T.purple : T.pink);
    c.fillStyle = col;
    c.shadowColor = col;
    c.shadowBlur = 8;
    c.fillRect(bx, by - barH, barW - 3, barH);
  }

  // Realtime Room Code badge on TV
  pill(c, -w / 2 + 24, -h / 2 + 24, 160, 36, 'rgba(5,5,8,0.85)', 'rgba(45,212,191,0.5)', 8);
  txt(c, 'ROOM: S4JC', -w / 2 + 40, -h / 2 + 47, { size: 14, weight: 800, font: F.mono, color: T.teal });
  c.fillStyle = T.green;
  c.beginPath();
  c.arc(-w / 2 + 160, -h / 2 + 42, 4, 0, Math.PI * 2);
  c.fill();

  c.restore();
  c.restore();
}

// ==============================================================
// SCENE 1: HOOK (0.0 - 3.0s) — "Every room has a stage."
// ==============================================================
function sceneHook(c, t) {
  c.fillStyle = T.bg;
  c.fillRect(0, 0, W, H);
  drawStars(c, t, 0.4);

  // Perspective 3D grid floor
  c.save();
  c.translate(W / 2, H * 0.72);
  const gridG = c.createLinearGradient(0, -200, 0, 400);
  gridG.addColorStop(0, 'rgba(45, 212, 191, 0)');
  gridG.addColorStop(0.3, 'rgba(45, 212, 191, 0.15)');
  gridG.addColorStop(1, 'rgba(45, 212, 191, 0.4)');
  c.strokeStyle = gridG;
  c.lineWidth = 1.5;

  const fov = 350;
  for (let z = 100; z < 1400; z += 90) {
    const scale = fov / z;
    const y = (1 - scale) * 380;
    c.beginPath();
    c.moveTo(-W * 1.2 * scale, y);
    c.lineTo(W * 1.2 * scale, y);
    c.stroke();
  }
  for (let x = -800; x <= 800; x += 100) {
    c.beginPath();
    c.moveTo(x * 0.2, 0);
    c.lineTo(x * 2.2, 400);
    c.stroke();
  }
  c.restore();

  // Words: "EVERY" -> "ROOM" -> "HAS A" -> "STAGE."
  // Timestamped: l1 start = 0.30s; words: Every@0.30, room@0.64, has@0.88, a@1.07, stage@1.14
  const words = [
    { text: 'EVERY', tIn: 0.30, col: T.white },
    { text: 'ROOM', tIn: 0.64, col: T.white },
    { text: 'HAS A', tIn: 0.88, col: T.grey },
    { text: 'STAGE.', tIn: 1.14, col: T.teal, glow: 30 },
  ];

  // Stage Spotlight Beam triggering exactly on "STAGE." (t = 1.14s)
  const spotK = p(t, 1.14, 1.45);
  if (spotK > 0) {
    c.save();
    c.translate(W / 2, 0);
    const spotGrad = c.createRadialGradient(0, 50, 20, 0, H * 0.65, 500);
    spotGrad.addColorStop(0, `rgba(45, 212, 191, ${spotK * 0.6})`);
    spotGrad.addColorStop(0.6, `rgba(45, 212, 191, ${spotK * 0.15})`);
    spotGrad.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = spotGrad;
    c.beginPath();
    c.moveTo(-40, 0);
    c.lineTo(40, 0);
    c.lineTo(380 * spotK, H);
    c.lineTo(-380 * spotK, H);
    c.closePath();
    c.fill();
    c.restore();
  }

  // Kinetic typography display
  c.save();
  const currentWordIdx = words.findIndex((w, i) => t >= w.tIn && (i === words.length - 1 || t < words[i + 1].tIn));
  if (currentWordIdx >= 0) {
    const cur = words[currentWordIdx];
    const age = t - cur.tIn;
    const scale = E.oBack(clamp(age / 0.25, 0, 1), 2.2);
    const alpha = clamp(age / 0.1, 0, 1);

    c.translate(W / 2, H * 0.42);
    c.scale(scale, scale);
    txt(c, cur.text, 0, 0, {
      size: 140, weight: 900, font: F.display,
      color: cur.col, align: 'center', base: 'middle',
      ls: -4, alpha, glow: cur.glow || (cur.col === T.teal ? 30 : 0)
    });
  }
  c.restore();

  // Floating sub-tagline
  if (t > 1.4) {
    const tagK = p(t, 1.4, 1.8);
    txt(c, 'TURN ANY SCREEN INTO AN INTERACTIVE KARAOKE STAGE', W / 2, H * 0.58, {
      size: 18, weight: 700, font: F.mono, color: T.grey, align: 'center',
      ls: 4, alpha: tagK * (1 - p(t, 2.7, 3.0))
    });
  }

  // Pre-drop snare rush flash
  if (t > 2.6) {
    const flashK = p(t, 2.6, 3.0);
    c.fillStyle = `rgba(45, 212, 191, ${flashK * 0.25})`;
    c.fillRect(0, 0, W, H);
  }
}

// ==============================================================
// SCENE 2: IDENTITY / DROP 1 (3.0 - 5.0s) — "Put OKEKARAOKE on the big screen…"
// ==============================================================
function sceneBrand(c, t) {
  const dt = t - 3.0;
  c.fillStyle = T.bg;
  c.fillRect(0, 0, W, H);
  drawStars(c, t, 2.0);

  // Impact Shockwave Rings from Drop 1
  for (let r = 0; r < 3; r++) {
    const ringT = dt - r * 0.12;
    if (ringT > 0 && ringT < 1.4) {
      const radius = ringT * 600;
      const alpha = (1 - ringT / 1.4) * 0.6;
      c.save();
      c.strokeStyle = r === 0 ? T.teal : (r === 1 ? T.purple : T.white);
      c.lineWidth = (1 - ringT / 1.4) * 8;
      c.shadowColor = c.strokeStyle;
      c.shadowBlur = 20;
      c.globalAlpha = alpha;
      c.beginPath();
      c.arc(W / 2, H * 0.38, radius, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }
  }

  // Brand Logo Slam & Bounce
  const logoScale = E.oBack(clamp(dt / 0.45, 0, 1), 2.4);
  const logoAlpha = clamp(dt / 0.1, 0, 1);
  c.save();
  c.translate(W / 2, H * 0.34);
  c.scale(logoScale, logoScale);
  c.globalAlpha = logoAlpha;

  // Soft circular backlight plate so dark logo elements pop
  c.fillStyle = 'rgba(255, 255, 255, 0.08)';
  c.beginPath();
  c.arc(0, 0, 130, 0, Math.PI * 2);
  c.fill();

  // Ambient logo halo
  const halo = c.createRadialGradient(0, 0, 40, 0, 0, 220);
  halo.addColorStop(0, 'rgba(45, 212, 191, 0.55)');
  halo.addColorStop(0.5, 'rgba(45, 212, 191, 0.15)');
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = halo;
  c.fillRect(-240, -240, 480, 480);

  if (imgLogo.complete) {
    c.shadowColor = T.teal;
    c.shadowBlur = 30;
    c.drawImage(imgLogo, -120, -120, 240, 240);
  }
  c.restore();

  // Kinetic Staggered Letters: "OKEKARAOKE"
  const letters = 'OKEKARAOKE'.split('');
  const startLetterT = 3.25;
  const letterStep = 0.038;
  const letterSize = 88;
  const totalW = tw(c, 'OKEKARAOKE', letterSize, 900, F.display, -2);
  let curX = W / 2 - totalW / 2;

  letters.forEach((char, idx) => {
    const lT = startLetterT + idx * letterStep;
    const lAge = t - lT;
    const lK = E.oBack(clamp(lAge / 0.28, 0, 1), 2.5);
    const lAlpha = clamp(lAge / 0.08, 0, 1);
    const charW = tw(c, char, letterSize, 900, F.display, -2);

    if (t >= lT) {
      c.save();
      c.translate(curX + charW / 2, H * 0.62);
      c.scale(lK, lK);
      c.globalAlpha = lAlpha;
      const isTeal = idx < 3;
      txt(c, char, 0, 0, {
        size: letterSize, weight: 900, font: F.display,
        color: isTeal ? T.teal : T.white, align: 'center', base: 'middle',
        ls: -2, glow: isTeal ? 28 : 0
      });
      c.restore();
    }
    curX += charW;
  });

  // Feature pill: "TV-FIRST KARAOKE • CONTROL FROM ANY PHONE"
  if (dt > 0.8) {
    const pillK = p(dt, 0.8, 1.2);
    pill(c, W / 2 - 250, H * 0.74, 500, 44, 'rgba(13, 148, 136, 0.15)', 'rgba(45, 212, 191, 0.4)', 22);
    txt(c, 'TV-FIRST SYSTEM • PHONE CONTROL • NO APP NEEDED', W / 2, H * 0.768, {
      size: 13, weight: 800, font: F.mono, color: T.teal, align: 'center',
      ls: 2, alpha: pillK
    });
  }
}

// ==============================================================
// SCENE 3: BIG SCREEN & TV VIEW (5.0 - 9.0s) — "…and every phone becomes the remote."
// ==============================================================
function sceneBigScreen(c, t) {
  const dt = t - 5.0;
  c.fillStyle = T.bg;
  c.fillRect(0, 0, W, H);
  drawStars(c, t, 0.8);

  // Center TV Screen Entrance
  const tvScale = E.oBack(clamp(dt / 0.6, 0, 1), 1.2);
  const tvY = lerp(H * 0.46, H * 0.40, clamp(dt / 3.0, 0, 1));
  drawTvScreen(c, W / 2, tvY, 960, 540, { t, scale: tvScale });

  // Floating phones swooping in on "every phone" (t >= 6.1s)
  if (t >= 6.0) {
    const pT = t - 6.0;

    // Left Phone (Search UI)
    const p1K = E.oBack(clamp(pT / 0.65, 0, 1), 1.5);
    const p1X = lerp(-250, 320, p1K);
    const p1Y = lerp(H + 300, H * 0.64, p1K);
    drawPhone(c, imgSearch, p1X, p1Y, 280, 590, {
      rz: 0.12, rx: -0.05, ry: 0.08, elevation: 45,
      borderGlow: 'rgba(45, 212, 191, 0.6)'
    });

    // Right Phone (Queue UI)
    const p2K = E.oBack(clamp((pT - 0.2) / 0.65, 0, 1), 1.5);
    const p2X = lerp(W + 250, W - 320, p2K);
    const p2Y = lerp(H + 300, H * 0.66, p2K);
    drawPhone(c, imgQueue, p2X, p2Y, 280, 590, {
      rz: -0.14, rx: 0.05, ry: -0.08, elevation: 45,
      borderGlow: 'rgba(168, 85, 247, 0.6)'
    });

    // Data sync laser beams connecting phones to the central TV
    if (t >= 6.8) {
      const beamK = clamp((t - 6.8) / 0.5, 0, 1);
      c.save();
      c.lineWidth = 3;
      c.setLineDash([12, 8]);
      c.lineDashOffset = -t * 60;

      // Beam from left phone to TV
      c.strokeStyle = T.teal;
      c.shadowColor = T.teal;
      c.shadowBlur = 16;
      c.globalAlpha = beamK * 0.8;
      c.beginPath();
      c.moveTo(p1X + 80, p1Y - 140);
      c.quadraticCurveTo(W * 0.35, tvY + 80, W / 2 - 200, tvY + 120);
      c.stroke();

      // Beam from right phone to TV
      c.strokeStyle = T.purple;
      c.shadowColor = T.purple;
      c.beginPath();
      c.moveTo(p2X - 80, p2Y - 140);
      c.quadraticCurveTo(W * 0.65, tvY + 80, W / 2 + 200, tvY + 120);
      c.stroke();
      c.restore();
    }
  }

  // Floating connection pill at top
  const toastK = clamp((dt - 1.2) / 0.4, 0, 1);
  if (toastK > 0) {
    pill(c, W / 2 - 220, 48, 440, 48, 'rgba(5, 5, 8, 0.92)', 'rgba(45, 212, 191, 0.5)', 24);
    txt(c, '⚡ REALTIME SYNC • ZERO LATENCY WEBSOCKETS', W / 2, 77, {
      size: 13, weight: 800, font: F.mono, color: T.teal, align: 'center',
      ls: 2, alpha: toastK
    });
  }
}

// ==============================================================
// SCENE 4: SEARCH & RESERVE (9.0 - 12.0s) — "Search any song. Reserve your turn."
// ==============================================================
function sceneSearch(c, t) {
  const dt = t - 9.0;
  c.fillStyle = T.bg;
  c.fillRect(0, 0, W, H);
  drawStars(c, t, 0.6);

  // Big focused Hero Phone at center stage
  const phoneScale = E.oBack(clamp(dt / 0.5, 0, 1), 1.15);
  c.save();
  c.translate(W * 0.38, H * 0.52);
  c.scale(phoneScale, phoneScale);
  drawPhone(c, imgSearch, 0, 0, 420, 880, {
    rz: -0.02, elevation: 50, borderGlow: 'rgba(45, 212, 191, 0.4)'
  });

  // Simulated Live Interactive Search Typing on Phone Screen
  // l4 word: Search@9.05, song@9.64
  const query = 'Rivermaya';
  const typeStart = 9.25;
  const typeK = clamp((t - typeStart) / 0.8, 0, 1);
  const charCount = Math.floor(typeK * query.length);
  const typedText = query.slice(0, charCount);

  // Overlay simulated active search bar
  const sbX = -170, sbY = -230, sbW = 340, sbH = 46;
  pill(c, sbX, sbY, sbW, sbH, '#181822', T.teal, 14);
  txt(c, typedText, sbX + 42, sbY + 28, { size: 16, weight: 600, font: F.sans, color: T.white });
  // Blinking cursor
  if (Math.sin(t * 12) > 0) {
    const curOffset = tw(c, typedText, 16, 600, F.sans);
    c.fillStyle = T.teal;
    c.fillRect(sbX + 45 + curOffset, sbY + 12, 2.5, 22);
  }

  // Interactive Tap Ripple on "+ RESERVE" button (t = 10.5s on "Reserve")
  if (t >= 10.5) {
    const tapAge = t - 10.5;
    const btnX = 65, btnY = -70; // Position over Reserve button
    if (tapAge < 0.6) {
      const tapR = tapAge * 90;
      c.strokeStyle = T.teal;
      c.lineWidth = 3;
      c.globalAlpha = 1 - tapAge / 0.6;
      c.beginPath();
      c.arc(btnX, btnY, tapR, 0, Math.PI * 2);
      c.stroke();
    }

    // Success State Pill replacing button
    pill(c, 0, -88, 160, 42, T.green, 'rgba(255,255,255,0.4)', 12);
    txt(c, '✓ RESERVED #1', 80, -62, { size: 13, weight: 900, font: F.sans, color: '#000', align: 'center' });
  }
  c.restore();

  // Right Side Feature Typography Card
  c.save();
  c.translate(W * 0.74, H * 0.46);
  const cardK = clamp(dt / 0.5, 0, 1);
  c.globalAlpha = cardK;

  txt(c, '01 / SEARCH & DISCOVER', -180, -120, { size: 14, weight: 800, font: F.mono, color: T.teal, ls: 3 });
  txt(c, 'INSTANT SONG', -180, -60, { size: 54, weight: 900, font: F.display, color: T.white, ls: -2 });
  txt(c, 'RESERVATION', -180, 0, { size: 54, weight: 900, font: F.display, color: T.teal, ls: -2 });

  txt(c, '• Massive catalog: OPM, Pop, Rock, Classics', -180, 70, { size: 18, weight: 500, font: F.sans, color: T.grey });
  txt(c, '• Filter by artist, genre or custom song code', -180, 110, { size: 18, weight: 500, font: F.sans, color: T.grey });
  txt(c, '• One-tap queue addition with instant TV sync', -180, 150, { size: 18, weight: 500, font: F.sans, color: T.grey });

  c.restore();
}

// ==============================================================
// SCENE 5: LIVE QUEUE (12.0 - 14.5s) — "Watch the queue line up, live."
// ==============================================================
function sceneQueue(c, t) {
  const dt = t - 12.0;
  c.fillStyle = T.bg;
  c.fillRect(0, 0, W, H);
  drawStars(c, t, 0.8);

  // Left Side Feature Typography
  c.save();
  c.translate(W * 0.28, H * 0.46);
  txt(c, '02 / LIVE QUEUE', -160, -120, { size: 14, weight: 800, font: F.mono, color: T.teal, ls: 3 });
  txt(c, 'REAL-TIME', -160, -60, { size: 54, weight: 900, font: F.display, color: T.white, ls: -2 });
  txt(c, 'TURN ORDER', -160, 0, { size: 54, weight: 900, font: F.display, color: T.purple, ls: -2 });

  txt(c, '• Dynamic order syncs across all guest remotes', -160, 70, { size: 18, weight: 500, font: F.sans, color: T.grey });
  txt(c, '• Reorder, delete or insert priority requests', -160, 110, { size: 18, weight: 500, font: F.sans, color: T.grey });
  txt(c, '• Live "NOW PLAYING" status with progress', -160, 150, { size: 18, weight: 500, font: F.sans, color: T.grey });
  c.restore();

  // Right Side Phone displaying Live Queue
  const pScale = E.oBack(clamp(dt / 0.45, 0, 1), 1.15);
  c.save();
  c.translate(W * 0.68, H * 0.52);
  c.scale(pScale, pScale);
  drawPhone(c, imgQueue, 0, 0, 420, 880, {
    rz: 0.03, elevation: 50, borderGlow: 'rgba(168, 85, 247, 0.5)'
  });

  // Animated Glowing "NOW PLAYING" indicator badge on song #1
  const badgePulse = Math.sin(t * 10) * 0.2 + 0.8;
  c.save();
  c.translate(110, -210);
  pill(c, -60, -14, 120, 28, 'rgba(34, 197, 94, 0.2)', T.green, 6);
  c.shadowColor = T.green;
  c.shadowBlur = 12 * badgePulse;
  txt(c, '● LIVE NOW', 0, 4, { size: 11, weight: 900, font: F.mono, color: T.green, align: 'center' });
  c.restore();

  // Floating animated queue cards drifting in
  for (let i = 0; i < 3; i++) {
    const cardAge = dt - i * 0.22;
    if (cardAge > 0) {
      const cardX = lerp(220, 180, clamp(cardAge / 0.4, 0, 1));
      const cardY = -90 + i * 115;
      c.save();
      c.globalAlpha = clamp(cardAge / 0.3, 0, 0.9);
      pill(c, cardX, cardY, 140, 48, 'rgba(13, 13, 20, 0.95)', T.teal, 10);
      txt(c, `#0${i + 2} UP NEXT`, cardX + 70, cardY + 28, { size: 12, weight: 800, font: F.mono, color: T.white, align: 'center' });
      c.restore();
    }
  }

  c.restore();
}

// ==============================================================
// SCENE 6: CHAT & HYPE (14.5 - 17.0s) — "Chat, react, and hype each other up."
// ==============================================================
function sceneChat(c, t) {
  const dt = t - 14.5;
  c.fillStyle = T.bg;
  c.fillRect(0, 0, W, H);
  drawStars(c, t, 1.2);

  // Left Side Phone showing Room Chat
  const pScale = E.oBack(clamp(dt / 0.4, 0, 1), 1.15);
  c.save();
  c.translate(W * 0.34, H * 0.52);
  c.scale(pScale, pScale);
  drawPhone(c, imgChat, 0, 0, 420, 880, {
    rz: -0.04, elevation: 50, borderGlow: 'rgba(236, 72, 153, 0.5)'
  });
  c.restore();

  // Right Side: Animated Floating Room Chat Speech Bubbles
  const chatMessages = [
    { name: 'Bert', text: 'Sound check! 🔥🎤', delay: 0.1, col: T.teal },
    { name: 'Gamzki', text: 'Galing mo idol!! 🙌🙌', delay: 0.5, col: T.purple },
    { name: 'Herrozz', text: 'Ako next sa 214! 🎶', delay: 1.0, col: T.pink },
    { name: 'Ki', text: 'Let’s goooo party! 🥳✨', delay: 1.4, col: T.amber },
  ];

  c.save();
  c.translate(W * 0.58, H * 0.35);
  chatMessages.forEach((msg, i) => {
    const age = dt - msg.delay;
    if (age > 0) {
      const scale = E.oBack(clamp(age / 0.3, 0, 1), 1.8);
      const y = i * 76;
      c.save();
      c.translate(0, y);
      c.scale(scale, scale);

      pill(c, 0, 0, 360, 58, 'rgba(18, 18, 28, 0.95)', msg.col, 16);
      txt(c, msg.name, 20, 24, { size: 12, weight: 800, font: F.mono, color: msg.col });
      txt(c, msg.text, 20, 46, { size: 17, weight: 600, font: F.sans, color: T.white });
      c.restore();
    }
  });
  c.restore();

  // Flurry of Floating Neon Reaction Emojis floating upwards with organic drift!
  const emojis = ['🔥', '❤️', '👏', '🎉', '⭐', '🔥', '🎤', '💯'];
  c.save();
  for (let i = 0; i < 24; i++) {
    const r = rng(i * 99 + 3);
    const startOffset = r() * 1.8;
    const eAge = dt - startOffset;
    if (eAge > 0) {
      const x = lerp(W * 0.2, W * 0.88, r()) + Math.sin(eAge * 4 + i) * 35;
      const y = H - eAge * 480;
      const alpha = clamp(1 - eAge / 2.2, 0, 1);
      const sz = 24 + r() * 32;

      c.font = `${sz}px sans-serif`;
      c.globalAlpha = alpha;
      c.fillText(emojis[i % emojis.length], x, y);
    }
  }
  c.restore();
}

// ==============================================================
// SCENE 7: SOLO MODE (17.0 - 21.0s) — "No TV? Go solo, on one device."
// ==============================================================
function sceneSolo(c, t) {
  const dt = t - 17.0;
  c.fillStyle = T.bg;
  c.fillRect(0, 0, W, H);
  drawStars(c, t, 1.5);

  // Retro CRT Screen Power-Off Collapse on "NO TV?" (17.0 - 17.8s)
  if (dt < 0.8) {
    const crtK = dt / 0.8;
    const hCollapse = Math.max(0.01, 1 - crtK * 1.2);
    const wCollapse = crtK > 0.6 ? Math.max(0.01, 1 - (crtK - 0.6) / 0.4) : 1;

    c.save();
    c.translate(W / 2, H / 2);
    c.scale(wCollapse, hCollapse);
    c.fillStyle = T.white;
    c.fillRect(-W / 2, -H / 2, W, H);
    c.restore();
  }

  // "NO TV? GO SOLO." Kinetic Title Slam
  if (dt >= 0.3) {
    const titleAge = dt - 0.3;
    const tScale = E.oBack(clamp(titleAge / 0.35, 0, 1), 2.0);
    c.save();
    c.translate(W * 0.26, H * 0.36);
    c.scale(tScale, tScale);
    txt(c, 'NO TV AROUND?', 0, -40, { size: 54, weight: 900, font: F.display, color: T.white, ls: -2 });
    txt(c, 'GO SOLO MODE.', 0, 24, { size: 54, weight: 900, font: F.display, color: T.teal, ls: -2, glow: 30 });
    txt(c, 'Karaoke player and remote controls integrated', 0, 80, { size: 18, weight: 500, font: F.sans, color: T.grey });
    txt(c, 'seamlessly into a single mobile screen.', 0, 110, { size: 18, weight: 500, font: F.sans, color: T.grey });
    c.restore();
  }

  // Hero Solo Phone rising proudly to Center-Right
  const pAge = dt - 0.2;
  if (pAge > 0) {
    const pK = E.oBack(clamp(pAge / 0.6, 0, 1), 1.2);
    const pScale = lerp(0.8, 1.05, pK);
    const pY = lerp(H + 200, H * 0.52, pK);

    c.save();
    c.translate(W * 0.68, pY);
    c.scale(pScale, pScale);
    drawPhone(c, imgSolo, 0, 0, 420, 880, {
      rz: 0.02, elevation: 60,
      borderGlow: 'rgba(45, 212, 191, 0.7)'
    });

    // Feature pointer pills attached to the phone
    if (dt > 1.2) {
      const pinK = clamp((dt - 1.2) / 0.4, 0, 1);
      c.globalAlpha = pinK;

      // Pointer 1: Embedded Top Video Player
      pill(c, -380, -260, 240, 44, 'rgba(5, 5, 8, 0.95)', T.teal, 12);
      txt(c, '📺 EMBEDDED PLAYER', -260, -232, { size: 12, weight: 800, font: F.mono, color: T.teal, align: 'center' });
      c.strokeStyle = T.teal;
      c.beginPath();
      c.moveTo(-140, -238);
      c.lineTo(-60, -210);
      c.stroke();

      // Pointer 2: Integrated Bottom Remote
      pill(c, -380, 180, 240, 44, 'rgba(5, 5, 8, 0.95)', T.purple, 12);
      txt(c, '📱 SEARCH & QUEUE', -260, 208, { size: 12, weight: 800, font: F.mono, color: T.purple, align: 'center' });
      c.strokeStyle = T.purple;
      c.beginPath();
      c.moveTo(-140, 202);
      c.lineTo(-60, 160);
      c.stroke();
    }
    c.restore();
  }

  // Pre-drop riser energy buildup from 19.5 to 21.0
  if (dt > 2.5) {
    const buildK = (dt - 2.5) / 1.5;
    c.fillStyle = `rgba(45, 212, 191, ${buildK * 0.25})`;
    c.fillRect(0, 0, W, H);
  }
}

// ==============================================================
// SCENE 8: FINALE / SIGN-OFF (21.0 - 25.0s) — "OKEKARAOKE. Your night. Your stage."
// ==============================================================
function sceneOutro(c, t) {
  const dt = t - 21.0;
  c.fillStyle = T.bg;
  c.fillRect(0, 0, W, H);
  drawStars(c, t, 1.8);

  // Big Celebration Radial Glow
  const halo = c.createRadialGradient(W / 2, H * 0.36, 60, W / 2, H * 0.36, 600);
  halo.addColorStop(0, 'rgba(45, 212, 191, 0.35)');
  halo.addColorStop(0.5, 'rgba(168, 85, 247, 0.15)');
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = halo;
  c.fillRect(0, 0, W, H);

  // Confetti / particle celebration flurry
  c.save();
  for (let i = 0; i < 48; i++) {
    const r = rng(i * 123 + 7);
    const rad = r() * 550 + 50;
    const ang = r() * Math.PI * 2 + dt * 0.4 * (i % 2 ? 1 : -1);
    const cx = W / 2 + Math.cos(ang) * rad;
    const cy = H * 0.36 + Math.sin(ang) * (rad * 0.6);
    const col = i % 3 === 0 ? T.teal : (i % 3 === 1 ? T.purple : T.white);

    c.fillStyle = col;
    c.globalAlpha = clamp(dt / 0.4, 0, 0.7);
    c.beginPath();
    c.arc(cx, cy, r() * 3 + 1.5, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();

  // Grand Logo Badge Center Slam
  const logoScale = E.oBack(clamp(dt / 0.5, 0, 1), 2.2);
  c.save();
  c.translate(W / 2, H * 0.28);
  c.scale(logoScale, logoScale);

  c.fillStyle = 'rgba(255, 255, 255, 0.08)';
  c.beginPath();
  c.arc(0, 0, 120, 0, Math.PI * 2);
  c.fill();

  if (imgLogo.complete) {
    c.shadowColor = T.teal;
    c.shadowBlur = 45;
    c.drawImage(imgLogo, -110, -110, 220, 220);
  }
  c.restore();

  // Main Brand Name
  if (dt > 0.2) {
    const nameK = clamp((dt - 0.2) / 0.3, 0, 1);
    txt(c, 'OKEKARAOKE', W / 2, H * 0.48, {
      size: 92, weight: 900, font: F.display,
      color: T.white, align: 'center', base: 'middle',
      ls: -3, alpha: nameK, glow: 35
    });
  }

  // Dynamic Tagline: "YOUR NIGHT. YOUR STAGE." (Synced to l8 voiceover words)
  // words: Oh-kay@21.40, karaoke@21.80, Your@22.41, night@22.63, Your@22.97, stage@23.18
  if (t >= 22.4 && t < 22.95) {
    const nightK = E.oBack(clamp((t - 22.4) / 0.22, 0, 1), 2.0);
    c.save();
    c.translate(W / 2, H * 0.60);
    c.scale(nightK, nightK);
    txt(c, 'YOUR NIGHT.', 0, 0, { size: 48, weight: 900, font: F.display, color: T.white, align: 'center', base: 'middle', ls: -1 });
    c.restore();
  } else if (t >= 22.95) {
    const stageK = E.oBack(clamp((t - 22.95) / 0.22, 0, 1), 2.0);
    c.save();
    c.translate(W / 2 - 200, H * 0.60);
    txt(c, 'YOUR NIGHT.', 0, 0, { size: 48, weight: 900, font: F.display, color: T.white, align: 'center', base: 'middle', ls: -1 });
    c.restore();

    c.save();
    c.translate(W / 2 + 180, H * 0.60);
    c.scale(stageK, stageK);
    txt(c, 'YOUR STAGE.', 0, 0, { size: 48, weight: 900, font: F.display, color: T.teal, align: 'center', base: 'middle', ls: -1, glow: 35 });
    c.restore();
  }

  // Call to Action Banner
  if (dt > 2.0) {
    const ctaK = clamp((dt - 2.0) / 0.4, 0, 1);
    c.save();
    c.globalAlpha = ctaK;
    pill(c, W / 2 - 260, H * 0.70, 520, 54, 'rgba(45, 212, 191, 0.15)', T.teal, 27);
    txt(c, '✨ SCAN & SING NOW • OKEKARAOKE.COM', W / 2, H * 0.735, {
      size: 15, weight: 800, font: F.mono, color: T.teal, align: 'center',
      ls: 2
    });
    c.restore();
  }

  // Smooth cinematic fade to black at 24.5 - 25.0s
  if (t > 24.4) {
    const fadeOut = (t - 24.4) / 0.6;
    c.fillStyle = `rgba(5, 5, 8, ${fadeOut})`;
    c.fillRect(0, 0, W, H);
  }
}

// ==============================================================
// MOTION DESIGNER HUD OVERLAY (Timecode, Brackets, Audio Progress)
// ==============================================================
function pad2(n) { return String(n).padStart(2, '0'); }

const SCENES = [
  [0.0, '01 / HOOK'],
  [3.0, '02 / IDENTITY'],
  [5.0, '03 / BIG SCREEN'],
  [9.0, '04 / SEARCH & RESERVE'],
  [12.0, '05 / LIVE QUEUE'],
  [14.5, '06 / CHAT & HYPE'],
  [17.0, '07 / SOLO MODE'],
  [21.0, '08 / SIGN-OFF'],
];

function drawHUD(c, t) {
  // Fade in HUD at start, fade out at end
  const a = p(t, 0.2, 0.8) * (1 - p(t, 24.4, 25.0));
  if (a <= 0) return;

  c.save();
  c.globalAlpha = a * 0.85;
  c.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  c.lineWidth = 1.5;

  const m = 54, L = 24;
  // 4 Corner Alignment Crosses
  for (const [x, y, sx, sy] of [
    [m, m, 1, 1],
    [W - m, m, -1, 1],
    [m, H - m, 1, -1],
    [W - m, H - m, -1, -1]
  ]) {
    c.beginPath();
    c.moveTo(x, y + sy * L);
    c.lineTo(x, y);
    c.lineTo(x + sx * L, y);
    c.stroke();
  }

  // Top Left: Project Title
  txt(c, 'OKEKARAOKE — OFFICIAL SHOWREEL ’26', m + 36, m + 14, {
    size: 13, weight: 800, font: F.mono, color: T.white, ls: 2
  });

  // Bottom Left: Active Scene Name
  let curScene = SCENES[0][1];
  for (const [sT, sName] of SCENES) {
    if (t >= sT) curScene = sName;
  }
  txt(c, curScene, m + 36, H - m - 10, {
    size: 13, weight: 800, font: F.mono, color: T.teal, ls: 2
  });

  // Top Right: SMPTE Frame-Accurate Timecode
  const totalFrames = Math.floor(t * 60);
  const sec = Math.floor(t);
  const frames = totalFrames % 60;
  txt(c, `TC 00:00:${pad2(sec)}:${pad2(frames)}`, W - m - 36, m + 14, {
    size: 13, weight: 800, font: F.mono, color: T.white, align: 'right', ls: 2
  });

  // Bottom Right: Timeline Audio Scrubber Bar
  const barW = 220;
  const bx = W - m - 36 - barW, by = H - m - 14;
  c.fillStyle = 'rgba(255, 255, 255, 0.15)';
  c.fillRect(bx, by, barW, 3);
  c.fillStyle = T.teal;
  c.shadowColor = T.teal;
  c.shadowBlur = 8;
  c.fillRect(bx, by - 0.5, barW * (t / DUR), 4);

  c.restore();
}

// Master Render Function
function render(t) {
  X.setTransform(1, 0, 0, 1, 0, 0);
  X.clearRect(0, 0, W, H);

  // Scene Router
  if (t < 3.0) {
    sceneHook(X, t);
  } else if (t < 5.0) {
    sceneBrand(X, t);
  } else if (t < 9.0) {
    sceneBigScreen(X, t);
  } else if (t < 12.0) {
    sceneSearch(X, t);
  } else if (t < 14.5) {
    sceneQueue(X, t);
  } else if (t < 17.0) {
    sceneChat(X, t);
  } else if (t < 21.0) {
    sceneSolo(X, t);
  } else {
    sceneOutro(X, t);
  }

  // Post-Processing: Cinematic Vignette
  if (VIGNETTE) {
    X.drawImage(VIGNETTE, 0, 0);
  }

  // Post-Processing: Film Grain Overlay
  if (GRAIN.length > 0) {
    X.save();
    X.globalCompositeOperation = 'overlay';
    X.globalAlpha = 0.06;
    const gi = Math.floor(t * 30) % GRAIN.length;
    X.fillStyle = GRAIN[gi];
    X.fillRect(0, 0, W, H);
    X.restore();
  }

  // Professional Motion Designer HUD
  drawHUD(X, t);
}

// Fast Base64 Frame Exporter for headless renderer
window.renderFrame = (t, q = 0.94) => {
  render(t);
  return cv.toDataURL('image/jpeg', q).split(',')[1];
};

// ==============================================================
// Bootstrapping: Preload all fonts and images before playback
// ==============================================================
const params = new URLSearchParams(location.search);

Promise.all([
  document.fonts.load('800 60px "Space Grotesk"'),
  document.fonts.load('900 60px "Space Grotesk"'),
  document.fonts.load('700 40px "Inter"'),
  document.fonts.load('900 40px "Inter"'),
  document.fonts.load('700 20px "JetBrains Mono"'),
  document.fonts.load('800 20px "JetBrains Mono"'),
  imgLogo.complete ? Promise.resolve() : new Promise(r => { imgLogo.onload = r; imgLogo.onerror = r; }),
  imgTv.complete ? Promise.resolve() : new Promise(r => { imgTv.onload = r; imgTv.onerror = r; }),
  imgSearch.complete ? Promise.resolve() : new Promise(r => { imgSearch.onload = r; imgSearch.onerror = r; }),
  imgQueue.complete ? Promise.resolve() : new Promise(r => { imgQueue.onload = r; imgQueue.onerror = r; }),
  imgChat.complete ? Promise.resolve() : new Promise(r => { imgChat.onload = r; imgChat.onerror = r; }),
  imgSolo.complete ? Promise.resolve() : new Promise(r => { imgSolo.onload = r; imgSolo.onerror = r; }),
]).catch(err => {
  console.warn('Font/Asset preload error:', err);
}).then(() => {
  initAssets();
  window.__ready = true;
  console.log('OKEKARAOKE Showreel v2 ready!');

  // Headless Render mode
  if (params.has('render')) {
    const hint = document.getElementById('hint');
    if (hint) hint.remove();
    render(0);
    return;
  }

  // Single frame preview (e.g. ?t=5.5)
  if (params.has('t')) {
    render(parseFloat(params.get('t')));
    return;
  }

  // Interactive Live Browser Preview
  const audio = new Audio('/showreel/v2/audio/mix.mp3');
  let t0 = performance.now();
  let isPlaying = false;

  cv.addEventListener('click', () => {
    audio.currentTime = 0;
    audio.play().catch(e => console.log('Audio play blocked:', e));
    t0 = performance.now();
    isPlaying = true;
    const hint = document.getElementById('hint');
    if (hint) hint.style.opacity = '0';
  });

  const loop = now => {
    if (isPlaying) {
      const t = ((now - t0) / 1000) % DUR;
      render(t);
    } else {
      render(3.5); // Default attractive preview frame while paused
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
});
