// Stills of the real /try simulation (recorded example) at 2x: chat, dream, diff, approve, session 4.
//   node scripts/capture-try.mjs [site]
import { chromium } from "/Users/supermaxxxzz/projects/belajar/mailsmtp/node_modules/playwright/index.mjs";
import path from "path"; import { fileURLToPath } from "url";
const SITE = (process.argv[2] || "https://quirenrh.com").replace(/\/$/, "");
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "img");
const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", args: ["--hide-scrollbars"] });
const p = await b.newPage({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 2 });
const w = (ms) => p.waitForTimeout(ms);
const shot = (n) => p.screenshot({ path: `${OUT}/try-${n}.png` });
await p.goto(SITE + "/try/", { waitUntil: "networkidle" }); await w(1500);
await shot("0-start");
let n = 0; while (true) { const s = await p.$(".sug:not([disabled])"); if (!s) break; await s.click(); n++; await w(2800); if (n === 1) await shot("1-chat"); }
await shot("2-chat-done");
await p.click("#bEnd"); await w(1500);
await p.click("#bDream"); await w(2500); await shot("3-dreaming"); await w(8000); await shot("4-proposal");
for (const t of await p.$$("#tabs button")) { if ((await t.evaluate((e) => e.textContent)).toLowerCase().includes("diff")) { await t.click(); await w(500); await shot("5-diff"); break; } }
await p.click(".review .tbtn.primary"); await w(1500); await shot("6-approved");
await p.click("#bNew"); await w(1500); await shot("7-session4");
n = 0; while (true) { const s = await p.$(".sug:not([disabled])"); if (!s) break; await s.click(); n++; await w(2800); }
await shot("8-session4-answers");
for (const t of await p.$$("#tabs button")) { if ((await t.evaluate((e) => e.textContent)).startsWith("Wiki")) { await t.click(); break; } }
await w(500); const tb = await p.$(".tree button:not(.on)"); if (tb) { await tb.click(); await w(400); }
await shot("9-wiki");
console.log("tabs", await p.$$eval("#tabs button", (x) => x.map((e) => e.textContent).join(" / ")));
await b.close();
