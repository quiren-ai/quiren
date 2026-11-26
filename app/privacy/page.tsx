import type { Metadata } from "next";
import { DocPage } from "@/components/quiren/doc-page";
import "../sub.css";

export const metadata: Metadata = { title: "Privacy", description: "What Quiren stores, what leaves your machine and how to delete it." };

export default function Page() {
  return <DocPage file="privacy.html" />;
}
