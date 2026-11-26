import type { Metadata } from "next";
import { DocPage } from "@/components/quiren/doc-page";
import "../sub.css";

export const metadata: Metadata = { title: "Terms", description: "Terms for the Quiren software, the website and $QRN." };

export default function Page() {
  return <DocPage file="terms.html" />;
}
