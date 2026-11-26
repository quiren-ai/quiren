import fs from "node:fs";
import path from "node:path";
import { DocEnhance } from "./doc-enhance";
import { SiteFooter, SiteHeader } from "./site-frame";

/** An inner page whose body is static HTML from /content (docs, privacy, terms). */
export function DocPage({ file }: { file: string }) {
  const html = fs.readFileSync(path.join(process.cwd(), "content", file), "utf8");
  return (
    <div className="ix-page sub-pg">
      <SiteHeader light />
      <div dangerouslySetInnerHTML={{ __html: html }} />
      <DocEnhance />
      <SiteFooter />
    </div>
  );
}
