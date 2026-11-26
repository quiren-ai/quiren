import { AbsoluteFill, Img, staticFile } from "remotion";
import { C, Eyebrow, Head, Lockup, Mark, Wordmark, display, mono, sans } from "./kit";

/** X profile photo: the site's favicon, the chrome mark on ink (X crops it round). */
export const Profile: React.FC = () => (
  <AbsoluteFill style={{ background: "#0d0d0d", alignItems: "center", justifyContent: "center" }}>
    <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 46%, rgba(200,85,42,0.20), rgba(92,44,22,0.08) 38%, transparent 62%)" }} />
    <Mark size={560} id="pf" style={{ transform: "translate(6px, -4px)" }} />
  </AbsoluteFill>
);

/**
 * Coin face: the terracotta core held in ice. An ink disc lit from inside by the core's warm glow, a frosted ice
 * ring, a chrome bezel, the name engraved around, the chrome mark at the centre.
 */
export const Coin: React.FC = () => {
  const R = 480, text = "QUIREN · MEMORY YOUR AGENT KEEPS · CLEAR AS ICE · $QRN · ";
  return (
    <AbsoluteFill style={{ background: "#0d0d0d", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "relative", width: R * 2, height: R * 2, borderRadius: "50%", background: "conic-gradient(from 200deg, #f6f7f9, #9aa0a7, #e9ecef, #5d636a, #f0b38f, #c9ced3, #6c737c, #b9d2e6, #f6f7f9)", boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.7), inset 0 0 28px rgba(0,0,0,0.4)" }}>
        {/* frosted ice ring */}
        <div style={{ position: "absolute", inset: 16, borderRadius: "50%", background: "radial-gradient(circle at 35% 28%, #f4f6f8, #cdd5dc 45%, #9aa6b1 80%, #7d8994)", boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,0.8), inset 0 6px 18px rgba(255,255,255,0.6), inset 0 -10px 24px rgba(40,50,60,0.35)" }} />
        {/* the core: ink lit warm from inside */}
        <div style={{ position: "absolute", inset: 118, borderRadius: "50%", background: "radial-gradient(circle at 50% 50%, #3a1a0d 0%, #1c0f09 42%, #0d0d0d 72%)", boxShadow: "0 0 0 2px rgba(255,255,255,0.55), 0 0 0 7px rgba(20,24,28,0.35), inset 0 0 60px rgba(200,85,42,0.35)" }} />
        <div style={{ position: "absolute", inset: 118, borderRadius: "50%", background: "radial-gradient(circle at 48% 46%, rgba(200,85,42,0.55), rgba(200,85,42,0.0) 58%)" }} />
        <svg viewBox="0 0 960 960" style={{ position: "absolute", inset: 0 }}>
          <defs><path id="ring" d="M480 480 m-412 0 a412 412 0 1 1 824 0 a412 412 0 1 1 -824 0" /></defs>
          <text fill="#2b3036" fontFamily={mono} fontWeight={500} fontSize={34} letterSpacing={2}><textPath href="#ring" startOffset="0" textLength={2575} lengthAdjust="spacing">{text}</textPath></text>
        </svg>
        <div style={{ position: "absolute", left: R - 260, top: R - 264, width: 520, height: 520 }}><Mark size={520} id="cf" /></div>
        {/* glint across the ice */}
        <div style={{ position: "absolute", inset: 16, borderRadius: "50%", background: "linear-gradient(125deg, rgba(255,255,255,0.0) 30%, rgba(255,255,255,0.35) 44%, rgba(255,255,255,0.0) 52%)", mixBlendMode: "screen" }} />
      </div>
    </AbsoluteFill>
  );
};

/** Banner 1500x500 (rendered at 2x): the real stage on the left and centre; name and promise in the sky on the right. */
export const Banner: React.FC = () => (
  <AbsoluteFill style={{ background: C.stone }}>
    <Img src={staticFile("img/banner-plate.png")} style={{ position: "absolute", inset: 0, width: 1500, height: 500 }} />
    <AbsoluteFill style={{ background: "radial-gradient(ellipse 52% 60% at 82% 26%, rgba(246,246,244,0.78), rgba(246,246,244,0) 70%)" }} />
    <div style={{ position: "absolute", left: 960, top: 64 }}>
      <Lockup size={30} color={C.ink1} id="bn" />
      <Head lines={["Memory your agent", "keeps, clear as ice."]} size={46} color={C.ink1} style={{ marginTop: 26 }} />
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginTop: 22, fontFamily: sans, fontSize: 15, color: C.ink2 }}>
        <span style={{ fontFamily: mono, fontSize: 14, color: C.ink1, background: "rgba(255,255,255,0.85)", padding: "7px 12px", borderRadius: 8, boxShadow: "0 0 0 1px rgba(0,0,0,0.08)" }}>npx quiren init</span>
        <span>quirenrh.com</span>
      </div>
    </div>
  </AbsoluteFill>
);

