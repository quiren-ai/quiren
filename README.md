# Quiren

Long-term memory for AI coding agents. Notes, session transcripts and a small markdown wiki live as plain files
on your machine; a **dream** pass reviews and corrects them, and you approve every change before it goes live.
Works with Claude Code, Codex, Cursor, Hermes, Claude Desktop and any MCP client.

Website: [quirenrh.com](https://quirenrh.com) · Try it in the browser: [quirenrh.com/try](https://quirenrh.com/try) ·
Docs: [quirenrh.com/docs](https://quirenrh.com/docs) · npm: [`quiren`](https://www.npmjs.com/package/quiren)

```bash
npx quiren init        # hooks + MCP for the agents it finds
quiren remember "deploys run with make release"
quiren recall deploy
quiren dream           # with your API key, a local model, or through your agent
```

## Dream with a key or on your machine

- **API key:** set `ANTHROPIC_API_KEY` (or any OpenAI-compatible endpoint).
- **Local model, no key:** run Ollama or LM Studio, then `QUIREN_LLM_PROVIDER=local quiren dream`. Nothing leaves your machine.
- **Through your agent, no key:** ask it to "run a Quiren dream"; it uses the `dream_prepare` and `dream_submit` MCP tools.

Every dream writes a proposal. Review with `quiren diff`, then `quiren apply` or `quiren reject`.

## Repository

| Folder | What it is |
|---|---|
| `cli/` | The `quiren` npm package: CLI, MCP server (17 tools), Claude Code hooks, dream engine. Zero dependencies. |
| `app/`, `components/` | The website (Next.js): landing, `/try`, `/docs`, `/privacy`, `/terms`, and the capped proxy for Live mode at `/api/sim`. |
| `public/try/` | `/try` runs the same engine in the browser (`engine/` is built from `cli/src/core`). |
| `content/` | Docs, privacy and terms as HTML. |
| `tools/` | Engine copier, `/try` browser test and the mock model it uses. |
| `blender/` | Scripts for the still images. |

## Develop

```bash
cd cli && npm test                     # engine and CLI tests
node tools/build-engine.cjs            # copy cli/src/core to public/try/engine after engine changes
npm install && npm run dev             # the site on http://localhost:3000
```

Browser test of `/try`, recorded and Live, against a mock model (needs Playwright):

```bash
node tools/mock-upstream.mjs &
npm run build && ANTHROPIC_API_KEY=test ANTHROPIC_BASE_URL=http://127.0.0.1:5299 npx next start -p 3610 &
node tools/try-e2e.cjs http://127.0.0.1:3610
QUIREN_SIM_RPM=1000 node tools/server-test.mjs on
```

Live mode on `/try` is off until `ANTHROPIC_API_KEY` is set on the server (see `.env.example`). The daily token cap,
per-visitor budget, rate limit, model and allowed tools are enforced server-side, and Live hides itself when the
account cannot answer.

## Credits and license

MIT, see [LICENSE](LICENSE). The engine started as a fork of [Nexorum](https://github.com/usenexorum/nexorum) (MIT);
its copyright notice is kept in `LICENSE` and `cli/LICENSE`.

$QRN is a community token. It is not needed to use the software.
