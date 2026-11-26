import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3610";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/try", "/docs", "/privacy", "/terms"].map((p) => ({ url: `${SITE_URL}${p}`, changeFrequency: "monthly", priority: p ? 0.7 : 1 }));
}
