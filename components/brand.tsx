import { useId } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The Quiren mark: a Q drawn as a rounded ring left open at the top right, with two leaves gathered
 * into that corner. A quire binds loose leaves into a book: the small leaf is what the agent already
 * keeps, the large one is what the next dream adds. Ring in chrome, leaves in brushed silver.
 */
export const MARK_PATHS = [
  // the ring: the Q, open where the leaves come in
  "M22.6 11.1H18A14 14 0 0 0 4 25.1V45.2A14 14 0 0 0 18 59.2H37.5A14 14 0 0 0 51.5 45.2V40.9A3.5 3.5 0 0 0 44.5 40.9V45.2A7 7 0 0 1 37.5 52.2H18A7 7 0 0 1 11 45.2V25.1A7 7 0 0 1 18 18.1H22.6A3.5 3.5 0 0 0 22.6 11.1Z",
  // the large leaf, wrapping the small one from above and the right
  "M30 5H55.5A5 5 0 0 1 60.5 10V34.7A1.5 1.5 0 0 1 59 36.2H47.7A1.5 1.5 0 0 1 46.2 34.7V23.8A4 4 0 0 0 42.2 19.8H30A1.5 1.5 0 0 1 28.5 18.3V6.5A1.5 1.5 0 0 1 30 5Z",
  // the small leaf, held in the open corner
  "M32.5 21.6H42.7A1.5 1.5 0 0 1 44.2 23.1V32.7A3.5 3.5 0 0 1 40.7 36.2H32.5A3.5 3.5 0 0 1 29 32.7V25.1A3.5 3.5 0 0 1 32.5 21.6Z",
];

/** tone: "dark" for dark grounds (silver), "light" for light grounds (graphite chrome). */
export function Mark({ className, title, tone = "dark" }: { className?: string; title?: string; tone?: "dark" | "light" }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 64 64" role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title} className={cn("ix-mark size-6 shrink-0", tone === "light" && "mk-light", className)}>
      <defs>
        <linearGradient id={`${id}r`} x1="0" y1="0" x2="1" y2="1">
          {[0, 0.14, 0.27, 0.5, 0.72, 0.86, 1].map((o, i) => (
            <stop key={o} offset={o} style={{ stopColor: `var(--mk-r${i})` }} />
          ))}
        </linearGradient>
        <linearGradient id={`${id}p`} x1="0" y1="0" x2="1" y2="1">
          {[0, 0.55, 1].map((o, i) => (
            <stop key={o} offset={o} style={{ stopColor: `var(--mk-p${i})` }} />
          ))}
        </linearGradient>
      </defs>
      <path d={MARK_PATHS[0]} fill={`url(#${id}r)`} />
      <path d={MARK_PATHS[1]} fill={`url(#${id}p)`} />
      <path d={MARK_PATHS[2]} fill={`url(#${id}p)`} />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("ix-logo", className)} aria-label="Quiren home">
      <Mark className="ix-logo-mark" />
      <span>Quiren</span>
    </Link>
  );
}

/** npm's mark (the "n" cut from a block), drawn in the current colour. */
export function NpmMark({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M2 2h20v20H2zm3.6 3.6v12.8H12V8.8h3.2v9.6h3.2V5.6z" />
    </svg>
  );
}
