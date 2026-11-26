/// <reference lib="webworker" />
/**
 * The opening, drawn off the main thread on an OffscreenCanvas. The page's own work (hydration,
 * loading three.js, compiling the stage's shaders) blocks the main thread for up to a second;
 * frames drawn here go straight to the compositor and keep their pace through it.
 *
 * In:  init {canvas, w, h, dpr, len, paths}, resize {w, h, dpr}, ready
 * Out: live (the ground is painted), assembled (the mark is whole: the page may build the stage), reveal (show the hero), done
 */

type Stops = [number, string][];
const RING_LINE = "M22.6 14.6H18A10.5 10.5 0 0 0 7.5 25.1V45.2A10.5 10.5 0 0 0 18 55.7H37.5A10.5 10.5 0 0 0 48 45.2V40.9";
const HOLE = { x: 11, y: 18.1, w: 33.5, h: 34.1, r: 7 };
const PIVOT = { x: HOLE.x + HOLE.w / 2, y: HOLE.y + HOLE.h / 2 };
const MARK_C = { x: 32.25, y: 32.1 };
const GROUND = "#0b0b0c";
const RING_STOPS: Stops = [[0, "#f6f7f9"], [0.14, "#f0b38f"], [0.27, "#6c737c"], [0.5, "#1f2226"], [0.72, "#59606a"], [0.86, "#b9d2e6"], [1, "#f3f5f7"]];
const LEAF_STOPS: Stops = [[0, "#ffffff"], [0.55, "#e2e6ea"], [1, "#8e959d"]];

// easing, matching the GSAP curves the page uses
const power2InOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const power3Out = (t: number) => 1 - (1 - t) ** 4;
const power1In = (t: number) => t * t;
const power1InOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const sineInOut = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
const expoInOut = (t: number) => (t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2);
const seg = (t: number, start: number, dur: number) => Math.min(1, Math.max(0, (t - start) / dur));

let ctx: OffscreenCanvasRenderingContext2D;
let canvas: OffscreenCanvas;
let W = 0, H = 0, dpr = 1, s0 = 1, len = 1;
let ring: Path2D, big: Path2D, small: Path2D, hole: Path2D;
let leafFill: CanvasGradient;

// phases on one clock (seconds since start)
let t0 = 0;
let assembledAt = 0; // when the mark became whole
let readyAt = -1; // when the page said the stage is warm
let leaveAt = -1; // when the window began to open
let k1 = 1;
const sent = { live: false, assembled: false, reveal: false, done: false };

const size = (w: number, h: number, d: number) => {
  W = w;
  H = h;
  dpr = Math.min(d || 1, 2);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  s0 = Math.min(W, H) < 640 ? 80 / 64 : 104 / 64;
};

const grad = (stops: Stops, a: number, x0: number, y0: number, x1: number, y1: number) => {
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, r = Math.hypot(x1 - x0, y1 - y0) / 2;
  const t = ((a + 45) * Math.PI) / 180;
  const g = ctx.createLinearGradient(cx - Math.cos(t) * r, cy - Math.sin(t) * r, cx + Math.cos(t) * r, cy + Math.sin(t) * r);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
};

