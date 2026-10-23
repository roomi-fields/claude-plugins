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
4. [ ] Web docs site (Docusaurus on GitHub Pages) **on its own subdomain** — a `github.io`
       subpath makes `robots.txt` and `llms.txt` unreachable, whatever they contain (§8.1)
5. [ ] SEO metadata + a site-wide JSON-LD `@graph` + **per-page** structured data (§8.3)
6. [ ] `README.md` keyword-rich, with a one-line install block at the top
7. [ ] `CHANGELOG.md` started, `Keep a Changelog` format
8. [ ] CI green: lint + typecheck + prettier + tests + version-sync gate + **a facts guard**
       on every countable claim (§8.5)
9. [ ] Listed in the `roomi-fields/claude-plugins` marketplace
10. [ ] Submitted to the manual-action directories (see §6)

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

- One **source of truth** for the mapping — a tiny `tool-names.ts` with `LEGACY_TO_CANONICAL` / `CANONICAL_TO_LEGACY` and _no heavy imports_, so both the server and the HTTP proxy can share it.
- `tools/list` advertises **only** the canonical names. The dispatch layer normalises _any_ accepted name (canonical or legacy) back to the internal name before routing — the switch and handlers don't change.
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

> Note: there is **no** `/plugin update <name>` command. The flow is _marketplace update_ then _reload-plugins_. Don't document the wrong command.

`description` / `keywords` / `homepage` in `marketplace.json` are shown in the Discover tab **before** the plugin is cloned — keep them accurate, they don't have to match upstream byte-for-byte.

### 2.6 Glama (and other auto-builders)

Glama auto-discovers and rebuilds a Docker image using **its own** Dockerfile (Debian + Node 24 + `pnpm`), not yours.

- Their builder is flaky — ECONNRESET while pulling the base image happens. Just retry from the admin UI.
- **pnpm/npm gap:** an `overrides` block in `package.json` is npm-only. pnpm reads `pnpm.overrides`. If you pin a transitive dep for a security fix, mirror it under `pnpm.overrides` or the auto-built image stays vulnerable.

### 2.7 Smithery (stdio servers — publish a bundle, by hand)

Smithery is a high-traffic registry, worth being on. For a **stdio** server the publish flow is fiddly and effectively undocumented — what actually works:

- **Publishing is CLI-only.** `smithery.ai/new` only accepts a hosted HTTPS URL or a GitHub repo. A stdio server ships as an MCPB bundle: `npx @smithery/cli mcp publish <bundle>.mcpb -n <namespace>/<name>`. The CLI needs **Node ≥ 20** (`globalThis.File`). Get the namespace from `smithery auth whoami` — don't assume it matches your GitHub org.
- **The bundle manifest must declare a `user_config` block** or publish fails with the opaque `400 "No values to set"`. One optional field (e.g. a data dir mapped to an env var) is enough.
- **Smithery never runs a stdio server**, so it never reads `tools/list` — the registry `tools` field stays `null` and the whole 40-point "Capability" score is zero. You must ship the full tool definitions _inside the bundle manifest_: `name`, `description`, `inputSchema`, `outputSchema`, `annotations` per tool.
  > **Scar:** the MCPB manifest schema only allows `{name, description}` in `tools` (`additionalProperties: false`), so `npx @anthropic-ai/mcpb pack` strips everything else — but Smithery's own parser _requires_ the full objects for scoring. Resolution: hand-zip the bundle (`zip -X b.mcpb manifest.json icon.png`), don't `mcpb pack`.
- **Server metadata is separate from the bundle.** Description / homepage / icon do _not_ come from the manifest — `PATCH /servers/{ns}%2F{name}` on `registry.smithery.ai` with a `Bearer` token from `smithery auth token --policy '{"namespaces":"<ns>"}'`.
- **Don't trust the read endpoints to verify.** `registry.smithery.ai` GETs are heavily cached and lag minutes behind a successful write — they show empty `description`/`tools` long after the data is live. Verify on the server's score page.
- **The score (100 total):** Metadata 35, Config UX 25, Capability 40. Capability is only reachable by shipping _real_ schemas — add `outputSchema` + `annotations` to the actual server code (§1.8), don't fake them in the manifest. The last ~2 points ("Naming" — a "navigable tree") run on an opaque heuristic; dot-notation captures most of it, the remainder is a guess — **don't chase it with another rename**.

