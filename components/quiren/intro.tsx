"use client";

import { useEffect, useRef } from "react";
import { MARK_PATHS } from "@/components/brand";

/**
 * The opening: the mark binds itself on a dark ground, then its ring opens into a window onto the stage.
 * 1. the ring draws from its top end round to its right end; the large leaf comes in from outside,
 *    the small one rises from inside the ring into the corner (the quire is gathered)
 * 2. the stage compiles behind the still mark; if it needs longer, a slow sheen turns on the chrome
 * 3. the leaves fade and the hole of the ring grows past the screen: you enter through the Q
 * Every frame is drawn in a worker on an OffscreenCanvas (intro.worker.ts), so the main thread's work
 * (hydration, three.js, shader compile) never costs it a frame. Without OffscreenCanvas it is skipped.
 * Once per session; skipped for reduced motion and when scripts are off.
 */

const KEY = "qr-intro";
const RING_LINE = "M22.6 14.6H18A10.5 10.5 0 0 0 7.5 25.1V45.2A10.5 10.5 0 0 0 18 55.7H37.5A10.5 10.5 0 0 0 48 45.2V40.9";

// runs before the overlay is parsed, so a repeat visit never flashes it
const EARLY = `try{if(sessionStorage.getItem("${KEY}")==="1"||matchMedia("(prefers-reduced-motion: reduce)").matches||!("transferControlToOffscreen" in HTMLCanvasElement.prototype))document.documentElement.classList.add("qi-skip")}catch(e){}`;

function skipIntro() {
  let seen = false;
  try {
    seen = sessionStorage.getItem(KEY) === "1";
  } catch {}
  const skip = seen || matchMedia("(prefers-reduced-motion: reduce)").matches || !("transferControlToOffscreen" in HTMLCanvasElement.prototype);
  if (skip) document.documentElement.classList.add("qi-skip");
  return skip;
}

function ringLength() {
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p.setAttribute("d", RING_LINE);
  return p.getTotalLength();
}

export function Intro({ ready, onReveal, onAssembled }: { ready: boolean; onReveal: () => void; onAssembled: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const cb = useRef({ onReveal, onAssembled });
  cb.current = { onReveal, onAssembled };
  const worker = useRef<Worker | null>(null);
  const readySent = useRef(false);

  useEffect(() => {
    if (skipIntro()) {
      cb.current.onAssembled();
      cb.current.onReveal();
      return;
    }
    const root = document.documentElement;
    root.classList.add("qi-on");
    // the page's smooth scroll is created after this effect runs: hold it on the next frame
    const lenis = () => (window as unknown as { __lenis?: { stop(): void; start(): void } }).__lenis;
    const hold = requestAnimationFrame(() => {
      scrollTo(0, 0);
      lenis()?.stop();
    });

    let w: Worker;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      root.classList.remove("qi-on");
      root.classList.add("qi-done");
      lenis()?.start();
      try {
        sessionStorage.setItem(KEY, "1");
      } catch {}
      w?.terminate();
      worker.current = null;
    };
    try {
      w = new Worker(new URL("./intro.worker.ts", import.meta.url), { type: "module" });
      const off = cv.current!.transferControlToOffscreen();
      w.postMessage({ type: "init", canvas: off, w: innerWidth, h: innerHeight, dpr: devicePixelRatio, len: ringLength(), paths: [MARK_PATHS[1], MARK_PATHS[2]] }, [off]);
    } catch {
      // no worker: open straight onto the page
      cb.current.onAssembled();
      cb.current.onReveal();
      finish();
      return;
    }
    worker.current = w;
    w.onmessage = (e) => {
      if (e.data === "live") box.current?.classList.add("live");
      else if (e.data === "assembled") cb.current.onAssembled();
      else if (e.data === "reveal") {
        lenis()?.start();
        cb.current.onReveal();
      } else if (e.data === "done") finish();
    };
    w.onerror = () => {
      cb.current.onAssembled();
      cb.current.onReveal();
      finish();
    };
    const onResize = () => w.postMessage({ type: "resize", w: innerWidth, h: innerHeight, dpr: devicePixelRatio });
    addEventListener("resize", onResize);

    return () => {
      removeEventListener("resize", onResize);
      cancelAnimationFrame(hold);
      if (!finished) {
        w.terminate();
        root.classList.remove("qi-on");
        lenis()?.start();
      }
    };
  }, []);

  useEffect(() => {
    if (!ready || readySent.current) return;
    // let the stage draw a few frames behind the cover (first uploads) before the window opens
    const t = window.setTimeout(() => {
      readySent.current = true;
      worker.current?.postMessage({ type: "ready" });
    }, 450);
    return () => clearTimeout(t);
  }, [ready]);

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: EARLY }} />
      <noscript>
        <style>{`.qi{display:none!important}`}</style>
      </noscript>
      <div ref={box} className="qi" aria-hidden>
        <canvas ref={cv} />
      </div>
    </>
  );
}
