'use strict';
// ---- the riding lamp: a bamboo pole behind the saddle with one paper lantern hung over the two of them. By day it just sways; from dusk it is
// their own light (it really lights the bird and the rider through the lantern light field) and it breathes with the bass ------------------------
const Lamp = (() => {
  let root, hang, body, glow, id = -1; const s = { ax: 0, az: 0, vx: 0, vz: 0, ok: false, p: V3(), v: V3() }, w = V3(), top = V3(), wind = V3(), q = new THREE.Quaternion(), up = V3(0, 1, 0), d = V3();
  function build() {
    root = new THREE.Group(); root.name = 'lamp'; const bam = Mat.make('wood', { color: '#c9a35a' }), cord = Mat.make('cloth', { color: PAL.verm }), lac = Mat.make('lacquer', { color: '#2a1c18' });
    const pole = [[-.62, -.1, -.2], [-.70, .5, -.2], [-.72, 1.1, -.16], [-.62, 1.62, -.10], [-.36, 1.96, -.03], [.02, 2.06, .02]]; const parts = [[Geo.tube(pole, u => lerp(.026, .011, u), 10, { smooth: 40 }), null]]; const c = new THREE.CatmullRomCurve3(pole.map(p => V3(...p)), false, 'centripetal'); for (let i = 1; i < 9; i++) { const u = i / 9, p = c.getPoint(u), t = c.getTangent(u), m = new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromUnitVectors(V3(0, 0, 1), t), V3(1, 1, 1)); parts.push([Geo.torus(lerp(.025, .012, u), .005, 14, 6), m]); }
    root.add(Mat.mesh(Geo.merge(parts), bam)); const tie = Mat.mesh(Geo.merge([0, .02, .04, .06].map(k => [Geo.torus(.034, .008, 14, 6), M4(-.64, .02 + k, -.2, PI / 2, 0, 0)])), cord); root.add(tie);
    hang = new THREE.Group(); hang.position.set(.02, 2.055, .02); root.add(hang); const cordM = Mat.mesh(Geo.tube([[0, 0, 0], [0, -.16, 0]], .006, 6), cord); hang.add(cordM); body = new THREE.Group(); body.position.y = -.16; hang.add(body);
    const prof = []; const n = 22; for (let i = 0; i <= n; i++) { const u = i / n, rr = .155 * Math.pow(Math.sin(PI * (.12 + .76 * u)), .75) + (i % 2 ? .005 : 0); prof.push([rr, -.04 - .30 * (1 - u)]); }
    const paper = Mat.hook(Mat.make('paper', { color: '#ffe9c4', trans: .7, transColor: '#ffb45c', double: true }), { key: 'lampglow', uniforms: { uLampG: glow = { value: 0 } }, fragPars: 'uniform float uLampG;', emissive: 'totalEmissiveRadiance += vec3(1.0, 0.58, 0.22) * uLampG * (0.55 + 0.75 * smoothstep(-0.36, -0.2, vOP.y) * (1.0 - smoothstep(-0.2, -0.04, vOP.y))) * (0.9 + 0.2 * sin(vOP.y * 130.0));' });
    const sh = Mat.mesh(Geo.lathe(prof, 32), paper); body.add(sh); body.add(Mat.mesh(Geo.merge([[Geo.lathe([[0, -.045], [.075, -.045], [.08, -.035], [.075, -.02], [.02, -.012], [.012, 0], [0, 0]], 24), null], [Geo.lathe([[0, -.365], [.06, -.365], [.078, -.352], [.078, -.336], [0, -.336]], 24), null]]), lac)); const tas = []; for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; tas.push([Geo.tube([[Math.cos(a) * .008, -.37, Math.sin(a) * .008], [Math.cos(a) * .022, -.44, Math.sin(a) * .022], [Math.cos(a) * .02, -.50, Math.sin(a) * .02]], .0035, 5, { smooth: 6 }), null]); } body.add(Mat.mesh(Geo.merge(tas), cord));
    id = Lan.add({ x: 0, y: 4, z: 0, r: 9.5, color: [1, .80, .56], gain: 0 }); root.traverse(o => o.layers.enable(1)); return null; }
  function update(ctx) {
    if (!root.parent) { const P = typeof Pelican !== 'undefined' && Pelican.seat ? Pelican.seat : null; if (P) P.add(root); else Main.scene.add(root); }
    root.updateWorldMatrix(true, false); top.set(.02, 2.055, .02).applyMatrix4(root.matrixWorld); const dt = clamp(ctx.dt, .001, .05);
    if (ctx.reset || !s.ok || top.distanceTo(s.p) > 3) { s.p.copy(top); s.v.set(0, 0, 0); s.ax = s.az = s.vx = s.vz = 0; s.ok = true; }
    d.subVectors(top, s.p).multiplyScalar(1 / dt); const axx = clamp((d.x - s.v.x) / dt, -60, 60), azz = clamp((d.z - s.v.z) / dt, -60, 60); s.v.copy(d); s.p.copy(top); Wind.at(top.x, top.y - .3, top.z, wind); const st = ctx.st, air = st.mode === 'fly' ? .9 : .25, fx = (-axx * .55 + (wind.x - st.vel.x * air) * 1.1), fz = (-azz * .55 + (wind.z - st.vel.z * air) * 1.1), L = .33, n = 4; for (let i = 0; i < n; i++) { const h = dt / n; s.vx += (fx / L * .55 - 9.8 / L * Math.sin(s.ax) - 2.2 * s.vx) * h; s.vz += (fz / L * .55 - 9.8 / L * Math.sin(s.az) - 2.2 * s.vz) * h; s.ax = clamp(s.ax + s.vx * h, -1.25, 1.25); s.az = clamp(s.az + s.vz * h, -1.25, 1.25); }
    // the pendulum hangs in world space whatever the bird does
    root.getWorldQuaternion(q).invert(); d.set(Math.sin(s.ax), -Math.cos(s.ax) * Math.cos(s.az), Math.sin(s.az)).normalize().applyQuaternion(q); hang.quaternion.setFromUnitVectors(up.set(0, -1, 0), d);
    const on = sm(52, 58, ctx.t) * (1 - sm(Score.CUE.PRINT + .6, Score.CUE.PRINT + 1.4, ctx.t)), puls = 1 + .22 * Score.env('bass', ctx.t, .22) + .05 * Math.sin(ctx.t * 11) * Math.sin(ctx.t * 7.3); glow.value = on * 3.4 * puls; w.set(0, -.36, 0).applyMatrix4(hang.matrixWorld); Lan.pos(id, w.x, w.y, w.z); Lan.list[id].gain = on * 2.5 * puls; }
  Assets.add('lamp', { order: 32, build, update });
  return { get pos() { return w; } };
})();
