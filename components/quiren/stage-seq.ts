/**
 * The stage as a rendered film: a Cycles camera path (blender/stage.py) cut into WebP frames and
 * scrubbed by scroll. Each key pose sits on a frame index; the page eases between them.
 * Frames are drawn cover-fit on one 2D canvas, cross-faded between neighbours so a slow scroll stays smooth.
 */

export const STEP = 20;
export const KEYS = ["hero", "manifesto", "partners", "macro", "macroB", "macroC", "final"] as const;
export type KeyName = (typeof KEYS)[number];
export const FRAMES = (KEYS.length - 1) * STEP + 1;

/** Dark veils behind the type, per key: [left, right]. */
const VEILS: Record<KeyName, [number, number]> = {
  hero: [0.45, 0.2],
  manifesto: [0.55, 0.2],
  partners: [0.45, 0.3],
  macro: [0.35, 0.45],
  macroB: [0.4, 0.5],
  macroC: [0.45, 0.45],
  final: [0.25, 0.25],
};

export const keyFrame = (k: string) => Math.max(0, KEYS.indexOf(k as KeyName)) * STEP;

export function createSeqStage(canvas: HTMLCanvasElement, opts: { onFirstFrame?: () => void } = {}) {
  const ctx = canvas.getContext("2d", { alpha: false })!;
  const dir = () => (innerWidth * Math.min(devicePixelRatio || 1, 2) > 1400 ? "/seq/l" : "/seq/s");
  const base = dir();
  const imgs: (HTMLImageElement | null)[] = new Array(FRAMES).fill(null);
  let disposed = false;
  let goal = 0, cur = 0;
  let px = 0, py = 0, sx = 0, sy = 0;
  let first = false;
  let w = 0, h = 0;

  const load = (i: number) =>
    new Promise<void>((res) => {
      if (imgs[i] || disposed) return res();
      const im = new Image();
      im.decoding = "async";
      im.src = `${base}/f${String(i).padStart(3, "0")}.webp`;
      im.onload = () => {
        im.decode().catch(() => {}).finally(() => {
          imgs[i] = im;
          res();
        });
      };
      im.onerror = () => res();
    });

  // the frame the visitor lands on first, then every key, then fill the gaps from the start
  (async () => {
    const start = Math.round(goal);
    await load(start);
    if (disposed) return;
    draw(true);
    const order: number[] = [];
    for (let k = 0; k < KEYS.length; k++) order.push(k * STEP);
    for (let s = STEP / 2; s >= 1; s = Math.floor(s / 2)) for (let i = 0; i < FRAMES; i += s) order.push(i);
    for (let i = 0; i < FRAMES; i++) order.push(i);
    const seen = new Set<number>([start]);
    const queue = order.filter((i) => !seen.has(i) && (seen.add(i), true));
    const lanes = 4;
    await Promise.all(Array.from({ length: lanes }, async () => {
      while (queue.length && !disposed) await load(queue.shift()!);
    }));
  })();

  const nearest = (i: number) => {
    if (imgs[i]) return i;
    for (let d = 1; d < FRAMES; d++) {
      if (i - d >= 0 && imgs[i - d]) return i - d;
      if (i + d < FRAMES && imgs[i + d]) return i + d;
    }
    return -1;
  };

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingQuality = "high";
    draw(true);
  }

  let lastDrawn = -1, lastSx = 0, lastSy = 0;
  function blit(im: HTMLImageElement, alpha: number) {
    // cover-fit with a small overscan so the pointer drift never shows an edge
    const over = 1.04;
    const s = Math.max(w / im.naturalWidth, h / im.naturalHeight) * over;
    const dw = im.naturalWidth * s, dh = im.naturalHeight * s;
    const x = (w - dw) / 2 - sx * (dw - w) * 0.5;
    const y = (h - dh) / 2 - sy * (dh - h) * 0.5;
    ctx.globalAlpha = alpha;
    ctx.drawImage(im, x, y, dw, dh);
  }
  function draw(force = false) {
    if (!w) return;
    const a = Math.floor(cur), t = cur - a;
    const ia = nearest(a);
    if (ia < 0) return;
    const key = cur * 1000 + sx * 7 + sy * 13;
    if (!force && Math.abs(key - lastDrawn) < 0.5 && lastSx === sx && lastSy === sy) return;
    lastDrawn = key; lastSx = sx; lastSy = sy;
    blit(imgs[ia]!, 1);
    const ib = a + 1 < FRAMES && imgs[a + 1] && ia === a ? a + 1 : -1;
    if (ib > 0 && t > 0.01) blit(imgs[ib]!, t);
    ctx.globalAlpha = 1;
    if (!first) {
      first = true;
      opts.onFirstFrame?.();
    }
  }

  resize();

  return {
    /** Target frame (0..FRAMES-1, fractional). */
    setGoal(f: number, snap = false) {
      goal = Math.min(FRAMES - 1, Math.max(0, f));
      if (snap) cur = goal;
    },
    setPointer(x: number, y: number) {
      px = x;
      py = y;
    },
    frame(dt: number, visible: boolean) {
      const k = 1 - Math.exp(-dt * 9);
      cur += (goal - cur) * k;
      if (Math.abs(goal - cur) < 0.002) cur = goal;
      const kp = 1 - Math.exp(-dt * 3);
      sx += (px * 0.5 - sx) * kp;
      sy += (py * 0.35 - sy) * kp;
      if (visible) draw();
    },
    veil(): [number, number] {
      const i = Math.min(KEYS.length - 2, Math.floor(cur / STEP));
      const t = Math.min(1, cur / STEP - i);
      const A = VEILS[KEYS[i]], B = VEILS[KEYS[i + 1]];
      return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t];
    },
    resize,
    dispose() {
      disposed = true;
    },
  };
}
export type SeqStage = ReturnType<typeof createSeqStage>;
