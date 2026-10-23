#!/usr/bin/env node
/**
 * Does the version we shipped actually show up everywhere it should?
 *
 * A release lands in five or six places that nobody updates by hand any more —
 * the package registry, the Official MCP Registry, the GitHub release, the
 * plugin manifest's npx pin — plus the directories that re-scrape us. Each one
 * can lag or fail on its own, silently, and the only way anyone notices today
 * is by browsing a directory page and spotting a five-month-old version number.
 *
 * This reports drift across every channel we publish to, per project. It
 * cannot push to third parties: a directory re-scrapes on its own schedule.
 * What it can do is tell us, the morning after a release, which channel did
 * not follow — the difference between "we are behind" and "they are behind"
 * being exactly what you need before deciding whether to act.
 *
 * Usage:
 *   node scripts/check-propagation.mjs            # human table
 *   node scripts/check-propagation.mjs --json     # machine-readable
 *   node scripts/check-propagation.mjs --strict   # exit 1 on any OUR-SIDE drift
 *
 * Exit 1 under --strict means a channel we control is behind. A third-party
 * directory lagging is reported but never fails the run — we do not control it.
 */

const JSON_OUT = process.argv.includes("--json");
const STRICT = process.argv.includes("--strict");

/** Everything published under the roomi-fields umbrella that has an MCP server. */
const PROJECTS = [
  {
    name: "notebooklm-mcp",
    repo: "roomi-fields/notebooklm-mcp",
    registryName: "io.github.roomi-fields/notebooklm-mcp",
    pkg: { type: "npm", id: "@roomi-fields/notebooklm-mcp" },
  },
  {
    name: "osc-bridge",
    repo: "roomi-fields/osc-bridge",
    registryName: "io.github.roomi-fields/osc-bridge",
    pkg: { type: "npm", id: "@roomi-fields/osc-bridge" },
  },
  {
    name: "rtfm",
    repo: "roomi-fields/rtfm",
    registryName: "io.github.roomi-fields/rtfm",
    pkg: { type: "pypi", id: "rtfm-ai" },
  },
];

const UA = { "User-Agent": "roomi-fields-propagation-check" };

/** Fetch JSON, returning null rather than throwing — one dead channel must not hide the rest. */
async function json(url, { timeoutMs = 20000, tries = 3 } = {}) {
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    const abort = AbortSignal.timeout(timeoutMs);
    try {
      const res = await fetch(url, { headers: UA, signal: abort });
      if (!res.ok) continue;
      return await res.json();
    } catch {
      // network hiccup or malformed body — retry, then give up quietly
    }
  }
  return null;
}

