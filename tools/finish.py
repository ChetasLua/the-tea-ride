#!/usr/bin/env python3
"""finish.py: qa/render/{b,a}.h264 + film.wav (from tools/render.mjs) -> dist/the-tea-ride-1080p60.mp4
The film is cut at 80.75 s: it opens on the finished last sheet (a real first frame for the feed) and runs round to the same frame, so it loops.
Loudness: one plain gain toward -14 LUFS, held under -1 dBTP by a short look-ahead limiter. Needs ffmpeg (FFMPEG=/path or the imageio-ffmpeg package)."""
import json, os, re, subprocess, sys
try: import imageio_ffmpeg; DEF = imageio_ffmpeg.get_ffmpeg_exe()
except Exception: DEF = 'ffmpeg'
FF = os.environ.get('FFMPEG', DEF); ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); R = os.path.join(ROOT, 'qa/render'); OUT = os.path.join(ROOT, 'dist', 'the-tea-ride-1080p60.mp4'); FPS, EXPECT = 60, 4896
run = lambda a: subprocess.run([FF, '-hide_banner'] + a, capture_output=True, text=True)
frames = lambda f: sum(1 for l in run((['-framerate', str(FPS)] if f.endswith('.h264') else []) + ['-i', f, '-map', '0:v', '-c', 'copy', '-f', 'framecrc', '-']).stdout.splitlines() if l and not l.startswith('#'))
es = os.path.join(R, 'film.h264')
with open(es, 'wb') as w:
    for n in ('b.h264', 'a.h264'): w.write(open(os.path.join(R, n), 'rb').read())
n = frames(es); print('frames', n, 'expected', EXPECT)
if n != EXPECT: sys.exit('frame count mismatch')
wav = os.path.join(R, 'film.wav'); LN = 'loudnorm=I=-14:TP=-1:LRA=11:print_format=json'
m = json.loads(re.search(r'\{[^{}]*"input_i"[^{}]*\}', run(['-i', wav, '-af', LN, '-f', 'null', '-']).stderr).group(0)); gain = -14.0 - float(m['input_i']); print('mix %s LUFS, %s dBTP, LRA %s -> gain %.1f dB' % (m['input_i'], m['input_tp'], m['input_lra'], gain))
af = 'volume=%.2fdB,aresample=192000,alimiter=limit=0.84:attack=4:release=60:level=disabled,aresample=48000' % gain; norm = os.path.join(R, 'film.norm.wav'); run(['-y', '-i', wav, '-af', af, '-c:a', 'pcm_f32le', norm])
m2 = json.loads(re.search(r'\{[^{}]*"input_i"[^{}]*\}', run(['-i', norm, '-af', LN, '-f', 'null', '-']).stderr).group(0)); print('master sound %s LUFS, %s dBTP, LRA %s' % (m2['input_i'], m2['input_tp'], m2['input_lra']))
r = run(['-y', '-framerate', str(FPS), '-i', es, '-i', norm, '-map', '0:v:0', '-map', '1:a:0', '-vf', 'setparams=range=tv:color_primaries=bt709:color_trc=bt709:colorspace=bt709', '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-maxrate', '28M', '-bufsize', '56M', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.2', '-g', str(FPS * 2), '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-shortest', '-movflags', '+faststart', '-metadata', 'title=The Tea Ride', OUT])
if r.returncode: print(r.stderr[-2500:]); sys.exit('encode failed')
for l in run(['-i', OUT]).stderr.splitlines():
    if re.search(r'Duration|Stream #', l): print(l.strip())
print('master frames', frames(OUT), 'MB %.1f' % (os.path.getsize(OUT) / 1e6))
