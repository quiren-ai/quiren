"use client";

import { createElement, useEffect, useRef, type ComponentPropsWithoutRef, type ElementType, type Ref, type RefObject } from "react";
import { cn } from "@/lib/utils";

/**
 * Optical liquid glass. The look lives in globals.css (.lg and its variants):
 * backdrop blur + saturation, a 1px directional rim drawn with mask-composite, an inner bevel,
 * and a specular glint that follows the pointer through --lx / --ly.
 * Only CSS custom properties and opacity change while it moves, so it stays on the compositor.
 */
export type GlassVariant = "smoked-pill" | "clear-light" | "control" | "thick-slab";
/** Earlier names, kept so nothing breaks. */
type LegacyVariant = "dark" | "light" | "thick" | "pill";
const LEGACY: Record<LegacyVariant, GlassVariant> = { dark: "smoked-pill", light: "clear-light", thick: "thick-slab", pill: "control" };

/** Eases the glint toward the pointer with one rAF loop that sleeps when it has arrived. */
export function useGlint<T extends HTMLElement>(ref: RefObject<T | null>, enabled = true) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || matchMedia("(hover: none), (prefers-reduced-motion: reduce)").matches) return;
    let tx = 50, ty = 0, x = 50, y = 0, raf = 0;
    const step = () => {
      x += (tx - x) * 0.18;
      y += (ty - y) * 0.18;
      el.style.setProperty("--lx", `${x.toFixed(2)}%`);
      el.style.setProperty("--ly", `${y.toFixed(2)}%`);
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.1 ? requestAnimationFrame(step) : 0;
    };
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width) * 100;
      ty = ((e.clientY - r.top) / r.height) * 100;
      if (!raf) raf = requestAnimationFrame(step);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerenter", move);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerenter", move);
      cancelAnimationFrame(raf);
    };
  }, [ref, enabled]);
}

type Props<E extends ElementType> = { as?: E; variant?: GlassVariant | LegacyVariant; refract?: boolean; ref?: Ref<HTMLElement> } & Omit<ComponentPropsWithoutRef<E>, "as">;

export function LiquidGlass<E extends ElementType = "div">({ as, variant = "smoked-pill", refract, className, ref: outer, children, ...rest }: Props<E>) {
  const v = (LEGACY as Record<string, GlassVariant>)[variant] ?? (variant as GlassVariant);
  const ref = useRef<HTMLElement>(null);
  useGlint(ref);
  const setRef = (el: HTMLElement | null) => {
    ref.current = el;
    if (typeof outer === "function") outer(el);
    else if (outer) (outer as { current: HTMLElement | null }).current = el;
  };
  // refract: the blur moves to a body layer and a second layer bends the backdrop only along the 6px rim,
  // so the dunes and ice facets curve at the edge while the text inside stays undistorted
  return createElement(
    as || "div",
    { ...rest, ref: setRef, className: cn("lg", `lg-${v}`, refract && "lg-refract", className) },
    refract ? createElement("span", { className: "lg-body", "aria-hidden": true }) : null,
    refract ? createElement("span", { className: "lg-lens", "aria-hidden": true }) : null,
    children,
  );
}

/**
 * The refraction filter: very low frequency turbulence, displacement of 3px.
 * Chromium applies it inside backdrop-filter; other engines keep blur + rim only (see .lg-refract in CSS).
 */
export function LiquidGlassDefs() {
  useEffect(() => {
    const chromium = /Chrome\//.test(navigator.userAgent);
    const lowPower = (navigator.hardwareConcurrency || 8) <= 4;
    if (chromium && !lowPower) document.documentElement.classList.add("lg-svg");
    return () => document.documentElement.classList.remove("lg-svg");
  }, []);
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden focusable="false">
      <filter id="apple-liquid-lensing" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="1" seed="7" result="n" />
        <feGaussianBlur in="n" stdDeviation="2" result="s" />
        <feDisplacementMap in="SourceGraphic" in2="s" scale="3" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}