async function text(url, opts) {
  const abort = AbortSignal.timeout(opts?.timeoutMs ?? 20000);
  try {
    const res = await fetch(url, { headers: UA, signal: abort });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

/** The version the package registry serves as current. */
async function packageVersion({ type, id }) {
  if (type === "npm") {
    const d = await json(
      `https://registry.npmjs.org/${encodeURIComponent(id).replace("%40", "@")}`,
    );
    return d?.["dist-tags"]?.latest ?? null;
  }
  const d = await json(`https://pypi.org/pypi/${id}/json`);
  return d?.info?.version ?? null;
}

/**
 * The version the Official MCP Registry marks as latest.
 *
 * `version=latest` matters: the unfiltered search returns one page of *every*
 * version ever published, so reading the last row of it reports a version from
 * months ago and invents a drift that does not exist.
 */
async function registryVersion(registryName) {
  // The slash in `io.github.owner/name` must stay literal: percent-encoding it
  // makes the endpoint answer with something that is not JSON at all, which
  // reads here as "the registry did not answer" — a drift that never existed.
  const url =
    `https://registry.modelcontextprotocol.io/v0/servers` +
    `?search=${registryName}&version=latest&limit=50`;
  const find = (d) => {
    const hit = (d?.servers ?? []).find(
      (e) => (e.server ?? e).name === registryName,
    );
    return hit ? ((hit.server ?? hit).version ?? null) : null;
  };
  const direct = find(await json(url));
  if (direct) return direct;
  // The qualified search answers intermittently. The bare name is a wider
  // query that the same endpoint serves reliably, so it is the fallback
  // rather than reporting a channel as silent when it is not.
  const bare = registryName.split("/").pop();
  return find(
    await json(
      `https://registry.modelcontextprotocol.io/v0/servers?search=${bare}&version=latest&limit=100`,
    ),
  );
}

/**
 * The newest non-draft GitHub release, with how long ago it was cut.
 *
 * The age matters: for the first half-hour after a tag, the package registry
 * legitimately has not caught up yet. Reporting that as drift would make the
 * check cry wolf on exactly the day somebody shipped.
 */
const PUBLISH_GRACE_MIN = 45;

async function latestRelease(repo) {
  const d = await json(`https://api.github.com/repos/${repo}/releases/latest`);
  if (!d?.tag_name) return { version: null, ageMin: null };
  const ageMin = d.published_at
    ? Math.round((Date.now() - Date.parse(d.published_at)) / 60000)
    : null;
  return { version: d.tag_name.replace(/^v/, ""), ageMin };
}

/** The version MCP Toplist is showing, and when it last synced us. */
async function toplist(registryName) {
  const page = await text(
    `https://mcptoplist.com/server/${encodeURIComponent(registryName)}`,
    { timeoutMs: 30000 },
  );
  if (!page) return { version: null, updated: null };
  const updated =
    /most recently updated on ([A-Z][a-z]{2} \d{1,2}, \d{4})/.exec(page)?.[1] ??
    null;
  // Their history block is not reliably ordered and the phrase "Version
  // history" appears more than once, so anchoring on it returned the *oldest*
  // version. Take the highest version anywhere on the page instead.
  const seen = [...page.matchAll(/\b(\d+)\.(\d+)\.(\d+)\b/g)].map((m) =>
    m.slice(1).map(Number),
  );
  if (!seen.length) return { version: null, updated };
  seen.sort((a, b) => b[0] - a[0] || b[1] - a[1] || b[2] - a[2]);
  return { version: seen[0].join("."), updated };
}

/**
 * The version pin inside a plugin manifest — the one that silently blocks
 * upgrades when stale, because npx and uvx both reuse their cache otherwise.
 *
 * Returns `null` when the project ships no manifest (nothing to check), and
 * the string `unpinned` only when a manifest exists and carries no version.
 */
async function pluginPin(repo, pkg) {
  const raw = await text(
    `https://raw.githubusercontent.com/${repo}/HEAD/.claude-plugin/plugin.json`,
  );
  if (!raw) return null;
  // A manifest that launches a bundled binary has no package spec and so
  // nothing to pin — the npx cache trap simply does not apply to it. Calling
  // that "unpinned" is a false alarm, and a false alarm in a daily check is
  // how the daily check stops being read.
  if (!/\b(npx|uvx|pipx)\b/.test(raw)) return "n/a";
  const spec =
    pkg.type === "npm"
      ? new RegExp(`${pkg.id.replace("/", "\\/")}@(\\d+\\.\\d+\\.\\d+)`)
      : new RegExp(`${pkg.id}[@=]=?(\\d+\\.\\d+\\.\\d+)`);
  return spec.exec(raw)?.[1] ?? "unpinned";
}

async function audit(project) {
  const [pkg, registry, release, top, pin] = await Promise.all([
    packageVersion(project.pkg),
    registryVersion(project.registryName),
    latestRelease(project.repo),
    toplist(project.registryName),
    pluginPin(project.repo, project.pkg),
  ]);

  const reference = pkg; // the package registry is what users actually install
  const ours = [
    { channel: "MCP Registry", value: registry },
    { channel: "GitHub release", value: release.version },
    // A manifest with no pin is its own bug: npx then reuses its cache and the
    // update never reaches the user, which is not the same as a stale pin.
    // `null` = no manifest at all, which is not a drift; `unpinned` is its own
    // finding, reported separately below.
    {
      channel: "plugin version pin",
      value: pin && pin !== "unpinned" && pin !== "n/a" ? pin : null,
    },
  ];

  const publishing =
    release.ageMin !== null && release.ageMin < PUBLISH_GRACE_MIN;
  const behind =
    reference && !publishing
      ? ours
          .filter((c) => c.value && c.value !== reference)
          .map((c) => c.channel)
      : [];
  const missing = ours
    .filter(
      (c) =>
        !c.value &&
        !(
          c.channel === "plugin version pin" &&
          (pin === null || pin === "n/a")
        ),
    )
    .map((c) => c.channel);
  const directoryBehind = top.version && reference && top.version !== reference;

  return {
    project: project.name,
    published: reference,
    registry,
    release: release.version,
    releaseAgeMin: release.ageMin,
    publishing,
    pin,
    toplist: top,
    behind,
    missing,
    directoryBehind,
  };
}

const results = [];
for (const p of PROJECTS) results.push(await audit(p));

if (JSON_OUT) {
  console.log(JSON.stringify(results, null, 2));
} else {
  const col = (v) => String(v ?? "—").padEnd(12);
  console.log(
    "project         published    registry     release      npx pin      toplist",
  );
  console.log("─".repeat(84));
  for (const r of results) {
    console.log(
      `${r.project.padEnd(15)} ${col(r.published)} ${col(r.registry)} ${col(r.release)} ` +
        `${col(r.pin)} ${col(r.toplist.version)}${r.publishing ? " (publication en cours)" : ""}`,
    );
  }
  console.log();
  for (const r of results) {
    if (r.publishing) {
      console.log(
        `· ${r.project}: ${r.release} was tagged ${r.releaseAgeMin} min ago — ` +
          `channels are still catching up, not drifting`,
      );
    }
    if (r.behind.length)
      console.log(`✗ ${r.project}: behind on ${r.behind.join(", ")}`);
    if (r.missing.length)
      console.log(`? ${r.project}: no answer from ${r.missing.join(", ")}`);
    if (r.pin === "unpinned") {
      console.log(
        `✗ ${r.project}: plugin manifest has no version pin — updates will not apply`,
      );
    }
    if (r.pin === null || r.pin === "n/a") {
      console.log(
        `· ${r.project}: nothing to pin (no manifest, or it runs a bundled binary)`,
      );
    }
    if (r.directoryBehind) {
      console.log(
        `· ${r.project}: MCP Toplist shows ${r.toplist.version} (synced ${r.toplist.updated}) ` +
          `— theirs to refresh, not ours`,
      );
    }
  }
  const clean = results.every((r) => !r.behind.length && r.pin !== "unpinned");
  if (clean) console.log("✓ every channel we control is in step");
}

const ourDrift = results.some((r) => r.behind.length || r.pin === "unpinned");
if (STRICT && ourDrift) process.exit(1);
