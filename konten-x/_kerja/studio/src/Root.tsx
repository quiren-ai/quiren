import { Composition, Html5Audio, Still, staticFile } from "remotion";
import "./theme";
import { Demo, DEMO_SECONDS } from "./Demo";
import { CoinSpin, IceLoop, MarkLoop, RecallLoop } from "./Loops";
import { Banner, Coin, F01, F02, F03, Profile } from "./Stills";

const DemoWithSound: React.FC = () => (<><Demo /><Html5Audio src={staticFile("audio/demo.wav")} /></>);

// Each loop is one GIF cycle, rendered silent; render.sh loops it under its bed for the MP4.
export const LOOPS: { id: string; component: React.FC; seconds: number; size: number }[] = [
  { id: "IceLoop", component: IceLoop, seconds: 12, size: 1080 },
  { id: "MarkLoop", component: MarkLoop, seconds: 5, size: 1080 },
  { id: "RecallLoop", component: RecallLoop, seconds: 8, size: 1080 },
  { id: "CoinSpin", component: CoinSpin, seconds: 4, size: 1000 },
];

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="Demo" component={DemoWithSound} durationInFrames={Math.round(30 * DEMO_SECONDS)} fps={30} width={1920} height={1080} />
    {LOOPS.map((l) => <Composition key={l.id} id={l.id} component={l.component} durationInFrames={Math.round(30 * l.seconds)} fps={30} width={l.size} height={l.size} />)}
    <Still id="Profile" component={Profile} width={1000} height={1000} />
    <Still id="CoinFace" component={Coin} width={1000} height={1000} />
    <Still id="Banner" component={Banner} width={1500} height={500} />
    <Still id="F01" component={F01} width={1080} height={1350} />
    <Still id="F02" component={F02} width={1080} height={1350} />
    <Still id="F03" component={F03} width={1080} height={1350} />
  </>
);
