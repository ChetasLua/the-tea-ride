'use strict';
// ---- Sculpt: SDF parts -> one smooth mesh with painted colour and automatic bone weights -------------------------
//   Sculpt.rig({ root:{pos:[0,1,0]}, head:{parent:'root',pos:[0.6,1.4,0]} })  -> { bones:{name:Bone}, list, skeleton, root, names }
//        (pos = rest position of the joint in MODEL space)
//   Sculpt.build({ parts:[ { f:SD shape, color:'#hex'|fn(x,y,z)->Color, bone:'head', k:0.06 }, { f, cut:true, k }, { f, paint:true, color, soft:0.01 } ],
//                  bb:[x0,y0,z0,x1,y1,z1], res:90, rig, wblend:0.12, cblend:0.012 }) -> BufferGeometry(position, normal, uv, color[, skinIndex, skinWeight])
//   Sculpt.skinned(geo, material, rig) -> SkinnedMesh (castShadow/receiveShadow set)
const Sculpt = (() => {
  function rig(def) {
    const bones = {}, list = [], names = []; for (const n in def) { const b = new THREE.Bone(); b.name = n; bones[n] = b; list.push(b); names.push(n); }
    let root = null; for (const n in def) { const d = def[n], p = d.parent ? def[d.parent].pos : [0, 0, 0]; bones[n].position.set(d.pos[0] - p[0], d.pos[1] - p[1], d.pos[2] - p[2]); if (d.parent) bones[d.parent].add(bones[n]); else root = root || bones[n]; bones[n].userData.rest = bones[n].position.clone(); }
    const top = new THREE.Group(); names.forEach(n => { if (!def[n].parent) top.add(bones[n]); }); top.updateMatrixWorld(true);
    return { bones, list, names, def, root: top, skeleton: new THREE.Skeleton(list) };
  }
  function build(o) {
    const solid = o.parts.filter(p => !p.cut && !p.paint), cuts = o.parts.filter(p => p.cut), paints = o.parts.filter(p => p.paint);
    const f = (x, y, z) => { let d = solid[0].f(x, y, z); for (let i = 1; i < solid.length; i++) { const k = solid[i].k === undefined ? 0.05 : solid[i].k, e = solid[i].f(x, y, z); d = k > 0 ? SD.smin(d, e, k) : Math.min(d, e); } for (const c of cuts) { const e = -c.f(x, y, z), k = c.k || 0; d = k > 0 ? SD.smax(d, e, k) : Math.max(d, e); } return d; };
    const m = SD.mesh(f, o.bb, o.res || 90), n = m.pos.length / 3, col = new Float32Array(n * 3), uv = new Float32Array(n * 2), si = o.rig ? new Uint16Array(n * 4) : null, sw = o.rig ? new Float32Array(n * 4) : null;
    const C = solid.map(p => typeof p.color === 'function' ? p.color : (c => () => c)(new THREE.Color(p.color || '#ffffff'))), PC = paints.map(p => typeof p.color === 'function' ? p.color : (c => () => c)(new THREE.Color(p.color)));
    const BI = solid.map(p => o.rig ? Math.max(0, o.rig.names.indexOf(p.bone || o.rig.names[0])) : 0), wb = o.wblend || 0.12, cb = o.cblend || 0.012, dd = new Float32Array(solid.length);
    const acc = o.rig ? new Float32Array(o.rig.names.length) : null;
    for (let i = 0; i < n; i++) {
      const x = m.pos[i * 3], y = m.pos[i * 3 + 1], z = m.pos[i * 3 + 2]; let dm = 1e9; for (let j = 0; j < solid.length; j++) { dd[j] = solid[j].f(x, y, z); if (dd[j] < dm) dm = dd[j]; }
      let r = 0, g = 0, b = 0, ws = 0; for (let j = 0; j < solid.length; j++) { const w = Math.exp(-(dd[j] - dm) / cb); if (w < 0.002) continue; const c = C[j](x, y, z); r += c.r * w; g += c.g * w; b += c.b * w; ws += w; } r /= ws; g /= ws; b /= ws;
      for (let j = 0; j < paints.length; j++) { const e = paints[j].f(x, y, z), s = paints[j].soft || 0.01, w = 1 - sm(-s, s, e); if (w > 0.001) { const c = PC[j](x, y, z), a = w * (paints[j].a === undefined ? 1 : paints[j].a); r += (c.r - r) * a; g += (c.g - g) * a; b += (c.b - b) * a; } }
      col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = b; uv[i * 2] = x * 2; uv[i * 2 + 1] = y * 2;
      if (o.rig) { acc.fill(0); let t = 0; for (let j = 0; j < solid.length; j++) { const w = Math.exp(-(dd[j] - dm) / wb); if (w > acc[BI[j]]) { acc[BI[j]] = w; } }
        const ord = []; for (let q = 0; q < acc.length; q++) if (acc[q] > 0.01) ord.push(q); ord.sort((a, c) => acc[c] - acc[a]); for (let q = 0; q < Math.min(4, ord.length); q++) { si[i * 4 + q] = ord[q]; sw[i * 4 + q] = acc[ord[q]]; t += acc[ord[q]]; } for (let q = 0; q < 4; q++) sw[i * 4 + q] /= t || 1; }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(m.pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(m.nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(new THREE.BufferAttribute(m.idx, 1));
    if (o.rig) { geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4)); }
    return geo;
  }
  function skinned(geo, mat, rg) { const mesh = new THREE.SkinnedMesh(geo, mat); mesh.add(rg.root); rg.root.updateMatrixWorld(true); mesh.bind(new THREE.Skeleton(rg.list), new THREE.Matrix4()); mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false; return mesh; }
  return { rig, build, skinned };
})();
