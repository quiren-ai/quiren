import { loadFont as tight } from "@remotion/google-fonts/InterTight";
import { loadFont as inter } from "@remotion/google-fonts/Inter";
import { loadFont as jet } from "@remotion/google-fonts/JetBrainsMono";

// The site's tokens (app/globals.css): stone paper, ink, a terracotta core, chrome for the mark.
export const C = {
  stone: "#f4f4f3", stone2: "#e7e7e5", hair: "#dcdcd9", ink: "#0d0d0d", ink1: "#111111", ink2: "#5a5d62", ink3: "#8c8f94",
  terra: "#5c2c16", core: "#c8552a", white: "#ffffff", w2: "rgba(255,255,255,0.76)", w3: "rgba(255,255,255,0.5)", wLine: "rgba(255,255,255,0.18)",
};
export const RING = ["#f6f7f9", "#f0b38f", "#6c737c", "#1f2226", "#59606a", "#b9d2e6", "#f3f5f7"];
export const LEAF = ["#ffffff", "#e2e6ea", "#8e959d"];
export const display = tight("normal", { weights: ["300", "400", "500"], subsets: ["latin"] }).fontFamily;
export const sans = inter("normal", { weights: ["400", "500", "600"], subsets: ["latin"] }).fontFamily;
export const mono = jet("normal", { weights: ["400", "500"], subsets: ["latin"] }).fontFamily;
