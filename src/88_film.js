'use strict';
// ---- FILM: the shot list, the print that becomes a world, and what the lens does. Cuts fall on bar lines; moves breathe with the phrase --------
const Film = (() => {
  const C = Score.CUE, T_OFF = Score.T_OFF, st = { pos: V3(), vel: V3(), yaw: 0, pitch: 0, roll: 0 }, p = V3(), q = V3(), f = V3(), r = V3(), tmp = V3(), tmp2 = V3(), V = { p: V3(), q: V3(), fov: 35, focus: 8, ap: .015, roll: 0, near: .12, box: 30 };
  const E = (a, b, t) => sm(a, b, t), ES = (a, b, t) => smoother(a, b, t), mixA = (a, b, k) => a.map((v, i) => lerp(v, b[i], k));
  const bx = t => Path.posAt(t)[0], bz = t => Path.posAt(t)[2];
  // set camera and target relative to the bird's ground point (world axes; -x is ahead)
  const rel = (t, P, Q_, fov, o = {}) => { const x = bx(t), z = bz(t) * .6; V.p.set(x + P[0], P[1], z + P[2]); V.q.set(x + Q_[0], Q_[1], z + Q_[2]); V.fov = fov; V.focus = o.f ? Math.hypot(P[0] - o.f[0], P[1] - o.f[1], P[2] - o.f[2]) : V.p.distanceTo(V.q); V.ap = o.ap === undefined ? .012 : o.ap; V.box = o.box || 26; V.roll = o.roll || 0; };
  // in the bird's own frame, for the flight: ahead, up, right
  const own = (t, P, Q_, fov, o = {}) => { Path.bird(t, st); const lag = o.lag === undefined ? .18 : o.lag; const s2 = Path.bird(Math.max(T_OFF, t - lag)), yaw = s2.yaw; f.set(Math.cos(yaw), 0, -Math.sin(yaw)); r.set(Math.sin(yaw), 0, Math.cos(yaw)); V.p.copy(s2.pos).addScaledVector(f, P[0]).addScaledVector(r, P[2]); V.p.y += P[1]; V.q.copy(st.pos).addScaledVector(f, Q_[0]).addScaledVector(r, Q_[2]); V.q.y += Q_[1]; V.fov = fov; V.focus = o.fd || V.p.distanceTo(tmp.copy(st.pos).setY(st.pos.y + 1.6)); V.ap = o.ap === undefined ? .010 : o.ap; V.box = o.box || 40; V.roll = (o.roll || 0) * st.roll; };
  const world = (P, Q_, fov, o = {}) => { V.p.set(...P); V.q.set(...Q_); V.fov = fov; V.focus = o.fd || V.p.distanceTo(V.q); V.ap = o.ap === undefined ? .010 : o.ap; V.box = o.box || 34; V.roll = o.roll || 0; };
  const keepH = (h, D) => 2 * Math.atan(h / 2 / D) * 180 / PI;
  const SHOTS = [
    // the print, then the same frame opening into depth: the bird keeps its size while the lens runs in from 40 m
    [0, 7.2, t => { const k = ES(3.7, 5.9, t), D = 1 / lerp(1 / 27, 1 / 9.4, k), h = lerp(9.2, 5.6, k), dr = E(5.2, 7.2, t); rel(t, [lerp(-.75, -.2, k) - .9 * dr, lerp(4.0, 2.15, k) - .25 * dr, D - 1.3 * dr], [lerp(-.75, -.6, k) - .25 * dr, lerp(3.75, 2.3, k), 0], keepH(h, D) + 3 * dr, { ap: .016 * k, f: [0, 1.6, .3] }); V.near = Math.max(.12, D - 8.2); V.box = 24; }],
    [7.2, 9.6, t => { const u = (t - 7.2) / 2.4; rel(t, [lerp(-1.9, -2.5, u), lerp(.34, .55, u), lerp(3.5, 3.1, u)], [lerp(-.1, -.55, u), lerp(.80, 1.85, u), 0], 39, { ap: .020, f: [0, .6, .4], box: 14 }); }],
    [9.6, 13.2, t => { const u = E(9.6, 13.2, t); rel(t, [lerp(-3.6, .5, u), lerp(1.9, 2.3, u), lerp(7.9, 7.4, u)], [lerp(-.8, .1, u), lerp(2.15, 2.6, u), -1.6], 43, { ap: .014, f: [0, 2, 0], box: 26 }); }],
    [13.2, 16.8, t => { const u = E(13.0, 16.9, t); rel(t, [lerp(-3.6, -5.0, u), lerp(1.05, .8, u), lerp(5.5, 4.6, u)], [lerp(-1.3, -.9, u), lerp(1.45, 1.6, u), .7], 38, { ap: .018, f: [-.6, 1.4, .8], box: 20 }); }],
    [16.8, 19.2, t => { const u = (t - 16.8) / 2.4; rel(t, [lerp(-5.6, -5.9, u), lerp(1.45, 1.7, u), lerp(3.3, 2.6, u)], [lerp(-1.9, -2.2, u), lerp(2.85, 3.1, u), -1.7], 41, { ap: .008, f: [-1.9, 3.4, -2.2], box: 22 }); }],
    [19.2, 24, t => { const u = E(19.0, 24.2, t); rel(t, [lerp(4.4, 3.2, u), lerp(3.55, 3.35, u), lerp(2.1, 1.35, u)], [-7, lerp(2.5, 2.3, u), -2.5], 42, { ap: .009, f: [0, 2.7, 0], box: 28 }); }],
    // the tea break
    [24, 26.4, t => { const u = E(23.8, 26.6, t); rel(t, [lerp(-1.05, -.85, u), lerp(2.72, 2.66, u), lerp(3.6, 3.05, u)], [-.62, 2.52, 0], 31, { ap: .032, f: [.1, 2.9, 0], box: 12 }); }],
    [26.4, 28.2, t => { const u = E(26.2, 28.3, t); if (typeof Rider !== 'undefined' && Rider.teaPos) Rider.teaPos(tmp2); else Steam.source(t, tmp2); V.p.set(tmp2.x - lerp(.17, .05, u), tmp2.y + lerp(.40, .30, u), tmp2.z + lerp(.40, .26, u)); V.q.copy(tmp2); V.fov = 28; V.focus = V.p.distanceTo(V.q); V.ap = .05; V.box = 8; V.roll = 0; }],
    // the bump and the lemon that plays
    [28.2, 30, t => { const u = E(28.1, 30.2, t), k = E(28.55, 29.7, t); world([lerp(-42.85, -43.9, u), lerp(1.45, 1.62, u), lerp(-1.2, -1.05, u)], [lerp(-43.7, -45.4, k), lerp(1.06, 1.25, k), lerp(-5.2, -4.6, k)], lerp(56, 54, u), { ap: .008, box: 16, fd: 4.2 }); }],
    [30, 33.6, t => { const u = E(29.8, 33.8, t), x = bx(t) - 2.25; world([x + lerp(.85, .35, u), lerp(1.72, 1.45, u), lerp(-1.0, -1.3, u)], [x - .30, 1.18, -3.55], 41, { ap: .022, fd: 2.5, box: 12 }); }],
    [33.6, 36, t => { const u = E(33.5, 36.2, t); rel(t, [lerp(-2.1, -2.5, u), lerp(1.85, 1.6, u), lerp(5.6, 4.7, u)], [-1.55, 1.75, -1.5], 39, { ap: .012, f: [-2.2, 1.3, -3.4], box: 20 }); }],
    [36, 38.4, t => { const u = (t - 36) / 2.4; rel(t, [lerp(-6.2, -5.7, u), lerp(1.5, 1.65, u), lerp(-2.0, -1.7, u)], [-1.0, 1.8, -1.9], 37, { ap: .016, f: [-2.4, 1.3, -3.4], box: 20 }); }],
    [38.4, 40.8, t => { const u = E(38.2, 41, t); rel(t, [lerp(.75, .25, u), lerp(2.15, 1.85, u), lerp(-2.55, -2.85, u)], [-5.0, lerp(.85, .95, u), -3.75], 42, { ap: .012, f: [-2.25, 1.2, -3.4], box: 20 }); }],
    [40.8, 42, t => { const u = (t - 40.8) / 1.2; rel(t, [lerp(-4.6, -4.2, u), lerp(1.7, 1.9, u), lerp(5.0, 4.6, u)], [lerp(-2.0, -2.1, u), lerp(1.7, 1.8, u), -1.4], 38, { ap: .014, f: [-2.0, 1.7, -1.6], box: 20 }); }],
    // the catch, from the other side, with the sun coming through the pouch
    [42, 43.8, t => { const u = E(41.9, 43.9, t); rel(t, [lerp(-5.9, -5.0, u), lerp(1.75, 2.2, u), lerp(-2.75, -2.35, u)], [lerp(-1.9, -1.65, u), lerp(2.05, 2.3, u), -.15], 37, { ap: .020, f: [-1.95, 2.3, -.3], box: 18 }); }],
    // the bridge: up off the street into gold
    [43.8, 45.6, t => { const u = (t - 43.8) / 1.8; rel(t, [lerp(-3.9, -3.6, u), lerp(2.75, 2.9, u), lerp(2.5, 2.2, u)], [-1.25, 2.62, -.05], 33, { ap: .022, f: [-1.3, 2.8, .1], box: 14 }); }],
    [45.6, 50.4, t => { const u = smoother(45.4, 50.6, t), x = bx(t); V.p.set(lerp(bx(45.6) - 1.6, -54, u), lerp(2.5, 11.2, smoother(45.4, 49.2, t)), lerp(7.2, 15.6, smoother(46.6, 50.8, t))); V.q.set(lerp(x - .8, -84, u), lerp(2.4, 6.2, u), lerp(0, -22, u)); V.fov = lerp(40, 50, u); V.focus = V.p.distanceTo(tmp.set(x, 2, 0)); V.ap = .008; V.box = lerp(26, 44, u); V.roll = 0; }],
    [50.4, 52.2, t => { const u = (t - 50.4) / 1.8; rel(t, [lerp(-2.6, -3.6, u), lerp(.15, .35, u), lerp(5.4, 5.0, u)], [lerp(-.6, -.9, u), 1.55, 0], 42, { ap: .010, f: [0, 1.6, 0], box: 22 }); }],
    [52.2, 54.6, t => { const b = Path.posAt(t), u = E(52.2, 54.6, t); world([-95.6, lerp(-.3, .5, u), lerp(5.0, 6.0, u)], [b[0] - .6, b[1] + 1.75, b[2]], lerp(40, 46, u), { ap: .008, box: 30, fd: Math.hypot(b[0] + 95.6, b[2] - 6) }); }],
    // flight
    [54.6, 57.6, t => { const u = E(54.4, 57.7, t); own(t, [lerp(-8.6, -7.0, u), lerp(2.2, 3.0, u), lerp(4.2, 1.6, u)], [7, 1.2, 0], 50, { roll: .5 }); }],
    [57.6, 60, t => { const u = (t - 57.6) / 2.4; own(t, [lerp(6.4, 5.0, u), lerp(1.5, 1.9, u), lerp(-4.2, -3.2, u)], [.1, 1.75, 0], 39, { roll: .25, lag: .04, ap: .014 }); }],
    [60, 62.4, t => { const u = (t - 60) / 2.4; own(t, [lerp(-2.0, 2.6, u), lerp(1.0, 2.6, u), -11.5], [.6, 1.3, 0], 40, { roll: .2, lag: .06 }); }],
    [62.4, 64.8, t => { const u = (t - 62.4) / 2.4; own(t, [lerp(-1.6, -.9, u), lerp(2.5, 2.35, u), lerp(3.6, 3.2, u)], [.8, 2.2, 0], 44, { roll: .8, lag: 0, ap: .014 }); }],
    [64.8, 67.2, t => { const u = E(64.6, 67.4, t); own(t, [lerp(-5.0, -4.2, u), lerp(4.2, 3.7, u), lerp(-1.4, -.5, u)], [9, -.4, 0], 50, { roll: .6, lag: .1, ap: .008 }); }],
    [67.2, 69.6, t => { const u = (t - 67.2) / 2.4; own(t, [lerp(10.5, 8.0, u), lerp(.3, .9, u), lerp(2.6, 1.2, u)], [0, 1.5, 0], 41, { roll: .3, lag: -.02 }); }],
    [69.6, 74.4, t => { const b = Path.posAt(t), u = smoother(71.9, 74.6, t); world([lerp(-99.2, -106.5, u), lerp(-.28, .55, u), lerp(-21.2, -18.6, u)], [b[0] + lerp(0, -.4, u), b[1] + lerp(1.4, 1.35, u), b[2]], lerp(lerp(21, 42, E(69.8, 72.0, t)), 36, u), { ap: .009, box: 30 }); }],
    // afloat under the moon, the peak behind, and the sheet closes on it
    [74.4, 81.6, t => { const u = E(74.2, 78.6, t), k = smoother(77.6, 80.2, t), b = Path.posAt(t), D = lerp(lerp(9.8, 8.6, u), 11.4, k), h = lerp(lerp(5.6, 5.0, u), 7.6, k); world([b[0] - lerp(.2, .7, u) + .4 * k, lerp(lerp(.5, .9, u), 1.3, k), b[2] + D], [b[0] - .5 + .3 * k, lerp(lerp(1.2, 1.3, u), 2.35, k), b[2]], keepH(h, D), { ap: .010 * (1 - k), box: 26, fd: D }); }],
  ];
  const free = { yaw: 0, pitch: 0, zoom: 1, tyaw: 0, tpitch: 0, tzoom: 1, hold: 0, ride: 0, tride: 0 };
  function update(ctx) {
    const t = ctx.t; let sh = SHOTS[SHOTS.length - 1]; for (const s of SHOTS) if (t < s[1]) { sh = s; break; } V.near = .12; V.shot = sh; sh[2](t);
    // the sheet: blocks go down on the four clacks, the world breaks through at SUN, the sheet closes again at the end
    const B = Post.fin.uBlocks.value, k = i => sm(0, .16, t - i * Score.BEAT); if (t < 20) B.set(k(0), k(1), k(2), k(3)); else B.set(1, 1, 1, 1);
    const pr = t < 20 ? 1 - sm(C.SUN - .55, C.SUN + .75, t) : sm(C.PRINT, C.PRINT + 1.25, t); LU.uPrint.value = Film.printLock === undefined ? pr : Film.printLock; Post.fin.uBorder.value = Film.printLock === undefined ? (t < 20 ? 1 - sm(C.SUN - .3, C.SUN + .5, t) : sm(C.PRINT + .2, C.PRINT + 1.1, t)) : Film.printLock; Post.fin.uSeal.value = t < 20 ? k(2) * (1 - sm(C.SUN - .5, C.SUN, t)) : clamp((t - C.SEAL + .02) / .16); if (Film.printLock !== undefined) Post.fin.uSeal.value = Film.printLock;
    Post.fin.uFade.value = t < 20 ? 1 - sm(0, .10, t) : sm(81.15, 81.58, t); Post.fin.uFlash.value = pulse(t, C.SUN - .12, .12, .5) * .10 + pulse(t, C.OFF - .05, .06, .45) * .05;
    // people may look round: an orbit and a zoom on top of the directed camera, which takes over again by itself
    free.hold = Math.max(0, free.hold - ctx.dt); if (free.hold <= 0) { free.tyaw *= Math.exp(-1.1 * ctx.dt); free.tpitch *= Math.exp(-1.1 * ctx.dt); free.tzoom = 1 + (free.tzoom - 1) * Math.exp(-.8 * ctx.dt); } const kk = 1 - Math.exp(-9 * ctx.dt); free.yaw += (free.tyaw - free.yaw) * kk; free.pitch += (free.tpitch - free.pitch) * kk; free.zoom += (free.tzoom - free.zoom) * kk; free.ride += (free.tride - free.ride) * (1 - Math.exp(-4 * ctx.dt));
    const cam = ctx.cam; p.copy(V.p); q.copy(V.q); if (Math.abs(free.yaw) + Math.abs(free.pitch) + Math.abs(free.zoom - 1) > 1e-4) { const pv = tmp.set(ctx.st.pos.x, ctx.st.pos.y + 1.7, ctx.st.pos.z), use = V.near > .2 ? 0 : 1, d = p.clone().sub(pv), R = d.length() * free.zoom, th = Math.atan2(d.x, d.z) + free.yaw * use, ph = clamp(Math.asin(clamp(d.y / d.length(), -1, 1)) + free.pitch * use, -.35, 1.35); d.set(Math.sin(th) * Math.cos(ph), Math.sin(ph), Math.cos(th) * Math.cos(ph)).multiplyScalar(R); const kf = clamp(Math.abs(free.yaw) + Math.abs(free.pitch)); p.copy(pv).add(d); if (p.y < .25 && ctx.st.mode !== 'fly') p.y = Math.max(p.y, -.4); q.lerp(pv, kf); V.focus = p.distanceTo(pv); }
    if (free.ride > .002) { Path.bird(t, st); const c = Math.cos(st.yaw), n = Math.sin(st.yaw), hx = st.pos.x + .12 * c, hz = st.pos.z - .12 * n; tmp.set(hx, st.pos.y + 3.15, hz); const ya = st.yaw + free.yaw * 1.2; tmp2.set(tmp.x + Math.cos(ya) * 6, tmp.y - .9 + free.pitch * 4, tmp.z - Math.sin(ya) * 6); p.lerp(tmp, free.ride); q.lerp(tmp2, free.ride); V.fov = lerp(V.fov, 58, free.ride); V.near = lerp(V.near, .25, free.ride); V.ap *= 1 - free.ride; }
    // the hand on the camera: breathing, footfalls, hits
    const amp = V.near > .5 ? 0 : clamp(V.focus * .0016, .0006, .016), step = ctx.st.mode === 'walk' || ctx.st.mode === 'run' ? Math.exp(-fract(ctx.st.phase) * 5) : 0, hit = Score.env('taiko', t, .16) * .012 + pulse(t, C.BUMP, .02, .28) * .10 + pulse(t, C.TOUCH, .03, .4) * .06; p.x += (Math.sin(t * 1.3) + .6 * Math.sin(t * 2.9 + 1)) * amp; p.y += (Math.sin(t * 1.7 + 2) + .5 * Math.sin(t * 3.7)) * amp * .8 - step * .004 + hit * .25 * Math.sin(t * 47); p.z += Math.sin(t * 1.1 + 4) * amp * .6 + hit * .15 * Math.sin(t * 39 + 1);
    cam.position.copy(p); cam.up.set(0, 1, 0); cam.near = V.near; cam.far = 1400; const asp = cam.aspect, base = 16 / 9; cam.fov = asp < base ? Math.min(100, 2 * Math.atan(Math.tan(deg(V.fov) / 2) * lerp(base / asp, 1, asp < 1 ? .42 : .25)) * 180 / PI) : V.fov; cam.updateProjectionMatrix(); cam.lookAt(q); if (V.roll) cam.rotateZ(V.roll); cam.updateMatrixWorld();
    LU.uPrintC.value.x = .5; LU.uPrintC.value.y = .47; }
  function view(ctx) { const n = Sky.S.night; return { focus: V.focus, aperture: V.ap, lightFocus: tmp.copy(ctx.st.mode === 'fly' || V.focus > 14 ? ctx.st.pos : V.q).setY(Math.max(0, ctx.st.mode === 'fly' ? ctx.st.pos.y : .8)).clone(), lightBox: V.box, shafts: lerp(1, .35, n), lanGain: lerp(.16, 1.15, sm(50, 60, ctx.t)) }; }
  return { update, view, SHOTS, free, V, printLock: undefined };
})();
