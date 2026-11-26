// Soft wiki checks shared by the CLI dream (organizer submit) and the agent dream (dream_submit).
import { INDEX_PATH } from "./text.js";

export const slugOf = (p) => p.replace(/^.*\//, "").replace(/\.md$/, "");
export const linksOf = (c) => [...new Set([...c.matchAll(/\[\[([^\]|#\n]+?)(?:[|#][^\]\n]*)?\]\]/g)].map((m) => m[1].trim()))];

/** Soft checks: dangling [[links]], pages missing from the index, frontmatter name not matching the file name. */
export function lintWiki(wiki) {
  const out = [];
  const slugs = new Set(Object.keys(wiki).map(slugOf));
  const indexed = new Set(linksOf(wiki[INDEX_PATH] ?? ""));
  for (const [p, c] of Object.entries(wiki)) {
    for (const l of linksOf(c)) if (!slugs.has(l)) out.push(`${p} links to [[${l}]] which does not exist`);
    if (p === INDEX_PATH) continue;
    if (!indexed.has(slugOf(p))) out.push(`${p} is not listed in ${INDEX_PATH}`);
    const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(c);
    const name = fm && /^name:\s*(.+)$/m.exec(fm[1]);
    if (!fm) out.push(`${p} has no frontmatter`);
    else if (!name || name[1].trim() !== slugOf(p)) out.push(`${p} frontmatter name should be "${slugOf(p)}"`);
  }
  return out.slice(0, 20);
}
