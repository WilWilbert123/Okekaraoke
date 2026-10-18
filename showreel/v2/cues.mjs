// Shared cue sheet for picture + sound. Imported by reel.js (browser) and audio.mjs (node),
// so every visual hit and every SFX lands on the exact same, word-accurate timestamp.
export function buildCues(timeline, words) {
  const at = Object.fromEntries(timeline.vo.map(v => [v.id, v.at]));
  // absolute time of word i in line id
  const w = (id, i) => +(at[id] + words[id].words[i].s).toFixed(3);
  const wEnd = (id, i) => +(at[id] + words[id].words[i].e).toFixed(3);

  const c = {
    // 01 HOOK
    hookWords: words.l1.words.map((_, i) => w('l1', i)),       // Every room has a stage.
    spotlight: w('l1', 4),                                       // light slams on "stage."
    drop1: 3.0,

    // 02 IDENTITY
    logoFall: 3.0,
    logoLand: 3.32,
    lettersStart: w('l2', 1),                                    // "Oh-kay" → wordmark builds
    letterStep: 0.048,
    tvMorphStart: 4.42,
    tvMorphEnd: w('l2', 6) + 0.1,                               // lands on "screen"

    // 03 BIG SCREEN
    phonesIn: w('l3', 2) - 0.12,                                 // "phone"
    beams: w('l3', 5),                                           // "remote."
    toast: w('l3', 5) + 0.62,
    zoomOut: 8.55,

    // 04 SEARCH
    typeStart: w('l4', 0) + 0.12,
    typeStep: 0.068,
    query: 'rivermaya',
    resultsGlow: w('l4', 2) + 0.15,                              // "song."
    tap: w('l4', 3),                                             // "Reserve"
    turnWord: w('l4', 5),
    flip: 11.62,

    // 05 LIVE QUEUE
    rowsStart: 12.15,
    rowStep: 0.17,
    liveWord: w('l5', 5),                                        // "live."
    explode: 13.05,
    whip: 14.28,

    // 06 CHAT
    chatWords: [w('l6', 0), w('l6', 1), w('l6', 3)],            // Chat / react / hype
    bubbles: [w('l6', 0) + 0.06, w('l6', 0) + 0.34, w('l6', 1), w('l6', 1) + 0.3, w('l6', 3)],
    emojiBurst: w('l6', 3),
    chatOut: 16.72,

    // 07 SOLO
    noTv: [w('l7', 0), w('l7', 1)],
    crtOff: w('l7', 1) + 0.08,
    goSolo: [w('l7', 2), w('l7', 3)],
    phoneRise: w('l7', 2) - 0.18,
    oneDevice: [w('l7', 5), w('l7', 6)],
    expand: w('l7', 5),
    build: 19.0,
    drop2: 21.0,

    // 08 SIGN-OFF
    iconSlam: 21.0,
    outroLetters: w('l8', 0),
    outroStep: 0.05,
    yourNight: [w('l8', 2), w('l8', 3)],
    yourStage: [w('l8', 4), w('l8', 5)],
    cta: wEnd('l8', 5) + 0.15,
    fadeOut: 24.55,
  };
  return c;
}
