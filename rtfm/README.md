# RTFM — Claude Code plugin

The open retrieval layer for AI agents. Indexes any project (code, docs, legal, research, data) and serves surgical context via MCP.

- **Repo**: [roomi-fields/rtfm](https://github.com/roomi-fields/rtfm)
- **Docs**: [roomi-fields.github.io/rtfm](https://roomi-fields.github.io/rtfm/)
- **PyPI**: [`rtfm-ai`](https://pypi.org/project/rtfm-ai/)

## Install

```bash
# 1. Install the RTFM Python package (one-time, system-wide)
pip install rtfm-ai
# or, isolated:
pipx install rtfm-ai

# 2. Add this marketplace and install the plugin
/plugin marketplace add roomi-fields/claude-plugins
/plugin install rtfm@roomi-fields
```

The plugin's `.mcp.json` launches `rtfm-serve` (entry point shipped by `rtfm-ai`).

## First-time project setup

Inside any project where you want RTFM:

```bash
rtfm init --no-embeddings   # creates .rtfm/library.db and indexes the repo
```

The MCP server auto-detects `.rtfm/library.db` in the working directory. Override with `RTFM_DB=/path/to/library.db`.

For semantic search support, install with embeddings:

```bash
pip install 'rtfm-ai[embeddings]'
rtfm embed --all   # one-time embedding generation
```

## Tools exposed

| Tool | Purpose |
|---|---|
| `rtfm_search` | FTS5 / hybrid search across the indexed corpus |
| `rtfm_expand` | Read full content of a chunk by slug |
| `rtfm_context` | Bundle multiple chunks as one context |
| `rtfm_discover` | Fast project structure scan |
| `rtfm_books` | List indexed corpora (paginated) |
| `rtfm_graph` | Navigate edges between files (imports, links, refs) |
| `rtfm_sync` | Re-index changed files |

## Why use it from Claude Code?

By default Claude grep/glob/find against your filesystem on every exploratory question. With RTFM enabled, the [bundled `CLAUDE.md` template](https://github.com/roomi-fields/rtfm/blob/main/rtfm/plugin/claude_md.py) instructs Claude to call `rtfm_search` first — typically -16% to -50% on token cost and runtime for research-heavy tasks (see [benchmarks](https://roomi-fields.github.io/rtfm/benchmark-paper/)).

## License

MIT.
