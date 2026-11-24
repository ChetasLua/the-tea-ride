'use strict';
// ---- LOOK: one palette, one material kit, one light model for the whole film -----------------------------------------------
// A stop-motion set on a table: painted wood, glazed clay, felt, cotton, washi paper, feathers, lit by a real sun..
const PAL = { cer: '#4f9fc8', cerD: '#2f7fb5', deep: '#2c72a4', navy: '#1b3f66', mint: '#aed3be', teal: '#5aa9a6', lemon: '#f4d03f', peach: '#efb07c', orange: '#ee9a35', verm: '#d4552b', red: '#d8402a', leaf: '#5d9c5c', sage: '#9cba7c', green: '#3f9470', brown: '#a5644a', umber: '#7d4a30', tan: '#e3c08f', lilac: '#a99cc8', pink: '#f0a896', skin: '#f3cfa8', wood: '#b3804f', paper: '#f3e7cf', cream: '#fbf3e0', white: '#f7f4ec', ink: '#1d2a44' };
// uniforms every built-in material receives (shared objects: set .value, everybody sees it)
const LU = {
  uTime: { value: 0 }, uBeat: { value: 0 }, uSunDir: { value: new THREE.Vector3(-0.6, 0.6, 0.4).normalize() }, uSunCol: { value: new THREE.Vector3(4, 3.6, 3) },
  uWind: { value: new THREE.Vector4(-0.8, 0.6, 0.5, 0) },                 // dir x, dir z, strength, gust phase
  uWakeP: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, -99, 0, 1)) }, uWakeV: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, 0, 0)) },   // moving bodies that push air: position+radius, velocity+strength
  uFogA: { value: new THREE.Vector4(0.6, 0.75, 0.85, 0.002) }, uFogB: { value: new THREE.Vector4(1, 0.85, 0.6, 0.05) },
  uPrint: { value: 0 }, uPrintC: { value: new THREE.Vector3(0.5, 0.45, 1.78) }, uRes: { value: new THREE.Vector2(1920, 1080) }, uPrintK: { value: new THREE.Vector2(0.16, 0.2) }, uPrintShade: { value: new THREE.Vector3(0.50, 0.72, 0.86) },
  tLan: { value: null }, tLanP: { value: null }, uLan: { value: new THREE.Vector4(0, 0, 80, 0) },                                     // lantern light field: centre x,z, size, gain
  uShadowK: { value: new THREE.Vector4(0.004, 0.02, 0.0004, 0.006) }, tNz: { value: null },
};
// tiling noise: R fbm, G fine grain, B cells, A long streaks (along v)
(() => { const N = 256, px = new Uint8Array(N * N * 4), R = rng(5), hsh = new Float32Array(N * N).map(() => R());
  const vn = (u, v, f, fy, s) => { const x = u * f, y = v * fy, xi = Math.floor(x), yi = Math.floor(y); let fx = x - xi, fyy = y - yi; fx = fx * fx * (3 - 2 * fx); fyy = fyy * fyy * (3 - 2 * fyy); const g = (a, b) => hsh[((((b % fy) + fy) % fy * 57 + s * 131) % N) * N + (((a % f) + f) % f * 31 + s * 17) % N]; return lerp(lerp(g(xi, yi), g(xi + 1, yi), fx), lerp(g(xi, yi + 1), g(xi + 1, yi + 1), fx), fyy); };
  const pts = []; for (let i = 0; i < 90; i++) pts.push([R(), R()]);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const u = i / N, v = j / N, k = (j * N + i) * 4; const f = 0.5 * vn(u, v, 4, 4, 1) + 0.26 * vn(u, v, 9, 9, 2) + 0.14 * vn(u, v, 19, 19, 3) + 0.1 * vn(u, v, 41, 41, 4); const g = 0.6 * vn(u, v, 64, 64, 5) + 0.4 * vn(u, v, 127, 127, 6); let d1 = 9, d2 = 9; for (const p of pts) { let dx = Math.abs(u - p[0]), dy = Math.abs(v - p[1]); if (dx > .5) dx = 1 - dx; if (dy > .5) dy = 1 - dy; const d = dx * dx + dy * dy; if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; } const c = clamp((Math.sqrt(d2) - Math.sqrt(d1)) * 14); const s = 0.55 * vn(u, v, 48, 3, 7) + 0.3 * vn(u, v, 97, 5, 8) + 0.15 * vn(u, v, 23, 2, 9);
    px[k] = f * 255; px[k + 1] = g * 255; px[k + 2] = c * 255; px[k + 3] = s * 255; }
  const t = new THREE.DataTexture(px, N, N, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 8; t.needsUpdate = true; LU.tNz.value = t; })();

