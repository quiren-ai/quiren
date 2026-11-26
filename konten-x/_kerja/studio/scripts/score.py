"""The QUIREN score, "Thaw": synthesised from nothing, timed to src/Demo.tsx and src/Loops.tsx.

    python3 scripts/score.py      # writes public/audio/demo.wav and public/audio/bed-*.wav

A block of ice on a wet desert floor at first light, a warm core inside it. E major with a raised fourth (lydian),
66 bpm. A soft bowed pad holds Emaj9 / C#m11 / Amaj9(#11) / Bsus; struck glass rings over it like the ice itself;
a felt piano plays the three-note motif of the mark (B E F#, the leaves gathered into the ring) at every chapter;
a single drop of water falls each time something is saved. Nothing is sampled; free to use anywhere.
"""
import os
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile


SR = 48000
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "audio")
S = dict(open=0, title=4.6, melt=10, remember=15, dream=23, approve=28.5, next=33, local=38, close=43, end=50)
TOTAL = 50.0
BEAT = 60 / 66


def hz(m): return 440.0 * 2 ** ((m - 69) / 12)
def tt(d): return np.arange(int(d * SR)) / SR
def lp(x, f, o=2): return sosfilt(butter(o, min(f, SR / 2 - 100), "low", fs=SR, output="sos"), x, axis=0)
def hp(x, f, o=2): return sosfilt(butter(o, f, "high", fs=SR, output="sos"), x, axis=0)
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], "band", fs=SR, output="sos"), x, axis=0)
def env(n, a, r):
    e = np.ones(n); ka = min(n // 2, max(1, int(a * SR))); kr = min(n // 2, max(1, int(r * SR)))
    e[:ka] = np.linspace(0, 1, ka) ** 1.6
    e[-kr:] *= np.linspace(1, 0, kr) ** 1.8
    return e


class Mix:
    def __init__(self, seconds, seed):
        self.N = int(seconds * SR)
        self.dry = np.zeros((self.N, 2)); self.send = np.zeros((self.N, 2))
        self.rng = np.random.default_rng(seed)

    def add(self, sig, at, gain=1.0, pan=0.0, rev=0.35):
        i = int(at * SR)
        if i >= self.N: return
        if i < 0: sig = sig[-i:]; i = 0
        if sig.ndim == 1:
            sig = np.stack([sig * np.sqrt((1 - pan) / 2), sig * np.sqrt((1 + pan) / 2)], axis=1)
        sig = sig[: self.N - i] * gain
        self.dry[i:i + len(sig)] += sig
        self.send[i:i + len(sig)] += sig * rev

    def render(self, fade_in=0.02, fade_out=2.0, loop=False):
        # open desert at dawn with a wet floor: few early reflections, a long soft tail
        n = int(5.5 * SR); t = np.arange(n) / SR
        ir = self.rng.standard_normal((n, 2)) * np.exp(-t / 1.45)[:, None]
        ir = lp(ir, 5200) * 0.6 + lp(ir, 1100) * 0.75
        for d, g in ((0.019, 0.55), (0.027, 0.45), (0.041, 0.38), (0.058, 0.3), (0.077, 0.22)):
            ir[int(d * SR)] += g * np.array([1, 0.85])
        ir /= np.abs(ir).sum(axis=0) ** 0.5 * 30
        wet = np.stack([fftconvolve(self.send[:, c], ir[:, c])[: self.N + (n if loop else 0)] for c in range(2)], axis=1)
        if loop:
            tail = wet[self.N:]; wet = wet[: self.N].copy()
            k = min(len(tail), self.N); wet[:k] += tail[:k]
        x = self.dry + wet * 0.75
        x = hp(x, 30)
        x = np.tanh(x * 1.05) / np.tanh(1.05)
        if not loop:
            x[: int(fade_in * SR)] *= np.linspace(0, 1, int(fade_in * SR))[:, None]
            k = int(fade_out * SR); x[-k:] *= np.linspace(1, 0, k)[:, None] ** 1.6
        return x / (np.abs(x).max() + 1e-9) * 0.89


# ---------------- instruments ----------------
def strings(notes, dur, rng, a=1.6, r=2.4, bright=2600, trem=0.0):
    """Bowed ensemble: several detuned saw voices per note with vibrato, a body resonance, soft bow noise."""
    t = tt(dur); x = np.zeros((len(t), 2))
    for m in notes:
        for v in range(3):
            c = v % 2; f = hz(m) * (1 + rng.normal(0, 0.0018))
            vib = 1 + 0.0042 * np.sin(2 * np.pi * (5.0 + rng.random() * 0.6) * t + rng.random() * 6) * np.clip(t / 1.2, 0, 1)
            ph = np.cumsum(f * vib) / SR
            x[:, c] += 2 * (ph % 1) - 1
    if trem: x *= (1 - trem + trem * (0.5 + 0.5 * np.sin(2 * np.pi * 9 * t)))[:, None]
    body = bp(x, 250, 1200) * 0.6 + lp(x, bright)
    noise = bp(rng.standard_normal((len(t), 2)), 1800, 5200) * 0.04
    return (body + noise) * env(len(t), a, r)[:, None] / (len(notes) * 3.2)


def felt(m, dur=3.2, vel=1.0):
    t = tt(dur); f = hz(m)
    x = sum(g * np.sin(2 * np.pi * f * k * t) * np.exp(-t * (1.1 + k * 0.9)) for k, g in ((1, 1), (2, 0.35), (3, 0.12), (4, 0.05)))
    x *= 1 - np.exp(-t / 0.004)
    return lp(x, 1700 + 900 * vel) * vel * 0.5



def air(rng, dur=2.0):
    """A soft rising breath of air into a new chapter."""
    t = tt(dur); n = rng.standard_normal((len(t), 2))
    return lp(bp(n, 300, 4000), 2600) * ((t / dur) ** 2.6)[:, None] * 0.05


def sub(dur=3.0):
    t = tt(dur); f = 38 + 20 * np.exp(-t / 0.25)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.9) * 0.6



