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
quiren dream           # on a local model (Ollama), no key needed
```

## Dream on your machine

- **Local model (default):** run Ollama or LM Studio (`ollama pull qwen3:8b`), then `quiren dream`. No key, nothing billed, nothing leaves your machine.
- **Through your agent:** ask it to "run a Quiren dream"; it uses the `dream_prepare` and `dream_submit` MCP tools.
- **Another local server:** LM Studio or llama.cpp work too, set `QUIREN_LLM_BASE_URL` (for example `http://localhost:1234/v1`). Pick a model with `QUIREN_LLM_MODEL`.

No GPU for an 8B model? `QUIREN_LLM_PROVIDER=nvidia` with a free `NVIDIA_API_KEY` from build.nvidia.com runs the dream on NVIDIA's hosted models instead. Nothing calls a hosted API unless you set it.

Every dream writes a proposal. Review with `quiren diff`, then `quiren apply` or `quiren reject`.

## Repository

| Folder | What it is |
|---|---|
| `cli/` | The `quiren` npm package: CLI, MCP server (17 tools), Claude Code hooks, dream engine. Zero dependencies. |
| `app/`, `components/` | The website (Next.js): landing, `/try`, `/docs`, `/privacy`, `/terms`. |
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

Browser test of `/try` (needs Playwright):

```bash
npm run build && npx next start -p 3610 &
node tools/try-e2e.cjs http://127.0.0.1:3610
```

`/try` plays a recorded example in the browser: no model runs and nothing is sent anywhere.

## Credits and license

MIT, see [LICENSE](LICENSE). The engine started as a fork of [Nexorum](https://github.com/usenexorum/nexorum) (MIT);
its copyright notice is kept in `LICENSE` and `cli/LICENSE`.

$QRN is a community token. It is not needed to use the software.
