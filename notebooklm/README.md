# NotebookLM — Claude Code plugin

Automate Google NotebookLM at scale. Citation-backed Q&A, full Studio generation (audio, video, infographic, report, presentation, data table), multi-account rotation with auto-reauth.

- **Repo**: [roomi-fields/notebooklm-mcp](https://github.com/roomi-fields/notebooklm-mcp)
- **npm**: [`@roomi-fields/notebooklm-mcp`](https://www.npmjs.com/package/@roomi-fields/notebooklm-mcp)

## Install

```bash
# Add the marketplace and install — npx handles the rest
/plugin marketplace add roomi-fields/claude-plugins
/plugin install notebooklm@roomi-fields
```

**Prerequisite**: Node.js ≥ 18. The plugin's `.mcp.json` runs `npx -y @roomi-fields/notebooklm-mcp`, which auto-downloads the package on first use.

## First-time auth

Once the plugin is enabled, ask Claude:

> Log me in to NotebookLM

Chrome will open. Sign in with the Google account that owns your notebooks. The session is cached, with auto-reauth on expiry.

For multi-account workflows or unattended deployments, see the [auth setup guide](https://github.com/roomi-fields/notebooklm-mcp/blob/main/deployment/docs/03-AUTH-SETUP.md).

## Capabilities

### Q&A with citations

- 5 citation formats: `none`, `inline`, `footnotes`, `json`, `expanded` (97% excerpt success rate)
- Multi-turn sessions with context preservation

### Studio content generation

| Type | Formats | Options |
|---|---|---|
| Audio Overview | Podcast-style | 80+ languages |
| Video | Brief, Explainer | 6 visual styles |
| Infographic | Horizontal, Vertical | Custom instructions |
| Report | Summary, Detailed | Custom instructions |
| Presentation | Overview, Detailed | Custom instructions |
| Data Table | Simple, Detailed | Custom instructions |

### Source management

Add: PDFs, URLs, Text, YouTube videos, Google Drive. List, search, and bulk-delete notebooks.

## Pairs with RTFM

`notebooklm-mcp` 1.6.0+ ships a `/batch-to-vault` endpoint that writes citation-backed answers as markdown + JSON sidecars (`nblm-answer-v1` schema). [RTFM](https://github.com/roomi-fields/rtfm) indexes these for offline queries — ideal for academic / SOTA workflows.

See the [RTFM × NotebookLM recipe](https://roomi-fields.github.io/rtfm/notebooklm-integration/).

## License

MIT.