> This corrects the earlier "hosted installers can't run local tools → ~0/40, won't-fix" note: the hosted _install button_ indeed stays dead for a local/stateful server, but the _quality score_ is fully reachable (60 → 98 in practice) by shipping the schemas in the bundle yourself.

---

## 3. In-repo documentation

### 3.1 README anatomy

The README is the #1 viewed page (measured) and what crawlers index. Structure:

1. **One-line value prop** + badges
2. **Install block in the first screen** — the marketplace one-liner first, npm second
3. Keyword-rich prose — write the _verbs and nouns people actually type into Google_ (e.g. "rest api", "n8n", "batch", "citations"), not internal jargon
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

> Everything below is the baseline. **§8 is the chapter that matters** for being found and
> quoted by answer engines — and it starts by explaining why a site on a `github.io` subpath
> cannot be made discoverable at all.

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

`notebooklm-mcp` grew faster than a higher-starred competitor not from louder marketing but from a **wider positioning**: "REST API + MCP" addresses automation users (n8n / Zapier / Make / scripts), not just one IDE's plugin users. Decide the broadest honest framing of what the tool _is_, and write everything — README, docs, keywords — to that framing.

### 5.2 What channels work (evidence-based)

Measured from GitHub Traffic over a 14-day window:

| Channel                                               | Verdict                                                    |
| ----------------------------------------------------- | ---------------------------------------------------------- |
| MCP directories (mcpservers.org, cursor.directory, …) | **Primary driver.** Auto-indexed once you're discoverable. |
| Google organic                                        | **Compounds.** Fed by the docs site + keywords.            |
| Official MCP Registry                                 | Real, modest.                                              |
| ChatGPT / LLM recommendations                         | Small but high-intent.                                     |
| LinkedIn / X                                          | **Negligible** (~2 visits each). Don't over-invest.        |

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

#### Anthropic plugin directory (Claude Code) — separate from the MCP registries

This is a **different channel** from everything above: it lists Claude Code _plugins_, not MCP servers. Two repos, very different rules:

- **`claude-plugins-official`** — curated by Anthropic, **no application process**, inclusion at their discretion. Can't be chased.
- **`claude-plugins-community`** (installs as `@claude-community`) — open submissions. This is the real target.

How it actually works (verified 2026-06-28):

