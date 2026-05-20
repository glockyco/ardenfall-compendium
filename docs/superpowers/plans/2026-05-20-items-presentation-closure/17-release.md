[← Previous phase](16-route-cutover.md) · [Coordinator](../2026-05-20-items-presentation-closure.md)

# Phase 17: SEO hygiene + final verification + release

**Spec coverage:** §8.3, §10.

**Why seventeenth (and last):** every feature ships in earlier phases. Phase 17 wraps the slice with SEO hygiene (JSON-LD per entity page, sitemap regeneration, canonical link tags, IndexNow ping), a fresh live-game export, a real release artifact, deploy, production smoke against every new entity type, and the roadmap closeout that marks the slice done.

**Outcome:** every public detail page carries a minimal JSON-LD block + canonical `<link rel="canonical">`; the sitemap includes every new entity URL; the production deploy serves the new release artifact with byte-exact composer parity against the captured goldens; the roadmap records the slice as done with snapshot id, Cloudflare deploy version, page count per entity type, and `_routes.json` rule count.

## Tasks

### Task 17.1: JSON-LD per entity page

**Files:**

- Create: `site/src/lib/components/seo/EntityJsonLd.svelte`
- Modify: every detail-page `+page.svelte` to include `<EntityJsonLd ... />`

```svelte
<!-- site/src/lib/components/seo/EntityJsonLd.svelte -->
<script lang="ts">
  let {
    name,
    description,
    image,
    url,
    entityKind = "Thing",
  }: {
    name: string;
    description: string | null;
    image: string | null;
    url: string;
    entityKind?: "Thing" | "Article" | "Product";
  } = $props();

  const ld = {
    "@context": "https://schema.org",
    "@type": entityKind,
    name,
    ...(description ? { description } : {}),
    ...(image ? { image } : {}),
    url,
    isPartOf: {
      "@type": "VideoGame",
      name: "Ardenfall",
      url: "https://ardenfall.compendiums.org/",
    },
  };
</script>

<svelte:head>
  <script type="application/ld+json">
{JSON.stringify(ld)}
  </script>
  <link rel="canonical" href={url} />
</svelte:head>
```

Wire into every detail page (item, status-effect, spell, enchantment, category, tag, stat, recipe). Each page passes its own `name`, `description`, `image`, `url`.

Per the librarian's research: no Google rich-result type exists for in-game items, so this is hygiene only — improves crawl quality + knowledge-panel signals.

- [ ] Run + commit: `feat(site): emit JSON-LD on entity pages`.

### Task 17.2: Sitemap regeneration

**Files:**

- Modify: `site/scripts/build-sitemap-manifest.mjs` (extend to include every new entity URL)

The existing sitemap script reads items + asset URLs from the SQLite artifact. Extend it to query `entity_nodes` and emit one `<url>` element per public node, with `<lastmod>` from the artifact's `createdAt`.

```js
// excerpt — replace the items-only query with a full entity_nodes scan
const rows = db
  .query(
    `SELECT entity_type, route_path FROM entity_nodes WHERE is_public = 1 ORDER BY entity_type, route_path`,
  )
  .all();
for (const row of rows) {
  urls.push({
    loc: `${origin}${row.route_path}`,
    lastmod: createdAt,
    changefreq: "weekly",
    priority: priorityFor(row.entity_type),
  });
}
```

`priorityFor` returns `1.0` for items, `0.8` for status-effects/spells/enchantments, `0.6` for categories/tags/stats/recipes.

Also emit `/_release.json` and the static overview pages (`/items`, `/spells`, …).

- [ ] Run + commit: `feat(site): include every entity in the sitemap`.

### Task 17.3: IndexNow ping for the new URL set

The existing `scripts/indexnow-ping.mjs` posts a URL list to IndexNow. Extend it to include every new entity URL on a release deploy.

- [ ] Run + commit: `feat(site): include new entities in IndexNow notification`.

### Task 17.4: Fresh live export

This is the same workflow the user followed for the Slice 4 release.

- [ ] **Step 1: Build runtime plugins**

```sh
dotnet build /Users/joaichberger/Projects/HotRepl/src/HotRepl.BepInEx/ --nologo -v q
dotnet build mod/ArdenfallCompendium.csproj -c Debug --nologo -v q
```

- [ ] **Step 2: Deploy plugins + capture token**

Same as `README.md` "HotRepl export smoke" recipe. After deploy, launch Ardenfall (via `cxstart --bottle Steam --no-wait steam://rungameid/1837770` on macOS / appropriate launcher elsewhere).

- [ ] **Step 3: Capture goldens before extraction**

The mod's new HotRepl command `compendium.captureGoldens` (Phase 10.3 + extensions in Phase 11/12) writes `fixtures/golden/<patch>/<entity-type>/<id>.json` for status-effects, spells, enchantments, and items. Invoke it once after the game reaches the title screen:

