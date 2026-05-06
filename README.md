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

> RTFM is also available as a standalone marketplace: `/plugin marketplace add roomi-fields/rtfm`. This aggregator marketplace lets you install both plugins in one go.

### `notebooklm` — Google NotebookLM automation

| | |
|---|---|
| **What** | Citation-backed Q&A from your NotebookLM notebooks, plus full Studio generation (audio, video, infographic, report, presentation, data table) |
| **Why** | Zero hallucinations from your sources. Multi-account rotation with auto-reauth for batch workloads |
| **Tools** | Q&A with 5 citation formats, source management, notebook library, content download |
| **Source** | This marketplace ships a thin wrapper that runs `npx -y @roomi-fields/notebooklm-mcp` |
| **Repo** | [`roomi-fields/notebooklm-mcp`](https://github.com/roomi-fields/notebooklm-mcp) |
| **Prerequisite** | Node.js ≥ 18 (npx auto-downloads the package on first use) |

See [`notebooklm/README.md`](./notebooklm/README.md) for setup details.

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
- **Aggregator pattern** — `rtfm` is sourced from its own repo (single source of truth for its version), `notebooklm` ships as a thin wrapper here
- **Backed by working open-source projects** — RTFM benchmarked on FeatureBench, NotebookLM tested on 1000+ overnight questions

---

## Repo layout

```
claude-plugins/
├── .claude-plugin/marketplace.json   # the catalog
├── notebooklm/                        # thin wrapper around @roomi-fields/notebooklm-mcp
│   ├── .claude-plugin/plugin.json
│   ├── .mcp.json
│   └── README.md
├── README.md   (this file)
└── LICENSE

# rtfm is sourced from github.com/roomi-fields/rtfm directly,
# so no rtfm/ subdirectory lives here.
```

---

## Versioning

- **`rtfm`** — version is read from [`roomi-fields/rtfm/.claude-plugin/plugin.json`](https://github.com/roomi-fields/rtfm/blob/main/.claude-plugin/plugin.json). Updates ship when that file is bumped. The marketplace entry is intentionally version-less to avoid drift between the two manifests.
- **`notebooklm`** — version pinned in this repo's [`notebooklm/.claude-plugin/plugin.json`](./notebooklm/.claude-plugin/plugin.json). Bump it when [`@roomi-fields/notebooklm-mcp`](https://www.npmjs.com/package/@roomi-fields/notebooklm-mcp) ships a new version.

---

## License

[MIT](./LICENSE) — same as both projects.
