#!/usr/bin/env python3
"""GPU+CPU ms per frame at given film times, 2392x1546 (live size).  perf.py dist/file.html 8 22 33 47 55 66 73"""
import json, os, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); f = sys.argv[1]; times = [float(x) for x in sys.argv[2:]] or [3, 8, 22, 27, 33, 47, 55, 66, 73]
js = ("(async()=>{const d=window.__dbg,gl=d.Main.R.getContext(),px=new Uint8Array(4),out=[];"
      "const run=(t0,n)=>{const a=performance.now();let c=0;for(let i=0;i<n;i++){const b=performance.now();d.Main.update(t0+i/60,1/60,false);c+=performance.now()-b;d.Main.draw();gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);}return[(performance.now()-a)/n,c/n];};"
      f"for(const t of {json.dumps(times)}){{d.Main.update(t-.2,1/60,true);run(t-.2,12);const [ms,cpu]=run(t,40),i=d.info;out.push({{t,ms:+ms.toFixed(1),upd:+cpu.toFixed(1),calls:i.calls,ktris:Math.round(i.tris/1000)}});await new Promise(r=>setTimeout(r,20));}}"
      "return JSON.stringify(out);})()")
r = subprocess.run([sys.executable, os.path.join(ROOT, "tools/cap.py"), "x_perf", f + "?capture", "", "--w", "2392", "--h", "1546", "--eval", js, "--timeout", "600"], capture_output=True, text=True)
try:
    res = json.load(open(os.path.join(ROOT, "tools/queue/x_perf.done.json"))); ev = json.loads(res["evalResult"]); print("load", res["info"]["load"], "ms  builds", res["info"]["build"], "errors", [e[:200] for e in res["info"]["errors"]])
    for p in ev: print(p)
except Exception as e: print(r.stdout[-1500:], r.stderr[-500:], e)
