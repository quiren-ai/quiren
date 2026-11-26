"use client";

import { useEffect } from "react";

/** Docs: mark the section in view in the contents list, and let sections fade in as they arrive. */
export function DocEnhance() {
  useEffect(() => {
    const io: IntersectionObserver[] = [];
    const toc = document.querySelector(".sub-pg .toc");
    if (toc) {
      const links: Record<string, Element> = {};
      toc.querySelectorAll('a[href^="#"]').forEach((a) => (links[a.getAttribute("href")!.slice(1)] = a));
      const o = new IntersectionObserver(
        (es) =>
          es.forEach((e) => {
            if (e.isIntersecting && links[e.target.id]) {
              toc.querySelectorAll("a.on").forEach((x) => x.classList.remove("on"));
              links[e.target.id].classList.add("on");
            }
          }),
        { rootMargin: "-20% 0px -70% 0px" },
      );
      Object.keys(links).forEach((id) => {
        const el = document.getElementById(id);
        if (el) o.observe(el);
      });
      io.push(o);
    }
    // a copy button on every command block
    document.querySelectorAll<HTMLPreElement>(".sub-pg .doc pre").forEach((pre) => {
      if (pre.querySelector(".cp")) return;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cp";
      b.textContent = "Copy";
      b.setAttribute("aria-label", "Copy to clipboard");
      b.onclick = async () => {
        const text = (pre.querySelector("code") ?? pre).textContent ?? "";
        try {
          await navigator.clipboard.writeText(text.trim());
          b.textContent = "Copied";
          b.classList.add("ok");
          setTimeout(() => { b.textContent = "Copy"; b.classList.remove("ok"); }, 1600);
        } catch { b.textContent = "Press Cmd+C"; }
      };
      pre.appendChild(b);
    });
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const rv = new IntersectionObserver(
        (es) =>
          es.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add("in");
              rv.unobserve(e.target);
            }
          }),
        { rootMargin: "0px 0px -8% 0px" },
      );
      document.querySelectorAll(".sub-pg .doc h2, .sub-pg .doc pre, .sub-pg .doc table").forEach((el) => {
        el.classList.add("rv");
        rv.observe(el);
      });
      io.push(rv);
    }
    return () => io.forEach((o) => o.disconnect());
  }, []);
  return null;
}