```sh
bun run controller:capture-goldens -- --url ws://127.0.0.1:18590 --token "$TOKEN" --patch 0.0.10.91-anchor --output ./fixtures/golden/0.0.10.91-anchor
```

(Add the `controller:capture-goldens` script + the CLI handler to the controller in this task if not done earlier; it invokes the HotRepl command and writes outputs.)

Review the captured goldens. Diff against the committed Phase-10/11/12 fixture goldens; if they mismatch (because the live game has more entities than the synthetic fixture), commit the new ones:

```sh
git add fixtures/golden/0.0.10.91-anchor/
git commit -m "test(pipeline): capture live goldens for 0.0.10.91"
```

- [ ] **Step 4: Run live extraction**

```sh
bun run controller:export -- --url ws://127.0.0.1:18590 --token "$TOKEN" --output ./snapshots --pipeline-out ./pipeline/dist
```

The extraction writes `snapshots/snapshots/<gameVersion>-<buildIdentifier>/`. Confirm it includes every new artifact (`stat-types.json`, `item-categories.json`, `item-tags.json`, `status-effects.json`, `spells.json`, `enchantments.json`, `potion-recipes.json`, `master-tooltip.json` v2, `effect-bindings-audit.json`).

- [ ] **Step 5: Run the composer's golden parity gate against the live data**

The golden tests run automatically as part of `bun test pipeline/test`. Confirm zero diffs.

### Task 17.5: Release artifact + deploy

- [ ] **Step 1: Build the release artifact**

```sh
bun run artifact:release snapshots/snapshots/<gameVersion>-<buildIdentifier>
```

Confirm:

- `pipeline/artifacts/releases/<artifactId>/artifact-manifest.json` includes counts for every new entity type (`statTypeOverviewRows`, `itemCategoryOverviewRows`, `itemTagOverviewRows`, `statusEffectOverviewRows`, `spellOverviewRows`, `enchantmentOverviewRows`, `potionRecipeOverviewRows`).
- `data.sqlite` contains the new canonical + read-model tables.
- `static/_redirects` carries the legacy GUID redirects.

- [ ] **Step 2: Deploy**

```sh
bun run --cwd site deploy:production ../pipeline/artifacts/releases/<artifactId>
```

- [ ] **Step 3: Post-deploy smoke**

```sh
bun run --cwd site smoke:production-release ../pipeline/artifacts/releases/<artifactId>/artifact-manifest.json
bun run --cwd site smoke:legacy-item-redirects
bun run --cwd site smoke:entity-pages
```

The third script is new — register `site/scripts/smoke-entity-pages.mjs` that fetches one representative URL per entity type from production and confirms 200 + entity name appears in the HTML body. Implementation:

```js
#!/usr/bin/env bun
import { readFileSync } from "node:fs";

const [origin = "https://ardenfall.compendiums.org"] = Bun.argv.slice(2);

const checks: { url: string; mustContain: string[] }[] = [
  { url: "/items", mustContain: ["Items"] },
  { url: "/status-effects", mustContain: ["Status effects"] },
  { url: "/spells", mustContain: ["Spells"] },
  { url: "/enchantments", mustContain: ["Enchantments"] },
  { url: "/categories", mustContain: ["Categories"] },
  { url: "/tags", mustContain: ["Tags"] },
  { url: "/stats", mustContain: ["Stats"] },
  { url: "/recipes", mustContain: ["Recipes"] },
];

let failures = 0;
for (const { url, mustContain } of checks) {
  const res = await fetch(`${origin}${url}`);
  if (!res.ok) {
    console.error(`expected 200 for ${url}, got ${res.status}`);
    failures++;
    continue;
  }
  const html = await res.text();
  for (const snippet of mustContain) {
    if (!html.includes(snippet)) {
      console.error(`${url} HTML missing ${JSON.stringify(snippet)}`);
      failures++;
    }
  }
}
if (failures > 0) process.exit(1);
process.stdout.write(`entity pages smoke passed against ${origin}\n`);
```

Register in `site/package.json`:

```json
"smoke:entity-pages": "bun run scripts/smoke-entity-pages.mjs"
```

- [ ] **Step 4: Commit any release-time fixes** (none expected; if a smoke fails, diagnose + patch + re-deploy).

### Task 17.6: Roadmap closeout

**Files:**

- Modify: `docs/superpowers/roadmap.md` (mark Slice 4.5 as `done`; record snapshot id + Cloudflare deploy version + per-entity counts)

- [ ] **Step 1: Add a Slice 4.5 entry under "Slices" with status `done`**

