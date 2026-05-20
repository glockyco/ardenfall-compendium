[← Previous phase](15-graph-rebuild.md) · [Next phase →](17-release.md) · [Coordinator](../2026-05-20-items-presentation-closure.md)

# Phase 16: Item route cutover + legacy redirects

**Spec coverage:** §8.2.

**Why sixteenth:** every new entity already ships at `<plural>/<kebab-slug>--<id8>` (Phases 4–13). Items are still at `/items/<32hex-guid>` from Slice 1, and Phase 15 already wired the `entity_redirects` machinery + Cloudflare `_redirects` emitter (Phase 2). Phase 16 flips items over: regenerate item slugs in the canonical shape, populate `entity_redirects` with one row per legacy GUID URL, swap the SvelteKit `/items/[id]` route to `/items/[slug]`, and verify that every previously-indexed item URL 301s to its new canonical route.

**Outcome:** every `entity_nodes` row for items has `route_path = /items/<slug>--<id8>` and `canonical_slug = <slug>--<id8>`; `entity_redirects` has one `legacy-id` row per item; the SvelteKit `/items/[slug]/+page.server.ts` resolves via `getItemPresentation(slug)`; the Cloudflare `_redirects` file emits a static 301 for every legacy GUID URL; a smoke test against a sample of 50 production item GUIDs returns 301 + correct `Location`.

## Tasks

### Task 16.1: Populate `entity_redirects` for items

**Files:**

- Modify: `pipeline/src/stages/build-graph.ts` (or add a follow-on `populate-redirects` stage if cleaner — read the existing structure first)
- Test: `pipeline/test/redirects.test.ts`

After Phase 15 has populated `entity_nodes` with the new canonical item slug, emit one `entity_redirects` row per legacy GUID:

```ts
function emitLegacyItemRedirects(db: Database): number {
  const rows = db
    .query<
      { entity_id: string; route_path: string },
      []
    >(`SELECT entity_id, route_path FROM entity_nodes WHERE entity_type = 'item' AND is_public = 1`)
    .all();
  const insert = db.prepare(
    `INSERT OR REPLACE INTO entity_redirects (source_type, source_id, target_type, target_id, reason)
     VALUES ('item-route', ?, 'item', ?, 'legacy-id')`,
  );
  let count = 0;
  for (const row of rows) {
    const legacyPath = `/items/${row.entity_id}`;
    if (legacyPath === row.route_path) continue;
    insert.run(legacyPath, row.entity_id);
    count++;
  }
  return count;
}
```

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Implement + commit**

```sh
git add pipeline/src/stages/build-graph.ts pipeline/test/redirects.test.ts
git commit -m "feat(pipeline): emit legacy item redirects"
```

### Task 16.2: SvelteKit route swap

**Files:**

- Move: `site/src/routes/items/[id]/` → `site/src/routes/items/[slug]/`
- Modify: the route's `+page.server.ts` to resolve via `parseSlugParam(params.slug)` + `getEntityNodeBySlug("item", params.slug)`
- Create: `site/src/routes/items/[id]/+page.ts` (or a hook) handling legacy GUID requests at build time

Because the existing Slice 4 path is `[id]`, moving it to `[slug]` is a clean rename. SvelteKit treats both as a single-segment param — the only thing that changes is how we resolve internally.

The route resolution:

```ts
// site/src/routes/items/[slug]/+page.server.ts
import { error, redirect } from "@sveltejs/kit";
import {
  getEntityNodeBySlug,
  getEntityNodeByShortId,
  getItemPresentation,
  listItemIds,
} from "$lib/server/read-models";
import { parseSlugParam } from "$lib/server/route-slug";
import type { EntryGenerator, PageServerLoad } from "./$types";

export const prerender = true;

export const entries: EntryGenerator = () =>
  listItemIds().map((row) => ({ slug: row.canonicalSlug }));

export const load: PageServerLoad = ({ params }) => {
  const parsed = parseSlugParam(params.slug);
  // First try the canonical slug.
  let node = getEntityNodeBySlug("item", params.slug);
  if (!node && parsed.hasShortId) {
    // Slug missing or stale; redirect by id8 to the current canonical.
    node = getEntityNodeByShortId("item", parsed.shortId!);
    if (node) {
      throw redirect(301, node.routePath);
    }
  }
  if (!node) throw error(404, "Item not found");
  const presentation = getItemPresentation(node.entityId);
  if (!presentation) throw error(404, "Item presentation not found");
  return {
    presentation,
    relationships: listRelationshipSections("item", node.entityId),
  };
};
```

`listItemIds()` is updated to return `{ entityId, canonicalSlug }` so `entries()` produces the new shape.

The fallback `getEntityNodeByShortId` makes the route resilient to slug renames within the same patch — id8 stays stable, but the slug part can change if an item was renamed at the source (rare, but the redirect machinery is the right place to handle it).

Legacy GUID requests (`/items/<32hex>.11400000`) are NOT handled by SvelteKit — they're served by the Cloudflare `_redirects` file. Phase 16.3 confirms.

- [ ] **Step 1: Rename the directory**

```sh
git mv site/src/routes/items/\[id\] site/src/routes/items/\[slug\]
```

