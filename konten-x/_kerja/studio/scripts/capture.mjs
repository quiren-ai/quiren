// Records the live Quiren site frame by frame on a virtual clock, so every frame is exact (no dropped frames).
//   node scripts/capture.mjs <mode> [site]      modes: probe | plate | tour | mobile
//   plate: the 3D stage alone (all text hidden), a slow drift through the first poses -> public/seq/plate/
//   tour:  the real page scrolled top to bottom with its text, 1920x1080 -> public/seq/tour/
import { chromium } from "/Users/supermaxxxzz/projects/belajar/mailsmtp/node_modules/playwright/index.mjs";
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
const mode = process.argv[2] || "probe";
const SITE = (process.argv[3] || "https://quirenrh.com").replace(/\/$/, "");
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", args: ["--use-gl=angle", "--use-angle=metal", "--hide-scrollbars", "--enable-gpu-rasterization", "--ignore-gpu-blocklist"] });
const vp = process.env.VW ? { width: +process.env.VW, height: +process.env.VH } : mode === "mobile" ? { width: 430, height: 932 } : { width: 1920, height: 1080 };
const p = await b.newPage({ viewport: vp, deviceScaleFactor: +(process.env.DPR || (mode === "mobile" ? 3 : 1)) });
p.on("pageerror", (e) => console.log("ERR", e.message));
await p.addInitScript(() => {
  try { sessionStorage.setItem("qr-intro", "1"); } catch {}
  let T = 0, id = 0; const q = new Map(); const base = Date.now();
  performance.now = () => T; Date.now = () => base + T;
  window.requestAnimationFrame = (cb) => { q.set(++id, cb); return id; };
  window.cancelAnimationFrame = (i) => q.delete(i);
  window.__step = (ms) => { T += ms; const c = [...q.values()]; q.clear(); for (const f of c) { try { f(T); } catch (e) { console.error(e); } } };
});
await p.goto(SITE + "/", { waitUntil: "load" });
const step = async (n, ms = 1000 / 60) => { for (let i = 0; i < n; i++) await p.evaluate((m) => window.__step(m), ms); };
// warm up: let the stage build, compile and settle (setTimeouts run on real time meanwhile)
for (let i = 0; i < 40; i++) { await step(6); await p.waitForTimeout(60); }
if (mode === "plate" || mode === "still") await p.addStyleTag({ content: "body *{visibility:hidden!important} canvas{visibility:visible!important}" });
const H = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
const scrollTo = (y) => p.evaluate((y) => { const l = window.__lenis; if (l) l.scrollTo(y, { immediate: true, force: true }); else scrollTo(0, y); }, y);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const shoot = async (dir, n, at) => {
  const out = path.join(ROOT, "seq", dir); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  const t0 = Date.now();
  for (let f = 0; f < n; f++) {
    await scrollTo(at(f / (n - 1)));
    await step(2);
    await p.screenshot({ path: path.join(out, `f${String(f).padStart(4, "0")}.jpg`), type: "jpeg", quality: 94 });
    if (f % 30 === 0) console.log(dir, f, "/", n, ((Date.now() - t0) / 1000).toFixed(0) + "s");
  }
};
if (mode === "probe") {
  await p.screenshot({ path: path.join(ROOT, "img", "probe-hero.jpg"), type: "jpeg", quality: 90 });
  for (const k of [0.12, 0.3, 0.5, 0.75, 1]) { await scrollTo(H * k); await step(90); await p.screenshot({ path: path.join(ROOT, "img", `probe-${k}.jpg`), type: "jpeg", quality: 90 }); }
  console.log("height", H);
} else if (mode === "still") {
  // one clean frame of the stage at this viewport, at scroll position AT (0..1 of the page): public/img/<NAME>.png
  await scrollTo(H * Number(process.env.AT || 0)); await step(240);
  await p.screenshot({ path: path.join(ROOT, "img", `${process.env.NAME || "still"}.png`) });
} else if (mode === "plate") {
  // 12 s at 30 fps: the hero pose, then a slow glide toward the manifesto pose and back
  const span = Number(process.env.SPAN || 0.16);
  await shoot(process.env.NAME || "plate", 360, (t) => H * span * (0.5 - 0.5 * Math.cos(t * Math.PI * 2)));
} else if (mode === "tour") {
  const secs = Number(process.env.SECS || 24);
  await shoot("tour", secs * 30, (t) => H * ease(t));
} else if (mode === "mobile") {
  await p.screenshot({ path: path.join(ROOT, "img", "mobile-hero.png") });
}
await b.close();
