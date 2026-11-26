import cli from "../../cli/package.json";

/**
 * Every word on the landing, typed, in one place. Counts, commands and file names are taken from the
 * engine in /cli (17 MCP tools, 18 commands, 4 layers, store.js paths).
 */

export const INSTALL = "npx quiren init";

/** Where the code and the package live. */
export const SOURCE = {
  github: { label: "GitHub", href: "https://github.com/quiren-ai/quiren", short: "quiren-ai/quiren" },
  npm: { label: "npm", href: "https://www.npmjs.com/package/quiren", short: `quiren ${cli.version}` },
  x: { label: "X", href: "https://x.com/quirenrh", short: "@quirenrh" },
};

export type Link = { label: string; href: string };

export const NAV: Link[] = [
  { label: "Principles", href: "/#principles" },
  { label: "Process", href: "/#process" },
  { label: "Try it", href: "/try" },
  { label: "Docs", href: "/docs" },
];

export const HERO = {
  title: ["Memory your agent", "keeps, clear as ice."],
  sub: "Long-term memory for AI coding agents. Notes, sessions and a wiki in plain files, read before every answer.",
  primary: { label: "Get started", href: "/docs#quickstart" },
  secondary: { label: "Try the simulation", href: "/try" },
  works: "Works with Claude Code, Codex, Cursor and any MCP client",
};

export const MANIFESTO = {
  statement: "Every session ends and its context melts away. Quiren keeps what mattered, the decisions, commands and fixes, held still in plain files your agent reads first.",
};

export const CLIENTS = {
  title: "Works with the agents you already use.",
  items: ["Claude Code", "Codex", "Cursor", "Claude Desktop", "Hermes", "Oh My Pi", "Any MCP client"],
};

/** The on-disk layout, exactly as cli/src/store.js writes it. */
export const STORE = {
  eyebrow: "Principles",
  title: "Plain files you own.",
  sub: "Everything your agent remembers lives in one folder on your machine. Open it, read it, commit it.",
  root: "~/.quiren/spaces/my-project/",
  rows: [
    { path: "notes.jsonl", dir: false, what: "Notes your agent saves", cmd: "quiren remember" },
    { path: "transcripts/", dir: true, what: "Every session, as it happened", cmd: "quiren log" },
    { path: "wiki/", dir: true, what: "Pages your agent reads first", cmd: "quiren recall" },
    { path: "proposals/", dir: true, what: "Changes waiting for you", cmd: "quiren diff" },
    { path: "history/", dir: true, what: "Every earlier version", cmd: "quiren restore" },
  ],
  rules: [
    { title: "Nothing lands unapproved.", body: "A dream only proposes. You read the diff and apply it.", cmd: "quiren diff" },
    { title: "Recall on your machine.", body: "Search runs locally over your notes and wiki.", cmd: "quiren recall" },
    { title: "Every version kept.", body: "Any page can go back to an earlier version.", cmd: "quiren restore" },
  ],
};

export type Step = { n: string; title: string; body: string; cmd: string };
export const PROCESS = {
  eyebrow: "Process",
  title: "How a memory forms.",
  steps: [
    { n: "01", title: "Capture", body: "Hooks keep each session. Your agent saves notes as it works.", cmd: "quiren init" },
    { n: "02", title: "Dream", body: "Everything new is read and folded into one proposal for the wiki.", cmd: "quiren dream" },
    { n: "03", title: "Review", body: "Read the diff. Apply it or reject it.", cmd: "quiren diff" },
    { n: "04", title: "Recall", body: "The next session starts from the wiki and searches before it answers.", cmd: "quiren recall" },
  ] satisfies Step[],
};

export type Kpi = { value: number; suffix?: string; label: string };
export const METRICS = {
  title: "Small enough to read.",
  items: [
    { value: 17, label: "MCP tools" },
    { value: 18, label: "CLI commands" },
    { value: 4, label: "memory layers" },
    { value: 0, label: "servers to run" },
  ] satisfies Kpi[],
};

export const INDEX = {
  title: "Everything it does,",
  fade: "in one index.",
  groups: [
    { name: "Setup", items: [["init", "wire up your agents"], ["mcp", "run the MCP server"], ["hook", "Claude Code hooks"], ["doctor", "health check"]] },
    { name: "Memory", items: [["remember", "save a note"], ["recall", "search notes and pages"], ["context", "the digest your agent reads"], ["log", "store a transcript"], ["import omp", "bring in omp sessions"], ["status", "what is stored"]] },
    { name: "Dreaming", items: [["dream", "write a proposal"], ["dream --if-due", "for schedulers"], ["proposals", "list what waits"]] },
    { name: "Review", items: [["diff", "read the change"], ["apply", "accept it"], ["reject", "drop it"], ["history", "every version"], ["restore", "roll a page back"], ["retention", "prune old transcripts"]] },
  ] as { name: string; items: [string, string][] }[],
};

export const START = {
  title: "Two ways in.",
  cards: [
    { title: "The simulation", role: "The real engine, in your browser", href: "/try", img: "/media/shot-try.jpg", alt: "The simulation page: chat, stage and memory panes" },
    { title: "The documentation", role: "Quickstart, CLI, MCP and hooks", href: "/docs", img: "/media/shot-docs.jpg", alt: "The documentation page at the quickstart" },
  ],
  token: { ticker: "$QRN", body: "Community token" },
};

export const FINAL = {
  title: ["Ready to keep", "what matters?"],
  sub: "One command sets up your agents.",
};
