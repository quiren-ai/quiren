import { AbsoluteFill } from "remotion";
import { Body, C, Eyebrow, Grain, Head, Lockup, Mark, Plate, Shot, Term, display, inOut, lerp, mono, ramp, sans, useT, win } from "./kit";

// scene starts in seconds (scripts/score.py reads the same numbers)
export const S = { open: 0, title: 4.6, melt: 10, remember: 15, dream: 23, approve: 28.5, next: 33, local: 38, close: 43, end: 50 };
export const DEMO_SECONDS = S.end;

// the hole of the ring, in mark units (intro.worker.ts)
const HOLE = { x: 11, y: 18.1, w: 33.5, h: 34.1, r: 7 };
const MARK = 300, W = 1920, H = 1080;

/** 1. The mark binds itself on ink, then its ring opens into a window onto the stage (as the site's opening). */
const Open: React.FC<{ t: number }> = ({ t }) => {
  const s0 = MARK / 64, mx = W / 2 - MARK / 2, my = H / 2 - MARK / 2;
  const draw = ramp(t, 0.25, 1.3, inOut), big = ramp(t, 0.95, 1.8), small = ramp(t, 1.12, 1.97);
  const sheen = 360 * ramp(t, 0.3, 2.8, inOut);
  const leave = ramp(t, 3.0, 3.35, (x) => x * x);
  const grow = ramp(t, 3.1, 4.6, inOut);
  const kMax = (Math.hypot(W, H) * 1.25) / (Math.min(HOLE.w, HOLE.h) * s0);
  const k = lerp(1, kMax, grow);
  const px = mx + (HOLE.x + HOLE.w / 2) * s0, py = my + (HOLE.y + HOLE.h / 2) * s0;
  // the hole, scaled about its centre
  const hw = HOLE.w * s0 * k, hh = HOLE.h * s0 * k, r = HOLE.r * s0 * k;
  const holeA = ramp(t, 3.0, 3.45, inOut);
  const clip = `inset(${py - hh / 2}px ${W - (px + hw / 2)}px ${H - (py + hh / 2)}px ${px - hw / 2}px round ${r}px)`;
  return (
    <AbsoluteFill style={{ background: "#0b0b0c" }}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 50%, rgba(200,85,42,${0.12 * ramp(t, 1.5, 2.6) * (1 - holeA)}), transparent 45%)` }} />
      <AbsoluteFill style={{ clipPath: clip, opacity: holeA }}><Plate p={0} style={{ transform: `scale(${lerp(1.18, 1, grow)})` }} /></AbsoluteFill>
      <div style={{ position: "absolute", left: mx, top: my, width: MARK, height: MARK, transformOrigin: `${px - mx}px ${py - my}px`, transform: `scale(${k})` }}>
        <Mark size={MARK} draw={draw >= 0.999 ? 1 : draw} big={big * (1 - leave)} small={small * (1 - leave)} sheen={sheen} id="op" />
      </div>
    </AbsoluteFill>
  );
};

/** The stage with a warm veil on the left for white type, as on the site. */
const Stage: React.FC<{ p: number; veil?: number; dim?: number }> = ({ p, veil = 0.55, dim = 0 }) => (
  <AbsoluteFill>
    <Plate p={p} />
    <AbsoluteFill style={{ background: `linear-gradient(90deg, rgba(58,38,26,${veil}) 0%, rgba(58,38,26,${veil * 0.6}) 34%, rgba(58,38,26,0) 58%)` }} />
    {dim > 0 && <AbsoluteFill style={{ background: `rgba(30,20,14,${dim})` }} />}
  </AbsoluteFill>
);

const Chapter: React.FC<{ n: string; label: string; t: number; at: number; color?: string }> = ({ n, label, t, at, color = C.ink2 }) => {
  const k = ramp(t, at, at + 0.8);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, opacity: k, transform: `translateY(${(1 - k) * 12}px)` }}>
      <span style={{ fontFamily: mono, fontSize: 20, color: C.core }}>{n}</span>
      <span style={{ width: 40, height: 1, background: color, opacity: 0.4 }} />
      <span style={{ fontFamily: sans, fontWeight: 500, fontSize: 21, color }}>{label}</span>
    </div>
  );
};

export const Demo: React.FC = () => {
  const { t } = useT();
  // the plate runs out and back (0 -> 0.5 is hero -> turned core, 0.5 -> 1 is back)
  const plateP =
    t < S.remember ? lerp(0, 0.38, ramp(t, S.title, S.remember, (x) => x)) :
    t < S.close ? lerp(0.38, 0.62, ramp(t, S.local, S.close, (x) => x)) :
    lerp(0.62, 1, ramp(t, S.close, S.end - 1, inOut));
  const onStage = t < S.remember + 0.9 || t > S.local - 0.9;
  const paper = win(t, S.remember, S.local + 0.4, 0.9, 0.9);
  return (
    <AbsoluteFill style={{ background: C.stone }}>
      {onStage && <Stage p={plateP} veil={t > S.local - 1 && t < S.close ? 0.62 : 0.55} />}

      {/* 1. opening */}
      {t < S.title + 0.1 && <Open t={t} />}

      {/* 2. title */}
      <AbsoluteFill style={{ opacity: win(t, S.title, S.melt, 0.4, 0.6) }}>
        <Lockup size={34} id="tl" style={{ position: "absolute", left: 120, top: 92 }} />
        <div style={{ position: "absolute", left: 120, top: 330 }}>
          <Head lines={["Memory your agent", "keeps, clear as ice."]} size={108} t={t} at={S.title + 0.2} />
          <Body size={28} style={{ marginTop: 34, maxWidth: 560, opacity: ramp(t, S.title + 1.2, S.title + 2.2) }}>Long-term memory for AI coding agents. Plain files on your machine, read before every answer.</Body>
        </div>
      </AbsoluteFill>

      {/* 3. the problem */}
      <AbsoluteFill style={{ opacity: win(t, S.melt, S.remember + 0.3, 0.5, 0.6) }}>
        <div style={{ position: "absolute", left: 120, top: 380 }}>
          <Head lines={["Every session ends.", "Its context melts away."]} size={92} t={t} at={S.melt + 0.1} />
          <Body size={28} style={{ marginTop: 34, maxWidth: 620, opacity: ramp(t, S.melt + 2.0, S.melt + 3.0) }}>Quiren keeps what mattered: the decisions, the commands, the fixes.</Body>
        </div>
      </AbsoluteFill>

      {/* paper: the product at work */}
      {paper > 0 && (
        <AbsoluteFill style={{ background: C.stone, opacity: paper, transform: `translateY(${(1 - ramp(t, S.remember, S.remember + 0.9)) * 60}px)` }}>
          <Lockup size={30} color={C.ink1} id="pp" style={{ position: "absolute", left: 120, top: 92 }} />

          {/* 4. remember */}
          <AbsoluteFill style={{ opacity: win(t, S.remember + 0.3, S.dream, 0.6, 0.5) }}>
            <div style={{ position: "absolute", left: 120, top: 330, width: 620 }}>
              <Chapter n="01" label="Remember" t={t} at={S.remember + 0.4} />
              <Head lines={["Your agent saves", "what matters."]} size={80} color={C.ink1} t={t} at={S.remember + 0.6} style={{ marginTop: 34 }} />
              <Body size={26} color={C.ink2} style={{ marginTop: 28, opacity: ramp(t, S.remember + 1.6, S.remember + 2.4) }}>Notes and whole sessions, scrubbed of secrets, stored as plain files.</Body>
            </div>
            <Term t={t - S.remember} width={980} size={24} style={{ position: "absolute", left: 800, top: 300, opacity: ramp(t, S.remember + 0.8, S.remember + 1.5) }} lines={[
              { cmd: 'quiren remember "tests run with pnpm test; lint is pnpm lint"', at: 1.2 },
              { out: "Saved note note_hhjcrtBoEIgQdxrDqHsCRg.", at: 3.3 },
              { cmd: "quiren log --id s1 - < session.json", at: 3.9 },
              { out: "Logged transcript s1 (4 events, status pending).", at: 5.0 },
              { cmd: 'quiren recall "how do I run the tests"', at: 5.5 },
              { out: "[note] tests run with pnpm test; lint is pnpm lint", at: 6.9, ok: true },
            ]} />
          </AbsoluteFill>

          {/* 5. dream */}
          <AbsoluteFill style={{ opacity: win(t, S.dream, S.next, 0.6, 0.5) }}>
            <div style={{ position: "absolute", left: 120, top: 210 }}>
              <Chapter n="02" label="Dream, then approve" t={t} at={S.dream + 0.2} />
              <Head lines={t < S.approve ? ["A dream writes a proposal."] : ["You approve every page."]} size={72} color={C.ink1} t={t} at={t < S.approve ? S.dream + 0.4 : S.approve} style={{ marginTop: 28 }} />
            </div>
            <Shot src="img/try-4-proposal.png" w={1680} h={555} crop={[956, 1064, 1684, 556]} style={{ position: "absolute", left: 120, top: 420, opacity: 1 - ramp(t, S.approve - 0.3, S.approve + 0.4, inOut), transform: `scale(${lerp(1.0, 1.03, ramp(t, S.dream, S.approve, (x) => x))})`, transformOrigin: "70% 40%" }} />
            <div style={{ position: "absolute", left: 120, top: 420, opacity: ramp(t, S.approve - 0.2, S.approve + 0.5, inOut) }}>
              <Shot src="img/try-6-approved.png" w={1680} h={268} crop={[240, 608, 2400, 344]} />
              <Shot src="img/try-9-wiki.png" w={560} h={294} crop={[1840, 180, 800, 420]} style={{ marginTop: 28, marginLeft: 1120, transform: `translateY(${(1 - ramp(t, S.approve + 0.5, S.approve + 1.4)) * 30}px)`, opacity: ramp(t, S.approve + 0.5, S.approve + 1.4) }} />
            </div>
            <Body size={24} color={C.ink2} style={{ position: "absolute", left: 120, top: 760, width: 900, opacity: ramp(t, S.approve + 0.8, S.approve + 1.6) * (1 - ramp(t, S.next - 0.5, S.next)) }}>Nothing reaches the wiki until you say so. Every write is a version you can restore.</Body>
          </AbsoluteFill>

          {/* 6. next session */}
          <AbsoluteFill style={{ opacity: win(t, S.next, S.local + 0.3, 0.6, 0.6) }}>
            <div style={{ position: "absolute", left: 120, top: 330, width: 700 }}>
              <Chapter n="03" label="Recall" t={t} at={S.next + 0.2} />
              <Head lines={["The next session", "starts from the wiki."]} size={78} color={C.ink1} t={t} at={S.next + 0.4} style={{ marginTop: 34 }} />
            </div>
            <Shot src="img/try-9-wiki.png" w={560} h={634} crop={[240, 220, 680, 770]} style={{ position: "absolute", left: 860, top: 230, transform: `translateY(${(1 - ramp(t, S.next + 0.4, S.next + 1.4)) * 40}px)`, opacity: ramp(t, S.next + 0.4, S.next + 1.4) }} />
            <Shot src="img/try-9-wiki.png" w={300} h={634} crop={[1840, 180, 470, 993]} style={{ position: "absolute", left: 1500, top: 300, transform: `translateY(${(1 - ramp(t, S.next + 0.8, S.next + 1.8)) * 40}px)`, opacity: ramp(t, S.next + 0.8, S.next + 1.8) }} />
          </AbsoluteFill>
        </AbsoluteFill>
      )}

      {/* 7. local */}
      <AbsoluteFill style={{ opacity: win(t, S.local, S.close + 0.2, 0.7, 0.6) }}>
        <div style={{ position: "absolute", left: 120, top: 330 }}>
          <Eyebrow size={22}>Runs on your machine</Eyebrow>
          <Head lines={["No API key.", "Nothing billed."]} size={110} t={t} at={S.local + 0.3} style={{ marginTop: 30 }} />
          <div style={{ marginTop: 40, fontFamily: mono, fontSize: 22, lineHeight: 1.6, color: C.w2, opacity: ramp(t, S.local + 1.6, S.local + 2.4) }}>
            <span style={{ color: "#9fd3b0" }}>PASS</span>  llm config: local model; http://localhost:11434/v1; no key needed
          </div>
        </div>
      </AbsoluteFill>

      {/* 8. close */}
      <AbsoluteFill style={{ opacity: win(t, S.close, S.end + 1, 0.8, 0.1) }}>
        <AbsoluteFill style={{ background: "radial-gradient(ellipse 50% 46% at 50% 44%, rgba(246,246,244,0.72), rgba(246,246,244,0) 75%)", opacity: ramp(t, S.close, S.close + 1.2) }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: 300, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <div style={{ opacity: ramp(t, S.close + 0.2, S.close + 1.0), transform: `scale(${lerp(0.94, 1, ramp(t, S.close + 0.2, S.close + 1.4))})` }}><Lockup size={64} color={C.ink1} id="cl" /></div>
          <Head lines={["Ready to keep what matters?"]} size={64} color={C.ink1} t={t} at={S.close + 0.9} style={{ marginTop: 44 }} />
          <div style={{ display: "flex", gap: 22, alignItems: "center", marginTop: 40, opacity: ramp(t, S.close + 1.8, S.close + 2.6) }}>
            <span style={{ fontFamily: mono, fontSize: 28, color: C.ink1, background: "rgba(255,255,255,0.92)", padding: "16px 24px", borderRadius: 12, boxShadow: "0 0 0 1px rgba(0,0,0,0.08), 0 24px 50px -24px rgba(40,24,12,0.45)" }}>npx quiren init</span>
          </div>
          <div style={{ fontFamily: sans, fontWeight: 500, fontSize: 26, color: C.ink1, marginTop: 34, opacity: ramp(t, S.close + 2.4, S.close + 3.2) }}>quirenrh.com</div>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "#0b0b0c", opacity: ramp(t, S.end - 0.9, S.end, inOut) }} />
      <Grain o={0.045} />
      <div style={{ display: "none", fontFamily: display }} />
    </AbsoluteFill>
  );
};