// ---- global shader chunk surgery: height fog, soft shadows, translucency, lantern light, print mode ---------------------------
const GLSL_NZ = /* glsl */`
float hash11(float p){ p = fract(p*.1031); p *= p+33.33; p *= p+p; return fract(p); }
float hash21(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float hash31(vec3 p3){ p3 = fract(p3*.1031); p3 += dot(p3,p3.zyx+31.32); return fract((p3.x+p3.y)*p3.z); }
vec3 hash33(vec3 p3){ p3 = fract(p3*vec3(.1031,.1030,.0973)); p3 += dot(p3,p3.yxz+33.33); return fract((p3.xxy+p3.yxx)*p3.zyx); }
float vnoise2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x), mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x), f.y); }
float vnoise3(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(mix(hash31(i),hash31(i+vec3(1,0,0)),f.x), mix(hash31(i+vec3(0,1,0)),hash31(i+vec3(1,1,0)),f.x), f.y), mix(mix(hash31(i+vec3(0,0,1)),hash31(i+vec3(1,0,1)),f.x), mix(hash31(i+vec3(0,1,1)),hash31(i+vec3(1,1,1)),f.x), f.y), f.z); }
float fbm3(vec3 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*vnoise3(p); p=p*2.03+vec3(17.1,9.2,5.3); a*=.5; } return s; }
`;
// world-space wind: displacement (metres) at world point p for a thing of flexibility w. Same field on CPU: Wind.at()
const GLSL_WIND = /* glsl */`
uniform float uTime; uniform vec4 uWind; uniform vec4 uWakeP[4]; uniform vec4 uWakeV[4];
vec3 trWind(vec3 p, float w){
  float g = 0.55 + 0.45 * sin(dot(p.xz, uWind.xy) * -0.22 + uTime * 1.1 + 2.0 * sin(p.z * 0.07 + uTime * 0.31));
  float f = sin(dot(p, vec3(1.7, 0.9, 1.3)) + uTime * 3.1) * 0.35 + sin(dot(p, vec3(3.1, 2.3, 2.7)) + uTime * 5.3) * 0.18;
  vec3 d = vec3(uWind.x, 0.0, uWind.y) * uWind.z * (g * 0.8 + f * 0.6) + vec3(-uWind.y, 0.35, uWind.x) * uWind.z * f * 0.5;
  for (int i = 0; i < 4; i++) { vec3 r = p - uWakeP[i].xyz; float q = exp(-dot(r, r) / (uWakeP[i].w * uWakeP[i].w)); d += (uWakeV[i].xyz + normalize(r + 1e-4) * length(uWakeV[i].xyz) * 0.35) * q * uWakeV[i].w; }
  return d * w; }
`;
(() => {
  const C = THREE.ShaderChunk, rep = (k, a, b) => { if (!C[k].includes(a)) throw new Error('chunk ' + k + ': missing ' + a); C[k] = C[k].split(a).join(b); };
  C.fog_pars_vertex = `#ifdef USE_FOG\nvarying float vFogDepth; varying vec3 vWP;\n#endif`;
  C.fog_vertex = `#ifdef USE_FOG\n vFogDepth = -mvPosition.z; vWP = transpose(mat3(viewMatrix)) * (mvPosition.xyz - viewMatrix[3].xyz);\n#endif`;
  C.fog_pars_fragment = /* glsl */`#ifdef USE_FOG
    uniform vec3 fogColor; uniform float fogDensity; varying float vFogDepth; varying vec3 vWP;
    uniform vec4 uFogA, uFogB; uniform vec3 uSunDir, uSunCol; uniform float uPrint; uniform vec3 uPrintC; uniform vec2 uRes; uniform vec2 uPrintK; uniform vec3 uPrintShade; uniform sampler2D tLan, tLanP; uniform vec4 uLan;
    float trPr(){ if (uPrint <= 0.0) return 0.0; if (uPrint >= 1.0) return 1.0; vec2 q = gl_FragCoord.xy / uRes - uPrintC.xy; q.x *= uPrintC.z; float a = atan(q.y, q.x), w = (0.045 * sin(a * 3.0 + 1.0) + 0.020 * sin(a * 7.0 + 4.0) + 0.006 * sin(a * 17.0)) * smoothstep(0.0, 0.5, length(q)); float e = 1.75 * pow(1.0 - uPrint, 1.25); return smoothstep(e - 0.05, e + 0.05, length(q) + w); }
    vec4 trFog(vec3 wp){ vec3 fv = wp - cameraPosition; float fd = length(fv); vec3 fr = fv / max(fd, 1e-4); float hf = uFogB.w, fy = fr.y * hf * fd;
      float fi = uFogA.w * exp(-max(cameraPosition.y, -2.0) * hf) * fd * (abs(fy) > 1e-3 ? (1.0 - exp(-fy)) / fy : 1.0); float sd = max(dot(fr, uSunDir), 0.0);
      return vec4(mix(uFogA.rgb, uFogB.rgb, pow(sd, 5.0) * 0.8), (1.0 - exp(-fi)) * (1.0 - trPr())); }
  #endif`;
  C.fog_fragment = `#ifdef USE_FOG\n { vec4 trf = trFog(vWP); gl_FragColor.rgb = mix(gl_FragColor.rgb, trf.rgb, trf.a); }\n#endif`;
  // soft shadows that widen with distance from the caster (PCSS, one directional light)
  C.shadowmap_pars_fragment += /* glsl */`
  #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
  uniform vec4 uShadowK;
  vec2 trVogel(int i, float n, float phi){ float r = sqrt((float(i) + 0.5) / n), th = float(i) * 2.39996323 + phi; return r * vec2(cos(th), sin(th)); }
  float trShadow( sampler2D m, vec2 sz, float inten, float bias, float radius, vec4 sc ) {
    sc.xyz /= sc.w; sc.z += bias; vec2 e = abs(sc.xy - 0.5); if (max(e.x, e.y) > 0.5 || sc.z > 1.0) return 1.0;
    float phi = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) * 6.2831853, bd = 0.0, bn = 0.0;
    for (int i = 0; i < 12; i++) { float d = unpackRGBAToDepth(texture2D(m, sc.xy + trVogel(i, 12.0, phi) * uShadowK.x)); if (d < sc.z) { bd += d; bn += 1.0; } }
    if (bn < 0.5) return 1.0; bd /= bn;
    float pen = clamp((sc.z - bd) * uShadowK.y, uShadowK.z, uShadowK.w), s = 0.0; float edge_ = 1.0 - smoothstep(0.44, 0.5, max(e.x, e.y));
    if (bn > 11.5 && pen < uShadowK.x * 0.6) return 1.0 - inten * edge_;
    for (int i = 0; i < 28; i++) s += step(sc.z, unpackRGBAToDepth(texture2D(m, sc.xy + trVogel(i, 28.0, phi) * pen)));
    s = smoothstep(0.0, 1.0, s / 28.0); return mix(1.0, s, inten * (1.0 - smoothstep(0.44, 0.5, max(e.x, e.y)))); }
  #endif`;
  rep('lights_fragment_begin', 'getShadow( directionalShadowMap[ i ]', 'trShadow( directionalShadowMap[ i ]');
  // thin things: sun through cloth, paper, leaf, pouch
  const L = C.lights_fragment_begin, k0 = L.indexOf('getDirectionalLightInfo'), k1 = L.indexOf('RE_Direct( directLight', k0), k2 = L.indexOf(';', k1) + 1;
  C.lights_fragment_begin = L.slice(0, k2) + `\n\t\t#ifdef TR_TRANS\n\t\t{ float tb = dot(-geometryNormal, directLight.direction); float vb = pow(max(dot(-geometryViewDir, directLight.direction), 0.0), 3.0); reflectedLight.directDiffuse += directLight.color * trTransC * (max(tb, 0.0) * 0.85 + vb * 0.5 + max(1.0 - abs(tb), 0.0) * 0.12) * RECIPROCAL_PI; }\n\t\t#endif` + L.slice(k2);
  C.lights_fragment_end = /* glsl */`#if defined( USE_FOG ) && defined( RE_Direct )
  if (uLan.w > 0.001) { vec2 lu = (vWP.xz - uLan.xy) / uLan.z + 0.5; if (lu.x > 0.0 && lu.x < 1.0 && lu.y > 0.0 && lu.y < 1.0) { vec4 la = texture2D(tLan, lu);
    if (la.a > 1e-3) { vec3 lp = texture2D(tLanP, lu).xyz / la.a + vec3(uLan.x, 0.0, uLan.y); vec3 Lw = lp - vWP; float d2 = dot(Lw, Lw); vec3 Lv = normalize((viewMatrix * vec4(Lw, 0.0)).xyz);
      float nl = dot(geometryNormal, Lv), ed = smoothstep(0.5, 0.42, max(abs(lu.x - 0.5), abs(lu.y - 0.5))); vec3 E = la.rgb * uLan.w * ed / (0.6 + 0.16 * d2);
      reflectedLight.directDiffuse += E * max((nl + 0.3) / 1.3, 0.0) * BRDF_Lambert( material.diffuseColor );
      #ifdef STANDARD
      vec3 hv = normalize(Lv + geometryViewDir); float glo = mix(140.0, 5.0, sqrt(material.roughness)); reflectedLight.directSpecular += E * pow(max(dot(geometryNormal, hv), 0.0), glo) * (glo + 2.0) * 0.004 * max(nl, 0.0);
      #endif
      #ifdef TR_TRANS
      reflectedLight.directDiffuse += E * trTransC * max((-nl + 0.25) / 1.25, 0.0) * RECIPROCAL_PI;
      #endif
    } } }
  #endif
  ` + C.lights_fragment_end;
  C.opaque_fragment = /* glsl */`#if defined(STANDARD) && defined(USE_FOG)
  float tpr_ = trPr(); if (tpr_ > 0.001) { float pal_ = dot(diffuseColor.rgb, vec3(0.3333)) + 1e-3, pk = dot(reflectedLight.directDiffuse, vec3(0.3333)) / pal_; float plit = smoothstep(uPrintK.x, uPrintK.y, pk);
    vec3 pflat = diffuseColor.rgb * mix(uPrintShade, vec3(1.0), plit); outgoingLight = mix(outgoingLight, pflat, tpr_); }
  #endif
  ` + C.opaque_fragment;
  const feed = sh => { for (const k in LU) if (!sh.uniforms[k]) sh.uniforms[k] = LU[k]; };
  THREE.Material.prototype.onBeforeCompile = function (sh) { feed(sh); };
  LU._feed = feed;
})();