```markdown
### Slice 4.5 — Items deterministic presentation closure

**Status:** done
**Completed:** YYYY-MM-DD on `main`; implementation commits `<first>..<last>`, with production deployment completed as Cloudflare version `<version-id>` from release artifact `<artifactId>`.
**Spec:** `docs/superpowers/specs/2026-05-20-items-presentation-closure-design.md`
**Supporting documents:** `2026-05-20-item-asset-graph-audit.md`, `2026-05-20-compendium-architecture-survey.md`, `2026-05-20-items-presentation-closure-architecture-review.md`

**Delivered:** every item page reproduces the in-game details panel deterministically (modulo player-state-only surfaces) via seven new public entities (stat-type, item-category, item-tag, status-effect, spell, enchantment, potion-recipe), a pure-TypeScript port of the game's tooltip composer chain, a single canonical `entity_edges` table powering forward + reverse relationship sections, slug routes shaped as `<plural>/<kebab-slug>--<id8>` with legacy GUID redirects, golden-file parity tests, and minimal JSON-LD per detail page.

**Verification evidence:** full phase gate green on YYYY-MM-DD (`bun run codegen:validators`, `bun run check:fixtures`, `dotnet test mod-tests/ArdenfallCompendium.Tests.csproj`, `bun test pipeline/test`, `bun test tooling.test.ts`, `bun test controller/test`, `bun run typecheck`, `bun run --cwd site check`, `bun run --cwd site build:fixture`, `bun run --cwd site smoke:prerender`, `bun run --cwd site smoke:item-icons`, `bun run --cwd site smoke:legacy-item-redirects`, `bun run --cwd site smoke:entity-pages`, `bun run format:check`, `bun run lint`, `git diff --check`). Fresh live export published `snapshots/snapshots/<snapshotId>` with `counts.item = N`, `counts.status-effect = N`, `counts.spell = N`, `counts.enchantment = N`, `counts.item-category = N`, `counts.item-tag = N`, `counts.stat-type = N`, `counts.potion-recipe = N`. Release artifact `pipeline/artifacts/releases/<artifactId>` recorded Git commit `<commit>`, `dirty: false`, SQLite hash `<hash>`, `_routes.json` rule count <count> (≤ 100), and `_redirects` line count <count>. Production deploy command `bun run --cwd site deploy:production ../pipeline/artifacts/releases/<artifactId>` completed and smoke-verified `/items`, `/items/<sample-slug>`, `/status-effects/<sample-slug>`, `/spells/<sample-slug>`, `/enchantments/<sample-slug>`, `/recipes/<sample-slug>`, `/tags/<sample-slug>`, `/stats/<sample-slug>`, `/categories/<sample-slug>`, a sampled legacy GUID URL returning 301, and the probe WebP asset against the same manifest.

Slice 11 (spells) is folded into this slice (the spell entity ships here). Slice 10 (search) and Slice 5 (locations) remain as planned.
```

- [ ] **Step 2: Update the open-questions tracker if any decisions changed**

- [ ] **Step 3: Remove the plan files from the working tree**

Per the roadmap convention ("completed plans are removed from the working tree once the roadmap/specs capture the outcome; git history is the archive"):

```sh
git rm -r docs/superpowers/plans/2026-05-20-items-presentation-closure/
git rm docs/superpowers/plans/2026-05-20-items-presentation-closure.md
```

The spec + audit + survey + architecture-review files stay in `docs/superpowers/specs/` — those are durable, not plans.

- [ ] **Step 4: Commit + push**

```sh
git add docs/superpowers/roadmap.md
git commit -m "docs(site): close slice 4.5 release"
git push origin main
```

### Task 17.7: Phase 17 verification gate

- [ ] Full phase gate green.
- [ ] Production smoke green.
- [ ] Roadmap closeout committed + pushed.
- [ ] Plan files removed from the working tree.
- [ ] Coordinator phase index row 17 status updated to ✅, then the coordinator file itself is removed in Task 17.6 step 3.

---

## Final acceptance criteria from spec §10

Verify every item below before declaring done:

1. ✅ Every public item page is feature-complete with respect to the in-game `ItemInfoListUI` chain, modulo strictly player-dependent surfaces.
2. ✅ Every new entity has a prerendered detail page with composed rich-text content.
3. ✅ Reverse relationship sections render on every detail page.
4. ✅ Icon tints are visible.
5. ✅ Legacy GUID routes 301 to the canonical slug route.
6. ✅ Golden-file parity tests pass for the anchor patch.
7. ✅ `auditEntityGraph` emits zero `relationshipMissingTarget` diagnostics.
8. ✅ `auditEntityGraph` emits zero `unresolvedEffectVariable` diagnostics.
9. ✅ Production site smoke passes against the new release artifact.
10. ✅ Roadmap closeout records the snapshot id, Cloudflare deploy version, per-entity counts, composer parity diff (empty), and `_routes.json` rule count.

---

[← Previous phase](16-route-cutover.md) · [Coordinator](../2026-05-20-items-presentation-closure.md)