function frame(now: number) {
  const t = (now - t0) / 1000;

  // 1. assembly: ring drawn 0.25-1.3s, large leaf 0.95-1.8s, small leaf 1.12-1.97s, one sheen pass 0.3-1.9s
  const draw = power2InOut(seg(t, 0.25, 1.05));
  const bigIn = power3Out(seg(t, 0.95, 0.85));
  const smallIn = power3Out(seg(t, 1.12, 0.85));
  let sheen = 35 + 360 * power1InOut(seg(t, 0.3, 1.6));
  if (!sent.assembled && t >= 1.95) {
    sent.assembled = true;
    assembledAt = t;
    postMessage("assembled");
  }
  // 2. waiting for the stage: one slow sheen at a time
  if (sent.assembled && leaveAt < 0) {
    const w = t - assembledAt;
    sheen = 35 + 360 * Math.floor(w / 3.2) + 360 * sineInOut((w % 3.2) / 3.2);
    // give up waiting after six seconds
    if (readyAt >= 0 || w > 6) {
      leaveAt = t;
      k1 = (Math.hypot(W, H) * 1.25) / (Math.min(HOLE.w, HOLE.h) * s0);
    }
  }
  // 3. the window
  let leafA = 1, holeA = 0, k = 1;
  if (leaveAt >= 0) {
    const u = t - leaveAt;
    leafA = 1 - power1In(seg(u, 0, 0.35));
    holeA = power1InOut(seg(u, 0, 0.45));
    k = 1 + (k1 - 1) * expoInOut(seg(u, 0.12, 1.25));
    if (!sent.reveal && u >= 0.55) {
      sent.reveal = true;
      postMessage("reveal");
    }
    if (u >= 1.4) {
      draw1(1, sheen, 0, 0, 1, k1, true);
      if (!sent.done) {
        sent.done = true;
        postMessage("done");
      }
      return;
    }
  }
  draw1(draw, sheen, Math.min(bigIn, leafA), Math.min(smallIn, leafA), holeA, k, false, bigIn, smallIn);
  if (!sent.live) {
    // the canvas now paints the ground: the page drops its plain dark cover
    sent.live = true;
    postMessage("live");
  }
  requestAnimationFrame(frame);
}

function draw1(draw: number, sheen: number, bigA: number, smallA: number, holeA: number, k: number, clear: boolean, bigIn = 1, smallIn = 1) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  if (clear) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }
  ctx.fillStyle = GROUND;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const s = k * s0;
  const px = W / 2 + (PIVOT.x - MARK_C.x) * s0;
  const py = H / 2 + (PIVOT.y - MARK_C.y) * s0;
  ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * (px - PIVOT.x * s), dpr * (py - PIVOT.y * s));
  if (holeA > 0) {
    ctx.globalCompositeOperation = "destination-out";
    ctx.globalAlpha = holeA;
    ctx.fill(hole);
    ctx.globalCompositeOperation = "source-over";
  }
  if (draw > 0) {
    ctx.globalAlpha = 1;
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.setLineDash([len * draw, len]);
    ctx.strokeStyle = grad(RING_STOPS, sheen - 35, 4, 11.1, 51.5, 59.2);
    ctx.stroke(ring);
    ctx.setLineDash([]);
  }
  ctx.fillStyle = leafFill;
  if (bigA > 0) {
    // the large leaf comes in from outside, the small one rises from inside the ring
    const o = 1 - bigIn;
    ctx.globalAlpha = bigA;
    ctx.translate(7 * o, -7 * o);
    ctx.fill(big);
    ctx.translate(-7 * o, 7 * o);
  }
  if (smallA > 0) {
    const o = 1 - smallIn;
    ctx.globalAlpha = smallA;
    ctx.translate(-7 * o, 9 * o);
    ctx.fill(small);
  }
}

self.onmessage = (e: MessageEvent) => {
  const m = e.data;
  if (m.type === "init") {
    canvas = m.canvas;
    ctx = canvas.getContext("2d")!;
    len = m.len;
    ring = new Path2D(RING_LINE);
    big = new Path2D(m.paths[0]);
    small = new Path2D(m.paths[1]);
    hole = new Path2D();
    hole.roundRect(HOLE.x, HOLE.y, HOLE.w, HOLE.h, HOLE.r);
    size(m.w, m.h, m.dpr);
    leafFill = grad(LEAF_STOPS, 0, 28.5, 5, 60.5, 37);
    t0 = performance.now();
    requestAnimationFrame(frame);
  } else if (m.type === "resize") {
    size(m.w, m.h, m.dpr);
    if (leaveAt >= 0) k1 = (Math.hypot(W, H) * 1.25) / (Math.min(HOLE.w, HOLE.h) * s0);
  } else if (m.type === "ready") {
    if (readyAt < 0) readyAt = performance.now();
  }
};

export {};
