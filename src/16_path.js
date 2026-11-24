'use strict';
// ---- THE RIDE: where the pelican is at film time t. Pure function of t ---------------------------------------------------------
// World: x to screen right, y up, z toward the lens. The street runs along x; the bird walks toward -x (screen left). Street y = 0, lake water y = WATER.
// Path.bird(t) -> { pos, yaw, pitch, roll, vel, speed, mode:'walk'|'run'|'fly'|'ski'|'float', phase, s, wing (0 folded .. 1 spread), flap (-1 up .. 1 down), legs (0 stand .. 1 tucked), k }
//   pose the model with group.rotation.set(roll, yaw, pitch, 'YZX'): pitch + = nose up, roll + = leans right (local +Z is the bird's right)
//   pos = point on the ground/water under the bird's middle (walk) or the body's own ground reference (fly). Forward (local +X) = (cos yaw, 0, -sin yaw).
//   phase = gait phase in steps (integer part = step index, fraction 0 = touchdown of foot (index % 2))
const Path = (() => {
  const { BEAT, BAR, T_RUN, T_OFF, T_TOUCH, DUR } = Score, WATER = -0.9, V = 1.5, PIER_END = -86.6;
  // the street bends a little so the view opens and closes
  const zOf = x => 0.9 * Math.sin((x + 8) * 0.085) * sm(6, -8, x) * (1 - sm(-66, -76, x)), dz = x => (zOf(x + .05) - zOf(x - .05)) / .1;
  const sRun = V * T_RUN, v1 = 7.2, dRun = T_OFF - T_RUN;
  const sAt = t => t <= T_RUN ? V * t : (() => { const u = Math.min(t, T_OFF) - T_RUN, a = (v1 - V) / dRun; return sRun + V * u + .5 * a * u * u; })();
  const xAt = t => -sAt(t);                                                 // street is near enough to unit speed in x
  // flight rail: [t, x, y, z] = reference point under the bird, y of the belly's ground reference
  const xo = xAt(T_OFF), F = [[T_OFF, xo, 0, 0], [T_OFF + .9, xo - 7.4, .55, -.1], [T_OFF + 2.4, xo - 20.5, 3.6, -1.6], [57.6, -130, 9.5, -14], [60, -146, 15.5, -34], [62.4, -139, 20.5, -57], [64.8, -113, 23, -73], [67.2, -84, 19.5, -74], [69.0, -70, 13.5, -60], [70.4, -74, 7.4, -42], [71.3, -83, 2.6, -33.6], [T_TOUCH, -92, WATER + .28, -30], [72.9, -100.2, WATER + .12, -28.6], [74.4, -108.6, WATER + .05, -27.6], [76.2, -111.8, WATER + .02, -27.2], [78, -112.6, WATER, -27.1], [DUR, -113, WATER, -27.1]];
  const ts = F.map(f => f[0]), tan = F.map((f, i) => { const a = F[Math.max(0, i - 1)], b = F[Math.min(F.length - 1, i + 1)], h = Math.max(1e-4, b[0] - a[0]); return [1, 2, 3].map(k => (b[k] - a[k]) / h); }); tan[0] = [-v1, 0.05, 0]; tan[F.length - 1] = [0, 0, 0];
  function fly(t) { t = clamp(t, ts[0], ts[ts.length - 1]); let i = 1; while (i < ts.length - 1 && t > ts[i]) i++; const h = ts[i] - ts[i - 1], u = (t - ts[i - 1]) / h, u2 = u * u, u3 = u2 * u, a = F[i - 1], b = F[i], ta = tan[i - 1], tb = tan[i]; return [1, 2, 3].map(k => (2 * u3 - 3 * u2 + 1) * a[k] + (u3 - 2 * u2 + u) * h * ta[k - 1] + (-2 * u3 + 3 * u2) * b[k] + (u3 - u2) * h * tb[k - 1]); }
  const posAt = t => { if (t <= T_OFF) { const x = xAt(t); return [x, 0, zOf(x)]; } return fly(t); };
  const stepPhase = t => { if (t <= T_RUN) return t / BEAT; return T_RUN / BEAT + Math.min(t - T_RUN, dRun) / (BEAT / 2); };
  const wingK = keyedCR([[0, 0], [T_OFF - 1.6, 0], [T_OFF - .9, .75], [T_OFF - .3, 1], [T_TOUCH - .2, 1], [T_TOUCH + .9, 1], [T_TOUCH + 2.2, .55], [T_TOUCH + 3.4, 0], [DUR, 0]]);
  const legK = keyedCR([[0, 0], [T_OFF + .15, 0], [T_OFF + 1.3, 1], [T_TOUCH - 1.3, 1], [T_TOUCH - .5, .12], [T_TOUCH + 1.6, .2], [T_TOUCH + 2.8, .8], [DUR, .8]]);
  const prev = { t: -1 }, out = () => ({ pos: V3(), vel: V3(), yaw: PI, pitch: 0, roll: 0 });
  function bird(t, o) {
    o = o || out(); t = clamp(t, 0, DUR); const e = .04, a = posAt(Math.max(0, t - e)), b = posAt(Math.min(DUR, t + e)), p = posAt(t), dt = Math.min(DUR, t + e) - Math.max(0, t - e); o.t = t; o.pos.set(p[0], p[1], p[2]); o.vel.set((b[0] - a[0]) / dt, (b[1] - a[1]) / dt, (b[2] - a[2]) / dt); if (t > 0 && t < .01) o.vel.set(-V, 0, 0);
    o.speed = o.vel.length(); const vh = Math.hypot(o.vel.x, o.vel.z); o.yaw = vh > .05 ? Math.atan2(-o.vel.z, o.vel.x) : PI - .0; if (t > 77.6) o.yaw = Math.atan2(-.02, -1) + TAU; if (o.yaw < 0) o.yaw += TAU;
    o.s = sAt(t); o.phase = stepPhase(t); o.mode = t < T_RUN ? 'walk' : t < T_OFF ? 'run' : t < T_TOUCH ? 'fly' : t < T_TOUCH + 2.6 ? 'ski' : 'float'; o.wing = clamp(wingK(t)); o.legs = clamp(legK(t)); o.pitch = 0; o.roll = 0;
    const fl = Score.last('flap', t), nx = Score.next('flap', t); o.flap = 0; o.glide = 0;
    if (fl && t < T_TOUCH + 1) { const T = fl.d, u = clamp((t - fl.t) / Math.min(T, 1.2)); if (T > 1.5) { o.glide = sm(.5, 1, (t - fl.t)) * (1 - sm(T - .5, T, t - fl.t)); } o.flap = u < .42 ? Math.cos(PI * (u / .42) + PI) : Math.cos(PI * ((u - .42) / .58)); o.flap *= (1 - o.glide) * fl.v; o.flapU = u; }
    if (t > T_OFF - .05) { const k = .35, p0 = fly(Math.max(T_OFF, t - k)), p1 = fly(Math.min(DUR, t + k)), pm = fly(t); const ax = (p1[0] + p0[0] - 2 * pm[0]) / (k * k), az = (p1[2] + p0[2] - 2 * pm[2]) / (k * k); const lat = -ax * Math.sin(o.yaw) - az * Math.cos(o.yaw);      /* acceleration to the bird's left */ const air = sm(T_OFF, T_OFF + 1.2, t) * (1 - sm(T_TOUCH - .6, T_TOUCH, t)); o.roll = clamp(-Math.atan2(lat, 9.8) * 1.15, -.75, .75) * air; o.pitch = clamp(Math.atan2(o.vel.y, Math.max(2, vh)) * .8, -.4, .5) * air + .10 * air - .0 + pulse(t, T_TOUCH - .7, .6, .9) * .30; }
    o.water = WATER; return o; }
  // where the townsfolk stand with a paper sky lantern (hands at y), and when each lets go: on the koto's sixteenths of section C
  const HOLD = (() => { const r = rng(77), out = [], K = Score.tracks.koto.filter(e => e.t >= T_OFF); for (let i = 0; i < 56; i++) { let x, z; if (i < 22) { x = -67 - r() * 7.5; z = (i % 2 ? 1 : -1) * (2.9 + r() * 4.2) + (i % 2 ? .4 : 0); } else if (i < 38) { x = -75.2 - (i - 22) / 16 * 10.6; z = -(2.05 + r() * .25); } else { x = -20 - r() * 44; z = r() < .5 ? -2.9 - r() * .5 : 7.4 + r() * 1.2; } out.push({ i, x, y: 1.72, z, t: K[Math.min(K.length - 1, 1 + i * 2)].t }); } return out; })();
  return { bird, zOf, dz, xAt, sAt, WATER, V, PIER_END, posAt, HOLD };
})();