def pad(notes, dur, rng, a=2.2, r=3.0, bright=1500):
    """Soft bowed pad: detuned saws, no vibrato, a slow swell, warm and low-passed."""
    t = tt(dur); x = np.zeros((len(t), 2))
    for m in notes:
        for v in range(4):
            c = v % 2; f = hz(m) * (1 + rng.normal(0, 0.0022))
            ph = np.cumsum(np.full(len(t), f)) / SR + rng.random()
            x[:, c] += 2 * (ph % 1) - 1
    sweep = lp(x, bright) * 0.8 + bp(x, 200, 700) * 0.3
    breath = 1 + 0.08 * np.sin(2 * np.pi * 0.11 * t + rng.random() * 6)
    return sweep * (env(len(t), a, r) * breath)[:, None] / (len(notes) * 4.0)


def glass(m, dur=5.0, vel=1.0, rng=None):
    """Struck glass, like a bowl of ice: inharmonic partials, two slightly detuned bodies that beat slowly."""
    rng = rng or np.random.default_rng(int(m)); t = tt(dur); f = hz(m)
    x = np.zeros(len(t))
    for k, g, d in ((1, 1.0, 2.6), (2.32, 0.42, 1.3), (4.25, 0.2, 0.6), (6.63, 0.09, 0.25)):
        for det in (1.0, 1.0 + 0.0011 * k):
            x += g * np.sin(2 * np.pi * f * k * det * t + rng.random() * 6) * np.exp(-t / d)
    strike = bp(rng.standard_normal(len(t)), 3000, 9000) * np.exp(-t / 0.004) * 0.25
    return (x * (1 - np.exp(-t / 0.0015)) + strike) * vel * 0.16


def drip(rng, vel=1.0):
    """One drop of water on a wet floor: a short rising pitch, then a small plop."""
    t = tt(0.35); f = 700 + 1500 * (1 - np.exp(-t / 0.018))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.045)
    plop = lp(rng.standard_normal(len(t)), 1200) * np.exp(-t / 0.01) * 0.2
    return (x + plop) * (1 - np.exp(-t / 0.002)) * vel * 0.22


