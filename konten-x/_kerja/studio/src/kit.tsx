import { AbsoluteFill, Easing, Img, getInputProps, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, LEAF, RING, display, mono, sans } from "./theme";
export { C, display, mono, sans };

/** --props='{"gif":true}': no grain, so the GIF palette stays small. */
export const GIF = !!(getInputProps() as { gif?: boolean }).gif;
export const ease = Easing.bezier(0.22, 1, 0.36, 1);
export const inOut = Easing.bezier(0.65, 0, 0.35, 1);
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const ramp = (t: number, a: number, b: number, e: (x: number) => number = ease) => e(clamp01((t - a) / (b - a)));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const useT = () => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const k = (i: number[], o: number[], e: (x: number) => number = ease) => interpolate(t, i, o, { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: e });
  return { t, k, fps, frame, width, height, dur: durationInFrames / fps };
};
/** visible inside [a, b], with soft edges */
export const win = (t: number, a: number, b: number, fin = 0.6, fout = 0.5) => Math.min(ramp(t, a, a + fin, inOut), 1 - ramp(t, b - fout, b, inOut));

// ---------------------------------------------------------------- the mark (components/brand.tsx, exact paths)
export const MARK_PATHS = [
  "M22.6 11.1H18A14 14 0 0 0 4 25.1V45.2A14 14 0 0 0 18 59.2H37.5A14 14 0 0 0 51.5 45.2V40.9A3.5 3.5 0 0 0 44.5 40.9V45.2A7 7 0 0 1 37.5 52.2H18A7 7 0 0 1 11 45.2V25.1A7 7 0 0 1 18 18.1H22.6A3.5 3.5 0 0 0 22.6 11.1Z",
  "M30 5H55.5A5 5 0 0 1 60.5 10V34.7A1.5 1.5 0 0 1 59 36.2H47.7A1.5 1.5 0 0 1 46.2 34.7V23.8A4 4 0 0 0 42.2 19.8H30A1.5 1.5 0 0 1 28.5 18.3V6.5A1.5 1.5 0 0 1 30 5Z",
  "M32.5 21.6H42.7A1.5 1.5 0 0 1 44.2 23.1V32.7A3.5 3.5 0 0 1 40.7 36.2H32.5A3.5 3.5 0 0 1 29 32.7V25.1A3.5 3.5 0 0 1 32.5 21.6Z",
];
/** the ring as one stroke (7 units wide), for drawing it on */
export const RING_LINE = "M22.6 14.6H18A10.5 10.5 0 0 0 7.5 25.1V45.2A10.5 10.5 0 0 0 18 55.7H37.5A10.5 10.5 0 0 0 48 45.2V40.9";
export const RING_LEN = 98;

/**
 * The Quiren mark in chrome. draw 0..1 draws the ring on; big/small 0..1 bring the leaves in (large from outside,
 * small rising from inside the ring), as in the site's opening. sheen turns the chrome gradient (degrees).
 */
export const Mark: React.FC<{ size: number; draw?: number; big?: number; small?: number; sheen?: number; style?: React.CSSProperties; id?: string }> = ({ size, draw = 1, big = 1, small = 1, sheen = 0, style, id = "m" }) => {
  const a = ((sheen + 45) * Math.PI) / 180, cx = 32, cy = 32;
  const x1 = cx - Math.cos(a) * 32, y1 = cy - Math.sin(a) * 32, x2 = cx + Math.cos(a) * 32, y2 = cy + Math.sin(a) * 32;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} style={{ display: "block", overflow: "visible", ...style }}>
      <defs>
        <linearGradient id={`${id}r`} gradientUnits="userSpaceOnUse" x1={x1} y1={y1} x2={x2} y2={y2}>
          {RING.map((c, i) => <stop key={i} offset={[0, 0.14, 0.27, 0.5, 0.72, 0.86, 1][i]} stopColor={c} />)}
        </linearGradient>
        <linearGradient id={`${id}p`} x1="0" y1="0" x2="1" y2="1">
          {LEAF.map((c, i) => <stop key={i} offset={[0, 0.55, 1][i]} stopColor={c} />)}
        </linearGradient>
      </defs>
      {draw >= 0.999 ? (
        <path d={MARK_PATHS[0]} fill={`url(#${id}r)`} />
      ) : draw > 0 ? (
        <path d={RING_LINE} fill="none" stroke={`url(#${id}r)`} strokeWidth={7} strokeLinecap="round" strokeDasharray={`${RING_LEN * draw} ${RING_LEN}`} />
      ) : null}
      {big > 0 && <path d={MARK_PATHS[1]} fill={`url(#${id}p)`} opacity={clamp01(big * 1.6)} transform={`translate(${7 * (1 - big)} ${-7 * (1 - big)})`} />}
      {small > 0 && <path d={MARK_PATHS[2]} fill={`url(#${id}p)`} opacity={clamp01(small * 1.6)} transform={`translate(${-7 * (1 - small)} ${9 * (1 - small)})`} />}
    </svg>
  );
};

