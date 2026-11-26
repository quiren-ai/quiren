import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { accountProblem, client, clientIp, foreign, left, limited, markDown, MAX_BODY, MAX_TOKENS, MODEL, sanitize, SimError, spend } from "@/lib/sim";

export const dynamic = "force-dynamic";
export const maxDuration = 130;

const fail = (status: number, type: string, message: string, headers: Record<string, string> = {}) =>
  NextResponse.json({ error: { type, message } }, { status, headers: { "cache-control": "no-store", ...headers } });

/** One Messages API call for the live simulation, model and limits forced server-side. */
export async function POST(req: Request) {
  if (!client) return fail(503, "disabled", "The live simulation is switched off on this site.");
  if (foreign(req.headers)) return fail(403, "invalid", "The live simulation only answers this site's own pages.");
  const ip = clientIp(req.headers);
  if (limited(ip)) return fail(429, "rate_limited", "Too many requests. Wait a minute.", { "retry-after": "60" });
  if (left() <= 0) return fail(429, "sim_quota", "The live simulation has used up its daily budget. It resets at midnight UTC.");
  if (left(ip) <= 0) return fail(429, "sim_quota", "You have used today's daily budget for the live simulation. It resets at midnight UTC; the recorded example is still here.");

  let input: ReturnType<typeof sanitize>;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY) return fail(413, "invalid", "Body is too large.");
    input = sanitize(JSON.parse(raw));
  } catch (e) {
    return fail(e instanceof SimError ? e.status : 400, "invalid", e instanceof SimError ? e.message : "Body is not valid JSON.");
  }

  try {
    const msg = await client.beta.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      ...(input.system ? { system: input.system } : {}),
      ...(input.tools.length ? { tools: input.tools, tool_choice: { type: "auto" as const } } : {}),
      messages: input.messages,
    } as Anthropic.Beta.Messages.MessageCreateParamsNonStreaming);
    const u = msg.usage;
    const used = (u?.input_tokens || 0) + (u?.output_tokens || 0) + (u?.cache_creation_input_tokens || 0) + (u?.cache_read_input_tokens || 0);
    spend(used, ip);
    return NextResponse.json({ id: msg.id, model: msg.model, content: msg.content, stop_reason: msg.stop_reason, usage: { ...u, total_tokens: used } }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (accountProblem(e)) {
      markDown();
      return fail(503, "disabled", "The live simulation is paused right now.");
    }
    if (e instanceof Anthropic.RateLimitError) return fail(429, "rate_limited", "The model is busy. Try again shortly.", { "retry-after": "20" });
    if (e instanceof Anthropic.BadRequestError) return fail(400, "invalid", "The model rejected this request.");
    if (e instanceof Anthropic.APIError) return fail(502, "upstream", `The model service answered ${e.status ?? "with an error"}.`);
    return fail(502, "upstream", "The model service cannot be reached.");
  }
}

export function GET() {
  return fail(405, "invalid", "Use POST.");
}
