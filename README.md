<div align="center">

# Claude Code plugins by roomi-fields

**Two open-source plugins to extend Claude Code: RTFM (retrieval) + NotebookLM (citation-backed Q&A).**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Claude Code](https://img.shields.io/badge/Claude_Code-Plugin-8A2BE2)](https://claude.ai/claude-code)
[![MCP](https://img.shields.io/badge/MCP-2025-green.svg)](https://modelcontextprotocol.io/)

</div>

---

## Quick install

```bash
/plugin marketplace add roomi-fields/claude-plugins
/plugin install rtfm@roomi-fields
/plugin install notebooklm@roomi-fields
```

That's it. Both MCP servers register automatically when each plugin is enabled.

---

## What's inside

### `rtfm` — open retrieval layer

| | |
|---|---|
| **What** | Indexes your projects (code, docs, legal, research, data) and serves surgical context via MCP |
| **Why** | Augment-style code search, but open source, multi-domain, and extensible |
| **Tools** | `rtfm_search`, `rtfm_expand`, `rtfm_context`, `rtfm_discover`, `rtfm_books`, `rtfm_graph`, `rtfm_sync` |
| **Source** | Pulled from [`roomi-fields/rtfm`](https://github.com/roomi-fields/rtfm) — pure-Python, no pip install required |
| **Docs** | [roomi-fields.github.io/rtfm](https://roomi-fields.github.io/rtfm/) |

### `notebooklm` — Google NotebookLM automation

| | |
|---|---|
| | |
|---|---|
| **What** | Citation-backed Q&A from your NotebookLM notebooks, plus full Studio generation (audio, video, infographic, report, presentation, data table) |
| **Why** | Zero hallucinations from your sources. Multi-account rotation with auto-reauth for batch workloads |
| **Tools** | Q&A with 5 citation formats, source management, notebook library, content download |
| **Source** | Pulled from [`roomi-fields/notebooklm-mcp`](https://github.com/roomi-fields/notebooklm-mcp) — `mcpServers` declared in upstream `.claude-plugin/plugin.json` |
| **Prerequisite** | Node.js ≥ 18 (the upstream manifest runs `npx -y @roomi-fields/notebooklm-mcp` — auto-download on first use) |

---

## How they pair

NotebookLM gives you authoritative answers from your sources. RTFM indexes those answers (via the `nblm-answer-v1` JSON schema) so you can query them offline without re-hitting NotebookLM.

```
Your sources  ─┐                                        ┌─►  Claude Code (offline)
               ├─► NotebookLM ─► /batch-to-vault ─► RTFM ┘
PDFs, URLs   ──┘                                          (FTS5 + embeddings, surgical context)
```

See the [RTFM × NotebookLM integration guide](https://roomi-fields.github.io/rtfm/notebooklm-integration/) for the full recipe.

---

## Why a marketplace?

- **One-line install** for users (`/plugin marketplace add ...`)
- **Discoverability** in Claude Code's `/plugin` Discover tab
- **Pure aggregator** — both plugins are sourced directly from their own repos via `source: github`. No code, no wrapper, no duplicated metadata. Each upstream `plugin.json` is the single source of truth for its version and configuration
- **Backed by working open-source projects** — RTFM benchmarked on FeatureBench, NotebookLM tested on 1000+ overnight questions

---

## Repo layout

```
claude-plugins/
├── .claude-plugin/marketplace.json   # the catalog (only file that matters)
├── PLAYBOOK.md                       # howto for shipping a quality MCP (code, docs, SEO, growth)
├── README.md
└── LICENSE
```

That's the whole repo. No plugin code lives here — both `rtfm` and `notebooklm` are sourced from their own GitHub repos at install time. This keeps the aggregator dependency-free and ensures users always get the upstream manifest.

> [`PLAYBOOK.md`](./PLAYBOOK.md) — the reusable playbook for building and launching every MCP under `roomi-fields`: server code quality, packaging, in-repo docs, web docs, communication, and growth. Read it before starting a new MCP.

---

## Versioning

Both plugins have their `version` field in upstream `.claude-plugin/plugin.json`. The marketplace entry stays version-less to avoid drift.

- **`rtfm`** — version pinned in [`roomi-fields/rtfm/.claude-plugin/plugin.json`](https://github.com/roomi-fields/rtfm/blob/main/.claude-plugin/plugin.json). Bump it via the RTFM release pipeline.
- **`notebooklm`** — version pinned in [`roomi-fields/notebooklm-mcp/.claude-plugin/plugin.json`](https://github.com/roomi-fields/notebooklm-mcp/blob/main/.claude-plugin/plugin.json). Discipline is automated upstream via `npm run version:check` in CI.

When either plugin ships a new version, users running auto-update or `/plugin marketplace update roomi-fields` pick it up automatically — no commit needed in this repo.

---

## Updating descriptions and keywords

The `description`, `keywords`, and `homepage` fields in `marketplace.json` are surfaced in Claude Code's Discover tab *before* the plugin is cloned, so they need to live in the catalog. To keep them in sync with upstream:

1. Pull the latest `description` and `keywords` from the upstream `plugin.json`
2. Update the corresponding entry in `.claude-plugin/marketplace.json`
3. Commit + push (no version bump needed for the marketplace itself)

Or just leave them — they don't have to match upstream byte-for-byte; they only need to give Discover-tab users an accurate idea of what they're installing.

---

## License

[MIT](./LICENSE) — same as both projects.
