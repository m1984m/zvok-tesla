"""Pripravi pravi posnetek motorja za granularni predvajalnik.

Uporaba:  python scripts/analyze-recording.py scripts/engines/<motor>.json [pot_do_slike.png]

Iz opisa (JSON) vzame izvorni posnetek, v navedenih odsekih sledi izbranemu harmoniku
(začetna frekvenca je podana ročno s spektrograma), frekvenco pretvori v obrate s kalibracijo
(hz → rpm) in zapiše:
  static/audio/<motor>/clip.opus   mono 48 kHz, obrezan posnetek (+ clip.mp3 za Safari)
  static/audio/<motor>/map.json    za vsako plast (on/off/idle) pari čas ↔ obrati + ovojnica RMS
Izjema od pravila »skripte v Node«: analiza potrebuje FFT; numpy/scipy sta nameščena (docs/DECISIONS.md).
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

SR = 48000
ANA_SR = 16000
HOP_S = 0.01
WIN = 4096  # pri 16 kHz: 0,26 s okno, ločljivost 3,9 Hz (+ parabolična interpolacija)
SEARCH = 0.02  # sledenje: iskanje vrha ±2 % od prejšnje ocene (motor se spremeni < 1 % na 10 ms)
SEARCH_START = 0.2  # prvi okvir: ±20 % okoli ročno podane frekvence


def decode(src: str, t0: float, t1: float, sr: int) -> np.ndarray:
    raw = subprocess.run(
        ['ffmpeg', '-v', 'error', '-ss', str(t0), '-to', str(t1), '-i', src, '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(raw, np.float32).copy()


def track(x: np.ndarray, t0: float, t1: float, f_start: float, search: float = SEARCH) -> tuple[np.ndarray, np.ndarray]:
    """Sledi harmoniku od f_start naprej; vrne čase (s, relativno na začetek clipa) in frekvence."""
    w = np.hanning(WIN)
    fr = np.fft.rfftfreq(WIN, 1 / ANA_SR)
    times, freqs = [], []
    f = f_start
    t = t0
    first = True
    while t <= t1:
        c = int(t * ANA_SR)
        seg = x[max(0, c - WIN // 2): c + WIN // 2]
        if len(seg) < WIN:
            seg = np.pad(seg, (0, WIN - len(seg)))
        mag = np.abs(np.fft.rfft(seg * w))
        sr_ = SEARCH_START if first else search
        first = False
        lo, hi = np.searchsorted(fr, [f * (1 - sr_), f * (1 + sr_)])
        hi = max(hi, lo + 2)
        k = lo + int(np.argmax(mag[lo:hi]))
        if 0 < k < len(mag) - 1:  # parabolična interpolacija vrha
            a, b, cc = np.log(mag[k - 1] + 1e-12), np.log(mag[k] + 1e-12), np.log(mag[k + 1] + 1e-12)
            k = k + 0.5 * (a - cc) / (a - 2 * b + cc)
        f = k * ANA_SR / WIN
        times.append(t)
        freqs.append(f)
        t += HOP_S
    fs = np.array(freqs)
    # glajenje (mediana 9 + drseče povprečje 5)
    pad = np.pad(fs, 4, mode='edge')
    fs = np.array([np.median(pad[i:i + 9]) for i in range(len(fs))])
    fs = np.convolve(np.pad(fs, 2, mode='edge'), np.ones(5) / 5, mode='valid')
    return np.array(times), fs


def main() -> None:
    spec_path = Path(sys.argv[1])
    spec = json.loads(spec_path.read_text(encoding='utf-8'))
    root = spec_path.resolve().parents[2]
    src = str(root / spec['source'])
    c0, c1 = spec['trim']
    x = decode(src, c0, c1, ANA_SR)
    hz, rpm = spec['calib']['hz'], spec['calib']['rpm']
    stretch = spec.get('stretch')  # neobvezno: [rec_lo, rec_hi, disp_lo, disp_hi] linearno raztegne razpon

    def to_rpm(f: np.ndarray) -> np.ndarray:
        r = f * rpm / hz
        if stretch:
            a, b, c, d = stretch
            r = c + (r - a) * (d - c) / (b - a)
        return r

    layers = {}
    plots = []
    for name, segs in spec['layers'].items():
        ts, rs = [], []
        for seg in segs:
            # [od, do, začetna Hz] ali [od, do, začetna Hz, faktor]: faktor preračuna sledeni harmonik
            # v isti red kot kalibracija (npr. 2 za polovično frekvenco vžiga)
            s0, s1, f0 = seg[:3]
            mult = seg[3] if len(seg) > 3 else 1
            t, f = track(x, s0 - c0, s1 - c0, f0, spec.get('search', SEARCH))
            f = f * mult
            ts.append(t)
            rs.append(to_rpm(f))
            plots.append((t + c0, f / mult))
        t = np.concatenate(ts)
        r = np.concatenate(rs)
        layers[name] = {'t': np.round(t, 3).tolist(), 'rpm': np.round(r, 1).tolist()}
        print(f'{name}: {len(t)} točk, obrati {r.min():.0f}–{r.max():.0f}')

    # ovojnica RMS (10 ms) za izenačitev glasnosti zrn
    x48 = decode(src, c0, c1, SR)
    n = int(SR * HOP_S)
    frames = len(x48) // n
    rms = np.sqrt(np.mean(x48[: frames * n].reshape(frames, n) ** 2, axis=1) + 1e-12)
    rms = np.convolve(rms, np.ones(5) / 5, mode='same')

    out = root / 'static' / 'audio' / spec['id']
    out.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ['ffmpeg', '-y', '-v', 'error', '-ss', str(c0), '-to', str(c1), '-i', src, '-ac', '1', '-ar', str(SR),
         '-c:a', 'libopus', '-b:a', '112k', str(out / 'clip.opus')],
        check=True,
    )
    subprocess.run(  # Safari ne dekodira vedno Ogg Opus
        ['ffmpeg', '-y', '-v', 'error', '-ss', str(c0), '-to', str(c1), '-i', src, '-ac', '1', '-ar', str(SR),
         '-c:a', 'libmp3lame', '-b:a', '128k', str(out / 'clip.mp3')],
        check=True,
    )
    m = {
        'source': spec['source'],
        'hop': HOP_S,
        'rms': np.round(rms, 5).tolist(),
        'layers': layers,
        'idle': spec.get('idle'),  # [t0, t1] v sekundah clipa ali null
        'idleRpm': spec.get('idleRpm', 1000),
        'gain': spec.get('gain', 1),
    }
    (out / 'map.json').write_text(json.dumps(m), encoding='utf-8')
    print(f'zapisano: {out}')

    if len(sys.argv) > 2:  # kontrolna slika: sled čez spektrogram
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        from scipy.signal import spectrogram

        fr, tt, S = spectrogram(x, ANA_SR, nperseg=4096, noverlap=4096 - 320)
        msk = fr < spec.get('plotMaxHz', 600)
        plt.figure(figsize=(14, 5))
        plt.pcolormesh(tt + c0, fr[msk], 10 * np.log10(S[msk] + 1e-12), shading='auto', cmap='magma', vmin=-115, vmax=-35)
        for t, f in plots:
            plt.plot(t, f, color='cyan', lw=1.5)
        plt.title(spec['id'])
        plt.tight_layout()
        plt.savefig(sys.argv[2], dpi=70)


if __name__ == '__main__':
    main()