// ---- material kit -------------------------------------------------------------------------------------------------------------
// Mat.make(type, opts) -> THREE.MeshStandardMaterial / MeshPhysicalMaterial. Cached by (type, opts) so equal calls share one program.
//   type: plaster wood lacquer clay cloth felt paper ceramic glass metal leaf skin feather stone earth hair bark wool plain
//   opts: color '#hex' | vcol:true (vertex colours) | rough | scale (detail frequency, 1/m) | bump | axis 'x'|'y'|'z' (grain direction) | space 'object'|'world'
//         trans 0..1 (light through it), transColor | sheen 0..1 | coat 0..1, coatRough | wind 0..1 (needs attribute aWind, or uses windUV:'y' = uv.y, or windH:true = local height)
//         double:true | emissive '#hex', emissiveI | metal 0..1 | print (unused) | alphaTest, map | noFog
// Mat.mesh(geo, mat, {cast,receive}) -> Mesh with shadows and the matching depth material (wind-moved things need it). Mat.inst(geo, mat, n) same, instanced.
// Mat.hook(mat, {vertPars, vert, fragPars, color, rough, bump, emissive, uniforms, key}) -> extra GLSL on top of a kit material (its own program)
const Mat = (() => {
  const T = { plain: 0, plaster: 1, wood: 2, lacquer: 3, clay: 4, cloth: 5, felt: 6, paper: 7, ceramic: 8, glass: 9, metal: 10, leaf: 11, skin: 12, feather: 13, stone: 14, earth: 15, hair: 16, bark: 17, wool: 18 };
  const D = { // defaults: rough, detail scale, bump, sheen, coat
    plain: { rough: .6, scale: 1, bump: 0 }, plaster: { rough: .92, scale: .55, bump: .012 }, wood: { rough: .62, scale: .9, bump: .006 }, lacquer: { rough: .38, scale: .8, bump: .0015, coat: .7, coatRough: .18 }, clay: { rough: .82, scale: 1.2, bump: .008 },
    cloth: { rough: .88, scale: 3, bump: .004, sheen: .35 }, felt: { rough: 1, scale: 4, bump: .006, sheen: .6 }, paper: { rough: .85, scale: 1.4, bump: .002 }, ceramic: { rough: .28, scale: 1.2, bump: .0012, coat: .9, coatRough: .07 }, glass: { rough: .06, scale: 1, bump: 0 }, metal: { rough: .35, scale: 2, bump: .001, metal: 1 },
    leaf: { rough: .7, scale: 2, bump: .002, trans: .5 }, skin: { rough: .55, scale: 2.2, bump: .0012, sheen: .15 }, feather: { rough: .8, scale: 2, bump: .0025, sheen: .4 }, stone: { rough: .9, scale: .8, bump: .006 }, earth: { rough: 1, scale: .5, bump: .02 }, hair: { rough: .5, scale: 2, bump: .006, sheen: .3 }, bark: { rough: .95, scale: 1.2, bump: .02 }, wool: { rough: 1, scale: 5, bump: .01, sheen: .9 } };
  const PARS = /* glsl */`
    uniform sampler2D tNz; uniform vec4 trP; uniform vec3 trTC; varying vec3 vOP; varying vec3 vON; varying vec2 vTU;
    vec4 trTri(vec3 p, vec3 n){ vec3 w = pow(abs(n), vec3(5.0)); w /= w.x + w.y + w.z; return texture2D(tNz, p.zy) * w.x + texture2D(tNz, p.xz) * w.y + texture2D(tNz, p.xy) * w.z; }
    vec4 trTriS(vec3 p, vec3 n){ vec3 w = pow(abs(n), vec3(5.0)); w /= w.x + w.y + w.z; return texture2D(tNz, p.zy) * w.x + texture2D(tNz, p.xy * 1.0) * w.z + texture2D(tNz, p.xz) * w.y; }
    vec3 trBump(vec3 pos_, vec3 n_, float h, float k){ vec3 sx = dFdx(pos_), sy = dFdy(pos_); vec3 r1 = cross(sy, n_), r2 = cross(n_, sx); float det = dot(sx, r1); vec2 dh = vec2(dFdx(h), dFdy(h)); vec3 g = sign(det) * (dh.x * r1 + dh.y * r2); return normalize(abs(det) * n_ - k * g); }
  `;
  // each type: statements that may read `nz` (vec4 triplanar noise at detail scale), `nzB` (large scale, /6), op, on; write col, rgh, hgt
  const BODY = {
    plain: ``, plaster: `col *= 0.90 + 0.2 * nzB.r; col *= 0.95 + 0.1 * nz.a; col = mix(col, col * vec3(0.93, 0.95, 0.98), smoothstep(0.5, 0.75, nzB.r) * 0.5); rgh -= 0.1 * nz.r; hgt = nz.r * 0.6 + nz.g * 0.35 + nz.a * 0.5;`,
    wood: `float gr = nz.a; col *= mix(0.70, 1.14, gr); col = mix(col, col * vec3(0.80, 0.72, 0.66), smoothstep(0.55, 0.8, nzB.a) * 0.45); rgh += 0.15 * (0.5 - gr); hgt = gr * 1.2 + nz.g * 0.15;`,
    lacquer: `col *= 0.95 + 0.1 * nzB.r; rgh += 0.08 * (nz.r - 0.5); hgt = nz.r * 0.8;`,
    clay: `col *= 0.82 + 0.36 * nzB.r; col = mix(col, col * 0.72, smoothstep(0.62, 0.8, nz.g) * 0.35); col = mix(col, vec3(dot(col, vec3(0.333))) * vec3(1.05, 1.0, 0.92), 0.12 * nz.r); hgt = nz.r * 0.7 + nz.g * 0.5;`,
    cloth: `vec3 aw = abs(on); vec2 cu = aw.y > aw.x && aw.y > aw.z ? op.xz : aw.x > aw.z ? op.zy : op.xy; cu *= 330.0; float fade = 1.0 - smoothstep(0.30, 1.3, max(fwidth(cu.x), fwidth(cu.y)) * 0.5); float we = sin(cu.x) * sin(cu.y + 1.57 * step(0.0, sin(cu.x * 0.5))); col *= 1.0 - 0.10 * fade * (0.5 + 0.5 * we); col *= 0.93 + 0.14 * nzB.r; hgt = we * 0.35 * fade + nz.r * 0.6;`,
    felt: `col *= 0.88 + 0.24 * nz.g; col *= 0.92 + 0.16 * nzB.r; hgt = nz.g * 1.2 + nz.b * 0.3;`,
    paper: `col *= 0.95 + 0.07 * nzB.r; float fb = smoothstep(0.58, 0.72, nz.a) * smoothstep(0.4, 0.7, nzB.r); col = mix(col, col * 1.06, fb * 0.6); hgt = nz.a * 0.6 + nz.g * 0.3;`,
    ceramic: `col *= 0.96 + 0.08 * nzB.r; col = mix(col, col * 0.80, smoothstep(0.72, 0.80, nz.g) * 0.25); rgh += 0.06 * (nz.r - 0.5); hgt = nz.r * 0.8;`, glass: ``,
    metal: `rgh += 0.25 * (nz.r - 0.5) + 0.1 * nz.a; col *= 0.9 + 0.2 * nzB.r; hgt = nz.r;`, leaf: `col *= 0.80 + 0.4 * nzB.r; hgt = nz.r;`,
    skin: `col *= 0.97 + 0.06 * nzB.r; hgt = nz.g * 0.5 + nz.r * 0.5; float fr_ = pow(1.0 - max(dot(normalize(vViewPosition), normal), 0.0), 2.0); col = mix(col, col * vec3(1.08, 0.86, 0.78), fr_ * 0.5);`,
    feather: `float br = sin(vTU.y * 130.0 + abs(vTU.x - 0.5) * 90.0); float ff = 1.0 - smoothstep(0.3, 1.0, fwidth(vTU.y) * 60.0); col *= 0.95 + 0.07 * br * ff; col *= 0.94 + 0.12 * nzB.r; hgt = br * 0.5 * ff + nz.a * 0.4;`,
    stone: `col *= 0.80 + 0.36 * nzB.r; col *= 0.94 + 0.12 * nz.g; col = mix(col * 0.88, col, smoothstep(0.02, 0.16, nz.b)); hgt = nz.r * 0.9 + nz.g * 0.4 + smoothstep(0.0, 0.2, nz.b) * 0.5;`,
    earth: `col *= 0.75 + 0.5 * nzB.r; col *= 0.9 + 0.2 * nz.g; hgt = nz.r + nz.g * 0.6;`,
    hair: `float st = texture2D(tNz, vec2(vTU.x * 3.0, vTU.y * 0.25)).a; col *= 0.72 + 0.5 * st; rgh += 0.2 * (0.5 - st); hgt = st * 1.4;`,
    bark: `col *= 0.65 + 0.6 * nz.a; col *= 0.8 + 0.4 * nzB.r; hgt = nz.a * 1.4 + nz.r;`, wool: `col *= 0.86 + 0.26 * nz.b; hgt = nz.b * 1.2 + nz.g * 0.6;`
  };
  const cache = new Map();
  const AXIS = { y: 'op', x: 'op.yxz', z: 'op.xzy' };
  function make(type, o = {}) {
    if (!(type in T)) throw new Error('Mat: unknown type ' + type); const key = type + JSON.stringify(o); if (cache.has(key)) return cache.get(key);
    const d = Object.assign({}, D[type], o), phys = !!(d.coat || d.sheen), M = phys ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
    const m = new M({ color: d.color || '#ffffff', roughness: d.rough, metalness: d.metal || 0, vertexColors: !!d.vcol }); if (d.coat) { m.clearcoat = d.coat; m.clearcoatRoughness = d.coatRough === undefined ? .15 : d.coatRough; }
    if (d.sheen) { m.sheen = d.sheen; m.sheenRoughness = .5; m.sheenColor = new THREE.Color(d.color || '#ffffff').lerp(new THREE.Color('#ffffff'), .5); } if (d.double) m.side = THREE.DoubleSide; if (d.emissive) { m.emissive = new THREE.Color(d.emissive); m.emissiveIntensity = d.emissiveI === undefined ? 1 : d.emissiveI; } if (d.map) m.map = d.map; if (d.alphaTest) m.alphaTest = d.alphaTest; if (d.noFog) m.fog = false; if (d.flat) m.flatShading = true;
    if (type === 'glass') { m.transparent = true; m.opacity = d.opacity || .35; }
    m.userData.kit = { type, d, hooks: [] }; install(m); if (d.wind) m.userData.depth = depthFor(m); cache.set(key, m); return m;
  }
  function windVert(d) { return d.wind ? /* glsl */`
    { float aw_ = ${d.windUV ? 'uv.y' : d.windH ? 'max(transformed.y, 0.0)' : 'aWind'}; mat4 mw_ = modelMatrix;
    #ifdef USE_INSTANCING
      mw_ = modelMatrix * instanceMatrix;
    #endif
      vec3 wp_ = (mw_ * vec4(transformed, 1.0)).xyz; vec3 dw_ = trWind(wp_, aw_ * ${(+d.wind).toFixed(3)}); mat3 m3_ = mat3(mw_); float s2_ = dot(m3_[0], m3_[0]); transformed += transpose(m3_) * dw_ / s2_; }` : ''; }
  function install(m) {
    const { type, d } = m.userData.kit, hooks = m.userData.kit.hooks, tc = new THREE.Color(d.transColor || d.color || '#ffffff').multiplyScalar(d.trans || 0);
    const un = { trP: { value: new THREE.Vector4(d.scale, d.bump, 0, 0) }, trTC: { value: new THREE.Vector3(tc.r, tc.g, tc.b) } };
    m.onBeforeCompile = sh => {
      LU._feed(sh); Object.assign(sh.uniforms, un); hooks.forEach(h => Object.assign(sh.uniforms, h.uniforms || {}));
      const hp = k => hooks.map(h => h[k] || '').join('\n');
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\n#define TR_VERT\nvarying vec3 vOP; varying vec3 vON; varying vec2 vTU;\n${d.wind ? GLSL_WIND + (d.windUV || d.windH ? '' : 'attribute float aWind;') : ''}\n${hp('vertPars')}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n vOP = position; vON = normal; vTU = uv;\n#ifdef USE_INSTANCING\n vOP += instanceMatrix[3].xyz * 0.371;\n#endif\n${d.space === 'world' ? 'vOP = (modelMatrix * vec4(transformed, 1.0)).xyz; vON = mat3(modelMatrix) * normal;\n#ifdef USE_INSTANCING\n vOP = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz; vON = mat3(modelMatrix) * mat3(instanceMatrix) * normal;\n#endif' : ''}\n${windVert(d)}\n${hp('vert')}`);
      if (!/attribute vec2 uv;|#define USE_UV/.test(sh.vertexShader)) { /* uv is always declared by three's prefix */ }
      const tri = d.axis && d.axis !== 'y' ? AXIS[d.axis] : 'op', non = d.axis && d.axis !== 'y' ? AXIS[d.axis].replace('op', 'on') : 'on';
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\n${d.trans ? '#define TR_TRANS\n' : ''}${PARS}\n${d.trans ? 'vec3 trTransC;' : ''}\n${hp('fragPars')}`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n vec3 op = vOP, on = normalize(vON); vec3 col = diffuseColor.rgb; float rgh = roughnessFactor, hgt = 0.0;`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n { vec4 nz = trTri(${tri} * trP.x, ${non}), nzB = trTri(${tri} * trP.x * 0.17 + 0.31, ${non});\n ${BODY[type]}\n ${hp('color')}\n diffuseColor.rgb = col; roughnessFactor = clamp(rgh, 0.04, 1.0);\n ${hp('rough')}\n #ifdef USE_FOG\n float bf = trP.y * (1.0 - smoothstep(14.0, 46.0, vFogDepth));\n #else\n float bf = trP.y;\n #endif\n ${hp('bump')}\n if (bf > 1e-5) normal = trBump(-vViewPosition, normal, hgt, bf); ${d.trans ? `trTransC = trTC * ${d.vcol ? 'col' : 'vec3(dot(col, vec3(0.3333)) / max(dot(diffuse, vec3(0.3333)), 1e-3))'};` : ''}\n }`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n ${hp('emissive')}`);
    };
    const ck = type + '|' + [d.axis, d.space, d.trans ? 1 : 0, d.vcol ? 1 : 0, d.wind, d.windUV, d.windH].join(',') + '|' + hooks.map(h => h.key).join('+'); m.customProgramCacheKey = () => ck;
  }
  function depthFor(m) { const { d, hooks } = m.userData.kit, dm = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: m.side }); const hp = k => hooks.map(h => h[k] || '').join('\n');
    dm.onBeforeCompile = sh => { LU._feed(sh); hooks.forEach(h => Object.assign(sh.uniforms, h.uniforms || {})); sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\nvarying vec2 vTU;\n${d.wind ? GLSL_WIND + (d.windUV || d.windH ? '' : 'attribute float aWind;') : ''}\n${hp('vertPars')}`).replace('#include <begin_vertex>', `#include <begin_vertex>\n${windVert(d)}\n${hp('vertDepth') || hp('vert')}`); };
    const ck = 'depth' + m.customProgramCacheKey(); dm.customProgramCacheKey = () => ck; return dm; }
  // returns a NEW material = kit material + extra GLSL. key must be unique per snippet.
  function hook(m, h) { const { type, d } = m.userData.kit, M = m.isMeshPhysicalMaterial ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial, n = new M(); M.prototype.copy.call(n, m); n.userData = { kit: { type, d, hooks: m.userData.kit.hooks.concat([h]) } }; install(n); if (d.wind || h.vert) n.userData.depth = depthFor(n); return n; }
  function mesh(geo, mat, o = {}) { const x = new THREE.Mesh(geo, mat); x.castShadow = o.cast !== false; x.receiveShadow = o.receive !== false; if (mat.userData.depth) x.customDepthMaterial = mat.userData.depth; return x; }
  function inst(geo, mat, n, o = {}) { const x = new THREE.InstancedMesh(geo, mat, n); x.castShadow = o.cast !== false; x.receiveShadow = o.receive !== false; x.frustumCulled = false; if (mat.userData.depth) x.customDepthMaterial = mat.userData.depth; return x; }
  return { make, hook, mesh, inst, types: Object.keys(T) };
})();

// ---- wind on the CPU: the same field the shader uses; things with springs read it --------------------------------------------------
const Wind = (() => { const v = new THREE.Vector3();
  function at(x, y, z, out) { out = out || v; const t = LU.uTime.value, w = LU.uWind.value; const g = 0.55 + 0.45 * Math.sin((x * w.x + z * w.y) * -0.22 + t * 1.1 + 2 * Math.sin(z * 0.07 + t * 0.31)); const f = Math.sin(x * 1.7 + y * .9 + z * 1.3 + t * 3.1) * .35 + Math.sin(x * 3.1 + y * 2.3 + z * 2.7 + t * 5.3) * .18;
    out.set(w.x * w.z * (g * .8 + f * .6) - w.y * w.z * f * .5, .35 * w.z * f * .5, w.y * w.z * (g * .8 + f * .6) + w.x * w.z * f * .5);
    for (let i = 0; i < 4; i++) { const P = LU.uWakeP.value[i], V = LU.uWakeV.value[i]; if (V.w === 0) continue; const rx = x - P.x, ry = y - P.y, rz = z - P.z, d2 = rx * rx + ry * ry + rz * rz, q = Math.exp(-d2 / (P.w * P.w)) * V.w; if (q < 1e-3) continue; const l = Math.sqrt(d2) + 1e-4, sp = Math.hypot(V.x, V.y, V.z) * .35; out.x += (V.x + rx / l * sp) * q; out.y += (V.y + ry / l * sp) * q; out.z += (V.z + rz / l * sp) * q; }
    return out; }
  // slots: 0 pelican, 1 pointer, 2 live gusts, 3 free
  function wake(i, x, y, z, r, vx, vy, vz, s) { LU.uWakeP.value[i].set(x, y, z, r); LU.uWakeV.value[i].set(vx, vy, vz, s); }
  return { at, wake }; })();
