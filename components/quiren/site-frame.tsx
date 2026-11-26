"use client";

import { ArrowRight, GithubLogo, List, X as XIcon, XLogo } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { Logo, NpmMark } from "@/components/brand";
import { cn } from "@/lib/utils";
import { NAV, SOURCE } from "./content";
import { LiquidGlass, LiquidGlassDefs } from "./liquid-glass";


/** The round glass arrow every primary action carries. */
export function Chip({ dark }: { dark?: boolean }) {
  return (
    <i className={cn("ix-chip", dark && "dark")} aria-hidden>
      <ArrowRight size={11} weight="bold" />
    </i>
  );
}

/** A glass capsule inside the nav pill that glides to the hovered link, or the current one. */
function NavPill({ path }: { path: string }) {
  const box = useRef<HTMLElement>(null);
  const cap = useRef<HTMLSpanElement>(null);
  const place = (a: HTMLElement | null) => {
    const c = cap.current;
    if (!c) return;
    if (!a) return void (c.style.opacity = "0");
    c.style.opacity = "1";
    c.style.width = `${a.offsetWidth}px`;
    c.style.transform = `translate3d(${a.offsetLeft}px,0,0)`;
  };
  const current = () => box.current?.querySelector<HTMLElement>('a[aria-current="page"]') ?? null;
  return (
    <LiquidGlass
      as="nav"
      variant="smoked-pill"
      refract
      ref={box}
      className="ix-pill"
      aria-label="Main"
      onPointerLeave={() => place(current())}
      onBlur={() => place(current())}
    >
      <span ref={cap} className="ix-pill-cap" aria-hidden />
      {NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          aria-current={path === n.href ? "page" : undefined}
          onPointerEnter={(e) => place(e.currentTarget)}
          onFocus={(e) => place(e.currentTarget)}
        >
          {n.label}
        </Link>
      ))}
    </LiquidGlass>
  );
}

/**
 * Floating header: mark on the left, the glass pill in the middle, the action on the right.
 * `light` flips the glass from smoked to clear while a light sheet sits under it.
 */
export function SiteHeader({ light, headerRef }: { light?: boolean; headerRef?: React.Ref<HTMLElement> }) {
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  return (
    <>
      <LiquidGlassDefs />
      <header ref={headerRef} className={cn("ix-head", light && "on-light")}>
        <Logo />
        <NavPill path={path} />
        <div className="ix-head-r">
          <LiquidGlass as="a" href={SOURCE.github.href} target="_blank" rel="noreferrer" variant="smoked-pill" className="ix-ico" aria-label="Source code on GitHub" title="GitHub: quiren-ai/quiren">
            <GithubLogo size={18} weight="fill" aria-hidden />
          </LiquidGlass>
          <LiquidGlass as="a" href={SOURCE.npm.href} target="_blank" rel="noreferrer" variant="smoked-pill" className="ix-ico" aria-label="Package on npm" title={`npm: ${SOURCE.npm.short}`}>
            <NpmMark size={17} />
          </LiquidGlass>
          <LiquidGlass as="a" href={SOURCE.x.href} target="_blank" rel="noreferrer" variant="smoked-pill" className="ix-ico" aria-label="Quiren on X" title={`X: ${SOURCE.x.short}`}>
            <XLogo size={17} weight="bold" aria-hidden />
          </LiquidGlass>
          <LiquidGlass as={Link} href="/docs#quickstart" variant="smoked-pill" className="ix-frost">
            Get started
            <Chip dark />
          </LiquidGlass>
        </div>
        <button type="button" className="ix-menu lg lg-smoked-pill" aria-label={menu ? "Close menu" : "Open menu"} aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
          {menu ? <XIcon size={20} /> : <List size={20} />}
        </button>
      </header>
      {menu && (
        <div className="ix-sheet lg lg-smoked-pill" role="dialog" aria-label="Menu" onClick={(e) => (e.target as HTMLElement).closest("a") && setMenu(false)}>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}>
              {n.label}
            </Link>
          ))}
          <Link href="/docs#quickstart">Get started</Link>
          <div className="ix-sheet-src">
            <a href={SOURCE.github.href} target="_blank" rel="noreferrer">
              <GithubLogo size={18} weight="fill" aria-hidden /> GitHub
            </a>
            <a href={SOURCE.npm.href} target="_blank" rel="noreferrer">
              <NpmMark size={17} /> npm
            </a>
            <a href={SOURCE.x.href} target="_blank" rel="noreferrer">
              <XLogo size={17} weight="bold" aria-hidden /> X
            </a>
          </div>
        </div>
      )}
    </>
  );
}

/** Footer for the inner pages and the last screen of the landing. */
export function SiteFooter({ onDark }: { onDark?: boolean }) {
  return (
    <footer className={cn("ix-foot", onDark && "on-dark")}>
      <span>© 2026 Quiren. MIT licence.</span>
      <nav aria-label="Footer">
        <Link href="/try">Try it</Link>
        <Link href="/docs">Docs</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <a href={SOURCE.github.href} target="_blank" rel="noreferrer" className="ix-foot-src">
          <GithubLogo size={14} weight="fill" aria-hidden /> GitHub
        </a>
        <a href={SOURCE.npm.href} target="_blank" rel="noreferrer" className="ix-foot-src">
          <NpmMark size={13} /> npm
        </a>
        <a href={SOURCE.x.href} target="_blank" rel="noreferrer" className="ix-foot-src">
          <XLogo size={13} weight="bold" aria-hidden /> X
        </a>
      </nav>
    </footer>
  );
}
