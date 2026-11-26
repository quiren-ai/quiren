import { AbsoluteFill, Img, staticFile } from "remotion";
import { C, Grain, Lockup, Mark, Seq, Term, clamp01, inOut, ramp, useT } from "./kit";

/** The real stage, square: the core turns forward and back (the recording is out-and-back, so it loops clean). */
export const IceLoop: React.FC = () => {
  const { t, dur } = useT();
  return (
    <AbsoluteFill style={{ background: C.stone }}>
      <Seq dir="sq" count={360} p={t / dur} />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(244,244,243,0.6), rgba(244,244,243,0) 18%)" }} />
      <Lockup size={30} color={C.ink1} id="il" style={{ position: "absolute", left: 56, top: 52 }} />
      <Grain o={0.04} />
    </AbsoluteFill>
  );
};

/** The mark binds itself on ink: ring drawn, leaves gathered, one sheen pass; then it lets go and starts again. */
export const MarkLoop: React.FC = () => {
  const { t, dur } = useT();
  const draw = ramp(t, 0.2, 1.3, inOut), big = ramp(t, 0.95, 1.8), small = ramp(t, 1.12, 1.97);
  const sheen = 360 * ramp(t, 1.9, 3.6, inOut);
  const out = ramp(t, dur - 0.7, dur, inOut);
  const glow = ramp(t, 1.6, 2.6) * (1 - out);
  return (
    <AbsoluteFill style={{ background: "#0d0d0d", alignItems: "center", justifyContent: "center" }}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 48%, rgba(200,85,42,${0.18 * glow}), transparent 55%)` }} />
      <div style={{ opacity: 1 - out, transform: `scale(${1 + 0.04 * out})` }}>
        <Mark size={520} draw={draw >= 0.999 ? 1 : draw} big={big} small={small} sheen={sheen} id="ml" />
      </div>
    </AbsoluteFill>
  );
};

/** The coin turning on its axis, on ink. */
export const CoinSpin: React.FC = () => {
  const { t, dur } = useT();
  const a = (t / dur) * Math.PI * 2, c = Math.cos(a), face = c >= 0;
  const sx = Math.max(0.015, Math.abs(c));
  const light = 0.5 + 0.5 * Math.sin(a + 0.6);
  return (
    <AbsoluteFill style={{ background: "#0d0d0d", alignItems: "center", justifyContent: "center" }}>
      <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 50%, rgba(200,85,42,0.14), transparent 55%)" }} />
      {/* edge: a chrome band seen side-on */}
      <div style={{ position: "absolute", width: 900 * sx + 34 * Math.sqrt(1 - c * c), height: 900, borderRadius: "50%", background: "linear-gradient(90deg, #5d636a, #e9ecef 40%, #9aa0a7 60%, #4a4f55)", opacity: 1 - sx * 0.6 }} />
      <Img src={staticFile("img/coin-face.png")} style={{ width: 900, height: 900, transform: `scaleX(${face ? sx : -sx})`, filter: `brightness(${0.82 + 0.3 * light})` }} />
    </AbsoluteFill>
  );
};

/** Remember, then recall: the real CLI output, on the site's stone paper. */
export const RecallLoop: React.FC = () => {
  const { t, dur } = useT();
  const o = 1 - ramp(t, dur - 0.6, dur, inOut);
  return (
    <AbsoluteFill style={{ background: C.stone, alignItems: "center", justifyContent: "center", opacity: clamp01(o + 0.0) }}>
      <Lockup size={28} color={C.ink1} id="rl" style={{ position: "absolute", left: 56, top: 52 }} />
      <Term t={t} width={940} size={25} lines={[
        { cmd: 'quiren remember "tests run with pnpm test; lint is pnpm lint"', at: 0.3 },
        { out: "Saved note note_hhjcrtBoEIgQdxrDqHsCRg.", at: 2.6 },
        { cmd: 'quiren recall "how do I run the tests"', at: 3.4 },
        { out: "[note] tests run with pnpm test; lint is pnpm lint", at: 5.0, ok: true },
        { out: "(note_hhjcrtBoEIgQdxrDqHsCRg) score=3.876", at: 5.2, dim: true },
      ]} />
    </AbsoluteFill>
  );
};
