import { NextResponse } from "next/server";

/** Unknown /api paths answer in JSON, like the rest of the API. */
const notFound = () => NextResponse.json({ error: { type: "not_found", message: "Not found." } }, { status: 404, headers: { "cache-control": "no-store" } });
export { notFound as GET, notFound as POST, notFound as PUT, notFound as DELETE, notFound as PATCH };
