import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3610";
const SITE_TITLE = "Quiren · Memory your agent keeps, clear as ice";
const SITE_DESCRIPTION =
  "Long-term memory for AI coding agents. Notes, transcripts and a small markdown wiki live as plain files on your machine; a dream pass proposes changes and you approve every one. CLI, MCP server and Claude Code hooks.";
const X_HANDLE = process.env.NEXT_PUBLIC_X_HANDLE || "";

// Inter Tight sets the display at regular weight with tight tracking; Inter carries the text.
const tight = Inter_Tight({ subsets: ["latin"], weight: ["300", "400", "500"], variable: "--font-tight", display: "swap" });
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-code", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: "%s · Quiren" },
  description: SITE_DESCRIPTION,
  openGraph: { type: "website", siteName: "Quiren", url: "/", title: SITE_TITLE, description: SITE_DESCRIPTION, images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "Quiren: a terracotta core held in a block of ice on a wet desert floor" }] },
  twitter: { card: "summary_large_image", ...(X_HANDLE ? { site: X_HANDLE, creator: X_HANDLE } : {}), title: SITE_TITLE, description: SITE_DESCRIPTION, images: ["/og.jpg"] },
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }], apple: [{ url: "/apple-icon.png", sizes: "180x180" }] },
};

export const viewport: Viewport = { themeColor: "#9aa0a6", colorScheme: "light", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${tight.variable} ${inter.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
