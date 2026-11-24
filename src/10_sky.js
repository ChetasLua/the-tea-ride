'use strict';
// ---- SKY + LIGHT OF THE DAY: dawn -> noon -> gold -> dusk -> moonlight, keyed to film time ----------------------------------
// Sky.apply(t) sets sun/moon direction and colour, sky colours, fog, exposure, environment. Sky.S = current state (read-only for others)
const Sky = (() => {
  const c = (r, g, b) => [r, g, b];
  // t, elev, azim (deg: -90 = straight behind the set, 0 = screen left, 90 = toward the lens, 180 = screen right), sun rgb*I, zenith, mid, horizon, horizon on the sun side, ground bounce, fog density, env gain, exposure
  const K = [
    { t: 0, el: 29, az: 24, sun: c(4.25, 3.24, 2.06), zen: c(.14, .40, .70), mid: c(.34, .62, .80), hor: c(.92, .80, .58), hs: c(1.35, .92, .52), gnd: c(.34, .30, .24), fog: 0.0022, env: 0.600, ex: 1.29 },
    { t: 4.8, el: 30, az: 27, sun: c(5.07, 3.78, 2.36), zen: c(.13, .39, .71), mid: c(.32, .62, .82), hor: c(.95, .80, .56), hs: c(1.45, .95, .52), gnd: c(.38, .33, .26), fog: 0.0020, env: 0.600, ex: 1.29 },
    { t: 13, el: 38, az: 40, sun: c(5.43, 4.66, 3.54), zen: c(.105, .37, .72), mid: c(.27, .60, .85), hor: c(.70, .88, .86), hs: c(1.05, .98, .74), gnd: c(.42, .38, .31), fog: 0.0012, env: 0.600, ex: 1.16 },
    { t: 26, el: 47, az: 60, sun: c(5.55, 5.07, 4.25), zen: c(.090, .35, .72), mid: c(.24, .58, .86), hor: c(.58, .86, .93), hs: c(.92, .98, .84), gnd: c(.44, .41, .34), fog: 0.0009, env: 0.600, ex: 1.14 },
    { t: 36, el: 44, az: 104, sun: c(5.55, 4.96, 3.89), zen: c(.090, .34, .70), mid: c(.26, .58, .84), hor: c(.70, .87, .84), hs: c(1.0, .96, .74), gnd: c(.44, .40, .33), fog: 0.0009, env: 0.600, ex: 1.16 },
    { t: 43.2, el: 30, az: 152, sun: c(5.66, 4.37, 2.77), zen: c(.10, .31, .62), mid: c(.33, .54, .72), hor: c(1.0, .78, .52), hs: c(1.5, .95, .48), gnd: c(.42, .35, .27), fog: 0.0012, env: 0.588, ex: 1.18 },
    { t: 48.5, el: 16, az: 180, sun: c(5.9, 3.95, 2.25), zen: c(.085, .22, .52), mid: c(.42, .42, .56), hor: c(1.25, .68, .36), hs: c(2.0, .98, .38), gnd: c(.38, .28, .21), fog: 0.0016, env: 0.552, ex: 1.22 },
    { t: 52.8, el: 8, az: 201, sun: c(5.4, 2.85, 1.35), zen: c(.12, .19, .40), mid: c(.48, .34, .42), hor: c(1.35, .50, .24), hs: c(2.3, .88, .26), gnd: c(.28, .20, .17), fog: 0.0018, env: 0.516, ex: 1.27 },
    { t: 57, el: 1.2, az: 209, sun: c(2.6, 1.05, .5), zen: c(.060, .095, .255), mid: c(.28, .20, .36), hor: c(1.05, .30, .22), hs: c(1.7, .48, .18), gnd: c(.13, .10, .12), fog: 0.0017, env: .80, ex: 1.23 },
    { t: 57.6, el: 0.2, az: 210, sun: c(0.00, 0.00, 0.00), zen: c(.054, .086, .24), mid: c(.25, .18, .35), hor: c(.95, .27, .22), hs: c(1.5, .42, .18), gnd: c(.11, .09, .12), fog: 0.0017, env: .86, ex: 1.25, moon: 0 },
    { t: 62.4, el: 20, az: -60, sun: c(.55, .70, 1.10), zen: c(.016, .034, .115), mid: c(.060, .072, .19), hor: c(.36, .17, .24), hs: c(.52, .20, .20), gnd: c(.05, .05, .085), fog: 0.0014, env: .80, ex: 1.35, moon: 1 },
    { t: 67, el: 21.5, az: -68, sun: c(0.6, 0.82, 1.3), zen: c(.0085, .020, .072), mid: c(.024, .044, .125), hor: c(.085, .088, .18), hs: c(.15, .16, .28), gnd: c(.035, .042, .075), fog: 0.0013, env: 0.570, ex: 1.44, moon: 1 },
    { t: 72, el: 22.5, az: -74, sun: c(0.95, 1.25, 1.9), zen: c(.0062, .016, .060), mid: c(.017, .037, .108), hor: c(.046, .068, .150), hs: c(.10, .15, .28), gnd: c(.03, .04, .07), fog: 0.0012, env: 0.600, ex: 1.51, moon: 1 },
    { t: 81.6, el: 23.5, az: -77, sun: c(1.05, 1.4, 2.1), zen: c(.0062, .016, .060), mid: c(.017, .037, .108), hor: c(.046, .068, .150), hs: c(.10, .16, .29), gnd: c(.03, .04, .07), fog: 0.0012, env: 0.600, ex: 1.51, moon: 1 }];
  const S = { sunDir: V3(), sun: V3(), zen: V3(), mid: V3(), hor: V3(), hs: V3(), gnd: V3(), fog: 0, env: 1, ex: 1.32, moon: 0, night: 0, t: -1, el: 0, az: 0 };
  const mixv = (o, a, b, k) => o.set(lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k));
  const U = { uZen: { value: V3() }, uMid: { value: V3() }, uHor: { value: V3() }, uHs: { value: V3() }, uGnd: { value: V3() }, uSunD: { value: V3() }, uSunI: { value: V3() }, uNight: { value: 0 }, uMoon: { value: 0 }, uT: LU.uTime, uPrint: LU.uPrint, uPrintC: LU.uPrintC, uRes: LU.uRes, uLite: { value: 0 }, uPulse: { value: 0 } };
  const GLSL = /* glsl */`
    uniform vec3 uZen, uMid, uHor, uHs, uGnd, uSunD, uSunI; uniform float uNight, uMoon, uT, uPrint, uLite, uPulse;
    vec3 skyCol(vec3 d, float disc){ float h = max(d.y, 0.0), az = dot(normalize(d.xz + 1e-5), normalize(uSunD.xz + 1e-5)) * 0.5 + 0.5, sd = max(dot(d, uSunD), 0.0);
      vec3 ho = mix(uHor, uHs, az * az * az); float k = 1.0 - h; vec3 c = mix(uZen, uMid, pow(k, 2.4)); c = mix(c, ho, pow(k, 7.5));
      c += uSunI * (0.020 * pow(sd, 8.0) + 0.05 * pow(sd, 64.0) * (1.0 - uMoon * 0.7) + 0.25 * pow(sd, 900.0)) * disc;
      if (d.y < 0.0) c = mix(ho * 0.85, uGnd, smoothstep(0.0, -0.18, d.y));
      return c; }`;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, uniforms: U,
    vertexShader: `varying vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: GLSL_NZ + GLSL + /* glsl */`varying vec3 vD; uniform vec3 uPrintC; uniform vec2 uRes; float trPr(){ if (uPrint <= 0.0) return 0.0; if (uPrint >= 1.0) return 1.0; vec2 q = gl_FragCoord.xy / uRes - uPrintC.xy; q.x *= uPrintC.z; float a = atan(q.y, q.x), w = (0.045 * sin(a * 3.0 + 1.0) + 0.020 * sin(a * 7.0 + 4.0) + 0.006 * sin(a * 17.0)) * smoothstep(0.0, 0.5, length(q)); float e = 1.75 * pow(1.0 - uPrint, 1.25); return smoothstep(e - 0.05, e + 0.05, length(q) + w); }
    void main(){ vec3 d = normalize(vD); vec3 c = skyCol(d, 1.0); float sd = dot(d, uSunD);
      if (uMoon < 0.5) { c += uSunI * 9.0 * smoothstep(0.99945, 0.99975, sd); }
      else { // the moon: a pale disc with seas
        float r = acos(clamp(sd, -1.0, 1.0)) / 0.034; vec3 up = vec3(0.0, 1.0, 0.0), mx = normalize(cross(up, uSunD)), my = cross(uSunD, mx); vec2 q = vec2(dot(d, mx), dot(d, my)) / 0.034; float seas = smoothstep(0.42, 0.62, fbm3(vec3(q * 1.6 + 3.0, 1.0))); float m = smoothstep(1.0, 0.94, r);
        c = mix(c, vec3(1.9, 1.82, 1.6) * (1.0 - 0.30 * seas) * (1.0 - 0.12 * r * r), m * uMoon); c += vec3(0.20, 0.26, 0.38) * exp(-r * 0.55) * uMoon * 0.5; }
      // stars
      if (uNight > 0.01 && d.y > 0.0) { vec3 p = d * 170.0; vec3 ip = floor(p); float s = 0.0; for (int k = 0; k < 8; k++) { vec3 o = vec3(k & 1, (k >> 1) & 1, (k >> 2) & 1); vec3 h = hash33(ip + o); vec3 sp = normalize(ip + o + (h - 0.5) * 0.7); float dd = length(d - sp) * 170.0; float big = step(0.90, h.x); s += smoothstep(0.10 + 0.13 * big * h.y, 0.0, dd) * step(0.86, h.z) * (0.18 + 1.5 * big) * (0.65 + 0.35 * sin(uT * (1.0 + 4.0 * h.y) + h.x * 40.0)) * (1.0 + uPulse * 1.2 * big); } float band = fbm3(d * 3.0 + vec3(2.0, 0.0, 5.0)); c += vec3(0.85, 0.92, 1.1) * s * uNight * smoothstep(0.02, 0.25, d.y) + vec3(0.03, 0.035, 0.06) * uNight * smoothstep(0.45, 0.8, band) * smoothstep(0.1, 0.5, d.y); }
      // print sky: the cerulean masses with paper gaps of the old sheet, cut as flat shapes
      float tpr_ = trPr(); if (tpr_ > 0.001) { vec3 P = vec3(0.105, 0.36, 0.62); float y = d.y; vec3 f = y > 0.0 ? P : vec3(0.90, 0.83, 0.68); float w = 0.012 * sin(d.x * 9.0) + 0.008 * sin(d.x * 23.0 + 1.0); f = mix(vec3(0.17, 0.45, 0.66), f, smoothstep(0.19, 0.20, y + w)); f = mix(vec3(0.30, 0.56, 0.70), f, smoothstep(0.125, 0.135, y + w * 0.8)); f = mix(vec3(0.91, 0.78, 0.40), f, smoothstep(0.075, 0.082, y + w * 0.5)); f = mix(vec3(0.52, 0.69, 0.62), f, smoothstep(0.035, 0.042, y - w * 0.4)); c = mix(c, f, tpr_); }
      gl_FragColor = vec4(c, 1.0); }` }));
  dome.frustumCulled = false; dome.layers.enable(1); dome.renderOrder = -100; dome.name = 'sky';
  const sun = new THREE.DirectionalLight(0xffffff, 1); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.035; const sc = sun.shadow.camera; sc.near = 1; sc.far = 190; sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34;
  const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.0); sun.layers.enable(1); hemi.layers.enable(1);      // layer 1 = what the lake reflects
  let R, scene, pm, eqRT, eqMat, eqScene, eqCam, envRT = null, lastEnv = -99;
  function init(renderer, scn) { R = renderer; scene = scn; scene.add(dome, sun, sun.target, hemi); scene.fog = new THREE.FogExp2(0xffffff, 0.001);
    pm = new THREE.PMREMGenerator(R); eqRT = new THREE.WebGLRenderTarget(256, 128, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }); eqRT.texture.mapping = THREE.EquirectangularReflectionMapping; eqRT.texture.wrapS = THREE.RepeatWrapping;
    eqMat = new THREE.ShaderMaterial({ uniforms: U, depthTest: false, depthWrite: false, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: GLSL_NZ + GLSL + `varying vec2 vUv; void main(){ float th = (vUv.x - 0.5) * 6.28318530718, ph = (vUv.y - 0.5) * 3.14159265; vec3 d = vec3(cos(ph) * cos(th), sin(ph), cos(ph) * sin(th)); vec3 c = skyCol(d, 0.35); float l = dot(c, vec3(0.30, 0.55, 0.15)); c = mix(vec3(l) * vec3(1.06, 1.0, 0.95), c, 0.42); c += uSunI * vec3(0.95, 0.86, 0.72) * 0.016 * smoothstep(0.25, -0.5, d.y) * clamp(uSunD.y * 2.5, 0.0, 1.0); gl_FragColor = vec4(c, 1.0); }` });
    eqScene = new THREE.Scene(); const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), eqMat); q.frustumCulled = false; eqScene.add(q); eqCam = new THREE.Camera(); }
  function bakeEnv() { const old = R.getRenderTarget(); R.setRenderTarget(eqRT); R.render(eqScene, eqCam); R.setRenderTarget(old); const rt = pm.fromEquirectangular(eqRT.texture, envRT); envRT = rt; scene.environment = rt.texture; }
  function state(t, o) { let i = 1; while (i < K.length - 1 && t > K[i].t) i++; const a = K[i - 1], b = K[i], k = clamp((t - a.t) / (b.t - a.t)); o = o || S; o.el = lerp(a.el, b.el, k); o.az = lerp(a.az, b.az, k);
    if (t > 57 && t < 62.4) { if (t < 57.6) { } else { o.el = 20; o.az = -60; } }           // the light changes hands from sun to moon while both are dark
    const e = deg(o.el), z = deg(o.az); o.sunDir.set(-Math.cos(z) * Math.cos(e), Math.sin(e), Math.sin(z) * Math.cos(e)).normalize(); for (const n of ['sun', 'zen', 'mid', 'hor', 'hs', 'gnd']) mixv(o[n], a[n], b[n], k); o.fog = lerp(a.fog, b.fog, k); o.env = lerp(a.env, b.env, k); o.ex = lerp(a.ex, b.ex, k); o.moon = t > 57.6 ? sm(57.6, 62, t) : 0; o.night = sm(57, 66, t); o.t = t; return o; }
  // focus = world point the shadow box is centred on; box = half size in metres
  function apply(t, focus, box = 34) {
    state(t); U.uZen.value.copy(S.zen); U.uMid.value.copy(S.mid); U.uHor.value.copy(S.hor); U.uHs.value.copy(S.hs); U.uGnd.value.copy(S.gnd); U.uSunD.value.copy(S.sunDir); U.uSunI.value.copy(S.sun); U.uNight.value = S.night; U.uMoon.value = S.moon; U.uPulse.value = Score.env('bell', t, 0.5);
    LU.uSunDir.value.copy(S.sunDir); LU.uSunCol.value.copy(S.sun); sun.color.setRGB(S.sun.x, S.sun.y, S.sun.z); sun.intensity = 1;
    const sz = box * 2 / sun.shadow.mapSize.x, f = focus || V3(); sc.left = -box; sc.right = box; sc.top = box; sc.bottom = -box; sc.updateProjectionMatrix();
    // snap to shadow texels so edges do not crawl as the camera moves
    const d = S.sunDir, up = Math.abs(d.y) > .99 ? V3(1, 0, 0) : V3(0, 1, 0), x = V3().crossVectors(up, d).normalize(), y = V3().crossVectors(d, x); const a = Math.round(f.dot(x) / sz) * sz, b = Math.round(f.dot(y) / sz) * sz, g = f.dot(d); const fp = V3().addScaledVector(x, a).addScaledVector(y, b).addScaledVector(d, g);
    sun.target.position.copy(fp); sun.position.copy(fp).addScaledVector(d, 95); sun.target.updateMatrixWorld(); sun.updateMatrixWorld();
    const tan = S.moon > .5 ? .03 : lerp(.055, .030, sm(5, 35, S.el)); LU.uShadowK.value.set(Math.min(.014, .48 / (2 * box)), 189 * tan / (2 * box), .7 / sun.shadow.mapSize.x, .40 / (2 * box));
    LU.uFogA.value.set(lerp(S.hor.x, S.mid.x, .25), lerp(S.hor.y, S.mid.y, .25), lerp(S.hor.z, S.mid.z, .25), S.fog); LU.uFogB.value.set(S.hs.x, S.hs.y, S.hs.z, .028);
    scene.environmentIntensity = S.env; if (Math.abs(t - lastEnv) > (CAPTURE ? 0.02 : 0.35) || !envRT) { bakeEnv(); lastEnv = t; }
  }
  return { init, apply, S, U, GLSL, sun, dome, state, K, get env() { return envRT; } };
})();

// ---- LANTERN LIGHT FIELD: any number of small warm lights, summed into a map every material reads -------------------------------------
// const id = Lan.add({x,y,z, r: reach in metres, color:[r,g,b], gain:()=>0..n | number}); Lan.pos(id,x,y,z); Lan.level(id,v)
const Lan = (() => {
  const MAX = 420, P = new Float32Array(MAX * 4), C = new Float32Array(MAX * 3); let n = 0, rt, mesh, scene, cam, R; const L = [], size = 84;
  function add(o) { const id = n++; if (id >= MAX) return -1; L.push(Object.assign({ r: 6, color: [1, .62, .28], gain: 1, level: 1 }, o)); return id; }
  function init(renderer) { R = renderer; rt = new THREE.WebGLRenderTarget(256, 256, { count: 2, type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    const g = new THREE.InstancedBufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3)); g.setIndex([0, 1, 2, 0, 2, 3]); g.setAttribute('aP', new THREE.InstancedBufferAttribute(P, 4)); g.setAttribute('aC', new THREE.InstancedBufferAttribute(C, 3));
    const m = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: { uC: { value: new THREE.Vector2() }, uS: { value: size } }, depthTest: false, depthWrite: false, transparent: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation,
      vertexShader: `in vec4 aP; in vec3 aC; uniform vec2 uC; uniform float uS; out vec2 vQ; out vec3 vC; out vec3 vP; void main(){ vQ = position.xy; vC = aC; vP = vec3(aP.x - uC.x, aP.y, aP.z - uC.y); vec2 w = aP.xz - uC + position.xy * aP.w; gl_Position = vec4(w / uS * 2.0, 0.0, 1.0); }`,
      fragmentShader: `precision highp float; in vec2 vQ; in vec3 vC; in vec3 vP; layout(location = 0) out vec4 o0; layout(location = 1) out vec4 o1; void main(){ float r = dot(vQ, vQ); float w = max(1.0 - r, 0.0); w *= w; if (w <= 0.0) discard; float l = dot(vC, vec3(0.333)) * w + w * 1e-3; o0 = vec4(vC * w, l); o1 = vec4(vP * l, 1.0); }` });
    mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; scene = new THREE.Scene(); scene.add(mesh); cam = new THREE.Camera(); LU.tLan.value = rt.textures[0]; LU.tLanP.value = rt.textures[1]; }
  function update(cx, cz, gain) { LU.uLan.value.set(cx, cz, size, gain); let k = 0; if (gain > .001) for (let i = 0; i < n && k < MAX; i++) { const o = L[i], g = (typeof o.gain === 'function' ? o.gain() : o.gain) * o.level; if (g < .004 || Math.abs(o.x - cx) > size * .5 + o.r || Math.abs(o.z - cz) > size * .5 + o.r) continue; P[k * 4] = o.x; P[k * 4 + 1] = o.y; P[k * 4 + 2] = o.z; P[k * 4 + 3] = o.r; C[k * 3] = o.color[0] * g; C[k * 3 + 1] = o.color[1] * g; C[k * 3 + 2] = o.color[2] * g; k++; }
    const g = mesh.geometry; g.instanceCount = k; g.attributes.aP.needsUpdate = g.attributes.aC.needsUpdate = true; mesh.material.uniforms.uC.value.set(cx, cz); const old = R.getRenderTarget(), ca = R.autoClear; R.setRenderTarget(rt); R.setClearColor(0, 0); R.clear(); R.autoClear = false; if (k) R.render(scene, cam); R.autoClear = ca; R.setRenderTarget(old); Lan.count = k; }
  return { add, init, update, pos(i, x, y, z) { const o = L[i]; o.x = x; o.y = y; o.z = z; }, level(i, v) { L[i].level = v; }, list: L, count: 0, size };
})();