def crack(rng, dur=1.2):
    """The ice giving way: a dry crackle that thins out, high and soft."""
    t = tt(dur); n = rng.standard_normal((len(t), 2))
    sparks = (rng.random((len(t), 2)) > 0.9965).astype(float) * rng.standard_normal((len(t), 2))
    x = lp(hp(sparks, 2500), 9000) * 1.6 + bp(n, 5000, 9000) * 0.006
    return x * np.exp(-t / 0.35)[:, None] * 0.35


# ---------------- harmony ----------------
CHORDS = [(40, [56, 63, 66, 71]), (37, [56, 64, 66, 71]), (33, [61, 64, 68, 75]), (35, [59, 64, 66, 71])]   # Emaj9 C#m11 Amaj9 Bsus
SPARK = [[83, 87, 90], [80, 83, 88], [81, 85, 87], [83, 88, 90]]
MOTIF = [71, 76, 78]   # B E F#: the leaves gathered into the ring


def motif(mx, at, gain=1.0, octave=0, pan=0.0):
    for k, m in enumerate(MOTIF):
        mx.add(felt(m + octave, 3.6, 0.85), at + k * BEAT * 0.5, 0.75 * gain, pan + (k - 1) * 0.22, 0.5)
    mx.add(glass(MOTIF[-1] + 12 + octave, 5.0, 0.8), at + 3 * BEAT * 0.5, 0.5 * gain, -pan, 0.65)


def bed_music(mx, start, end, rng, bar=BEAT * 4, chord_from=0, sparkle=True, gain=1.0, bright=1500):
    t = start; i = chord_from
    while t < end - 0.4:
        root, notes = CHORDS[i % 4]; d = min(bar + 2.6, end - t + 1.6)
        mx.add(pad(notes, d, rng, bright=bright), t, 0.9 * gain, (i % 2) * 0.2 - 0.1, 0.55)
        mx.add(pad([root, root + 12], d, rng, bright=500), t, 0.75 * gain, 0, 0.3)
        if sparkle:
            for k, m in enumerate(SPARK[i % 4]):
                mx.add(glass(m, 4.5, 0.55), t + bar * (0.25 + k * 0.22), 0.45 * gain, -0.5 + k * 0.5, 0.7)
        t += bar; i += 1


