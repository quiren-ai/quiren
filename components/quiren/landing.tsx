"use client";

import { Check, Copy, GithubLogo } from "@phosphor-icons/react";
import { NpmMark } from "@/components/brand";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import { Intro } from "./intro";
import { cn } from "@/lib/utils";
import { CLIENTS, FINAL, HERO, INDEX, INSTALL, MANIFESTO, SOURCE, METRICS, PROCESS, START, STORE, type Kpi } from "./content";
import { LiquidGlass } from "./liquid-glass";
import { POSES, type Pose, type PoseName } from "./gem-scene";
import { Chip, SiteFooter, SiteHeader } from "./site-frame";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

function CopyCommand({ className }: { className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={cn("ix-btn white cmd", className)}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(INSTALL);
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        } catch {
          /* clipboard blocked: the command stays visible on the button */
        }
      }}
      aria-label={`Copy ${INSTALL}`}
    >
      <code>{INSTALL}</code>
      <i className="ix-chip dark" aria-hidden>
        {done ? <Check size={11} weight="bold" /> : <Copy size={11} weight="bold" />}
      </i>
      <span className="sr-only" aria-live="polite">
        {done ? "Copied" : ""}
      </span>
    </button>
  );
}

function Count({ k }: { k: Kpi }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current!;
    if (k.value === 0 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.textContent = "0";
    const o = { v: 0 };
    const st = ScrollTrigger.create({
      trigger: el,
      start: "top 85%",
      once: true,
      onEnter: () => gsap.to(o, { v: k.value, duration: 1.6, ease: "power3.out", onUpdate: () => (el.textContent = String(Math.round(o.v))) }),
    });
    return () => st.kill();
  }, [k.value]);
  return (
    <span ref={ref} className="ix-kpi-n">
      {k.value}
    </span>
  );
}

/** A folder or a file, drawn in two strokes. */
function FileGlyph({ dir }: { dir?: boolean }) {
  return (
    <svg className="ix-glyph" viewBox="0 0 20 20" aria-hidden>
      {dir ? (
        <path d="M2.5 5.5a1.5 1.5 0 0 1 1.5-1.5h3.6l1.8 2H16a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 16 16H4a1.5 1.5 0 0 1-1.5-1.5z" />
      ) : (
        <path d="M5 2.5h6.5L15 6v10a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 4 16V4a1.5 1.5 0 0 1 1-1.5zM11.5 2.5V6H15" />
      )}
    </svg>
  );
}