export const Wordmark: React.FC<{ size: number; color?: string; style?: React.CSSProperties }> = ({ size, color = C.white, style }) => (
  <div style={{ fontFamily: display, fontWeight: 500, fontSize: size, lineHeight: 1, letterSpacing: "-0.035em", color, ...style }}>Quiren</div>
);
export const Lockup: React.FC<{ size: number; color?: string; style?: React.CSSProperties; id?: string }> = ({ size, color, style, id }) => (
  <div style={{ display: "flex", alignItems: "center", gap: size * 0.32, ...style }}><Mark size={size * 1.15} id={id} /><Wordmark size={size} color={color} /></div>
);

/** Small label with the site's terracotta dot. */
export const Eyebrow: React.FC<{ children: React.ReactNode; size?: number; color?: string; dot?: string; style?: React.CSSProperties }> = ({ children, size = 20, color = C.w2, dot = C.core, style }) => (
  <div style={{ display: "flex", alignItems: "center", gap: size * 0.55, fontFamily: sans, fontWeight: 500, fontSize: size, color, ...style }}>
    <span style={{ width: size * 0.36, height: size * 0.36, borderRadius: 99, background: dot }} />{children}
  </div>
);
/** Display line: Inter Tight, tight tracking, as the site's h1. */
export const Head: React.FC<{ lines: string[]; size: number; color?: string; style?: React.CSSProperties; t?: number; at?: number }> = ({ lines, size, color = C.white, style, t, at = 0 }) => (
  <div style={{ fontFamily: display, fontWeight: 400, fontSize: size, lineHeight: 1.02, letterSpacing: "-0.045em", color, ...style }}>
    {lines.map((l, i) => {
      const k = t === undefined ? 1 : ramp(t, at + i * 0.18, at + i * 0.18 + 1.1);
      return <div key={i} style={{ opacity: k, transform: `translateY(${(1 - k) * 0.35 * size}px)`, filter: `blur(${(1 - k) * 10}px)` }}>{l}</div>;
    })}
  </div>
);
export const Body: React.FC<{ children: React.ReactNode; size?: number; color?: string; style?: React.CSSProperties }> = ({ children, size = 26, color = C.w2, style }) => (
  <div style={{ fontFamily: sans, fontWeight: 400, fontSize: size, lineHeight: 1.45, color, ...style }}>{children}</div>
);

/** A recorded sequence from the live site (public/seq/<dir>/fNNNN.jpg). p is 0..1 along it. */
export const Seq: React.FC<{ dir: string; count: number; p: number; style?: React.CSSProperties; blend?: boolean }> = ({ dir, count, p, style, blend = false }) => {
  const f = clamp01(p) * (count - 1), i = Math.floor(f), j = Math.min(count - 1, i + 1), w = f - i;
  const src = (n: number) => staticFile(`seq/${dir}/f${String(n).padStart(4, "0")}.jpg`);
  const st: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", ...style };
  return (
    <AbsoluteFill>
      <Img src={src(i)} style={st} />
      {blend && w > 0.02 && <Img src={src(j)} style={{ ...st, opacity: w }} />}
    </AbsoluteFill>
  );
};
/** The plate (the 3D stage, no text): 360 frames, a seamless out-and-back glide. */
export const PLATE_N = 360;
export const Plate: React.FC<{ p: number; style?: React.CSSProperties }> = ({ p, style }) => <Seq dir="plate" count={PLATE_N} p={p} style={style} />;

