'use strict';
// ---- shared helpers: math, rng, noise, geometry kit ---------------------------------------------------------
const Q = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const CAPTURE = Q.has('capture');
const TAU = Math.PI * 2, PI = Math.PI;
const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const lerp = (a, b, t) => a + (b - a) * t;
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const smoother = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * t * (t * (t * 6 - 15) + 10); };
const fract = x => x - Math.floor(x), mod = (a, n) => ((a % n) + n) % n;
const deg = d => d * PI / 180;
const damp = (cur, target, rate, dt) => target + (cur - target) * Math.exp(-rate * dt);
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const h1 = n => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);
// keyed curve [[x,y],...] : keyed = smoothstep between keys, keyedLin = linear, keyedCR = monotone cubic (C1)
const keyed = ks => x => { if (x <= ks[0][0]) return ks[0][1]; for (let i = 1; i < ks.length; i++) if (x <= ks[i][0]) return lerp(ks[i - 1][1], ks[i][1], sm(ks[i - 1][0], ks[i][0], x)); return ks[ks.length - 1][1]; };
const keyedLin = ks => x => { if (x <= ks[0][0]) return ks[0][1]; for (let i = 1; i < ks.length; i++) if (x <= ks[i][0]) return lerp(ks[i - 1][1], ks[i][1], (x - ks[i - 1][0]) / (ks[i][0] - ks[i - 1][0])); return ks[ks.length - 1][1]; };
function keyedCR(ks) { const n = ks.length, m = []; for (let i = 0; i < n; i++) { const a = ks[Math.max(0, i - 1)], b = ks[Math.min(n - 1, i + 1)]; m.push((b[1] - a[1]) / Math.max(1e-6, b[0] - a[0])); }
  return x => { if (x <= ks[0][0]) return ks[0][1]; if (x >= ks[n - 1][0]) return ks[n - 1][1]; let i = 1; while (x > ks[i][0]) i++; const h = ks[i][0] - ks[i - 1][0], t = (x - ks[i - 1][0]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ks[i - 1][1] + (t3 - 2 * t2 + t) * h * m[i - 1] + (-2 * t3 + 3 * t2) * ks[i][1] + (t3 - t2) * h * m[i]; }; }
const pulse = (t, t0, att, rel) => t < t0 ? 0 : t < t0 + att ? sm(t0, t0 + att, t) : Math.exp(-(t - t0 - att) / rel);
// closed-form damped spring kick: what a spring at rest does after an impulse at t0 (f Hz, d damping rate); 0 before
const ring = (t, t0, f, d) => t < t0 ? 0 : Math.exp(-d * (t - t0)) * Math.sin(TAU * f * (t - t0));
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const hex = h => new THREE.Color(h);                                     // sRGB hex -> linear THREE.Color

// ---- CPU noise (Perlin 3D) ------------------------------------------------------------------------------------
const NZ = (() => {
  const p = new Uint8Array(512), r = rng(20261124), perm = [];
  for (let i = 0; i < 256; i++) perm.push(i);
  for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0, t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const grad = (h, x, y, z) => { h &= 15; const u = h < 8 ? x : y, v = h < 4 ? y : (h === 12 || h === 14) ? x : z; return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); };
  function n3(x, y, z) {
    let X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z); x -= X; y -= Y; z -= Z; X &= 255; Y &= 255; Z &= 255;
    const u = fade(x), v = fade(y), w = fade(z), A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z, B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z, l = (a, b, t) => a + (b - a) * t;
    return l(l(l(grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z), u), l(grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z), u), v),
      l(l(grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1), u), l(grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1), u), v), w);
  }
  const fbm = (x, y, z, o = 4) => { let a = .5, s = 0, f = 1; for (let i = 0; i < o; i++) { s += a * n3(x * f, y * f, z * f); f *= 2.03; a *= .5; } return s; };
  const ridged = (x, y, z, o = 5) => { let a = .5, s = 0, f = 1, w = 1; for (let i = 0; i < o; i++) { let n = 1 - Math.abs(n3(x * f, y * f, z * f)); n *= n; s += n * a * w; w = clamp(n * 1.6); f *= 2.11; a *= .5; } return s; };
  return { n3, fbm, ridged };
})();

