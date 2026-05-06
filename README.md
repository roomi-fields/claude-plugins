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

That's it. The MCP servers register automatically when each plugin is enabled.

---

## What's inside

### `rtfm` — open retrieval layer

| | |
|---|---|
| **What** | Indexes your projects (code, docs, legal, research, data) and serves surgical context via MCP |
| **Why** | Augment-style code search, but open source, multi-domain, and extensible. Drop-in for any Claude Code project |
| **Tools** | `rtfm_search`, `rtfm_expand`, `rtfm_context`, `rtfm_discover`, `rtfm_books`, `rtfm_graph`, `rtfm_sync` |
| **Repo** | [`roomi-fields/rtfm`](https://github.com/roomi-fields/rtfm) |
| **Docs** | [roomi-fields.github.io/rtfm](https://roomi-fields.github.io/rtfm/) |
| **PyPI** | [`rtfm-ai`](https://pypi.org/project/rtfm-ai/) |
| **Prerequisite** | `pip install rtfm-ai` (or `pipx install rtfm-ai`) before enabling the plugin |

See the [plugin's own README](./rtfm/README.md) for setup details.

### `notebooklm` — Google NotebookLM automation

| | |
|---|---|
| **What** | Citation-backed Q&A from your NotebookLM notebooks, plus full Studio generation (audio, video, infographic, report, presentation, data table) |
| **Why** | Zero hallucinations from your sources. Multi-account rotation with auto-reauth for batch workloads |
| **Tools** | Q&A with 5 citation formats, source management, notebook library, content download |
| **Repo** | [`roomi-fields/notebooklm-mcp`](https://github.com/roomi-fields/notebooklm-mcp) |
| **npm** | [`@roomi-fields/notebooklm-mcp`](https://www.npmjs.com/package/@roomi-fields/notebooklm-mcp) |
| **Prerequisite** | Node.js ≥ 18 (the plugin runs via `npx` — no manual install needed) |

See the [plugin's own README](./notebooklm/README.md) for setup details.

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
- **Discoverability** in `/plugin Discover` tab
- **Consistent versioning** (each plugin pinned to its release)
- **Backed by working open-source projects** — both tools are battle-tested in production (RTFM benchmarked on FeatureBench, NotebookLM tested on 1000+ overnight questions)

---

## Repo layout

```
claude-plugins/
├── .claude-plugin/marketplace.json   # the catalog
├── rtfm/
│   ├── .claude-plugin/plugin.json    # plugin manifest
│   ├── .mcp.json                     # MCP server definition
│   └── README.md
├── notebooklm/
│   ├── .claude-plugin/plugin.json
│   ├── .mcp.json
│   └── README.md
└── README.md   (this file)
```

The plugins are *thin wrappers*: their `.mcp.json` launches the upstream binary (`rtfm-serve` from PyPI, `npx @roomi-fields/notebooklm-mcp` from npm). All the heavy lifting lives in the source repos linked above.

---

## License

[MIT](./LICENSE) — same as both projects.