/** Fine film grain, off for GIFs. */
export const Grain: React.FC<{ o?: number }> = ({ o = 0.05 }) => {
  const f = useCurrentFrame();
  if (GIF) return null;
  return (
    <AbsoluteFill style={{ opacity: o, mixBlendMode: "overlay", pointerEvents: "none" }}>
      <svg width="100%" height="100%"><filter id={`g${f % 6}`}><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={f % 6} /><feColorMatrix values="0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 1.6 -0.3" /></filter><rect width="100%" height="100%" filter={`url(#g${f % 6})`} /></svg>
    </AbsoluteFill>
  );
};

/** A terminal pane in the site's style: stone paper, hairline, mono. lines appear as typed. */
export type TLine = { cmd?: string; out?: string; dim?: boolean; ok?: boolean; at: number };
export const Term: React.FC<{ t: number; lines: TLine[]; width: number; title?: string; size?: number; style?: React.CSSProperties }> = ({ t, lines, width, title = "~/orbit-api", size = 24, style }) => (
  <div style={{ width, background: "#fbfbfa", borderRadius: 18, boxShadow: "0 0 0 1px rgba(0,0,0,0.08), 0 40px 80px -30px rgba(40,24,12,0.35)", overflow: "hidden", ...style }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 22px", borderBottom: `1px solid ${C.hair}`, background: C.stone }}>
      {[0, 1, 2].map((i) => <span key={i} style={{ width: 12, height: 12, borderRadius: 99, background: C.hair }} />)}
      <span style={{ marginLeft: 14, fontFamily: mono, fontSize: size * 0.68, color: C.core }}>{title}</span>
    </div>
    <div style={{ padding: "26px 30px 30px", fontFamily: mono, fontSize: size, lineHeight: 1.6, color: C.ink1, minHeight: size * 6 }}>
      {lines.map((l, i) => {
        if (t < l.at) return null;
        if (l.cmd !== undefined) {
          const n = Math.floor(clamp01((t - l.at) / Math.max(0.5, l.cmd.length * 0.035)) * l.cmd.length);
          const typing = n < l.cmd.length;
          return (
            <div key={i} style={{ whiteSpace: "pre-wrap" }}>
              <span style={{ color: C.core }}>$ </span>{l.cmd.slice(0, n)}
              {(typing || (i === lines.length - 1)) && <span style={{ display: "inline-block", width: size * 0.55, height: size * 1.05, verticalAlign: "-0.2em", background: C.ink1, opacity: Math.floor(t * 2.4) % 2 ? 0.15 : 0.85, marginLeft: 2 }} />}
            </div>
          );
        }
        const k = ramp(t, l.at, l.at + 0.35);
        return <div key={i} style={{ whiteSpace: "pre-wrap", opacity: k, color: l.ok ? "#2f6b45" : l.dim ? C.ink3 : C.ink2 }}>{l.out}</div>;
      })}
    </div>
  </div>
);

/** A screenshot of the real site, framed as a window and panned. */
export const Shot: React.FC<{ src: string; w: number; h: number; crop: [number, number, number, number]; style?: React.CSSProperties }> = ({ src, w, h, crop, style }) => {
  const [cx, cy, cw, ch] = crop; // in source pixels (2880x1620 for the /try stills)
  const s = w / cw;
  return (
    <div style={{ width: w, height: h, overflow: "hidden", borderRadius: 20, position: "relative", background: C.stone, boxShadow: "0 0 0 1px rgba(0,0,0,0.07), 0 50px 90px -40px rgba(40,24,12,0.45)", ...style }}>
      <Img src={staticFile(src)} style={{ position: "absolute", left: -cx * s, top: -cy * s, width: 2880 * s, height: 1620 * s, maxWidth: "none" }} />
      <div style={{ position: "absolute", inset: 0, height: ch * s }} />
    </div>
  );
};