// ---- geometry kit: every builder returns an indexed BufferGeometry with position, normal, uv ------------------
const M4 = (px = 0, py = 0, pz = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => new THREE.Matrix4().compose(new THREE.Vector3(px, py, pz), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));
const Geo = (() => {
  const make = (pos, nor, uv, idx) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3)); if (nor) g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nor), 3)); g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv || (pos.length / 3 * 2)), 2)); g.setIndex(idx); if (!nor) g.computeVertexNormals(); return g; };
  // profile [[r,y],...] bottom to top, spun round Y. o.smooth=false for hard rings; o.sx/o.sz squash
  function lathe(profile, seg = 32, o = {}) { const n = profile.length, pos = [], uv = [], idx = []; let L = 0; const len = [0]; for (let i = 1; i < n; i++) { L += Math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1]); len.push(L); }
    for (let i = 0; i < n; i++) for (let j = 0; j <= seg; j++) { const a = j / seg * TAU; pos.push(Math.cos(a) * profile[i][0] * (o.sx || 1), profile[i][1], Math.sin(a) * profile[i][0] * (o.sz || 1)); uv.push(j / seg, len[i] / (L || 1)); }
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < seg; j++) { const a = i * (seg + 1) + j, b = a + seg + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const g = make(pos, null, uv, idx); seam(g, n, seg); return g; }
  // average normals across the u=0 / u=1 seam of an (n rows) x (seg+1) grid
  function seam(g, n, seg) { const N = g.attributes.normal.array; for (let i = 0; i < n; i++) { const a = (i * (seg + 1)) * 3, b = a + seg * 3; const x = N[a] + N[b], y = N[a + 1] + N[b + 1], z = N[a + 2] + N[b + 2], l = Math.hypot(x, y, z) || 1; N[a] = N[b] = x / l; N[a + 1] = N[b + 1] = y / l; N[a + 2] = N[b + 2] = z / l; } }
  // tube along points (Vector3[] or [x,y,z][]); radius = number | array | fn(u)->r or [rN, rB] (elliptic). caps rounded by collapsing
  function tube(pts, radius, sides = 10, o = {}) { pts = pts.map(p => p.isVector3 ? p : new THREE.Vector3(p[0], p[1], p[2])); if (o.smooth) { const c = new THREE.CatmullRomCurve3(pts, !!o.closed, 'centripetal'); pts = c.getPoints(o.smooth); }
    const n = pts.length, pos = [], nor = [], uv = [], idx = [], T = V3(), N = V3(), B = V3(), tmp = V3(); let len = 0; N.copy(o.up ? (o.up.isVector3 ? o.up : V3(...o.up)) : V3(0.13, 0.2, 0.97));
    const R = i => { const u = n > 1 ? i / (n - 1) : 0; let r = typeof radius === 'function' ? radius(u) : Array.isArray(radius) ? radius[Math.min(radius.length - 1, i)] : radius; return Array.isArray(r) ? r : [r, r]; };
    const rings = []; if (o.caps !== false) rings.push([0, 0]); for (let i = 0; i < n; i++) rings.push([i, 1]); if (o.caps !== false) rings.push([n - 1, 0]);
    let last = -1; for (const [i, k] of rings) { if (i !== last) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; T.subVectors(b, a).normalize(); N.addScaledVector(T, -N.dot(T)); if (N.lengthSq() < 1e-8) N.set(1, 0, 0).addScaledVector(T, -T.x); N.normalize(); B.crossVectors(T, N); if (i > 0) len += pts[i].distanceTo(pts[i - 1]); last = i; }
      const [rn, rb] = R(i); for (let j = 0; j <= sides; j++) { const th = j / sides * TAU, c = Math.cos(th), s = Math.sin(th); tmp.set(0, 0, 0).addScaledVector(N, c * rn * k).addScaledVector(B, s * rb * k).add(pts[i]); pos.push(tmp.x, tmp.y, tmp.z); tmp.set(0, 0, 0).addScaledVector(N, c / Math.max(rn, 1e-5)).addScaledVector(B, s / Math.max(rb, 1e-5)).normalize(); nor.push(tmp.x, tmp.y, tmp.z); uv.push(len, j / sides); } }
    for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < sides; j++) { const p0 = i * (sides + 1) + j, p1 = p0 + sides + 1; idx.push(p0, p0 + 1, p1, p0 + 1, p1 + 1, p1); }
    return make(pos, nor, uv, idx); }
  // box with rounded edges (r) and optional per-face segments; centred at origin
  function box(w, h, d, r = 0.02, seg = 2) { r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4); if (r <= 0.0005) { return new THREE.BoxGeometry(w, h, d).toNonIndexed ? idx(new THREE.BoxGeometry(w, h, d)) : null; }
    const g = new THREE.BoxGeometry(w, h, d, seg * 2 + 1, seg * 2 + 1, seg * 2 + 1), P = g.attributes.position, N = g.attributes.normal, hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r, s = seg * 2 + 1;
    const map = (v, half, full) => { const t = Math.round((v / full + 0.5) * s); if (t <= seg) return -half - r * Math.cos(t / seg * PI / 2 * 1); return half + r * Math.cos((s - t) / seg * PI / 2); };
    for (let i = 0; i < P.count; i++) { let x = P.getX(i), y = P.getY(i), z = P.getZ(i); const mx = map(x, hx, w), my = map(y, hy, h), mz = map(z, hz, d); const ix = clamp(mx, -hx, hx), iy = clamp(my, -hy, hy), iz = clamp(mz, -hz, hz); let dx = mx - ix, dy = my - iy, dz = mz - iz; const l = Math.hypot(dx, dy, dz); if (l > 1e-6) { dx /= l; dy /= l; dz /= l; P.setXYZ(i, ix + dx * r, iy + dy * r, iz + dz * r); N.setXYZ(i, dx, dy, dz); } }
    return idx(g); }
  const idx = g => { if (!g.index) { const n = g.attributes.position.count, a = []; for (let i = 0; i < n; i++) a.push(i); g.setIndex(a); } g.clearGroups(); return g; };
  const sphere = (r = 1, ws = 24, hs = 16) => idx(new THREE.SphereGeometry(r, ws, hs));
  const cyl = (r0, r1, h, seg = 20, o = {}) => idx(new THREE.CylinderGeometry(r1, r0, h, seg, o.hs || 1, !!o.open));      // r0 bottom, r1 top, centred
  const torus = (R, r, a = 24, b = 10, arc = TAU) => idx(new THREE.TorusGeometry(R, r, b, a, arc));
  const plane = (w, h, a = 1, b = 1) => idx(new THREE.PlaneGeometry(w, h, a, b));
  // 2-D outline [[x,y],...] extruded along +z (depth d, bevel b), centred in z
  function extrude(outline, d = 0.1, b = 0, o = {}) { const s = new THREE.Shape(); if (o.curve) { const c = new THREE.SplineCurve(outline.map(p => new THREE.Vector2(p[0], p[1]))); s.setFromPoints(c.getPoints(o.curve)); } else s.setFromPoints(outline.map(p => new THREE.Vector2(p[0], p[1]))); (o.holes || []).forEach(h => { const q = new THREE.Path(); q.setFromPoints(h.map(p => new THREE.Vector2(p[0], p[1]))); s.holes.push(q); });
    const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(1e-4, d - 2 * b), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: o.bs || 2, curveSegments: 8 }); g.translate(0, 0, -(d - 2 * b) / 2); return idx(g); }
  // parametric surface fn(u,v)->[x,y,z], (nu+1)x(nv+1) grid
  function surf(fn, nu, nv, o = {}) { const pos = [], uv = [], ix = []; for (let i = 0; i <= nv; i++) for (let j = 0; j <= nu; j++) { const p = fn(j / nu, i / nv); pos.push(p[0], p[1], p[2]); uv.push(j / nu, i / nv); }
    for (let i = 0; i < nv; i++) for (let j = 0; j < nu; j++) { const a = i * (nu + 1) + j, b = a + nu + 1; if (o.flip) ix.push(a, b, a + 1, a + 1, b, b + 1); else ix.push(a, a + 1, b, a + 1, b + 1, b); } const g = make(pos, null, uv, ix); if (o.seamU) seam(g, nv + 1, nu); return g; }
  // merge geometries (missing uv/color are filled: uv 0, colour white). Entries: geo | [geo, Matrix4] | [geo, Matrix4, color]
  function merge(list) { list = list.map(e => Array.isArray(e) ? (() => { let g = e[0]; if (e[1] || e[2]) g = g.clone(); if (e[1]) { g.applyMatrix4(e[1]); if (e[1].determinant() < 0) flip(g); } if (e[2]) paint(g, e[2]); return g; })() : e);
    const extra = new Set(); list.forEach(g => Object.keys(g.attributes).forEach(k => extra.add(k))); const names = [...extra]; let nv = 0, ni = 0; list.forEach(g => { idx(g); nv += g.attributes.position.count; ni += g.index.count; });
    const size = n => { for (const g of list) if (g.attributes[n]) return g.attributes[n].itemSize; }; const arrs = {}; names.forEach(n => arrs[n] = new Float32Array(nv * size(n)).fill(n === 'color' ? 1 : 0)); const ia = new Uint32Array(ni); let vo = 0, io = 0;
    for (const g of list) { for (const n of names) if (g.attributes[n]) { const a = g.attributes[n], s = a.itemSize; for (let i = 0; i < a.count; i++) for (let k = 0; k < s; k++) arrs[n][(vo + i) * s + k] = a.array[i * s + k]; } const a = g.index.array; for (let i = 0; i < a.length; i++) ia[io + i] = a[i] + vo; io += a.length; vo += g.attributes.position.count; }
    const out = new THREE.BufferGeometry(); names.forEach(n => out.setAttribute(n, new THREE.BufferAttribute(arrs[n], size(n)))); out.setIndex(new THREE.BufferAttribute(ia, 1)); return out; }
  function flip(g) { const a = g.index.array; for (let i = 0; i < a.length; i += 3) { const t = a[i]; a[i] = a[i + 1]; a[i + 1] = t; } return g; }
  // vertex colours: c = THREE.Color | hex string | fn(x,y,z,nx,ny,nz,u,v) -> THREE.Color | [r,g,b] linear
  function paint(g, c) { const n = g.attributes.position.count, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, a = new Float32Array(n * 3); if (typeof c === 'string' || typeof c === 'number') c = new THREE.Color(c);
    for (let i = 0; i < n; i++) { let q = c; if (typeof c === 'function') q = c(P.getX(i), P.getY(i), P.getZ(i), N ? N.getX(i) : 0, N ? N.getY(i) : 1, N ? N.getZ(i) : 0, U ? U.getX(i) : 0, U ? U.getY(i) : 0); if (q.isColor) { a[i * 3] = q.r; a[i * 3 + 1] = q.g; a[i * 3 + 2] = q.b; } else { a[i * 3] = q[0]; a[i * 3 + 1] = q[1]; a[i * 3 + 2] = q[2]; } } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
  const at = (g, px, py, pz, rx, ry, rz, sx, sy, sz) => { const q = g.clone(); q.applyMatrix4(M4(px, py, pz, rx, ry, rz, sx, sy, sz)); return q; };
  // move vertices: fn(x,y,z,nx,ny,nz,u,v) -> [x,y,z]; normals recomputed (weld seams with o.weld)
  function warp(g, fn, o = {}) { const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv; for (let i = 0; i < P.count; i++) { const p = fn(P.getX(i), P.getY(i), P.getZ(i), N.getX(i), N.getY(i), N.getZ(i), U ? U.getX(i) : 0, U ? U.getY(i) : 0); P.setXYZ(i, p[0], p[1], p[2]); } P.needsUpdate = true; normals(g, o.weld !== false); return g; }
  // smooth normals, welding coincident vertices so uv seams do not crease
  function normals(g, weld = true) { g.computeVertexNormals(); if (!weld) return g; const P = g.attributes.position, N = g.attributes.normal, m = new Map(); for (let i = 0; i < P.count; i++) { const k = Math.round(P.getX(i) * 2e4) + ',' + Math.round(P.getY(i) * 2e4) + ',' + Math.round(P.getZ(i) * 2e4); let e = m.get(k); if (!e) m.set(k, e = [0, 0, 0, []]); e[0] += N.getX(i); e[1] += N.getY(i); e[2] += N.getZ(i); e[3].push(i); }
    m.forEach(e => { if (e[3].length < 2) return; const l = Math.hypot(e[0], e[1], e[2]) || 1; e[3].forEach(i => N.setXYZ(i, e[0] / l, e[1] / l, e[2] / l)); }); return g; }
  // attribute fill: one value per vertex, constant or fn(i, x, y, z)
  function attr(g, name, size, v) { const n = g.attributes.position.count, P = g.attributes.position, a = new Float32Array(n * size); for (let i = 0; i < n; i++) { const q = typeof v === 'function' ? v(i, P.getX(i), P.getY(i), P.getZ(i)) : v; for (let k = 0; k < size; k++) a[i * size + k] = size === 1 ? (q.length ? q[0] : q) : q[k]; } g.setAttribute(name, new THREE.BufferAttribute(a, size)); return g; }
  return { make, lathe, tube, box, sphere, cyl, torus, plane, extrude, surf, merge, paint, at, warp, normals, flip, attr, seam, idx };
})();
// world state shared by every module
const G = { t: 0, dt: 1 / 60, tick: [], info: {}, errors: [] };
// ---- assets: every module registers itself; main builds them in order and updates them every frame ----------------------------------
//   Assets.add('name', { build() -> Object3D | [Object3D...] | null, update(ctx), order: 10, ... })
//   ctx = { t, dt, st: Path.bird(t), cam: THREE.PerspectiveCamera, reset: true on a seek, live: true when people can touch, scene }
//   optional hooks: prepass(renderer, scene, cam, ctx) before the main render; pick: [Object3D] things a click can hit, poke(hit, ctx) when it does
const Assets = (() => { const list = []; return { list, add(name, o) { o.name = name; o.order = o.order === undefined ? 50 : o.order; list.push(o); list.sort((a, b) => a.order - b.order); return o; }, get: n => list.find(a => a.name === n) }; })();