- **Submit via in-app form, never a PR.** PRs against the repo are auto-closed; the catalog syncs nightly from Anthropic's internal pipeline. Individual authors: `platform.claude.com/plugins/submit` (Console). Team/Enterprise orgs with directory access: `claude.ai/admin-settings/directory/submissions/plugins/new`.
- **One submission = one plugin repo** (each needs `.claude-plugin/plugin.json`). My 5 plugins live in separate repos, so each is submitted individually. The `roomi-fields` marketplace.json stays an independent parallel channel — it does not migrate.
- **Gate = `claude plugin validate` + automated safety screening.** The pipeline runs the same `validate` you can run locally. Run `claude plugin validate <repo> --strict` on every plugin _before_ submitting.
- Approved plugins are pinned to a commit SHA; CI bumps the pin as you push. Delay between approval and appearing in `marketplace.json` (nightly sync). Check the [community catalog](https://github.com/anthropics/claude-plugins-community/blob/main/.claude-plugin/marketplace.json) for your name.

> **Scar (2026-06-28):** strict-validate caught real blockers before submission. `paper-trail` **failed plain validate** — two command `description:` values had unescaped `: ` (colon-space) → broken YAML frontmatter, commands loading with empty metadata. Fix: quote the value. `rtfm` tripped a strict warning for a dev-context `CLAUDE.md` at the plugin root (dead in plugin context); moved it to `.claude/CLAUDE.md` (still auto-loaded as project memory, validator stops flagging it). Lesson: `--strict` on day 1 is free; a rejected submission is not.

> **Safety screening is a product decision, not a bug.** `paper-trail` name-dropped Sci-Hub / Anna's Archive in its public pitch (functionality is opt-in, default-off). Softened the _public-facing_ surfaces only (plugin.json description, README tagline, MARKETPLACE_ENTRY) to neutral "optional extended sources, disabled by default" — kept the code, the opt-in env var, and full DISCLAIMER/LEGAL disclosure intact. Softening the description ≠ evading the scan (it reads the code too); the goal is accurate, non-promotional framing, not concealment.

#### Hosted-install directories (Glama / Smithery) and local tools

Glama's "Install Server" button and Smithery's hosted runner both want to **build and run** your server in their infra. That only works for **stateless** servers. A tool that needs local files (`rtfm` indexes the user's project) or interactive auth (`notebooklm-mcp` needs a browser + Google login) cannot do anything useful in a hosted container — the hosted _install button_ stays dead. This part is **won't-fix, not a bug**: never build a Dockerfile or chase a hosted "release" to satisfy it for a local tool.

But the _listing_ and its _quality score_ are a different thing, and they are worth it — they carry real SEO weight. For Smithery specifically, a stdio server still gets a full, high-scoring page if you publish the bundle correctly and ship the tool schemas inside it yourself (§2.7) — `notebooklm-mcp` went 60 → 98 that way. Presence + a good score badge ≠ a working hosted install; pursue the former, skip the latter.

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

## 8. Being found — by humans and by machines

> Everything above gets a project _listed_. This chapter is about being _found and quoted_,
> which is a different problem now that a large share of discovery runs through answer
> engines rather than through a search results page. Distilled from taking
> `notebooklm-mcp` from a C to a B on an external audit (59.8 → 80.6) in one day, 2026-10-18.

An AI answer engine needs four things from you, in this order. Each one is useless without
the one before it.

1. **Reach your files at all** (§8.1 — the domain)
2. **Know who publishes this** (§8.2 — identity)
3. **Know what each page is about** (§8.3 — structured data)
4. **Find a page that answers the question someone actually typed** (§8.4 — content)

### 8.1 The domain — the mistake that silently cancels the rest

> **Scar (2026-10-18):** `notebooklm-mcp` shipped a careful `robots.txt` and a careful
> `llms.txt`. Both returned 200. Both were **never read by anything**, for five months.
> They sat at `roomi-fields.github.io/notebooklm-mcp/robots.txt`, and **`robots.txt` is only
> ever fetched at the domain root**. On a project subpath it is a file nobody requests.
> The same is true of `llms.txt`. An external audit scored us 0/30 and 0/10 on them; the
> audit's _reason_ was wrong (it claimed the files were missing) but its _verdict_ was right.

**Rule: a docs site on a shared `github.io` subpath cannot be made discoverable.** Move to a
subdomain before writing a single line of crawler metadata.

The move, end to end:

1. Pick the subdomain for **entity consistency** (§8.2), not for convenience.
2. `website/static/CNAME` containing the bare hostname.
3. DNS: a **CNAME** record to `<owner>.github.io`. _Not_ an A record to GitHub's IPs — those
   change, and an A record also blocks the certificate renewal path.
4. `gh api repos/<owner>/<repo>/pages -X PUT -f cname=<host>`
5. Watch the certificate state go `authorized` → `approved`, then
   `-f https_enforced=true`. Enforcing before approval breaks the site.
6. Update `url` / `baseUrl` in `docusaurus.config.ts` — `baseUrl` becomes `/`.
7. Verify the old URLs 301 to the new ones **with their paths preserved**, then update every
   absolute link you control: README badges, npm `homepage`, `server.json`, the schema host,
   the plugin manifest.

Verify the DNS yourself at the authoritative server _and_ at a public resolver before
declaring it done — a delegation that works from your box can be broken for everyone else.

### 8.2 Identity — one name, everywhere

Answer engines resolve a project to an **entity**. An entity scattered across four different
names is four weak entities instead of one strong one. Keep the same visible name across:

- the npm scope / PyPI owner
- the GitHub org
- the docs domain
- the `Organization` node in your structured data (§8.3)
- the author field in every manifest

> This is why `notebooklm-mcp` went to `notebooklm.roomi-fields.com` rather than a prettier
> unrelated domain: the org, the npm scope, the schema host and the docs now all say
> `roomi-fields`. A product-flavoured subdomain on an unrelated apex would have read as a
> different publisher.

Also publish the **dates**. A page with no `datePublished` / `dateModified` is a page an
engine cannot rank for freshness.

> **Scar:** `showLastUpdateTime` rendered nothing, with a green build. The website's `docs/`
> are generated _and gitignored_, so git had no history for them to read. Fix: carry the
> **source** file's last commit date through the sync script, and set `fetch-depth: 0` in the
> deploy workflow (the default shallow clone has no history to read either).

### 8.3 Structured data — per page, not just site-wide

Most projects emit one JSON-LD block describing _the project_ and repeat it on every page.
An engine reading the troubleshooting page then learns nothing about troubleshooting.

What `notebooklm-mcp` ships:

- **A site-wide `@graph`** in `headTags`: `Organization`, `WebSite`, `SoftwareApplication`,
  each with a stable `@id`.
- **A per-page node**, generated by the doc-sync script from the page's own content and
  written to its own JSON file. Type chosen per page: `HowTo` for a procedure (with real
  steps), `FAQPage` for a troubleshooting page (with real question/answer pairs),
  `TechArticle` otherwise.
- **A theme wrapper** (`src/theme/DocItem/Layout`) that looks the page up and emits it.

Three traps, each of which cost a silent failure:

> **Scar — data through frontmatter.** A JSON string carried through YAML frontmatter into
> MDX arrives **corrupted** (`Expected ',' or '}' … at position 624`). Data must travel in its
> own file, not through the document header.

> **Scar — the id mismatch.** Docusaurus strips the `NN-` numeric prefix when it builds a
> document id. Our lookup key kept it, so _every_ page missed its own schema — green build,
> no output, no warning.

> **Scar — two competing nodes.** The first blog wrapper emitted a second full `BlogPosting`
> alongside the one Docusaurus already emits. Emit a **merge fragment** instead: a node
> carrying only the shared `@id` plus the fields you are adding (`publisher`, `isPartOf`,
> `about`). Nodes merge by `@id`; duplicates compete.

**Then add a guard that fails the build** when a page carries no structured data, and break it
once on purpose to prove it bites. `website/scripts/check-schemas.mjs` is the reference
implementation (it names its exemptions explicitly rather than skipping quietly).

#### robots.txt for answer engines

Being crawled by model-training and answer bots is the _point_ for public documentation, but
**several of them default to staying out when unlisted**. Name them one by one, and state the
signal explicitly:

```
User-agent: *
Content-Signal: search=yes, ai-input=yes, ai-train=yes
Allow: /
```

followed by an explicit `Allow` block per named agent (OAI-SearchBot, ChatGPT-User,
PerplexityBot, Perplexity-User, ClaudeBot, Claude-User, Google-Extended, GPTBot, CCBot, …),
and the sitemap URL **at the new domain**.

#### llms.txt

One file at the domain root, written for a model, not for a crawler: what the project is, who
publishes it, the install one-liner, the registry ids, the counts that matter, and a linked
index of the docs and the blog. Keep its numbers under the facts guard (§8.5) — a stale
`llms.txt` is worse than none, because it is the file an engine quotes verbatim.

### 8.4 Content — research the question before writing the answer

A blog on a docs site is not content marketing; it is **surface for questions that the
reference docs do not phrase**. Nobody searches for your feature names. They search for
"does NotebookLM have an API", "notebooklm rate limit", "run notebooklm from n8n".

Method:

1. **Research the real queries first**, before choosing a single title. Across the ecosystem —
   competitors' issue trackers are the best source of real phrasing.
2. One post per question, titled as the question.
3. Answer it honestly, including when the answer is "no, and here is what to do instead".
4. Link the post from `llms.txt` and let the sitemap pick it up.

> **The research is worth more than the posts.** Keyword research for nine posts turned up two
> _false claims in our own product_: a "50 queries/day" quota that Google had replaced two
> months earlier — present in four documents **and in the error message the server hands an
> agent**, so an agent planning a batch run was planning against an invented number — and the
> widespread "there is no NotebookLM API" folklore, which had stopped being true. Both were
> corrected against primary sources. Budget the research step for that, not for the titles.

> **Scar — prettier eats the truncation marker.** In a `.md` file, prettier rewrites
> `{/* truncate */}` into `{/_ truncate _/}`, _after_ a passing local build, and every post
> silently loses its excerpt. The `.mdx` extension selects prettier's MDX parser, which leaves
> it alone. Name blog posts `.mdx`. (MDX 3 also rejects `<!-- -->` HTML comments outright.)

### 8.5 Keep the countable claims honest, mechanically

Numbers in prose drift, and an answer engine will quote the stale one back at a user.

> **Scar:** we advertised "33 endpoints" in six places while shipping 45. The `llms.txt`
> written specifically for answer engines was six releases out of date.

The fix is a script, not discipline:

- **One module derives every countable claim from the code** (`scripts/lib/facts.mjs`:
  endpoints by parsing the route table, tools by parsing the definitions, the Node floor from
  `package.json`). Deriving the same number twice is how it drifts.
- **One syncer rewrites the number inside each phrase**, never the phrase itself, across the
  README, `llms.txt`, the REST reference, the comparison table and the skill.
- **The same script checks coverage**: every declared route must appear in the reference _and_
  in the OpenAPI spec. A new endpoint nobody documents fails the build.
- **It runs in CI with `--check`.**
- Where a claim lives in _another_ repo (a standalone skill, a marketplace entry), fetch and
  check it too.

Add a wiring guard with the same reflex: a test that fails when a tool is advertised without a
dispatch case (§1.2), instead of a manual diff you will forget.

### 8.6 Measuring it, without lying to yourself

- **Downloads are the usage signal; stars are a bookmark.** The ratio of weekly downloads to
  lifetime stars separates the two. Observed 2026-10-23: `teng-lin/notebooklm-py` ≈ 1.9×,
  ours ≈ 5×, a stalled competitor ≈ 0.35×. A high ratio means people install rather than
  bookmark; a collapsing one means a viral moment that stopped converting. Caveat before
  celebrating: downloads are a weekly _flow_ against a lifetime _stock_, so a young package
  reads high mechanically, and registries are not comparable to each other (PyPI carries far
  more mirror traffic than npm).
- **Discount release days.** A publish triggers mirrors, CI and registry re-scrapes: our
  release day was 809 downloads against a 40–140 baseline. Quoting the week that contains it
  as if it were demand is self-deception.
- **npm's last few days read 0** until consolidated — not a collapse.
- **Share-of-competitor is the honest comparative**, and say which way it moved: ours went 18%
  → 41% of a rival's volume in two months, almost entirely because _he_ stopped shipping.
- An external page audit (positionia.com and friends) measures **page mechanics, not
  citations** — it will not tell you whether an engine quotes you. Read its findings, verify
  each one yourself, and discard the ones that are wrong: ours scored two of our files 0 by
  probing the wrong path. It was still worth running — the verdict was right even though the
  reason was not.

### 8.7 The meta-lesson

Four of this chapter's scars share one shape: **a green build and an absent result.**
Corrupted data through frontmatter, a mismatched lookup key, a reformatted truncation marker,
a missing git history. None of them failed loudly.

So: whenever the output can be _missing_ rather than _wrong_, add a guard that asserts its
presence — and **break the guard once on purpose** before you trust it.

### 8.8 Propagation — a release lands in six places, and you control four

Publishing is automated per project; **noticing that one channel did not follow is not**.
`scripts/check-propagation.mjs` in this repo reports, per project, the version visible on:

| Channel                        | Ours?  | If it lags                                                    |
| ------------------------------ | ------ | ------------------------------------------------------------- |
| npm / PyPI                     | yes    | the release job failed — fix now                              |
| Official MCP Registry          | yes    | the registry step never ran; it **never** auto-syncs from npm |
| GitHub release                 | yes    | the tag exists but the release did not publish                |
| Plugin manifest version pin    | yes    | updates silently do not reach users (§2.3)                    |
| MCP Toplist / Glama / PulseMCP | **no** | they re-scrape on their own schedule — wait, don't chase      |

Run it after a release, or on a schedule. Three design rules learned by getting each of them
wrong on the first run — a check that cries wolf is a check nobody reads:

- **A release tagged minutes ago is not drift.** Inside a 45-minute grace window the script
  says "still catching up". Our first run flagged a publish that was literally in progress.
- **A manifest that launches a bundled binary has nothing to pin.** Only `npx` / `uvx` /
  `pipx` manifests are subject to the cache trap; flagging the others is a false alarm.
- **A third-party directory being behind is reported, never failed on.** `--strict` exits
  non-zero only for channels we control.

> **Scar — the checker's own bug.** The first version reported "no answer from MCP Registry"
> for all three projects and read a two-year-old version off a directory page. Both were
> mine: the registry rejects a percent-encoded slash in its `search` parameter, and the
> directory's version list is not ordered the way it looks. A monitoring script states facts
> about other systems; verify its output by hand before believing a single one of them.

---

## 9. Anti-patterns — the short list

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
- ❌ Building a Dockerfile or chasing a Glama/Smithery hosted-_install_ "release" for a local or stateful server — it structurally can't work (§6.1). (The Smithery _score_, though, is reachable — §2.7.)
- ❌ Faking `outputSchema` / `annotations` in a distribution manifest instead of adding them to the server code — the manifest then lies about what the server exposes (§1.8)
- ❌ `mcpb pack` for a Smithery bundle that needs full per-tool schemas — it validates against the MCPB schema and strips everything past `{name, description}`. Hand-zip instead (§2.7)
- ❌ Trusting `registry.smithery.ai` GET endpoints to verify a publish — heavily cached, minutes-stale. Check the score page (§2.7)
- ❌ Chasing the opaque tail of a quality score (e.g. Smithery "Naming") with another tool rename right after a major release — churn for ~2 points on a heuristic you can't see. Stop at "excellent"
- ❌ Treating a green `npm audit` as permanent — the advisory DB updates; a clean audit goes red with zero code change. Re-pin transitive deps with targeted `overrides` (bit us between 1.7.9 and 2.0.0: `fast-uri`, `hono`)
- ❌ A docs site on a `github.io` subpath with a `robots.txt` or `llms.txt` in it — the files return 200 and are never requested (§8.1)
- ❌ One site-wide JSON-LD block repeated on every page, so no page says what _it_ is about (§8.3)
- ❌ Carrying JSON through YAML frontmatter into MDX — it arrives corrupted (§8.3)
- ❌ A second `BlogPosting`/`Article` node alongside the one the framework already emits — merge by `@id` instead (§8.3)
- ❌ A `.md` blog post with `{/* truncate */}` — prettier rewrites it and the excerpt vanishes; use `.mdx` (§8.4)
- ❌ A countable claim written by hand in more than one file — derive it from the code and check it in CI (§8.5)
- ❌ Quoting the week that contains a release day as if it were demand (§8.6)
- ❌ Trusting a guard you have never seen fail (§8.7)
- ❌ Assuming a GitHub token can open PRs anywhere — an enterprise/EMU token can comment on issues but is blocked from `CreatePullRequest` on external repos. There's no code workaround; open the PR from a personal account

---

## 10. Appendix — applying §8 to `osc-bridge` (audited 2026-10-23)

The chapter above was written from `notebooklm-mcp`. Here is what a live audit of
`osc-bridge` / SynthHub found, as a worked example of reading §8 against a real project.
**Re-verify before acting** — this snapshot ages.

**Already done, and done well** — do not redo:

- Own subdomain (`synthhub.roomi-fields.com`), so `robots.txt` and `llms.txt` are actually
  reachable (§8.1).
- `robots.txt` carries `Content-Signal` and names the answer-engine agents one by one.
- A substantial `llms.txt`: what it is, who publishes it, install, registry ids, the hosted
  endpoint, the trust model.
- A sitemap with ~1 000 URLs, blog included; a blog already exists.
- Community scaffolding most projects lack: issue templates (including a _new device
  request_), three PR templates, a CLA workflow. For a community project this is the part
  that converts a visitor into a contributor — it is ahead of `notebooklm-mcp` here.

**Three gaps, in order of cost:**

1. **The same count is stated three different ways** — GitHub description says **849**
   devices, the npm description says **963**, the README and `llms.txt` say **964**. Every
   auto-indexer recopies the GitHub description verbatim (§6.1), so the lowest and oldest
   number is the one most directories are showing. There is no facts guard in the repo.
   → Derive the count from the driver files and sync it everywhere (§8.5). One number, one
   source, checked in CI.
2. **`/blog` without a trailing slash 301s to `http://synthhub.roomi-fields.com:8080/blog/`**
   — port 8080, downgraded to http, and it times out. A crawler or a human following that
   link gets nothing. The site uses `trailingSlash: true`, so the no-slash form is the one
   outsiders will type. → Fix the `url` in the Docusaurus config (something is injecting the
   dev port), then re-verify both forms.
3. **One JSON-LD block, site-wide** — the project is described, the individual pages are not.
   With ~1 000 pages, most of them per-device, this is the single largest untapped surface in
   the whole `roomi-fields` estate: each device page could carry its own node naming the
   device, its vendor and its parameters. → §8.3, plus the build-time guard.

**Where this project is not like `notebooklm-mcp`:** the goal is a _community_, not just
installs. §8.4's research step should therefore mine what synth owners actually ask
("minilab 3 sysex", "control ableton from claude", "bitwig osc api") **and** what would make
someone contribute a driver — the contribution path is the product here, so it deserves the
same keyword treatment as the features.

---

_Maintained alongside the `roomi-fields/claude-plugins` marketplace. When a new scar is earned, add it here._
