#!/usr/bin/env python3
"""who costs what: triangles and draw calls per asset at a time (main view visibility by frustum), from scene graph.  tris.py 15 66"""
import json, os, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); times = [float(x) for x in sys.argv[1:]] or [15, 66]
js = ("(async()=>{const d=window.__dbg,out={};for(const t of %s){d.Main.update(t-.1,1/60,true);d.Main.update(t,1/60,false);d.Main.draw();const cam=d.Main.cam,fr=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse)),by={};"
      "const own=new Map();for(const a of d.Assets.list)if(a._roots)a._roots.forEach(r=>own.set(r,a.name));"
      "const walk=(o,n)=>{if(o.visible===false)return;n=own.get(o)||n;if((o.isMesh||o.isPoints)&&o.geometry){const g=o.geometry,c=(g.index?g.index.count:g.attributes.position?g.attributes.position.count:0)/3*(o.isInstancedMesh?o.count:g.isInstancedBufferGeometry?(g.instanceCount===Infinity?1:g.instanceCount):1);let vis=true;if(o.frustumCulled){vis=fr.intersectsObject(o);}const b=by[n]||(by[n]={main:0,mc:0,sh:0,sc:0,ref:0,top:[]});if(vis){b.main+=c;b.mc++;b.top.push([Math.round(c/1000),o.name||o.material&&o.material.type,o.castShadow?1:0]);}if(o.castShadow){b.sh+=c;b.sc++;}if(o.layers.mask&2)b.ref+=c;}for(const k of o.children)walk(k,n);};for(const c of d.Main.scene.children)walk(c,c.name||c.type);"
      "for(const k in by){const b=by[k];b.main=Math.round(b.main/1000);b.sh=Math.round(b.sh/1000);b.ref=Math.round(b.ref/1000);b.top=b.top.sort((x,y)=>y[0]-x[0]).slice(0,5).map(x=>x.join(':')).join(' ');}out[t]=by;}return JSON.stringify(out);})()" % json.dumps(times))
r = subprocess.run([sys.executable, os.path.join(ROOT, "tools/cap.py"), "x_tris", "dist/pelican-market-3d.html?capture", "", "--w", "1920", "--h", "1080", "--eval", js, "--timeout", "600"], capture_output=True, text=True)
res = json.load(open(os.path.join(ROOT, "tools/queue/x_tris.done.json")))
try:
    for t, by in json.loads(res["evalResult"]).items():
        print("t", t); 
        for k, b in sorted(by.items(), key=lambda q: -q[1]["main"] - q[1]["sh"]): print("  %-10s main %5dk/%3d calls  shadow-casters %5dk/%3d  reflect %5dk | %s" % (k[:10], b["main"], b["mc"], b["sh"], b["sc"], b["ref"], b["top"]))
except Exception as e: print(res, e)
