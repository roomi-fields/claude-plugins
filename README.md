<div align="center">

# Claude Code plugins by roomi-fields

**Open-source plugins to extend Claude Code: RTFM (retrieval), NotebookLM (citation-backed Q&A), osc-bridge (MIDI/OSC for synths & DAWs), electra-one (Electra One widget development).**

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
/plugin install osc-bridge@roomi-fields
/plugin install electra-one@roomi-fields
```

That's it. Each MCP server registers automatically when its plugin is enabled.

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
| **What** | Citation-backed Q&A from your NotebookLM notebooks, plus full Studio generation (audio, video, infographic, report, presentation, data table) |
| **Why** | Zero hallucinations from your sources. Multi-account rotation with auto-reauth for batch workloads |
| **Tools** | Q&A with 5 citation formats, source management, notebook library, content download |
| **Source** | Pulled from [`roomi-fields/notebooklm-mcp`](https://github.com/roomi-fields/notebooklm-mcp) — `mcpServers` declared in upstream `.claude-plugin/plugin.json` |
| **Prerequisite** | Node.js ≥ 18 (the upstream manifest runs `npx -y @roomi-fields/notebooklm-mcp` — auto-download on first use) |

### `osc-bridge` — MIDI & OSC bridge for synths and DAWs

| | |
|---|---|
| **What** | A clean, named OSC surface in front of 849 hardware synthesizers (MIDI/SysEx) plus DAW & live-coding targets (Ableton, Bitwig, Reaper, Sonic Pi, SuperCollider, Pure Data, TouchDesigner, VCV Rack) |
| **Why** | One JSON file per device — no Rust recompile to add a synth. The same OSC surface drives hardware and software, locally or from Claude over MCP |
| **Tools** | MIDI MCP + OSC MCP: discover the device catalogue, read a device's OSC surface, send OSC to synths and DAWs |
| **Source** | Pulled from [`roomi-fields/osc-bridge`](https://github.com/roomi-fields/osc-bridge) — `mcpServers` declared in upstream `.claude-plugin/plugin.json` |
| **Prerequisite** | Node.js ≥ 18 (the upstream manifest runs `npx -y @roomi-fields/osc-bridge mcp` — auto-download on first use) |
| **Docs** | [roomi-fields.github.io/osc-bridge](https://roomi-fields.github.io/osc-bridge/) |

### `electra-one` — Electra One MK2/Mini widget development

| | |
|---|---|
| **What** | Develop custom Lua widgets and presets for the Electra One MIDI controller from Claude. Push to the device over USB SysEx, run a live Lua REPL, capture knob/button events, pull presets back into your repo |
| **Why** | The Electra One Lua extension is powerful but its documentation is scattered (official docs + forum + tribal knowledge). The plugin packages the indexed docs, the empirically-confirmed gotchas, and 20 MCP tools so Claude can iterate on hardware without re-paying the discovery tax |
| **Tools** | 20 MCP tools: `push_to_device`, `execute_lua` (REPL), `pull_preset`, `device_state`, `subscribe`, `clear_preset_slot`, `upload_lua_module`, doc-search, schema validation, screenshot, and more |
| **Source** | Pulled from [`roomi-fields/electra-one-mcp`](https://github.com/roomi-fields/electra-one-mcp) — Python MCP, runs locally |
| **Prerequisite** | Python ≥ 3.10 + `pip install -r requirements.txt` (mcp + mido + python-rtmidi). Works on macOS / Linux / Windows / WSL2 (transparent winmm bridge, no usbipd needed) |
| **Docs** | [roomi-fields.github.io/electra-one-mcp](https://roomi-fields.github.io/electra-one-mcp/) |

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
- **Pure aggregator** — every plugin is sourced directly from its own repo via `source: url`. No code, no wrapper, no duplicated metadata. Each upstream `plugin.json` is the single source of truth for its version and configuration
- **Backed by working open-source projects** — RTFM benchmarked on FeatureBench, NotebookLM tested on 1000+ overnight questions, osc-bridge driving 849 declarative device JSONs, electra-one running on a physical MK2 over USB SysEx

---

## Repo layout

```
claude-plugins/
├── .claude-plugin/marketplace.json   # the catalog (only file that matters)
├── PLAYBOOK.md                       # howto for shipping a quality MCP (code, docs, SEO, growth)
├── README.md
└── LICENSE
```

That's the whole repo. No plugin code lives here — every plugin is sourced from its own GitHub repo at install time. This keeps the aggregator dependency-free and ensures users always get the upstream manifest.

> [`PLAYBOOK.md`](./PLAYBOOK.md) — the reusable playbook for building and launching every MCP under `roomi-fields`: server code quality, packaging, in-repo docs, web docs, communication, and growth. Read it before starting a new MCP.

---

## Versioning

Each plugin pins its `version` in its upstream `.claude-plugin/plugin.json`. The marketplace entry stays version-less to avoid drift.

- **`rtfm`** — version pinned in [`roomi-fields/rtfm/.claude-plugin/plugin.json`](https://github.com/roomi-fields/rtfm/blob/main/.claude-plugin/plugin.json). Bump it via the RTFM release pipeline.
- **`notebooklm`** — version pinned in [`roomi-fields/notebooklm-mcp/.claude-plugin/plugin.json`](https://github.com/roomi-fields/notebooklm-mcp/blob/main/.claude-plugin/plugin.json). Discipline is automated upstream via `npm run version:check` in CI.
- **`osc-bridge`** — version pinned in [`roomi-fields/osc-bridge/.claude-plugin/plugin.json`](https://github.com/roomi-fields/osc-bridge/blob/main/.claude-plugin/plugin.json). Bumped on each tagged release.
- **`electra-one`** — version pinned in [`roomi-fields/electra-one-mcp/.claude-plugin/plugin.json`](https://github.com/roomi-fields/electra-one-mcp/blob/main/.claude-plugin/plugin.json). Bumped on each tagged release.

When any plugin ships a new version, users running auto-update or `/plugin marketplace update roomi-fields` pick it up automatically — no commit needed in this repo.

---

## Updating descriptions and keywords

The `description`, `keywords`, and `homepage` fields in `marketplace.json` are surfaced in Claude Code's Discover tab *before* the plugin is cloned, so they need to live in the catalog. To keep them in sync with upstream:

1. Pull the latest `description` and `keywords` from the upstream `plugin.json`
2. Update the corresponding entry in `.claude-plugin/marketplace.json`
3. Commit + push (no version bump needed for the marketplace itself)

Or just leave them — they don't have to match upstream byte-for-byte; they only need to give Discover-tab users an accurate idea of what they're installing.

---

## License

[MIT](./LICENSE) — same as the underlying projects (osc-bridge is GPL-3.0-or-later upstream).