- [ ] **Step 2: Update `+page.server.ts`** as above.

- [ ] **Step 3: Update `+page.svelte` if it references `params.id`**. Most components consume `data.presentation` directly so the rename is contained.

- [ ] **Step 4: Update `listItemIds`** in `read-models.ts` to return `{ entityId, canonicalSlug }`.

- [ ] **Step 5: Update site smokes** that reference `/items/<id>` in their assertions. The `smoke:item-icons` smoke today reads a specific id; switch to a slug.

- [ ] **Step 6: Run + commit**

Run: `bun run --cwd site check && NODE_OPTIONS=--max-old-space-size=8192 bun run --cwd site build:fixture && bun run --cwd site smoke:prerender`

```sh
git add site/src/routes/items/ site/src/lib/server/read-models.ts site/scripts/
git commit -m "feat(site): cut items over to canonical slug routes"
```

### Task 16.3: Cloudflare `_redirects` file emission (production)

The Phase 2 emitter already writes `_redirects` from `entity_redirects`. Phase 16 confirms the production path:

- [ ] **Step 1: Audit `_redirects` content**

After running `bun run artifact:fixture synthetic fixtures/synthetic/snapshot && bun run --cwd site build:fixture`, inspect `.svelte-kit/cloudflare/_redirects`. Confirm:

- One line per legacy item GUID → canonical slug, format `<source> <target> 301`.
- File is ≤ 2,100 lines (Cloudflare Pages static-redirect cap; with 1,273 items + room for future entity redirects, comfortable).
- Wildcards are NOT used here — every legacy URL gets an explicit redirect because each maps to a different canonical.

- [ ] **Step 2: Production smoke for redirects**

Create `site/scripts/smoke-legacy-item-redirects.mjs`:

```ts
#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { join } from "node:path";

const [origin = "https://ardenfall.compendiums.org"] = Bun.argv.slice(2);
const release = JSON.parse(readFileSync("static/_release.json", "utf8"));
const sampleSize = 50;
const ids = release.probes.items.slice(0, sampleSize).map((p) => p.id);

let failures = 0;
for (const id of ids) {
  const res = await fetch(`${origin}/items/${id}`, { redirect: "manual" });
  if (res.status !== 301) {
    console.error(`expected 301 for /items/${id}, got ${res.status}`);
    failures++;
    continue;
  }
  const location = res.headers.get("location");
  if (!location || !location.startsWith("/items/")) {
    console.error(`bad Location header for /items/${id}: ${location}`);
    failures++;
  }
}
if (failures > 0) {
  console.error(`${failures}/${ids.length} legacy GUID URLs failed the 301 smoke`);
  process.exit(1);
}
process.stdout.write(
  `legacy item redirect smoke passed for ${ids.length} URLs against ${origin}\n`,
);
```

Register the smoke in `site/package.json`:

```json
"smoke:legacy-item-redirects": "bun run scripts/smoke-legacy-item-redirects.mjs"
```

- [ ] **Step 3: Run + commit**

```sh
git add site/scripts/smoke-legacy-item-redirects.mjs site/package.json
git commit -m "test(site): smoke legacy item redirects"
```

### Task 16.4: `_routes.json` audit

**Files:**

- Modify: `site/svelte.config.js` (or wherever `_routes.json` is configured)

Per the spec and the librarian's research, `_routes.json` has a hard cap of 100 include+exclude rules combined. Audit the current configuration:

- [ ] **Step 1: Inspect the current `_routes.json`**

Read `.svelte-kit/cloudflare/_routes.json` after a build. Count include + exclude entries.

- [ ] **Step 2: Ensure plural-wildcards only**

The slice ships these new prerendered route patterns:

- `/items/*`
- `/items/variant/*`
- `/status-effects/*`
- `/spells/*`
- `/enchantments/*`
- `/categories/*`
- `/tags/*`
- `/stats/*`
- `/recipes/*`
- `/terms/*` (existing)
- `/assets/*` (existing)
- `/_release.json` (existing)

Plus the implicit `/` (overview / root pages). All as `exclude` wildcards so static assets short-circuit the Worker.

Total count: ~14 entries. Well under the 100 cap.

If the SvelteKit adapter generates `_routes.json` automatically with one entry per page, override it via `adapter-cloudflare`'s `routes: { include, exclude }` option in `svelte.config.js`.

- [ ] **Step 3: Run + commit**

```sh
git add site/svelte.config.js
git commit -m "feat(site): pin _routes.json to plural wildcards"
```

### Task 16.5: Phase 16 verification gate

- [ ] Run the standard phase gate.
- [ ] Visit `/items/iron-sword--<id8>` and confirm 200 + content matches.
- [ ] Visit `/items/<legacy-32hex>.11400000` and confirm 301 (use `curl -I` against the built artifact served locally).
- [ ] Visit `/items/iron-sword--ABC12345` (uppercase hex) — should 301 to the lowercase canonical or 404 (your call; document the choice).
- [ ] `_routes.json` rule count ≤ 100.
- [ ] Update coordinator phase index row 16 status to ✅.

---

[← Previous phase](15-graph-rebuild.md) · [Next phase →](17-release.md) · [Coordinator](../2026-05-20-items-presentation-closure.md)
