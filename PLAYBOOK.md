# MCP Project Playbook

> The reusable howto for shipping a high-quality, discoverable MCP server — server code, packaging, in-repo docs, web docs, communication, and growth.
> Distilled from building [`notebooklm-mcp`](https://github.com/roomi-fields/notebooklm-mcp) and [`rtfm`](https://github.com/roomi-fields/rtfm). Apply it to every new MCP under `roomi-fields`.

This document is opinionated on purpose. Each rule exists because skipping it cost a release or a bug. Where a rule has a scar, the scar is named.

---

## 0. Day-1 checklist (do these in order)

Before writing a single feature, get the skeleton right:

1. [ ] npm package published with `name`, `version`, **`mcpName`**, `bin`, `files`
2. [ ] `server.json` created + published to the **Official MCP Registry** via `mcp-publisher`
3. [ ] `.claude-plugin/plugin.json` with the **version-pinned** `npx` arg (see §2.3)
4. [ ] Web docs site (Docusaurus on GitHub Pages) with SEO metadata + JSON-LD
5. [ ] `README.md` keyword-rich, with a one-line install block at the top
6. [ ] `CHANGELOG.md` started, `Keep a Changelog` format
7. [ ] CI green: lint + typecheck + prettier + tests + version-sync gate
8. [ ] Listed in the `roomi-fields/claude-plugins` marketplace
9. [ ] Submitted to the manual-action directories (see §6)

Design the tool surface as a `namespace.action` **dot-notation tree** from the start (§1.8) — it's MCP best practice, registries score it, and renaming later forces a major version bump.

Channels that **did not** move the needle (measured via GitHub Traffic): LinkedIn, X/Twitter. Do not over-invest there for a developer tool. The engine is **MCP directories + Google SEO**.

---

## 1. MCP server — code quality & structure

### 1.1 Repo layout

Keep a predictable shape. `notebooklm-mcp` uses:

```
src/
  index.ts            # entrypoint + the tool dispatch switch
  tools/index.ts      # ToolHandlers class + buildToolDefinitions()
  config.ts           # all env/config in one place
  errors.ts           # typed errors, no bare throws
  <domain folders>/   # accounts/, auth/, content/, session/, startup/, ...
  utils/              # shared helpers
schemas/              # JSON Schemas you publish/version
docs/                 # maintainer-facing docs (architecture, registries, ...)
deployment/docs/      # user-facing docs (numbered: 01-INSTALL.md, ...)
website/              # Docusaurus site
scripts/              # build/release/ops scripts
.github/workflows/    # ci.yml, release.yml, deploy-docs.yml
```

Keep the repo root **clean**. Temp scripts, debug PNGs, `tmp-*.ps1`, `*.tar.gz` build artifacts do not belong in version control — `.gitignore` them or delete them. A cluttered root is the first thing a potential user (or auto-indexer) sees.

### 1.2 The 3-place tool wiring rule

An MCP tool is only reachable if it exists in **three** places. Miss one → silent "Unknown tool":

1. A definition in `buildToolDefinitions()`
2. A method on the `ToolHandlers` class
3. A `case` in the dispatch `switch` in `src/index.ts`

After any tool change, audit alignment — e.g. `comm` the three sets of names. Structural alignment is necessary but **not sufficient**.

### 1.3 Audit before exposing a handler

> **Scar:** in 1.7.4 two orphaned handlers (`create_notebook`, `delete_notebooks_from_nblm`) were wired up as MCP tools without reading their bodies. Both were broken. Cost two follow-up releases.

Before exposing any previously-unused handler as a tool: **read its implementation end to end** — selectors, `waitForURL`, post-action verification — or run it live. Wiring it up is not the same as it working.

### 1.4 Integration discipline (scraping / external APIs)

For anything that scrapes a UI or depends on an external service you don't control:

- **Never return a hardcoded placeholder as a fallback.** If a scrape can't extract the real value, return `''` / `null` and let the caller see the failure. A lie like `name: 'Notebook'` is worse than an empty string — it hides the breakage.
  > **Scar:** `list_notebooks_from_nblm` returned 21 notebooks all named `"Notebook"` for five releases because the selector broke silently behind a placeholder.
- **Prefer stable selector patterns.** ID-pattern selectors (`[id^="project-"][id$="-title"]`) survive UI rewrites; tag/aria-pattern selectors don't.
- **Detect errors from specific containers**, never by scanning whole-page text — real content triggers false positives.
- **Poll for a state change, don't sleep a fixed delay.**

### 1.5 Honest errors, honest status

- Typed errors in `errors.ts`, not bare `throw new Error(string)`.
- A tool that half-worked must say so. Don't report success on a timeout, don't swallow a failure into a generic message.
- If a verification step (URL check, count check) is the ground truth, trust it over cached/derived state.

### 1.6 Test before you ship — non-negotiable

> **Scar:** shipped `add_source` with a false-negative timeout because the count-detection was gated behind a stale `if (dialogVisible)` branch. Caught only by attaching the MCP to a live session and actually running it.

A tool is "done" when it has been **run**, not when it compiles. For browser/integration tools that means attaching the MCP to a real client session and exercising it. "Tests should pass" is not a test result.

### 1.7 CI gates (the `ci.yml` baseline)

Every MCP repo runs, on every push + PR, across Node 18/20/22:

- `eslint`
- `tsc --noEmit`
- `prettier --check`
- tests with coverage
- `type-coverage --at-least 95`

The release workflow adds a **version-sync gate** (§2.4). If any of these is red, nothing ships.

### 1.8 Tool contract: dot-notation names, annotations, output schema

Three things make the tool surface "evaluable at a glance" — by agents and by registry scorers:

- **Names are a `namespace.action` dot-notation tree** (`notebook.ask`, `source.add`, `session.list`), not a flat `snake_case` list. Keep namespaces balanced — avoid single-tool namespaces and avoid going past two levels.
- **Every tool has `annotations`** — accurate `readOnlyHint` / `destructiveHint` / `idempotentHint` / `openWorldHint` / `title`. From a central table, not scattered.
- **Every tool has an `outputSchema`** — and the dispatch returns `structuredContent` matching it, not just text. If all handlers share a result envelope (`{success, data?, error?}`), it's one shared schema.

> **Scar:** these were retrofitted in v2.0.0 to lift a registry quality score from 60 → 98. Doing them on day 1 is free; retrofitting is a major version bump.

**Renaming tools compatibly** (legacy flat → dot-notation tree):

- One **source of truth** for the mapping — a tiny `tool-names.ts` with `LEGACY_TO_CANONICAL` / `CANONICAL_TO_LEGACY` and *no heavy imports*, so both the server and the HTTP proxy can share it.
- `tools/list` advertises **only** the canonical names. The dispatch layer normalises *any* accepted name (canonical or legacy) back to the internal name before routing — the switch and handlers don't change.
- Legacy names keep working as **aliases** — existing scripts, IDE configs and batch jobs don't break. That backward-compatibility is what makes the major bump non-disruptive.

---

## 2. Packaging & distribution plumbing

### 2.1 npm package

`package.json` essentials:

- `name` — scoped (`@roomi-fields/<thing>`)
- **`mcpName`** — `io.github.roomi-fields/<thing>`. Required for the Official MCP Registry **and** for auto-indexers to pick you up. Missing this = invisible.
- `bin` — the executable(s)
- `files` — explicit allowlist. Ship `dist`, `README.md`, `LICENSE`, docs. Do **not** ship `scripts/archive/`, test logs, dev junk.
- `engines.node` — declare the floor (`>=18`)
- Build must `chmod 755` the `bin` entrypoints — npm tarballs otherwise preserve `644` and the CLI fails with "Permission denied" on some installs.

### 2.2 Official MCP Registry

npm publish does **not** propagate here. After a notable release, publish manually:

```bash
./mcp-publisher login github     # GitHub device flow
./mcp-publisher publish          # reads server.json + package.json mcpName
curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.roomi-fields/<thing>"
```

`server.json` holds the registry metadata; keep it in the repo root.

### 2.3 Claude Code plugin manifest — the npx pin gotcha

`.claude-plugin/plugin.json` declares the `mcpServers` block. The `npx` arg **must** carry the version pin:

```json
"args": ["-y", "@roomi-fields/<thing>@1.7.9"]
```

> **Scar:** without the `@<version>` pin, `/plugin marketplace update` does **not** upgrade the running server — npx reuses the `_npx/<hash>/` cache. Users sat on 1.7.2 for two releases thinking they'd updated.

The pin is load-bearing, not cosmetic. It must be bumped on every release (§2.4 automates this).

### 2.4 Version sync — one source, many mirrors

The version number is duplicated across several files and **will** drift if synced by hand:

- `package.json` — source of truth
- `.claude-plugin/plugin.json` — `version` **and** the npx pin in `mcpServers.args`
- `website/docusaurus.config.ts` — `softwareVersion` in the JSON-LD
- `README.md` — hero / latest-release mentions

Rules:

- A `scripts/sync-version.mjs` propagates from `package.json` to all mirrors. Run it after every bump.
- CI runs it in `--check` mode as a **release gate** — drift fails the publish.
- **Use regex replace on the target field, never `JSON.parse` + `JSON.stringify`.** Prettier and `JSON.stringify` disagree on array layout, producing phantom drift on every run.
  > **Scar:** the parse+stringify approach caused a CI failure on 1.7.1, forcing a 1.7.2 just for the fix.

### 2.5 The marketplace aggregator

`roomi-fields/claude-plugins` is a **pure aggregator** — `marketplace.json` only, no plugin code. Each plugin is `source: github` pointing at its own repo, so the upstream `plugin.json` stays the single source of truth. New versions are picked up by `/plugin marketplace update roomi-fields` + `/reload-plugins` with **no commit** in the aggregator.

> Note: there is **no** `/plugin update <name>` command. The flow is *marketplace update* then *reload-plugins*. Don't document the wrong command.

`description` / `keywords` / `homepage` in `marketplace.json` are shown in the Discover tab **before** the plugin is cloned — keep them accurate, they don't have to match upstream byte-for-byte.

### 2.6 Glama (and other auto-builders)

Glama auto-discovers and rebuilds a Docker image using **its own** Dockerfile (Debian + Node 24 + `pnpm`), not yours.

- Their builder is flaky — ECONNRESET while pulling the base image happens. Just retry from the admin UI.
- **pnpm/npm gap:** an `overrides` block in `package.json` is npm-only. pnpm reads `pnpm.overrides`. If you pin a transitive dep for a security fix, mirror it under `pnpm.overrides` or the auto-built image stays vulnerable.

### 2.7 Smithery (stdio servers — publish a bundle, by hand)

Smithery is a high-traffic registry, worth being on. For a **stdio** server the publish flow is fiddly and effectively undocumented — what actually works:

- **Publishing is CLI-only.** `smithery.ai/new` only accepts a hosted HTTPS URL or a GitHub repo. A stdio server ships as an MCPB bundle: `npx @smithery/cli mcp publish <bundle>.mcpb -n <namespace>/<name>`. The CLI needs **Node ≥ 20** (`globalThis.File`). Get the namespace from `smithery auth whoami` — don't assume it matches your GitHub org.
- **The bundle manifest must declare a `user_config` block** or publish fails with the opaque `400 "No values to set"`. One optional field (e.g. a data dir mapped to an env var) is enough.
- **Smithery never runs a stdio server**, so it never reads `tools/list` — the registry `tools` field stays `null` and the whole 40-point "Capability" score is zero. You must ship the full tool definitions *inside the bundle manifest*: `name`, `description`, `inputSchema`, `outputSchema`, `annotations` per tool.
  > **Scar:** the MCPB manifest schema only allows `{name, description}` in `tools` (`additionalProperties: false`), so `npx @anthropic-ai/mcpb pack` strips everything else — but Smithery's own parser *requires* the full objects for scoring. Resolution: hand-zip the bundle (`zip -X b.mcpb manifest.json icon.png`), don't `mcpb pack`.
- **Server metadata is separate from the bundle.** Description / homepage / icon do *not* come from the manifest — `PATCH /servers/{ns}%2F{name}` on `registry.smithery.ai` with a `Bearer` token from `smithery auth token --policy '{"namespaces":"<ns>"}'`.
- **Don't trust the read endpoints to verify.** `registry.smithery.ai` GETs are heavily cached and lag minutes behind a successful write — they show empty `description`/`tools` long after the data is live. Verify on the server's score page.
- **The score (100 total):** Metadata 35, Config UX 25, Capability 40. Capability is only reachable by shipping *real* schemas — add `outputSchema` + `annotations` to the actual server code (§1.8), don't fake them in the manifest. The last ~2 points ("Naming" — a "navigable tree") run on an opaque heuristic; dot-notation captures most of it, the remainder is a guess — **don't chase it with another rename**.

> This corrects the earlier "hosted installers can't run local tools → ~0/40, won't-fix" note: the hosted *install button* indeed stays dead for a local/stateful server, but the *quality score* is fully reachable (60 → 98 in practice) by shipping the schemas in the bundle yourself.

---

## 3. In-repo documentation

### 3.1 README anatomy

The README is the #1 viewed page (measured) and what crawlers index. Structure:

1. **One-line value prop** + badges
2. **Install block in the first screen** — the marketplace one-liner first, npm second
3. Keyword-rich prose — write the *verbs and nouns people actually type into Google* (e.g. "rest api", "n8n", "batch", "citations"), not internal jargon
4. Feature list, quick examples
5. Latest releases (synced — §2.4)
6. Links to the web docs

### 3.2 CHANGELOG discipline

- `Keep a Changelog` format, `## [x.y.z] - DATE` headings.
- The release workflow extracts the section between headings into the GitHub Release notes — so write it for humans.
- Every user-visible change gets a line. Security fixes get a line that names the advisory.

### 3.3 docs/ vs deployment/docs/

- `docs/` — **maintainer-facing**: architecture, registry tracking, migration studies. Not shipped to users' eyes.
- `deployment/docs/` — **user-facing**, numbered (`01-INSTALL.md` …). These are the source for the web docs (§4.2).
- `CONTRIBUTING.md` at root.

---

## 4. Web documentation (Docusaurus + GitHub Pages)

A real docs site — not just a README — is a measurable SEO driver (Google was the #3 referrer for `notebooklm-mcp`).

### 4.1 Setup & deploy

- Docusaurus under `website/`.
- `deploy-docs.yml` builds on push to `main` and deploys to the `gh-pages` branch.
- `onBrokenLinks: 'warn'` (not `throw`) so a stray link doesn't block a deploy — but check the warnings.

### 4.2 Doc sync

`website/scripts/sync-docs.mjs` copies `deployment/docs/*` into `website/docs/*`. Single source of truth lives in `deployment/docs/`; the website is a mirror. Don't hand-edit `website/docs/`.

### 4.3 SEO — the part that actually compounds

- `docusaurus.config.ts` → `headTags` with a **JSON-LD `SoftwareApplication`** block (name, description, OS, downloadUrl, `softwareVersion`, license, author, free `offers`).
- `themeConfig.metadata` → `keywords` + `description` + `robots: index, follow` + Open Graph + Twitter card.
- `sitemap` preset enabled.
- Keywords = real search terms across the ecosystem (clients, integrations, use cases), not feature names.

### 4.4 MDX gotcha

> **Scar:** MDX 3 (Docusaurus 3) parses `<https://...>` autolinks as JSX and fails the build. URLs ending in `/>` happen to survive; anything else breaks.

In any markdown that gets synced into the site, use `[text](url)` — never bare `<URL>` autolinks.

### 4.5 Published schemas

If the project defines a data contract (e.g. `nblm-answer-v1.json`), it lives in **multiple synced places** (repo `schemas/`, canonical host, embedded in a doc, referenced in code). List them explicitly somewhere and treat breaking changes as a **v2** — never mutate v1 in place.

---

## 5. Communication & positioning

### 5.1 Positioning beats promotion

`notebooklm-mcp` grew faster than a higher-starred competitor not from louder marketing but from a **wider positioning**: "REST API + MCP" addresses automation users (n8n / Zapier / Make / scripts), not just one IDE's plugin users. Decide the broadest honest framing of what the tool *is*, and write everything — README, docs, keywords — to that framing.

### 5.2 What channels work (evidence-based)

Measured from GitHub Traffic over a 14-day window:

| Channel | Verdict |
|---|---|
| MCP directories (mcpservers.org, cursor.directory, …) | **Primary driver.** Auto-indexed once you're discoverable. |
| Google organic | **Compounds.** Fed by the docs site + keywords. |
| Official MCP Registry | Real, modest. |
| ChatGPT / LLM recommendations | Small but high-intent. |
| LinkedIn / X | **Negligible** (~2 visits each). Don't over-invest. |

The takeaway: spend effort on **discoverability** (registries, SEO, directory submissions), not on social posts.

---

## 6. Growth & visibility

### 6.1 Directory submissions

Most directories auto-index once you're on npm/PyPI + the MCP Registry. Some claim to take manual submissions — but **verify the mechanism actually works before spending any effort on it.**

> **Scar:** the March distribution plan for `rtfm` listed five "high-value manual" channels. A 2026-05-14 live audit found exactly **one** was actually actionable. mcp.so is a comment in a megathread issue, no triage, no SLA. Cline Marketplace had 500+ untriaged `[Server Submission]` issues. `wong2/awesome-mcp-servers` no longer takes PRs (redirects to `mcpservers.org/submit`). `appcypher/awesome-mcp-servers` has the PR feature **disabled** (`gh api repos/.../pulls` → 404) despite its CONTRIBUTING.md still saying "make an individual pull request". Only `punkpeye/awesome-mcp-servers` was a real PR channel.

Tiers, honestly:

- **Auto-indexed — this is the engine.** Glama, mcpservers.org, PulseMCP, LobeHub. Fed by your GitHub repo + the MCP Registry; they re-scrape on activity. This is where listings actually come from — verify you appear, keep the source metadata fresh.
- **Manual, occasionally real.** `punkpeye/awesome-mcp-servers` (genuine PR review). Cursor Directory (no PR path — Supabase-backed, interactive GitHub/Google sign-in at `cursor.directory/plugins/new`, auto-detects the repo's `.mcp.json`). **Before drafting an entry, confirm the channel even accepts submissions:** `gh api repos/<owner>/<repo>/pulls` must not 404, and check actual PR/issue throughput — not the CONTRIBUTING.md, which lies.
- **Dead — don't re-chase.** Issue-megathread channels (mcp.so), untriaged-backlog marketplaces (Cline), repos with PRs disabled (appcypher).

The single highest-leverage action is keeping the **GitHub repo description + topics** accurate — every auto-indexer recopies it verbatim. A stale description (`rtfm` shipped "10 parsers" when it was 15) poisons every downstream directory at once; one `gh repo edit` fixes them all on the next re-scrape.

Track the **verified** state per repo in `docs/DISTRIBUTION.md` (or `MCP_DIRECTORIES.md`) — status, not aspiration. Re-audit before acting; March's plan was 80% stale by May.

#### Hosted-install directories (Glama / Smithery) and local tools

Glama's "Install Server" button and Smithery's hosted runner both want to **build and run** your server in their infra. That only works for **stateless** servers. A tool that needs local files (`rtfm` indexes the user's project) or interactive auth (`notebooklm-mcp` needs a browser + Google login) cannot do anything useful in a hosted container — the hosted *install button* stays dead. This part is **won't-fix, not a bug**: never build a Dockerfile or chase a hosted "release" to satisfy it for a local tool.

But the *listing* and its *quality score* are a different thing, and they are worth it — they carry real SEO weight. For Smithery specifically, a stdio server still gets a full, high-scoring page if you publish the bundle correctly and ship the tool schemas inside it yourself (§2.7) — `notebooklm-mcp` went 60 → 98 that way. Presence + a good score badge ≠ a working hosted install; pursue the former, skip the latter.

### 6.2 Monitoring cadence

- **Weekly:** GitHub Insights → Traffic (referrers = ground truth for what's working). Note: the API needs push access — you only see your own repos.
- **Weekly:** npm downloads (npm-stat.com) — the only objective usage metric, comparable across projects.
- **Monthly:** star history trend.
- Don't read clone counts as adoption — CI runners inflate them.

---

## 7. Release runbook

```
1. Edit package.json version
2. npm run version:sync          # propagate to all mirrors
3. Update CHANGELOG.md           # new ## [x.y.z] section
4. Update README latest-release  # (version:sync may cover this)
5. npm run build && test locally
6. git commit + push
7. git tag vX.Y.Z && git push --tags
        │
        └─► release.yml: version:check → build → npm publish → GitHub Release
8. (notable releases) ./mcp-publisher publish   # Official MCP Registry
9. Verify: npx -y @roomi-fields/<thing>@X.Y.Z from a clean cwd boots the new version
10. If a security fix touched transitive deps: confirm pnpm.overrides mirror exists (§2.6)
```

---

## 8. Anti-patterns — the short list

Every one of these shipped a bug or a bad release at least once:

- ❌ Wiring a tool in only 2 of the 3 required places → silent "Unknown tool"
- ❌ Exposing a handler without reading/running it first
- ❌ Hardcoded placeholder as a scrape fallback → silent data corruption
- ❌ Tag/aria selectors instead of ID-pattern selectors → breaks on every UI rewrite
- ❌ Reporting success on a timeout / swallowing failures
- ❌ "Tests should pass" without running them
- ❌ `npx` arg without the `@<version>` pin → updates silently don't update
- ❌ `JSON.parse`+`JSON.stringify` to rewrite a prettier-controlled file → phantom CI drift
- ❌ `npm` `overrides` without a `pnpm.overrides` mirror → auto-built images stay vulnerable
- ❌ Bare `<URL>` autolinks in synced markdown → MDX build failure
- ❌ Mutating a published schema in place instead of bumping to v2
- ❌ Dev junk (tmp scripts, debug PNGs, build tarballs) committed to the repo root
- ❌ Documenting `/plugin update` — it doesn't exist
- ❌ Over-investing in social posts for a developer tool
- ❌ Drafting a directory submission before verifying the channel accepts one — `gh api repos/X/pulls` → 404 means PRs are off, whatever CONTRIBUTING.md claims
- ❌ `gh pr create` / `OWNER:BRANCH` shorthand when the fork name ≠ the parent name → resolves to the wrong fork (or another fork in your account), fails with a misleading permission error. Use the GraphQL `createPullRequest` mutation with explicit `headRepositoryId` / `repositoryId`
- ❌ Letting the MCP Registry drift — it never auto-syncs from npm/PyPI; `rtfm` sat 5 versions behind for ~2 months. Re-publish on every notable release (§2.2)
- ❌ Building a Dockerfile or chasing a Glama/Smithery hosted-*install* "release" for a local or stateful server — it structurally can't work (§6.1). (The Smithery *score*, though, is reachable — §2.7.)
- ❌ Faking `outputSchema` / `annotations` in a distribution manifest instead of adding them to the server code — the manifest then lies about what the server exposes (§1.8)
- ❌ `mcpb pack` for a Smithery bundle that needs full per-tool schemas — it validates against the MCPB schema and strips everything past `{name, description}`. Hand-zip instead (§2.7)
- ❌ Trusting `registry.smithery.ai` GET endpoints to verify a publish — heavily cached, minutes-stale. Check the score page (§2.7)
- ❌ Chasing the opaque tail of a quality score (e.g. Smithery "Naming") with another tool rename right after a major release — churn for ~2 points on a heuristic you can't see. Stop at "excellent"
- ❌ Treating a green `npm audit` as permanent — the advisory DB updates; a clean audit goes red with zero code change. Re-pin transitive deps with targeted `overrides` (bit us between 1.7.9 and 2.0.0: `fast-uri`, `hono`)
- ❌ Assuming a GitHub token can open PRs anywhere — an enterprise/EMU token can comment on issues but is blocked from `CreatePullRequest` on external repos. There's no code workaround; open the PR from a personal account

---

*Maintained alongside the `roomi-fields/claude-plugins` marketplace. When a new scar is earned, add it here.*
