import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { MARK_PATHS } from "@/components/brand";
import { SiteFooter, SiteHeader } from "@/components/quiren/site-frame";
import { TryMount } from "@/components/quiren/try-mount";
import "./try.css";

export const metadata: Metadata = {
  title: "Try it",
  description:
    "A simulation of Quiren running its real engine in your browser: an agent forgets a fact between sessions, a dream rewrites its notes into a small wiki, and the same question gets a better answer.",
};

export default function TryPage() {
  const markup = fs.readFileSync(path.join(process.cwd(), "app", "try", "markup.html"), "utf8");
  return (
    <div className="ix-page try-pg">
      {/* the mark the stage actors are drawn with */}
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          <linearGradient id="icActor" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#d86638" />
            <stop offset=".55" stopColor="#c8552a" />
            <stop offset="1" stopColor="#5c2c16" />
          </linearGradient>
          <g id="icMark">
            {MARK_PATHS.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
        </defs>
      </svg>
      <SiteHeader light />
      <div dangerouslySetInnerHTML={{ __html: markup }} />
      <TryMount />
      <SiteFooter />
    </div>
  );
}
