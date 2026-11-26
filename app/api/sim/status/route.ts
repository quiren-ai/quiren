import { NextResponse } from "next/server";
import { client, clientIp, healthy, left, limits, MODEL } from "@/lib/sim";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ip = clientIp(req.headers);
  const ok = !!client && left(ip) > 0 && (await healthy());
  return NextResponse.json({ enabled: ok, model: client ? MODEL : null, limits: limits(ip) }, { headers: { "cache-control": "no-store" } });
}
