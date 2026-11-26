import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * The capped proxy behind the live simulation on /try (forked from Nexorum, MIT).
 * The browser runs the agent loop and the tools; the server only forwards capped model calls,
 * with the model, the output size and the tool list forced here.
 * Env: ANTHROPIC_API_KEY (no key = live mode off), QUIREN_SIM_MODEL, QUIREN_SIM_DAILY_TOKENS,
 *      QUIREN_SIM_VISITOR_TOKENS, QUIREN_SIM_MAX_TOKENS, QUIREN_SIM_RPM.
 */
const KEY = process.env.ANTHROPIC_API_KEY || "";
export const MODEL = process.env.QUIREN_SIM_MODEL || "claude-opus-5-5";
const DAILY = Number(process.env.QUIREN_SIM_DAILY_TOKENS || 2_000_000);
export const MAX_TOKENS = Math.min(Number(process.env.QUIREN_SIM_MAX_TOKENS || 2048), 8192);
export const RPM = Number(process.env.QUIREN_SIM_RPM || 60);
// one visitor may spend this much a day (a full chat, dream and recall is about 50k), so no one drains the site's budget
const VISITOR = Number(process.env.QUIREN_SIM_VISITOR_TOKENS || 150_000);
export const MAX_BODY = 256 * 1024;
const MAX_MESSAGES = 60;
const MAX_SYSTEM_CHARS = 40_000;
// The chat tools of /try plus the dream tools of the engine (the page runs the same engine as the CLI).
const ALLOWED_TOOLS = new Set(["remember", "recall", "read_document", "list_docs", "read_doc", "grep_docs", "write_doc", "edit_doc", "delete_doc", "rename_doc", "submit"]);

export const client = KEY ? new Anthropic({ apiKey: KEY, maxRetries: 2, timeout: 120_000 }) : null;

// ---------- account health ----------
// When the provider refuses the account itself (credit used up, key revoked), Live hides itself instead of failing
// every visitor: the status check probes at most every few minutes and the page shows only the recorded example.
const PROBE_MS = 10 * 60_000;
let health = { ok: true, at: 0 };
let probing: Promise<boolean> | null = null;

/** True for errors about the account rather than the request: no credit, bad or revoked key, no permission. */
export function accountProblem(e: unknown) {
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return true;
  return e instanceof Anthropic.APIError && /credit balance|billing|purchase credits|quota/i.test(String(e.message));
}
export function markDown() {
  health = { ok: false, at: Date.now() };
}
/** Whether the account can answer right now; one tiny call at most every ten minutes. */
export async function healthy() {
  if (!client) return false;
  if (Date.now() - health.at < PROBE_MS) return health.ok;
  probing ??= client.messages
    .create({ model: MODEL, max_tokens: 1, messages: [{ role: "user", content: "ok" }] })
    .then(() => true)
    .catch((e) => !accountProblem(e))
    .then((ok) => {
      health = { ok, at: Date.now() };
      probing = null;
      return ok;
    });
  return probing;
}

// ---------- budget + rate limit (in memory, resets at midnight UTC) ----------
const day = () => new Date().toISOString().slice(0, 10);
const budget = { day: day(), used: 0 };
const byVisitor = new Map<string, number>();
function roll() {
  if (budget.day !== day()) {
    budget.day = day();
    budget.used = 0;
    byVisitor.clear();
  }
}
export function spend(n: number, ip?: string) {
  roll();
  budget.used += n;
  if (ip) byVisitor.set(ip, (byVisitor.get(ip) || 0) + n);
}
/** Tokens left today for the whole site, or for one visitor when ip is given (whichever is lower). */
export function left(ip?: string) {
  roll();
  const site = DAILY - budget.used;
  return ip ? Math.min(site, VISITOR - (byVisitor.get(ip) || 0)) : site;
}
/** Requests from another site are refused: only this site's own pages may call the proxy. */
export function foreign(h: Headers) {
  const site = h.get("sec-fetch-site");
  if (site && site !== "same-origin") return true;
  const origin = h.get("origin");
  if (!origin) return false;
  const host = (h.get("x-forwarded-host") || h.get("host") || "").split(",")[0].trim();
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}
export const limits = (ip?: string) => ({ max_tokens_per_call: MAX_TOKENS, requests_per_minute: RPM, daily_tokens: DAILY, tokens_left_today: Math.max(0, left(ip)) });

const hits = new Map<string, number[]>();
export function limited(ip: string) {
  const now = Date.now();
  const w = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  w.push(now);
  hits.set(ip, w);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < 60_000)) hits.delete(k);
  return w.length > RPM;
}

/** The address nginx saw: x-real-ip, else the last x-forwarded-for hop (the one nginx appended). */
export function clientIp(h: Headers) {
  const real = h.get("x-real-ip")?.trim();
  if (real) return real;
  const fwd = (h.get("x-forwarded-for") || "").split(",").map((s) => s.trim()).filter(Boolean);
  return fwd[fwd.length - 1] || "?";
}

export class SimError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

type TextBlock = { type: "text"; text: string; cache_control?: { type: "ephemeral" } };

/** A string, or text blocks as the engine sends them (with an optional ephemeral cache marker). */
function cleanSystem(system: unknown): string | TextBlock[] | undefined {
  if (typeof system === "string") return system.slice(0, MAX_SYSTEM_CHARS) || undefined;
  if (!Array.isArray(system)) return undefined;
  if (system.length > 4) throw new SimError("Too many system blocks.");
  let room = MAX_SYSTEM_CHARS;
  const out: TextBlock[] = [];
  for (const b of system) {
    if (!b || b.type !== "text" || typeof b.text !== "string") throw new SimError("System blocks must be text.");
    const text = b.text.slice(0, room);
    room -= text.length;
    if (text) out.push({ type: "text", text, ...(b.cache_control ? { cache_control: { type: "ephemeral" as const } } : {}) });
  }
  return out.length ? out : undefined;
}

/** Keep only what the simulation needs; everything else is dropped or refused. */
export function sanitize(body: unknown) {
  if (!body || typeof body !== "object") throw new SimError("Body must be a JSON object.");
  const { system, messages, tools } = body as { system?: unknown; messages?: unknown; tools?: unknown };
  if (!Array.isArray(messages) || !messages.length || messages.length > MAX_MESSAGES) throw new SimError(`messages must be an array of 1 to ${MAX_MESSAGES} items.`);
  for (const m of messages) if (!m || (m.role !== "user" && m.role !== "assistant")) throw new SimError("Only user and assistant messages are allowed.");
  const t = Array.isArray(tools) ? tools : [];
  if (t.length > 12) throw new SimError("Too many tools.");
  for (const x of t) if (!x || !ALLOWED_TOOLS.has(x.name) || typeof x.input_schema !== "object") throw new SimError(`Tool not allowed: ${x?.name}`);
  return {
    system: cleanSystem(system),
    messages: messages as Anthropic.Beta.Messages.BetaMessageParam[],
    tools: t.map(({ name, description, input_schema }) => ({ name: String(name), description: String(description || "").slice(0, 2000), input_schema })) as Anthropic.Beta.Messages.BetaTool[],
  };
}