/** Photo posts, 1080x1350: the real stage, one line in the sky. */
const Poster: React.FC<{ img: string; eyebrow: string; lines: string[]; foot?: React.ReactNode }> = ({ img, eyebrow, lines, foot }) => (
  <AbsoluteFill style={{ background: C.stone }}>
    <Img src={staticFile(`img/${img}.png`)} style={{ position: "absolute", inset: 0, width: 1080, height: 1350 }} />
    <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(244,244,243,0.86) 0%, rgba(244,244,243,0.55) 22%, rgba(244,244,243,0) 40%)" }} />
    <div style={{ position: "absolute", left: 84, top: 84, right: 84 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Lockup size={30} color={C.ink1} id={`ps${img}`} />
        <Eyebrow size={19} color={C.ink2}>{eyebrow}</Eyebrow>
      </div>
      <Head lines={lines} size={84} color={C.ink1} style={{ marginTop: 64 }} />
    </div>
    {foot && <div style={{ position: "absolute", left: 84, right: 84, bottom: 72 }}>{foot}</div>}
  </AbsoluteFill>
);
const Pill: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ fontFamily: mono, fontSize: 24, color: C.ink1, background: "rgba(255,255,255,0.9)", padding: "14px 20px", borderRadius: 12, boxShadow: "0 0 0 1px rgba(0,0,0,0.08), 0 20px 40px -20px rgba(40,24,12,0.4)" }}>{children}</span>
);
export const F01: React.FC = () => (
  <Poster img="poster-plate" eyebrow="Agent memory" lines={["Memory your agent", "keeps, clear as ice."]} foot={<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><Pill>npx quiren init</Pill><span style={{ fontFamily: sans, fontSize: 24, color: C.ink1, background: "rgba(255,255,255,0.7)", padding: "10px 16px", borderRadius: 10 }}>quirenrh.com</span></div>} />
);
export const F02: React.FC = () => (
  <Poster img="poster-plate-b" eyebrow="Runs on your machine" lines={["No key.", "Nothing billed."]} foot={
    <div style={{ background: "rgba(251,251,250,0.94)", borderRadius: 18, padding: "26px 30px", fontFamily: mono, fontSize: 22, lineHeight: 1.6, boxShadow: "0 0 0 1px rgba(0,0,0,0.07), 0 30px 60px -30px rgba(40,24,12,0.45)" }}>
      <div><span style={{ color: C.core }}>$ </span>quiren doctor</div>
      <div style={{ color: "#2f6b45" }}>PASS  llm config: local model;</div>
      <div style={{ color: C.ink2 }}>      base URL http://localhost:11434/v1;</div>
      <div style={{ color: C.ink2 }}>      no key needed</div>
    </div>} />
);
export const F03: React.FC = () => (
  <AbsoluteFill style={{ background: C.stone, padding: 84 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <Lockup size={30} color={C.ink1} id="f3" />
      <Eyebrow size={19} color={C.ink2}>Plain files</Eyebrow>
    </div>
    <Head lines={["Plain files", "you own."]} size={92} color={C.ink1} style={{ marginTop: 70 }} />
    <div style={{ fontFamily: sans, fontSize: 28, lineHeight: 1.45, color: C.ink2, marginTop: 26, maxWidth: 760 }}>Everything your agent remembers lives in one folder on your machine.</div>
    <div style={{ marginTop: 56, background: "#fbfbfa", borderRadius: 20, boxShadow: "0 0 0 1px rgba(0,0,0,0.08), 0 40px 70px -40px rgba(40,24,12,0.4)", overflow: "hidden" }}>
      <div style={{ padding: "20px 28px", background: C.stone2, fontFamily: mono, fontSize: 22, color: C.core }}>~/.quiren/spaces/my-project/</div>
      {[["notes.jsonl", "Notes your agent saves", "remember"], ["transcripts/", "Every session, as it happened", "log"], ["wiki/", "Pages your agent reads first", "recall"], ["proposals/", "Changes waiting for you", "diff"], ["history/", "Every earlier version", "restore"]].map(([f, d, c]) => (
        <div key={f} style={{ display: "flex", alignItems: "center", padding: "20px 28px", borderTop: `1px solid ${C.hair}` }}>
          <div style={{ flex: 1 }}><div style={{ fontFamily: mono, fontSize: 25, color: C.ink1 }}>{f}</div><div style={{ fontFamily: sans, fontSize: 20, color: C.ink2, marginTop: 4 }}>{d}</div></div>
          <div style={{ fontFamily: mono, fontSize: 19, color: C.ink3 }}>quiren {c}</div>
        </div>
      ))}
    </div>
  </AbsoluteFill>
);
export { Wordmark, display };