def demo():
    rng = np.random.default_rng(5); mx = Mix(TOTAL, 9)
    # opening: a low drone on ink, the mark binds (three soft glass notes), the ice gives way into the window
    mx.add(pad([28, 40], 5.5, rng, a=2.0, r=1.5, bright=380), 0, 0.9, 0, 0.3)
    for k, (at, m) in enumerate(((0.3, 83), (1.0, 88), (1.15, 90))):
        mx.add(glass(m, 4.5, 0.75), at, 0.6, (k - 1) * 0.35, 0.65)
    mx.add(crack(rng, 1.4), 3.0, 0.55, 0, 0.55)
    mx.add(air(rng, 1.6), S["title"] - 1.6, 1.0, 0, 0.45)
    # title: sub, the motif, the pad enters
    mx.add(sub(4.0), S["title"], 0.65, 0, 0.1)
    motif(mx, S["title"] + 0.25, 1.0)
    bed_music(mx, S["title"], S["remember"] + 0.4, rng, chord_from=0)
    # melt: the drops begin, slow and sparse
    for k, a in enumerate((S["melt"] + 0.6, S["melt"] + 2.1, S["melt"] + 3.4)):
        mx.add(drip(rng, 0.9 - 0.1 * k), a, 1.0, (k - 1) * 0.4, 0.45)
    # the product at work: lighter, brighter; a drop on every save, the motif at every chapter
    bed_music(mx, S["remember"], S["local"] + 0.3, rng, chord_from=2, gain=0.8, bright=2100)
    for name, oct_ in (("remember", 0), ("dream", 12), ("next", 0)):
        motif(mx, S[name] + 0.35, 0.75, oct_, 0.15)
    for a in (S["remember"] + 3.3, S["remember"] + 5.0, S["remember"] + 6.9):
        mx.add(drip(rng, 0.85), a, 1.0, 0.25, 0.4)
    mx.add(glass(83, 5.0, 0.8), S["approve"] + 0.05, 0.7, -0.2, 0.6)
    mx.add(glass(88, 5.0, 0.7), S["approve"] + 0.4, 0.6, 0.25, 0.6)
    mx.add(drip(rng, 0.9), S["approve"] + 1.0, 1.0, 0, 0.4)
    # local: back on the stage, warmer, the sub again
    mx.add(sub(3.5), S["local"], 0.55, 0, 0.1)
    bed_music(mx, S["local"], S["close"] + 0.3, rng, chord_from=1, gain=0.85, bright=1300)
    # close: the home chord held to silence, the motif an octave up, one last drop
    mx.add(air(rng, 1.8), S["close"] - 1.8, 0.9, 0, 0.45)
    mx.add(sub(4.5), S["close"], 0.65, 0, 0.1)
    mx.add(pad([56, 63, 66, 71, 75], TOTAL - S["close"], rng, a=1.4, r=4.2, bright=1900), S["close"], 1.0, 0, 0.6)
    mx.add(pad([28, 40], TOTAL - S["close"], rng, a=1.2, r=4.2, bright=450), S["close"], 0.85, 0, 0.3)
    for k, m in enumerate([71, 75, 78, 83, 87, 90]):
        mx.add(glass(m, 5.0, 0.7), S["close"] + 0.3 + k * 0.16, 0.5, -0.5 + k * 0.2, 0.65)
    motif(mx, S["close"] + 1.7, 1.0, 12)
    mx.add(drip(rng, 0.8), S["end"] - 2.2, 0.9, 0, 0.55)
    return mx.render(fade_out=3.0)


def bed(seconds, seed, events, chord_from=0, sparkle=True, bars=4):
    rng = np.random.default_rng(seed); mx = Mix(seconds, seed)
    bed_music(mx, -1.0, seconds + 1.0, rng, bar=seconds / bars, chord_from=chord_from, sparkle=sparkle, gain=0.9)
    events(mx, rng)
    x = mx.render(loop=True)
    k = int(0.04 * SR); x[:k] *= np.linspace(0, 1, k)[:, None]; x[-k:] *= np.linspace(1, 0, k)[:, None]
    return x


def write(name, x):
    os.makedirs(OUT, exist_ok=True)
    wavfile.write(os.path.join(OUT, name), SR, (x * 32767).astype(np.int16)); print("wrote", name, f"{len(x) / SR:.1f}s")


if __name__ == "__main__":
    write("demo.wav", demo())
    # GIF beds, seamless; each spans whole loops of its picture
    write("bed-ice.wav", bed(24, 21, lambda mx, r: [motif(mx, a, 0.8) for a in (0.5, 12.5)] + [mx.add(drip(r, 0.7), a, 1, 0.3, 0.45) for a in (6.0, 18.0)]))
    write("bed-mark.wav", bed(15, 22, lambda mx, r: [mx.add(glass(m, 4.5, 0.7), a + o, 0.6, p, 0.65) for a in (0, 5, 10) for o, m, p in ((0.3, 83, -0.3), (1.0, 88, 0.0), (1.15, 90, 0.3))], chord_from=0, sparkle=False, bars=3))
    write("bed-recall.wav", bed(16, 23, lambda mx, r: [mx.add(drip(r, 0.8), a, 1, 0.2, 0.4) for a in (2.6, 5.0, 10.6, 13.0)], chord_from=2))
    write("bed-coin.wav", bed(16, 24, lambda mx, r: [motif(mx, a, 0.7, 12) for a in (0.3, 8.3)], chord_from=3, sparkle=True))
