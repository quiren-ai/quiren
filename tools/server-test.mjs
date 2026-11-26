// The Nexorum server tests (server/test.mjs + server/test-engine.mjs), ported to run over HTTP against this site.
//   off: node tools/server-test.mjs off http://127.0.0.1:3610          (server started with no key)
//   on:  node tools/server-test.mjs on  http://127.0.0.1:3610          (server started with ANTHROPIC_API_KEY=test,
//        ANTHROPIC_BASE_URL=http://127.0.0.1:5299, QUIREN_SIM_RPM=1000; this script starts the mock on 5299)
import { startMockUpstream } from "./mock-upstream.mjs";

const [, , mode = "off", base = "http://127.0.0.1:3610"] = process.argv;
let pass = 0, fail = 0;
const t = async (n, f) => { try { await f(); pass++; console.log("ok  ", n); } catch (e) { fail++; console.log("FAIL", n, e.message); } };
const eq = (a, b) => { if (a !== b) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const post = (body) => fetch(base + "/api/sim/v1/messages", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) });

if (mode === "off") {
  await t("status says off without a key", async () => { const j = await (await fetch(base + "/api/sim/status")).json(); eq(j.enabled, false); eq(j.model, null); });
  await t("proxy returns 503 disabled without a key", async () => { const r = await post("{}"); eq(r.status, 503); eq((await r.json()).error.type, "disabled"); });
  await t("proxy GET is 405", async () => eq((await fetch(base + "/api/sim/v1/messages")).status, 405));
  await t("home page is served", async () => { const r = await fetch(base + "/"); eq(r.status, 200); eq((await r.text()).includes("Quiren"), true); });
  await t("/try is served", async () => eq((await fetch(base + "/try")).status, 200));
  await t("unknown page is 404", async () => eq((await fetch(base + "/nope/")).status, 404));
  await t("unknown api is 404 json", async () => { const r = await fetch(base + "/api/x"); eq(r.status, 404); eq((await r.json()).error.type, "not_found"); });
  await t("path traversal is blocked", async () => { const r = await fetch(base + "/..%2f..%2fpackage.json"); eq([400, 404].includes(r.status), true); });
} else {
  const up = await startMockUpstream(5299);
  const E = await import("../public/try/engine/index.js");
  await t("status is on with a key", async () => { const j = await (await fetch(base + "/api/sim/status")).json(); eq(j.enabled, true); });
  await t("sanitize refuses unknown tools", async () => { const r = await post({ messages: [{ role: "user", content: "x" }], tools: [{ name: "bash", input_schema: {} }] }); eq(r.status, 400); });
  await t("sanitize refuses system-role messages", async () => eq((await post({ messages: [{ role: "system", content: "x" }] })).status, 400));
  await t("sanitize keeps allowed tools only with their fields; model and max_tokens are forced", async () => {
    await post({ messages: [{ role: "user", content: "hi" }], tools: [{ name: "recall", description: "d", input_schema: { type: "object" }, extra: 1 }], model: "x", max_tokens: 99999 });
    const b = up.stats.lastBody;
    eq(Object.keys(b.tools[0]).join(), "name,description,input_schema"); eq(b.model !== "x", true); eq(b.max_tokens, 2048);
  });
  let result, wiki; const events = [];
  await t("a full dream (2 analyzers + organizer) completes through the proxy", async () => {
    wiki = new E.MemoryWiki({});
    const notes = E.renderNotes([{ id: "n1", ts: "2026-11-19T10:00:00Z", content: "tests run with pnpm test:unit" }]);
    result = await E.runDream({
      llm: { provider: "anthropic", apiKey: "sim", baseUrl: base + "/api/sim" },
      models: { analyzer: "server", organizer: "server" },
      docs: wiki,
      transcripts: [
        { id: "S3", source: "try", text: E.renderTranscript({ id: "S3", source: "try", events: [{ role: "user", content: "we moved to pnpm" }, { role: "assistant", content: "noted" }] }) },
        { id: "notes", source: "notes", text: notes },
      ],
      budgetTokens: 90_000, maxTokensPerCall: 2048, onEvent: (e) => events.push(e),
    });
    eq(result.status, "completed");
  });
  await t("analyzers wrote their pages and the organizer wrote the index", () => eq(wiki.list().map((d) => d.path).sort().join(","), "/_index.md,/notes.md,/s3.md"));
  await t("events report analyzers, organizer and usage", () => { for (const k of ["analyzer_started", "analyzer_done", "organizer_started", "organizer_done", "tool"]) if (!events.some((e) => e.type === k)) throw new Error("missing " + k); });
  await t("the proxy forwarded the engine's system blocks and tools", () => { const b = up.stats.lastBody; eq(Array.isArray(b.system), true); eq(b.tools.some((x) => x.name === "rename_doc"), true); eq(b.max_tokens, 2048); });
  await t("token use is counted against the daily budget", async () => { const j = await (await fetch(base + "/api/sim/status")).json(); eq(j.limits.tokens_left_today < j.limits.daily_tokens, true); eq(result.usage.input_tokens > 0, true); });
  await t("a chat turn with tools works", async () => {
    const r = await post({ system: "x", messages: [{ role: "user", content: "How do I run tests?" }], tools: [{ name: "recall", description: "d", input_schema: { type: "object" } }] });
    const j = await r.json(); eq(r.status, 200); eq(j.content[0].name, "recall");
  });
  up.server.close();
}
console.log(`\n${pass}/${pass + fail} ok`);
process.exitCode = fail ? 1 : 0;
