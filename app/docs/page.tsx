import type { Metadata } from "next";
import { DocPage } from "@/components/quiren/doc-page";
import "../sub.css";

export const metadata: Metadata = { title: "Docs", description: "Quickstart, concepts, on-disk layout, CLI reference, MCP server, hooks, dreaming, search and security." };

export default function Page() {
  return <DocPage file="docs.html" />;
}