export function Landing() {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const veilL = useRef<HTMLDivElement>(null);
  const veilR = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLElement>(null);
  const stepsBox = useRef<HTMLOListElement>(null);
  const [light, setLight] = useState(false);
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);
  // the stage is built only once the opening has drawn the mark (its shader compile blocks the main thread)
  const gate = useRef<{ p: Promise<void>; open: () => void } | null>(null);
  if (!gate.current) {
    let open = () => {};
    const p = new Promise<void>((r) => (open = r));
    gate.current = { p, open };
  }
  const [noGL, setNoGL] = useState(false);

  // ---------- the stage, the scroll and every scroll-linked motion ----------
  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const el = root.current!;
    const still = process.env.NODE_ENV !== "production" ? (new URLSearchParams(location.search).get("still")) : null;
    if (still) document.documentElement.classList.add("ix-still");

    let disposed = false;
    let scene: import("./gem-scene").GemScene | null = null;
    const lenis = reduced || still ? null : new Lenis({ lerp: 0.08, smoothWheel: true });
    if (lenis) {
      lenis.on("scroll", ScrollTrigger.update);
      (window as unknown as { __lenis?: Lenis }).__lenis = lenis;
    }

    // camera marks: each section names a pose; the pose is held while the section is centred
    type M = { el: HTMLElement; p: Pose; at: number };
    let marks: M[] = [];
    let curtains: { top: number; bottom: number }[] = [];
    const measure = () => {
      const vh = innerHeight;
      curtains = Array.from(el.querySelectorAll<HTMLElement>("[data-curtain]")).map((c) => {
        const r = c.getBoundingClientRect();
        return { top: r.top + scrollY, bottom: r.bottom + scrollY };
      });
      marks = Array.from(el.querySelectorAll<HTMLElement>("[data-cam]")).map((s) => {
        const r = s.getBoundingClientRect();
        const top = r.top + scrollY;
        return { el: s, p: POSES[(s.dataset.cam as PoseName) || "hero"] ?? POSES.hero, at: top + r.height / 2 - vh / 2 };
      });
    };
    const ease = (t: number) => t * t * (3 - 2 * t);
    const poseAt = (y: number): Pose => {
      if (!marks.length || !scene) return POSES.hero;
      if (y <= marks[0].at) return marks[0].p;
      for (let i = 0; i < marks.length - 1; i++) {
        const a = marks[i], b = marks[i + 1];
        if (y < b.at) {
          // hold each pose through the middle of its section, travel between them
          const t = Math.min(1, Math.max(0, ((y - a.at) / (b.at - a.at) - 0.18) / 0.64));
          return scene.lerpPose(a.p, b.p, ease(t));
        }
      }
      return marks[marks.length - 1].p;
    };

    let lastL = -1, lastR = -1, lastLight = false;
    const tick = (time: number, deltaTime: number) => {
      lenis?.raf(time * 1000);
      if (!scene) return;
      const y = lenis ? lenis.animatedScroll : scrollY;
      if (!still) scene.setGoal(poseAt(y));
      // the core inside the ice turns only as the page scrolls, and in its direction
      scene.setTurn(y / innerHeight);
      // a curtain that fills the screen hides the stage: skip the draw, keep the camera moving
      const vh = innerHeight;
      let covered = false;
      let underHead = false;
      for (const c of curtains) {
        const top = c.top - y, bottom = c.bottom - y;
        if (top <= 0 && bottom >= vh) covered = true;
        if (top <= 36 && bottom >= 36) underHead = true;
      }
      scene.frame(deltaTime / 1000, !covered);
      const [l, rr] = scene.veil();
      if (Math.abs(l - lastL) > 0.004) veilL.current!.style.opacity = String((lastL = l));
      if (Math.abs(rr - lastR) > 0.004) veilR.current!.style.opacity = String((lastR = rr));
      if (underHead !== lastLight) setLight((lastLight = underHead));
    };

    (async () => {
      try {
        const mod = import("./gem-scene");
        await gate.current!.p;
        const { createGemScene } = await mod;
        if (disposed) return;
        scene = createGemScene(canvas.current!, {
          reduced,
          onFirstFrame: () => {
            setReady(true);
            document.documentElement.classList.add("ix-ready");
          },
        });
      } catch {
        setNoGL(true);
        setReady(true);
        document.documentElement.classList.add("ix-ready");
        return;
      }
      measure();
      if (still) scene.setGoal(POSES[still as PoseName] ?? POSES.hero, true);
      else scene.setGoal(poseAt(scrollY), true);
      gsap.ticker.add(tick);
    })();
    gsap.ticker.lagSmoothing(0);

    const onResize = () => {
      scene?.resize();
      measure();
    };
    const onMove = (e: PointerEvent) => scene?.setPointer((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
    addEventListener("resize", onResize);
    addEventListener("pointermove", onMove, { passive: true });
    ScrollTrigger.addEventListener("refresh", measure);

    const ctx = gsap.context(() => {
      if (reduced) return;
      // manifesto: each word lights up as it passes
      gsap.fromTo(
        ".ix-manifesto .w",
        { opacity: 0.25 },
        { opacity: 1, stagger: 0.08, ease: "none", scrollTrigger: { trigger: ".ix-manifesto", start: "top 75%", end: "center 40%", scrub: 1.2 } },
      );
      // quiet rises for blocks as they enter
      ScrollTrigger.batch(".ix-rise", {
        start: "top 88%",
        once: true,
        onEnter: (b) => gsap.fromTo(b, { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: "power3.out", stagger: 0.08, overwrite: true }),
      });
      // curtains: the sheet's first row lifts a little slower than the page
      gsap.utils.toArray<HTMLElement>("[data-curtain] .ix-lift").forEach((n) => {
        gsap.fromTo(n, { y: 60 }, { y: 0, ease: "none", scrollTrigger: { trigger: n, start: "top bottom", end: "top 40%", scrub: 1.2 } });
      });
    }, el);

    // process: the step under the reading line is the active one
    const stepTriggers = Array.from(el.querySelectorAll<HTMLElement>(".ix-step")).map((s, i) =>
      ScrollTrigger.create({ trigger: s, start: "top 62%", end: "bottom 62%", onToggle: (self) => self.isActive && setStep(i) }),
    );

    // in-page links go through Lenis so the stage keeps easing with them
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a");
      const href = a?.getAttribute("href") || "";
      const hash = href.startsWith("/#") ? href.slice(1) : href.startsWith("#") ? href : "";
      if (!hash || !lenis) return;
      const t = document.querySelector(hash);
      if (!t) return;
      e.preventDefault();
      lenis.scrollTo(t as HTMLElement, { offset: -20, duration: 1.6 });
      history.replaceState(null, "", hash);
    };
    document.addEventListener("click", onClick);
    if (location.hash && lenis) {
      const t = document.querySelector(location.hash);
      if (t) setTimeout(() => lenis.scrollTo(t as HTMLElement, { immediate: true, offset: -20 }), 60);
    }

    return () => {
      disposed = true;
      gsap.ticker.remove(tick);
      removeEventListener("resize", onResize);
      removeEventListener("pointermove", onMove);
      ScrollTrigger.removeEventListener("refresh", measure);
      document.removeEventListener("click", onClick);
      stepTriggers.forEach((t) => t.kill());
      ctx.revert();
      lenis?.destroy();
      scene?.dispose();
      document.documentElement.classList.remove("ix-ready", "ix-still");
    };
  }, []);

  // the white plate glides to the active step (transform + height on one absolute layer)
  useEffect(() => {
    const box = stepsBox.current;
    const li = box?.children[step + 1] as HTMLElement | undefined;
    const plate = box?.firstElementChild as HTMLElement | undefined;
    if (!li || !plate) return;
    plate.style.transform = `translate3d(0,${li.offsetTop}px,0)`;
    plate.style.height = `${li.offsetHeight}px`;
  }, [step]);

  // KPI cells: the glass lens follows the pointer inside the hovered cell
  const lens = (e: React.PointerEvent<HTMLElement>) => {
    const cell = (e.target as HTMLElement).closest<HTMLElement>(".ix-kpi");
    if (!cell) return;
    const r = cell.getBoundingClientRect();
    cell.style.setProperty("--lx", `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
    cell.style.setProperty("--ly", `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
  };

  const words = MANIFESTO.statement.split(" ");

  return (
    <div ref={root} className="ix">
      <Intro ready={ready} onReveal={() => root.current?.classList.add("is-ready")} onAssembled={() => gate.current!.open()} />
      {/* layer 0: the stage */}
      <div className={cn("ix-stage", noGL && "no-gl")} aria-hidden>
        <canvas ref={canvas} />
        <div ref={veilL} className="ix-veil l" />
        <div ref={veilR} className="ix-veil r" />
      </div>

      <SiteHeader light={light} headerRef={header} />

      <main className="ix-main">
        {/* 01 hero */}
        <section className="ix-hero" data-cam="hero">
          <div className="ix-hero-copy">
            <h1>
              {HERO.title.map((l) => (
                <span className="ln" key={l}>
                  <span>{l}</span>
                </span>
              ))}
            </h1>
            <p className="ix-hero-sub">{HERO.sub}</p>
            <div className="ix-acts">
              <CopyCommand />
              <LiquidGlass as={Link} href={HERO.secondary.href} variant="control" className="ix-ghost">
                {HERO.secondary.label}
              </LiquidGlass>
            </div>
          </div>
          <div className="ix-hero-foot">
            <a href="#manifesto" className="ix-scroll">
              <i aria-hidden />
              Scroll down
            </a>
            <span className="ix-hero-works">{HERO.works}</span>
            <span className="ix-hero-src">
              <a href={SOURCE.github.href} target="_blank" rel="noreferrer" aria-label={`Source code on GitHub: ${SOURCE.github.short}`}>
                <GithubLogo size={15} weight="fill" aria-hidden />
                <span>{SOURCE.github.short}</span>
              </a>
              <a href={SOURCE.npm.href} target="_blank" rel="noreferrer" aria-label={`Package on npm: ${SOURCE.npm.short}`}>
                <NpmMark size={14} />
                <span>{SOURCE.npm.short}</span>
              </a>
            </span>
          </div>
        </section>

        {/* 02 manifesto */}
        <section id="manifesto" className="ix-manifesto ix-wrap" data-cam="manifesto">
          <div className="ix-mani-card">
            <p className="ix-mani-k">Why it exists</p>
            <p className="ix-statement">
              {words.map((w, i) => (
                <Fragment key={i}>
                  <span className="w">{w}</span>{" "}
                </Fragment>
              ))}
            </p>
          </div>
        </section>

        {/* 03 clients */}
        <section className="ix-clients ix-wrap" data-cam="partners" aria-labelledby="clients-h">
          <h2 id="clients-h" className="ix-h2 ix-rise">
            {CLIENTS.title}
          </h2>
          <ul>
            {CLIENTS.items.map((c) => (
              <li key={c} className="ix-rise">
                {c}
              </li>
            ))}
          </ul>
        </section>

        {/* curtain one: the files */}
        <div className="ix-curtain" data-curtain data-cam="macro">
          <section id="principles" className="ix-block ix-wrap ix-store">
            <div className="ix-store-copy ix-lift">
              <p className="ix-store-k">{STORE.eyebrow}</p>
              <h2 className="ix-h2">{STORE.title}</h2>
              <p className="ix-store-sub">{STORE.sub}</p>
              <ul className="ix-rules">
                {STORE.rules.map((r, i) => (
                  <li key={r.title} className="ix-rise">
                    <span className="ix-rule-n">{String(i + 1).padStart(2, "0")}</span>
                    <div>
                      <h3>{r.title}</h3>
                      <p>{r.body}</p>
                      <code>{r.cmd}</code>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="ix-files ix-rise" role="table" aria-label="Files Quiren keeps">
              <div className="ix-files-head" role="row">
                <FileGlyph dir />
                <code role="cell">{STORE.root}</code>
              </div>
              {STORE.rows.map((r) => (
                <div key={r.path} className="ix-file" role="row">
                  <FileGlyph dir={r.dir} />
                  <div className="ix-file-t" role="cell">
                    <code>{r.path}</code>
                    <span>{r.what}</span>
                  </div>
                  <code className="ix-file-cmd" role="cell">{r.cmd}</code>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* 07 process */}
        <section id="process" className="ix-process ix-wrap" data-cam="macro">
          <div className="ix-sticky">
            <h2 className="ix-h2 big">{PROCESS.title}</h2>
          </div>
          <ol ref={stepsBox} className="ix-steps">
            <li className="ix-plate lg lg-thick-slab" aria-hidden />
            {PROCESS.steps.map((s, i) => (
              <li key={s.n} className={cn("ix-step", i === step && "on")} onPointerEnter={() => setStep(i)} onFocus={() => setStep(i)} tabIndex={0}>
                <span className="ix-step-n">{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
                <code>{s.cmd}</code>
              </li>
            ))}
          </ol>
        </section>

        {/* 08 metrics */}
        <section className="ix-metrics ix-wrap" data-cam="macroB">
          <h2 className="ix-h2 big ix-center ix-rise">{METRICS.title}</h2>
          <dl className="ix-kpis" onPointerMove={lens}>
            {METRICS.items.map((k) => (
              <div key={k.label} className="ix-kpi">
                <dt className="sr-only">{k.label}</dt>
                <dd>
                  <Count k={k} />
                  <span className="ix-kpi-l">{k.label}</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* 09 index */}
        <section className="ix-index ix-wrap" data-cam="macroC">
          <h2 className="ix-h2 big ix-rise">
            {INDEX.title} <span className="fade">{INDEX.fade}</span>
          </h2>
          <div className="ix-dir">
            {INDEX.groups.map((g) => (
              <div key={g.name} className="ix-rise">
                <h3>{g.name}</h3>
                <ul>
                  {g.items.map(([cmd, what]) => (
                    <li key={cmd}>
                      <code>{cmd}</code>
                      <span>{what}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* curtain two: start */}
        <div className="ix-curtain two" data-curtain data-cam="final">
          <section id="start" className="ix-block ix-wrap ix-start">
            <div className="ix-start-head ix-lift">
              <h2 className="ix-h2 big">{START.title}</h2>
              <p className="ix-token" id="coin">
                <b>{START.token.ticker}</b>
                {START.token.body}
              </p>
            </div>
            <div className="ix-start-cards">
              {START.cards.map((c) => (
                <Link key={c.href} href={c.href} className="ix-portrait ix-rise">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.img} alt={c.alt} loading="lazy" decoding="async" />
                  <LiquidGlass as="span" variant="clear-light" className="ix-portrait-bar">
                    <span>
                      <b>{c.title}</b>
                      {c.role}
                    </span>
                    <Chip dark />
                  </LiquidGlass>
                </Link>
              ))}
            </div>
          </section>
        </div>

        {/* 12 final */}
        <section className="ix-final" data-cam="final">
          <div className="ix-final-c">
            <h2 className="ix-h2 big">
              {FINAL.title[0]}
              <br />
              {FINAL.title[1]}
            </h2>
            <p>{FINAL.sub}</p>
            <CopyCommand />
          </div>
          <SiteFooter onDark />
        </section>
      </main>
    </div>
  );
}
