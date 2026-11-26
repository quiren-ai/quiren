import { readFile } from "node:fs/promises";

// The $QRN contract address, written by the local admin panel to /opt/quiren/data/token.json on the server.
// Read on every request, so a posted CA shows at once; 404 until the first one is posted.
export const dynamic = "force-dynamic";
const FILE = process.env.QUIREN_TOKEN_FILE || "/opt/quiren/data/token.json";
const HEAD = { "content-type": "application/json", "cache-control": "no-store" };

export async function GET() {
  try {
    const j = JSON.parse(await readFile(FILE, "utf8"));
    const ca = typeof j?.ca === "string" && /^0x[0-9a-fA-F]{40}$/.test(j.ca) ? j.ca : null;
    if (!ca) throw new Error("no ca");
    return new Response(JSON.stringify({ ca }), { headers: HEAD });
  } catch {
    return new Response(JSON.stringify({ ca: null }), { status: 404, headers: HEAD });
  }
}
