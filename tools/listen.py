#!/usr/bin/env python3
"""Numbers for a mix nobody can hear: loudness per section, band balance, onsets vs score, crest."""
import sys, wave, numpy as np
def load(f):
    w = wave.open(f); n = w.getnframes(); d = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32) / 32768; return d.reshape(-1, 2), w.getframerate()
SEC = [('INTRO', 0, 4.8), ('A', 4.8, 24), ('TEA', 24, 28.8), ('LEMON', 28.8, 43.2), ('BRIDGE', 43.2, 52.8), ('C', 52.8, 72), ('OUT', 72, 81.6)]
db = lambda v: 20 * np.log10(max(v, 1e-9))
for f in sys.argv[1:] or ['qa/music.wav', 'qa/fx.wav', 'qa/mix.wav']:
    d, sr = load(f); m = d.mean(1); print(f, 'peak %.1f' % db(np.abs(d).max()), 'rms %.1f' % db(np.sqrt((d ** 2).mean())))
    for n, a, b in SEC:
        x = d[int(a * sr):int(b * sr)]; mm = x.mean(1); X = np.abs(np.fft.rfft(mm * np.hanning(len(mm)))) ** 2; fr = np.fft.rfftfreq(len(mm), 1 / sr); tot = X.sum() + 1e-12; sh = lambda lo, hi: 100 * X[(fr >= lo) & (fr < hi)].sum() / tot
        w = int(.05 * sr); k = len(mm) // w; loud = np.sqrt((mm[:k * w].reshape(k, w) ** 2).mean(1)).max()
        corr = np.corrcoef(x[:, 0], x[:, 1])[0, 1] if len(x) else 0
        print('  %-7s rms %6.1f loud50 %6.1f | 20-120 %4.1f 120-300 %4.1f 300-800 %4.1f 800-2k %4.1f 2-4k %4.1f >4k %4.2f | cent %4d Hz  L/R corr %.2f' % (n, db(np.sqrt((x ** 2).mean())), db(loud), sh(20, 120), sh(120, 300), sh(300, 800), sh(800, 2000), sh(2000, 4000), sh(4000, 20000), (fr * X).sum() / tot, corr))
