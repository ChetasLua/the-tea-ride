'use strict';
// ---- THE SCORE: one list of notes that both the synth and the picture read -----------------------------------------
// 100 BPM, 4/4. Every event is { t, d, m, v, i, ... } in film seconds. Everything on screen that moves to the music asks Score.
//   Score.BEAT .6  Score.BAR 2.4  Score.BARS 34  Score.DUR 81.6
//   Score.tracks.koto|flute|bass|taiko|wood|shake|bell|chord|lemon|lemon2|step|flap|clack|strings   (sorted by t)
//   Score.last(track,t) / Score.next(track,t)   the latest event at or before t / the first after t (or null)
//   Score.env(track,t,decay,filter?)   summed exponential envelope of recent events (0 = silent, ~1 = just struck at full velocity)
//   Score.recent(track,t,window)       events in (t-window, t], newest first
//   Score.sec(t) -> 'INTRO'|'A'|'B'|'BRIDGE'|'C'|'OUTRO'     Score.chordAt(t) -> {root, notes, name}
//   Score.beat(t) -> {i, f}  (beat index, 0..1 phase)        Score.bar(t) -> {i, f}
// Live playing (clicks, keys) pushes extra events through Score.live(track, ev): they show up in env/last/recent like written ones.
const Score = (() => {
  const BEAT = 0.6, BAR = 2.4, BARS = 34, DUR = BARS * BAR, S = { BEAT, BAR, BARS, DUR };
  const names = ['koto', 'flute', 'bass', 'taiko', 'wood', 'shake', 'bell', 'chord', 'lemon', 'lemon2', 'step', 'flap', 'clack', 'strings', 'flute2'];
  const T = S.tracks = {}; names.forEach(n => T[n] = []);
  const add = (tr, t, d, m, v, x) => { const e = Object.assign({ t, d, m, v }, x); T[tr].push(e); return e; };
  // sections (in bars)
  const SEC = S.SEC = [['INTRO', 0, 2], ['A', 2, 10], ['B', 10, 18], ['BRIDGE', 18, 22], ['C', 22, 30], ['OUTRO', 30, 34]];
  S.sec = t => { const b = t / BAR; for (const s of SEC) if (b < s[2]) return s[0]; return 'OUTRO'; };
  S.t0 = n => SEC.find(s => s[0] === n)[1] * BAR; S.t1 = n => SEC.find(s => s[0] === n)[2] * BAR;
  // eight-note voicings, low to high: rank r of a koto note = which of the eight lanterns on a string it belongs to
  const CH = {
    D: [50, 57, 62, 66, 69, 74, 78, 81], Bm: [47, 54, 59, 62, 66, 71, 74, 78], G: [43, 50, 55, 59, 62, 69, 71, 74], A: [45, 52, 57, 59, 64, 69, 74, 76], A7: [45, 52, 57, 61, 64, 69, 73, 76],
    Em: [40, 47, 52, 55, 59, 66, 71, 74], Fsm: [42, 49, 54, 57, 61, 66, 69, 73], Dfs: [42, 50, 57, 62, 66, 69, 74, 78], B7: [47, 54, 57, 63, 66, 71, 75, 78],
    E: [52, 59, 64, 68, 71, 76, 80, 83], Csm: [49, 56, 61, 64, 68, 73, 76, 80], Aa: [45, 52, 57, 61, 64, 71, 73, 76], Bb: [47, 54, 59, 61, 66, 71, 76, 78], B: [47, 54, 59, 63, 66, 71, 75, 78], Gsm: [44, 51, 56, 59, 63, 68, 71, 75], Amaj: [45, 52, 57, 61, 64, 68, 73, 76], D2: [50, 57, 62, 64, 66, 69, 74, 78], Gm: [43, 50, 55, 58, 62, 67, 70, 74],
  };
  const PROG = S.PROG = ['D', 'D', /*A*/ 'D', 'Bm', 'G', 'A', 'D', 'Bm', 'G', 'D', /*B*/ 'G', 'D', 'Bm', 'G', 'D', 'A', 'G', 'A7', /*BR*/ 'G', 'Dfs', 'Em', 'B7', /*C*/ 'E', 'Csm', 'Amaj', 'B', 'E', 'Csm', 'Amaj', 'B', /*OUT*/ 'E', 'Csm', 'Amaj', 'D2'];
  S.chordAt = t => { const b = clamp(Math.floor(t / BAR), 0, BARS - 1), n = PROG[b]; return { name: n, notes: CH[n], root: CH[n][0], bar: b }; };
  // the pentatonic you may play over each section (for live playing): D E F# A B, up a tone in C
  S.scaleAt = t => { const b = t / BAR, k = b >= 22 && b < 33 ? 2 : 0; return [50, 52, 54, 57, 59].map(m => m + k); };
  S.quant = (m, t) => { const sc = S.scaleAt(t); let best = m, bd = 99; for (let o = -2; o <= 4; o++) for (const s of sc) { const q = s + o * 12, d = Math.abs(q - m); if (d < bd) { bd = d; best = q; } } return best; };
  for (let b = 0; b < BARS; b++) add('chord', b * BAR, BAR, CH[PROG[b]][0], 1, { name: PROG[b], notes: CH[PROG[b]], bar: b });

  // ---- melodies (beats, beats, midi) -----------------------------------------------------------------------------------------
  const M1 = [[[0, 1, 66], [1, .5, 69], [1.5, .5, 71], [2, 1.5, 74], [3.5, .5, 71]], [[0, 1, 69], [1, 1, 66], [2, 2, 71]], [[0, .5, 74], [.5, .5, 76], [1, 1, 74], [2, 1, 71], [3, 1, 69]], [[0, 1.5, 76], [1.5, .5, 74], [2, 2, 69]],
    [[0, 1, 78], [1, .5, 76], [1.5, .5, 74], [2, 1.5, 71], [3.5, .5, 74]], [[0, 1, 71], [1, 1, 69], [2, 1, 66], [3, 1, 69]], [[0, 1, 71], [1, 1, 74], [2, 1, 76], [3, 1, 74]], [[0, 3, 74], [3, 1, 69]]];
  // the flight theme (written in E): wide leaps, long tops
  const M3 = [[[0, 1.5, 76], [1.5, .5, 78], [2, 1, 80], [3, 1, 83]], [[0, 2, 85], [2, .5, 83], [2.5, .5, 80], [3, 1, 78]], [[0, 1, 80], [1, 1, 76], [2, 1.5, 73], [3.5, .5, 76]], [[0, 1.5, 78], [1.5, .5, 75], [2, 2, 78]],
    [[0, 1, 80], [1, .5, 83], [1.5, .5, 85], [2, 2, 88]], [[0, 1, 85], [1, 1, 83], [2, 1, 80], [3, .5, 78], [3.5, .5, 80]], [[0, 1, 81], [1, 1, 80], [2, 1, 76], [3, 1, 73]], [[0, 1, 75], [1, 1, 78], [2, 1, 83], [3, 1, 80]]];
  const mel = (tr, bar0, M, n0, n1, tp, v, x) => { for (let k = n0; k < n1; k++) M[k].forEach(n => add(tr, (bar0 + k - n0) * BAR + n[0] * BEAT, n[1] * BEAT, n[2] + tp, v, x)); };
  mel('flute', 2, M1, 0, 8, 0, 0.85);                                  // A: the tea steam sings the tune
  mel('flute', 22, M3, 0, 8, 0, 1.0);                                  // C: the flight theme in E
  // the second voice joins for the last half of the flight, a sixth or third under
  const M3b = [[[0, 1, 76], [1, .5, 80], [1.5, .5, 80], [2, 2, 83]], [[0, 1, 80], [1, 1, 80], [2, 1, 76], [3, .5, 75], [3.5, .5, 76]], [[0, 1, 73], [1, 1, 76], [2, 1, 73], [3, 1, 69]], [[0, 1, 71], [1, 1, 75], [2, 1, 78], [3, 1, 76]]];
  mel('flute2', 26, M3b, 0, 4, 0, 0.7);
  // B, the tea break: two long breaths
  [[10, 2, 2, 74], [11, 0, 1.5, 71], [11, 1.5, .5, 69], [11, 2, 2, 66]].forEach(n => add('flute', n[0] * BAR + n[1] * BEAT, n[2] * BEAT, n[3], 0.55));
  // bridge: high and slow over the roofs
  [[18, 0, 3, 78], [18, 3, 1, 76], [19, 0, 2, 74], [19, 2, 2, 81], [20, 0, 3, 79 - 1], [20, 3, 1, 76], [21, 0, 2, 75], [21, 2, 1, 78], [21, 3, 1, 83]].forEach(n => add('flute', n[0] * BAR + n[1] * BEAT, n[2] * BEAT, n[3], 0.8));
  // outro
  [[30, 1, 1, 83], [30, 2, 1, 80], [30, 3, 1, 78], [31, 0, 2, 76], [31, 2, 2, 73], [32, 0, 1, 76], [32, 1, 1, 73], [32, 2, 2, 69], [33, 0, 2.5, 66]].forEach((n, k) => add('flute', n[0] * BAR + n[1] * BEAT, n[2] * BEAT, n[3], 0.8 - k * 0.04));

  // ---- koto: one string of eight lanterns per bar -----------------------------------------------------------------------------
  const PAT = [[0, 2, 4, 5, 7, 5, 4, 2], [0, 3, 5, 6, 7, 6, 5, 3], [0, 2, 3, 5, 6, 5, 7, 4], [0, 4, 2, 5, 3, 6, 4, 7]];
  for (let b = 0; b < BARS; b++) {
    const t0 = b * BAR, ch = CH[PROG[b]], s = S.sec(t0 + 0.01);
    if (b === 0) { [0, 2, 4, 5].forEach((r, i) => add('koto', t0 + i * BEAT, 2.0, ch[r], 0.5 + 0.08 * i, { r, b, n: i })); continue; }
    if (b === 10 || b === 11) { [0, 3, 5, 7].forEach((r, i) => add('koto', t0 + i * BEAT, 1.8, ch[r], 0.42, { r, b, n: i, harm: 1 })); continue; }       // tea: single drops, harmonics
    if (s === 'C') { for (let i = 0; i < 16; i++) { const r = [0, 2, 4, 5, 7, 5, 4, 2, 3, 5, 6, 7, 6, 5, 4, 3][i]; add('koto', t0 + i * BEAT / 4, 0.9, ch[r], i % 4 === 0 ? 0.8 : 0.48, { r, b, n: i }); } continue; }
    if (b === 33) { [0, 2, 3, 4, 5, 6, 7].forEach((r, i) => add('koto', t0 + i * 0.055, 3.4, ch[r], 0.75, { r, b, n: i })); continue; }
    if (b === 32) { [0, 2, 4, 5, 7, 5].forEach((r, i) => add('koto', t0 + i * BEAT * 0.66, 1.8, ch[r], 0.6 - i * 0.04, { r, b, n: i })); continue; }
    const P = PAT[b % 4], soft = s === 'B' ? 0.62 : s === 'BRIDGE' ? 0.8 : 1; for (let i = 0; i < 8; i++) add('koto', t0 + i * BEAT / 2, 1.5, ch[P[i]], (i % 2 ? 0.5 : i === 0 ? 0.9 : 0.72) * soft, { r: P[i], b, n: i });
  }
  // ---- bass ------------------------------------------------------------------------------------------------------------------
  for (let b = 1; b < BARS; b++) { const t0 = b * BAR, ch = CH[PROG[b]], lo = m => m > 46 ? m - 12 : m, s = S.sec(t0 + 0.01); if (b === 33) { add('bass', t0, 3, lo(ch[0]), 0.9); continue; }
    if (s === 'C') { [[0, 0, 1], [1.5, 0, .7], [2, 1, .85], [3, 0, .7], [3.5, 1, .6]].forEach(n => add('bass', t0 + n[0] * BEAT, 0.6, lo(ch[n[1]]), n[2])); continue; }
    if (b === 10 || b === 11 || s === 'OUTRO') { add('bass', t0, 2.0, lo(ch[0]), 0.7); continue; }
    add('bass', t0, 1.0, lo(ch[0]), 0.95); add('bass', t0 + 2 * BEAT, 0.8, lo(ch[1]), 0.7); if (b % 2) add('bass', t0 + 3.5 * BEAT, 0.3, lo(ch[1]) + 0, 0.5); }
  // ---- lemon xylophone (B, bars 12-17): one lemon hops the tune along the crockery; a second answers -----------------------------
  const L1 = [[[0, .5, 71], [.5, .5, 74], [1, .5, 78], [1.5, .5, 76], [2, 1, 74], [3, 1, 71]], [[0, .5, 74], [.5, .5, 71], [1, .5, 69], [1.5, .5, 71], [2, 1, 74], [3, 1, 78]],
    [[0, .5, 81], [.5, .5, 78], [1, .5, 76], [1.5, .5, 74], [2, .5, 76], [2.5, .5, 78], [3, 1, 74]], [[0, .5, 76], [.5, .5, 74], [1, .5, 71], [1.5, .5, 69], [2, .5, 71], [2.5, .5, 74], [3, 1, 76]],
    [[0, .25, 74], [.25, .25, 76], [.5, .25, 78], [.75, .25, 81], [1, .5, 83], [1.5, .5, 81], [2, .5, 78], [2.5, .5, 76], [3, .5, 74], [3.5, .5, 71]], [[0, .5, 69], [.5, .5, 71], [1, .5, 74], [1.5, .5, 76], [2, .25, 78], [2.25, .25, 81], [2.5, .25, 83], [2.75, 1.25, 86]]];
  mel('lemon', 12, L1, 0, 6, 0, 0.9);
  const L2 = [null, null, [[0, 1, 62], [1, 1, 66], [2, 1, 69], [3, 1, 66]], [[0, 1, 64], [1, 1, 69], [2, 1, 64], [3, 1, 69]], [[0, 1, 67 - 1], [1, 1, 71 - 2], [2, 1, 74], [3, 1, 71]], [[0, 1, 64], [1, 1, 69], [2, 1, 73], [3, 1, 76]]];
  L2.forEach((bar, k) => bar && bar.forEach(n => add('lemon2', (12 + k) * BAR + n[0] * BEAT, n[1] * BEAT, n[2], 0.7)));
  // ---- drums -----------------------------------------------------------------------------------------------------------------
  const tk = (b, beat, v, sz) => add('taiko', b * BAR + beat * BEAT, 0.6, 0, v, { sz: sz || 1 });
  tk(2, 0, 0.9, 1); tk(6, 0, 0.6); tk(9, 3, 0.4); tk(9, 3.5, 0.5); tk(12, 0, 1.0, 1.1); tk(12, 0.5, 0.4); for (let b = 13; b < 18; b++) { tk(b, 0, 0.55); if (b % 2) { tk(b, 2.5, 0.35); } }
  tk(18, 0, 0.9); tk(19, 0, 0.5); tk(20, 0, 0.6); tk(20, 2, 0.4); for (let i = 0; i < 16; i++) tk(21, i / 4, 0.2 + 0.045 * i, 0.8);                           // run-up roll
  for (let b = 22; b < 30; b++) { tk(b, 0, b === 22 ? 1.1 : 0.9, 1); tk(b, 1.5, 0.5); tk(b, 2, 0.75, 0.9); tk(b, 3, 0.45, 0.8); tk(b, 3.5, 0.55, 0.8); }
  tk(30, 0, 1.15, 1.1); tk(33, 0, 0.5, 1.1);
  for (let b = 2; b < 30; b++) { const s = S.sec(b * BAR + .01), t0 = b * BAR; if (b === 10 || b === 11) continue; if (s === 'BRIDGE' && b < 20) { add('wood', t0 + 2 * BEAT, 0, 0, 0.3, { hi: 1 }); continue; }
    add('wood', t0 + 1 * BEAT, 0, 0, 0.6, { hi: 0 }); add('wood', t0 + 3 * BEAT, 0, 0, 0.55, { hi: 1 }); if (b % 2 === 1) add('wood', t0 + 3.5 * BEAT, 0, 0, 0.35, { hi: 1 }); if (s === 'C') { add('wood', t0 + 2.5 * BEAT, 0, 0, 0.35, { hi: 0 }); } }
  for (let b = 6; b < 30; b++) { const s = S.sec(b * BAR + .01); if (b === 10 || b === 11 || (s === 'BRIDGE' && b < 20)) continue; const n = s === 'C' ? 16 : 8; for (let i = 0; i < n; i++) add('shake', b * BAR + i * BAR / n, 0, 0, i % (n / 4) === 0 ? 0.6 : 0.32); }
  // ---- bells: light catching things --------------------------------------------------------------------------------------------
  [[1, 3], [2, 0], [4, 0], [6, 0], [8, 0], [10, 0], [18, 0], [19, 0], [20, 0], [21, 0], [22, 0], [23, 0], [24, 0], [25, 0], [26, 0], [27, 0], [28, 0], [29, 0], [30, 0], [31, 0], [32, 0], [33, 0]].forEach(e => { const ch = CH[PROG[e[0]]]; add('bell', e[0] * BAR + e[1] * BEAT, 2.4, ch[6] + 12 > 93 ? ch[6] : ch[6] + 12, e[0] < 2 ? 0.3 : 0.55); if (e[0] >= 18) add('bell', e[0] * BAR + e[1] * BEAT + BEAT * 2, 2.0, ch[7] + 12 > 93 ? ch[7] : ch[7] + 12, 0.35); });
  // ---- strings: chord beds ------------------------------------------------------------------------------------------------------
  for (let b = 4; b < BARS; b++) { const s = S.sec(b * BAR + .01), v = { A: 0.4, B: 0.3, BRIDGE: 0.95, C: 0.85, OUTRO: 0.55 }[s]; if (b === 10 || b === 11) continue; add('strings', b * BAR, b === 33 ? 3.2 : BAR, 0, v, { notes: CH[PROG[b]].slice(1, 6), low: CH[PROG[b]].slice(0, 5) }); }
  // ---- print blocks at the head, the seal at the end ------------------------------------------------------------------------------
  for (let i = 0; i < 4; i++) add('clack', i * BEAT, 0.2, 0, 0.8, { k: i }); add('clack', 33 * BAR + 2 * BEAT, 0.2, 0, 1.0, { k: 9, seal: 1 });
  // ---- feet: touchdown times (foot 0 = near/left side, 1 = far), then wingbeats -------------------------------------------------------
  S.T_RUN = 21 * BAR; S.T_OFF = 22 * BAR; S.T_TOUCH = 30 * BAR;
  { let k = 0; for (let t = 0; t < S.T_RUN - 1e-6; t += BEAT) add('step', t, 0, 0, 1, { foot: k++ % 2 }); for (let t = S.T_RUN; t < S.T_OFF - 1e-6; t += BEAT / 2) add('step', t, 0, 0, 1.1, { foot: k++ % 2, run: 1 }); }
  // downstrokes: hard and fast off the pier, then one per beat pair, with two glides
  { const F = []; for (let i = -2; i < 8; i++) F.push(S.T_OFF + i * BEAT); for (let b = 24; b < 29; b++) { if (b === 25 || b === 27) { F.push(b * BAR); continue; } for (let i = 0; i < 4; i += (b === 28 ? 2 : 1)) F.push(b * BAR + i * BEAT); } F.push(29 * BAR, 29 * BAR + 2 * BEAT, 29 * BAR + 3 * BEAT); F.forEach((t, i) => add('flap', t, (F[i + 1] || t + 1.2) - t, 0, t < S.T_OFF + 2.4 ? 1 : 0.75)); }
  names.forEach(n => T[n].sort((a, b) => a.t - b.t).forEach((e, i) => e.i = i));

  // ---- story cues (film seconds), shared by every module --------------------------------------------------------------------------
  S.CUE = { SUN: 4.8, GIRAFFE: 9.6, TURTLE: 14.4, SIP1: 24.6, BUMP: 28.8, GULP: 43.2, HONK: 45.6, RUN: 50.4, OFF: 52.8, SIP2: 64.9, TOUCH: 72.0, SIP3: 75.2, PRINT: 78.6, SEAL: 80.4 };
  S.SIPS = [S.CUE.SIP1, S.CUE.SIP2, S.CUE.SIP3];                         // each lasts 2.4 s: lift .6, drink 1.0, lower .8
  // how far through a sip are we: 0 none .. 1 cup at the lips (smooth), including live ones (Score.live('sip',{t}))
  S.sipK = (t, at) => { const u = t - at; return u < 0 || u > 2.4 ? 0 : u < .6 ? sm(0, .6, u) : u < 1.6 ? 1 : 1 - sm(1.6, 2.4, u); };
  // ---- queries -------------------------------------------------------------------------------------------------------------------
  const liveEv = {}; names.forEach(n => liveEv[n] = []);
  // a live note lands on the next sixteenth, for the ear and the eye alike (o.now = at once)
  S.live = (tr, e, o) => { const L = liveEv[tr] || (liveEv[tr] = []), g = BEAT / 4, ev = Object.assign({ d: 0.6, m: 62, v: 0.8, live: 1 }, e); if (!(o && o.now)) ev.t = Math.ceil((ev.t + 0.008) / g) * g; L.push(ev); if (L.length > 64) L.shift(); if (S.onLive) S.onLive(tr, ev); return ev; };
  S.clearLive = () => { for (const k in liveEv) liveEv[k].length = 0; };
  const idxAt = (A, t) => { let lo = 0, hi = A.length; while (lo < hi) { const m = (lo + hi) >> 1; if (A[m].t <= t) lo = m + 1; else hi = m; } return lo - 1; };
  S.last = (tr, t) => { const A = T[tr], i = idxAt(A, t); return i >= 0 ? A[i] : null; };
  S.next = (tr, t) => { const A = T[tr], i = idxAt(A, t); return i + 1 < A.length ? A[i + 1] : null; };
  S.recent = (tr, t, w) => { const A = T[tr], out = []; for (let i = idxAt(A, t); i >= 0 && A[i].t > t - w; i--) out.push(A[i]); const L = liveEv[tr]; if (L) for (const e of L) if (e.t <= t && e.t > t - w) out.push(e); return out; };
  S.env = (tr, t, decay = 0.35, filt) => { let s = 0; const w = decay * 5; const A = T[tr]; for (let i = idxAt(A, t); i >= 0 && A[i].t > t - w; i--) if (!filt || filt(A[i])) s += A[i].v * Math.exp(-(t - A[i].t) / decay); const L = liveEv[tr]; if (L) for (const e of L) if (e.t <= t && e.t > t - w && (!filt || filt(e))) s += e.v * Math.exp(-(t - e.t) / decay); return s; };
  S.beat = t => { const b = t / BEAT, i = Math.floor(b); return { i, f: b - i }; };
  S.bar = t => { const b = t / BAR, i = Math.floor(b); return { i, f: b - i }; };
  // smooth loudness of the whole band, 0..1, for things that breathe with the music
  S.level = keyedLin([[0, .12], [2.4, .25], [4.8, .6], [24, .6], [24.6, .25], [28.8, .7], [43.2, .6], [50.4, .75], [52.8, 1], [71, 1], [72.6, .6], [79, .2], [81.6, .05]]);
  // the sung line as a continuous pitch (midi) and breath (0..1): what the steam ribbon draws
  S.sing = t => { const A = T.flute, i = idxAt(A, t); if (i < 0) return { m: 69, a: 0 }; const e = A[i], u = t - e.t, p = i > 0 ? A[i - 1] : e, g = sm(0, 0.07, u); const a = e.v * sm(0, 0.06, u) * (1 - sm(e.d - 0.02, e.d + 0.22, u)); return { m: lerp(Math.abs(p.m - e.m) < 9 ? p.m : e.m, e.m, g) + 0.18 * Math.sin(u * 33) * sm(0.2, 0.5, u), a, e }; };
  return S;
})();
