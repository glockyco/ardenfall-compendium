---
title: "Site Prerender Static Assets Implementation Plan"
type: plan
status: implemented
created: 2026-05-15
parent:
superseded_by:
archived: 2026-06-25
---

# Site Prerender Static Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert Ardenfall Compendium's generated pages from a client-rendered SQLite SPA into static prerendered SvelteKit HTML served by Cloudflare Workers Static Assets before Worker execution.

**Architecture:** Generated `pipeline/dist/{data.sqlite,assets/*.webp}` still syncs into `site/static` before build, but route data is read at build time from `site/static/data.sqlite` through a server-only SQLite reader. Root page options default to SSR + prerender + no CSR; item overview/detail routes become `+page.server.ts` loads, and `[id]` exports `entries()` so every item detail page is emitted as static HTML.

**Tech Stack:** SvelteKit 2 page options, `@sveltejs/adapter-cloudflare`, Cloudflare Workers Static Assets, Bun, `better-sqlite3` for build-time SQLite reads, existing generated SQLite read models and WebP asset bundle.

---

## Source-grounded constraints

- SvelteKit page options documentation says `ssr = false` renders an empty shell and is not the right mode for static generation; prerendered routes are generated at build time and dynamic routes need `entries()` when the crawler cannot infer every parameter.
- SvelteKit `adapter-cloudflare` remains the right adapter: it emits a Worker plus static asset bundle for Workers Static Assets. The objective is not deleting the Worker; it is making normal page and asset traffic resolve as matching static assets before Worker execution.
- Cloudflare Workers Static Assets documentation says matching files under `[assets].directory` are served without invoking Worker code by default. Keep `run_worker_first` unset/false.
- Ancient Kingdoms is a useful precedent, but not the source of truth. Ardenfall should copy the static-assets-first shape, not AK-specific data loaders, query names, route inventory, or interactive choices.
- Current Ardenfall item pages do not require browser-only behavior. Client sorting/filtering is deferred to Slice 10 unless a future route explicitly opts into CSR with a documented reason.

## Files and responsibilities

- `site/package.json` — add build-only SQLite dependency and prerender smoke script.
- `site/src/lib/server/read-models.ts` — server-only read-model accessor over `site/static/data.sqlite`; no imports from browser store.
- `site/src/routes/+layout.ts` — global page options: SSR, prerender, no CSR by default.
- `site/src/routes/items/+page.ts` → `site/src/routes/items/+page.server.ts` — item overview build-time load.
- `site/src/routes/items/[id]/+page.ts` → `site/src/routes/items/[id]/+page.server.ts` — item detail build-time load plus `entries()`.
- `site/src/lib/components/EntityTable.svelte` — static table markup only; no client state or event handlers.
- `site/scripts/smoke-prerender-output.mjs` — post-build assertions for static HTML output and no SPA shell regression.
- `tooling.test.ts` — repository-level guardrails for static prerender architecture.
- `site/AGENTS.md`, `README.md`, `site/wrangler.toml` — document that most routes must be prerendered/static-assets-first and that Worker use is exceptional.

---

### Task 1: Add static prerender guardrail tests

**Files:**

- Modify: `tooling.test.ts`
- Modify: `site/package.json`

- [ ] **Step 1: Write failing tooling tests for the target architecture**

Add these imports near the existing file reads in `tooling.test.ts`:

```ts
const siteLayout = readFileSync("site/src/routes/+layout.ts", "utf8");
const siteSvelteConfig = readFileSync("site/svelte.config.js", "utf8");
const siteWranglerConfig = readFileSync("site/wrangler.toml", "utf8");
```

Add this `describe` block after `describe("site deployment tooling", ...)`:

```ts
describe("site prerender architecture", () => {
  it("defaults routes to static prerendered SSR without client hydration", () => {
    expect(siteLayout).toContain("export const ssr = true");
    expect(siteLayout).toContain("export const prerender = true");
    expect(siteLayout).toContain("export const csr = false");
    expect(siteLayout).not.toContain("ssr = false");
    expect(siteLayout).not.toContain("prerender = false");
  });

  it("keeps Cloudflare static assets ahead of Worker execution", () => {
    expect(siteSvelteConfig).toContain("adapter({})");
    expect(siteWranglerConfig).toContain('directory = ".svelte-kit/cloudflare"');
    expect(siteWranglerConfig).toContain('binding = "ASSETS"');
    expect(siteWranglerConfig).not.toContain("run_worker_first = true");
  });

  it("has a prerender smoke script wired into the site package", () => {
    expect(sitePackageJson.scripts["smoke:prerender"]).toBe(
      "bun run scripts/smoke-prerender-output.mjs",
    );
  });
});
```

Update `site/package.json` scripts in the same step:

```json
{
  "scripts": {
    "smoke:prerender": "bun run scripts/smoke-prerender-output.mjs"
  }
}
```

Do not remove existing scripts.

- [ ] **Step 2: Run tests to verify the guardrails fail**

Run:

```sh
bun test tooling.test.ts
```

Expected: fail because `+layout.ts` still exports `ssr = false`/`prerender = false`, `site/package.json` has no `smoke:prerender`, and `site/svelte.config.js` currently calls `adapter()` rather than `adapter({})`.

- [ ] **Step 3: Add the build-time SQLite dependency**

Run:

```sh
bun add --cwd site -d better-sqlite3 @types/better-sqlite3
```

Rationale: `better-sqlite3` is only used by SvelteKit server/build-time load modules. Prerendered item routes are excluded from the deployed Worker manifest; do not import this dependency from client code or non-prerendered runtime routes.

- [ ] **Step 4: Commit the failing guardrails and dependency pin**

Run:

```sh
git add tooling.test.ts site/package.json bun.lock
git commit -m "test(site): guard static prerender architecture"
```

---

### Task 2: Add server-only SQLite read models

**Files:**

- Create: `site/src/lib/server/read-models.ts`
- Test: `tooling.test.ts`

- [ ] **Step 1: Add a failing import-boundary test**

Extend the `site prerender architecture` block in `tooling.test.ts`:

```ts
it("keeps generated SQLite reads server-only", () => {
  expect(existsSync("site/src/lib/server/read-models.ts")).toBe(true);
  const readModels = readFileSync("site/src/lib/server/read-models.ts", "utf8");
  expect(readModels).toContain("better-sqlite3");
  expect(readModels).toContain("static/data.sqlite");
  expect(readModels).not.toContain("$app/environment");
  expect(readModels).not.toContain("@sqlite.org/sqlite-wasm");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```sh
bun test tooling.test.ts
```

Expected: fail because `site/src/lib/server/read-models.ts` does not exist.

- [ ] **Step 3: Create the server read-model module**

Create `site/src/lib/server/read-models.ts`:

```ts
import Database from "better-sqlite3";
import { fileURLToPath } from "node:url";

const DB_PATH = fileURLToPath(new URL("../../../static/data.sqlite", import.meta.url));

let db: Database.Database | null = null;

const assetSrc = (hash: string | null): string | null => (hash ? `/assets/${hash}.webp` : null);

function getDb(): Database.Database {
  db ??= new Database(DB_PATH, { readonly: true, fileMustExist: true });
  return db;
}

function all<T>(sql: string, params: Database.BindParameters = []): T[] {
  return getDb().prepare(sql).all(params) as T[];
}

function get<T>(sql: string, params: Database.BindParameters = []): T | undefined {
  return getDb().prepare(sql).get(params) as T | undefined;
}

export interface SiteEntity {
  entity_id: string;
  singular_label: string;
  plural_label: string;
  route_path: string;
  canonical_table: string;
}

export interface SiteOverviewColumn {
  entity_id: string;
  column_id: string;
  field_id: string;
  position: number;
  renderer: "text" | "itemNameWithIcon";
  sortable: number;
}

export interface SiteDetailSection {
  entity_id: string;
  section_id: string;
  kind: "fieldList" | "custom";
  title: string;
  position: number;
  renderer_key: string | null;
  payload_schema_version: number;
  payload_json: string | null;
}

export interface SiteDetailSectionField {
  entity_id: string;
  section_id: string;
  field_id: string;
  position: number;
}

export interface SiteEntityField {
  entity_id: string;
  field_id: string;
  source_table: string;
  source_column: string;
  label: string;
  value_kind: string;
  formatter: string | null;
  null_policy: string;
  link_target: string | null;
}

interface ItemOverviewRecord {
  id: string;
  name: string | null;
  weight: number | null;
  value: number | null;
  variant: string | null;
  display_icon_hash: string | null;
  display_icon_color: string | null;
}

interface ItemDetailRecord {
  id: string;
  name: string | null;
  variant: string | null;
  display_icon_hash: string | null;
  display_icon_color: string | null;
  fields_json: string;
}

export interface ItemOverviewRow {
  id: string;
  name: string | null;
  weight: number | null;
  value: number | null;
  variant: string | null;
  displayIconSrc: string | null;
  displayIconColor: string | null;
}

export interface ItemDetailRow {
  id: string;
  name: string | null;
  variant: string | null;
  displayIconSrc: string | null;
  displayIconColor: string | null;
  fields_json: string;
}

export const getEntity = (id: string): SiteEntity | undefined =>
  get<SiteEntity>("SELECT * FROM site_entities WHERE entity_id = ?", [id]);

export const listOverviewColumns = (id: string): SiteOverviewColumn[] =>
  all<SiteOverviewColumn>(
    "SELECT * FROM site_overview_columns WHERE entity_id = ? ORDER BY position",
    [id],
  );

export const listDetailSections = (id: string): SiteDetailSection[] =>
  all<SiteDetailSection>(
    "SELECT * FROM site_detail_sections WHERE entity_id = ? ORDER BY position",
    [id],
  );

export const listSectionFields = (entityId: string, sectionId: string): SiteDetailSectionField[] =>
  all<SiteDetailSectionField>(
    "SELECT * FROM site_detail_section_fields WHERE entity_id = ? AND section_id = ? ORDER BY position",
    [entityId, sectionId],
  );

export const getEntityField = (entityId: string, fieldId: string): SiteEntityField | undefined =>
  get<SiteEntityField>("SELECT * FROM site_entity_fields WHERE entity_id = ? AND field_id = ?", [
    entityId,
    fieldId,
  ]);

export const listItemsOverview = (): ItemOverviewRow[] =>
  all<ItemOverviewRecord>("SELECT * FROM item_overview_rows ORDER BY name").map((row) => ({
    id: row.id,
    name: row.name,
    weight: row.weight,
    value: row.value,
    variant: row.variant,
    displayIconSrc: assetSrc(row.display_icon_hash),
    displayIconColor: row.display_icon_color,
  }));

export const listItemIds = (): string[] =>
  all<{ id: string }>("SELECT id FROM item_detail_rows ORDER BY id").map((row) => row.id);

export const getItemDetail = (id: string): ItemDetailRow | undefined => {
  const row = get<ItemDetailRecord>("SELECT * FROM item_detail_rows WHERE id = ?", [id]);
  if (!row) return undefined;
  return {
    id: row.id,
    name: row.name,
    variant: row.variant,
    displayIconSrc: assetSrc(row.display_icon_hash),
    displayIconColor: row.display_icon_color,
    fields_json: row.fields_json,
  };
};
```

- [ ] **Step 4: Run tests and typecheck**

Run:

```sh
bun test tooling.test.ts
bun run typecheck
```

Expected: `tooling.test.ts` still fails on route options until Task 3; typecheck may fail until route imports move to the server module in Task 3. Fix only syntax/type errors in `read-models.ts`, not the route architecture yet.

- [ ] **Step 5: Commit the server read-model module**

Run:

```sh
git add tooling.test.ts site/src/lib/server/read-models.ts
git commit -m "feat(site): add prerender read models"
```

---

### Task 3: Convert routes to SSR prerender loads

**Files:**

- Modify: `site/svelte.config.js`
- Modify: `site/wrangler.toml`
- Modify: `site/src/routes/+layout.ts`
- Rename: `site/src/routes/items/+page.ts` → `site/src/routes/items/+page.server.ts`
- Rename: `site/src/routes/items/[id]/+page.ts` → `site/src/routes/items/[id]/+page.server.ts`
- Modify: `site/src/routes/items/+page.server.ts`
- Modify: `site/src/routes/items/[id]/+page.server.ts`

- [ ] **Step 1: Run the guardrail test before changing routes**

Run:

```sh
bun test tooling.test.ts
```

Expected: fail on `site prerender architecture` because the layout still disables SSR/prerender and the smoke script is not yet present.

- [ ] **Step 2: Update SvelteKit and Cloudflare comments/configuration**

Replace `site/svelte.config.js` with:

```js
import adapter from "@sveltejs/adapter-cloudflare";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    // Cloudflare adapter writes a Worker entry plus prerendered/static assets
    // into .svelte-kit/cloudflare. Keep almost all generated routes
    // prerendered so matching HTML, data.sqlite, and WebP files are served by
    // Workers Static Assets without invoking the Worker.
    adapter: adapter({}),
    alias: { $lib: "src/lib" },
  },
};

export default config;
```

Update `site/wrangler.toml` comments without changing the deployed resource names:

```toml
name = "ardenfall-compendium-site"
main = ".svelte-kit/cloudflare/_worker.js"
compatibility_date = "2026-05-07"
compatibility_flags = ["nodejs_compat"]

workers_dev = false

[[routes]]
pattern = "ardenfall.compendiums.org"
custom_domain = true

# adapter-cloudflare emits both the Worker entry and static asset bundle into
# .svelte-kit/cloudflare. Leave run_worker_first unset so Cloudflare serves
# matching prerendered HTML, data.sqlite, and WebP assets without invoking the
# Worker. Routes should opt out of prerendering only when they genuinely need
# request-time computation.
[assets]
directory = ".svelte-kit/cloudflare"
binding = "ASSETS"
```

- [ ] **Step 3: Enable static SSR defaults**

Replace `site/src/routes/+layout.ts` with:

```ts
// Generated compendium pages are deterministic for a given snapshot. Render
// them at build time and ship static HTML by default. Re-enable CSR only for a
// route that documents a real browser-interactivity requirement.
export const ssr = true;
export const prerender = true;
export const csr = false;
```

- [ ] **Step 4: Convert item overview load to build-time server load**

Rename the file:

```sh
git mv site/src/routes/items/+page.ts site/src/routes/items/+page.server.ts
```

Replace `site/src/routes/items/+page.server.ts` with:

```ts
import {
  getEntity,
  getEntityField,
  listItemsOverview,
  listOverviewColumns,
  type ItemOverviewRow,
} from "$lib/server/read-models";
import type { PageServerLoad } from "./$types";

export const prerender = true;

export const load: PageServerLoad = () => {
  const entity = getEntity("item");
  const columnsMeta = listOverviewColumns("item");
  const rows = listItemsOverview();

  const columns = columnsMeta.map((c) => {
    const field = getEntityField("item", c.field_id);
    return {
      id: c.column_id,
      label: field?.label ?? c.field_id,
      field: c.field_id as keyof ItemOverviewRow & string,
      renderer: c.renderer,
      sortable: c.sortable !== 0,
    };
  });

  return {
    label: entity?.plural_label ?? "Items",
    columns,
    rows,
  };
};
```

- [ ] **Step 5: Convert item detail load and dynamic entries**

Rename the file:

```sh
git mv 'site/src/routes/items/[id]/+page.ts' 'site/src/routes/items/[id]/+page.server.ts'
```

Replace `site/src/routes/items/[id]/+page.server.ts` with:

```ts
import { error } from "@sveltejs/kit";
import {
  getEntityField,
  getItemDetail,
  listDetailSections,
  listItemIds,
  listSectionFields,
} from "$lib/server/read-models";
import type { EntryGenerator, PageServerLoad } from "./$types";

export interface ResolvedSection {
  id: string;
  title: string;
  kind: "fieldList" | "custom";
  rendererKey: string | null;
  fields: { id: string; label: string; value: unknown }[];
  payload: Record<string, unknown>;
}

export const prerender = true;

export const entries: EntryGenerator = () => listItemIds().map((id) => ({ id }));

export const load: PageServerLoad = ({ params }) => {
  const detail = getItemDetail(params.id);
  if (!detail) throw error(404, "Item not found");

  const allFields = JSON.parse(detail.fields_json) as Record<string, unknown>;
  const sectionsMeta = listDetailSections("item");

  const sections: ResolvedSection[] = sectionsMeta.map((s): ResolvedSection => {
    const fieldList = listSectionFields("item", s.section_id);
    const fields = fieldList.map((f) => {
      const meta = getEntityField("item", f.field_id);
      return {
        id: f.field_id,
        label: meta?.label ?? f.field_id,
        value: allFields[f.field_id],
      };
    });
    return {
      id: s.section_id,
      title: s.title,
      kind: s.kind,
      rendererKey: s.renderer_key,
      fields,
      payload: s.payload_json ? (JSON.parse(s.payload_json) as Record<string, unknown>) : {},
    };
  });

  return {
    id: detail.id,
    name: detail.name,
    variant: detail.variant,
    displayIconSrc: detail.displayIconSrc,
    sections,
  };
};
```

- [ ] **Step 6: Run route/type checks**

Run:

```sh
bun test tooling.test.ts
bun run --cwd site check
```

Expected: route option tests pass except the missing smoke script if Task 4 has not run; `svelte-check` passes with generated `$types` after `svelte-kit sync`.

- [ ] **Step 7: Commit route conversion**

Run:

```sh
git add site/svelte.config.js site/wrangler.toml site/src/routes/+layout.ts site/src/routes/items/+page.server.ts 'site/src/routes/items/[id]/+page.server.ts' tooling.test.ts
git add -u site/src/routes/items/+page.ts 'site/src/routes/items/[id]/+page.ts'
git commit -m "feat(site): prerender item routes"
```

---

### Task 4: Remove default client-side table behavior

**Files:**

- Modify: `site/src/lib/components/EntityTable.svelte`
- Modify: `site/scripts/smoke-item-icons.mjs`

- [ ] **Step 1: Update smoke expectations before changing the component**

In `site/scripts/smoke-item-icons.mjs`, replace the sort-specific assertion:

```js
if (!table.includes("const av = a[field]") || !table.includes("toggleSort(col)")) {
  throw new Error("EntityTable sorting must remain field-driven.");
}
```

with:

```js
if (table.includes("$state") || table.includes("onclick=") || table.includes("toggleSort")) {
  throw new Error(
    "EntityTable must remain static by default; interactive sorting belongs in a CSR opt-in route.",
  );
}
if (!table.includes("rowHref(row)")) {
  throw new Error("EntityTable must keep static linked row text.");
}
```

- [ ] **Step 2: Run smoke to verify it fails**

Run:

```sh
bun run --cwd site smoke:item-icons
```

Expected: fail because `EntityTable.svelte` still has `$state`, `onclick`, and `toggleSort`.

- [ ] **Step 3: Replace `EntityTable.svelte` with static table markup**

Replace `site/src/lib/components/EntityTable.svelte` with:

```svelte
<script lang="ts" generics="T extends { id: string | number }">
  type Column = {
    id: string;
    label: string;
    field: keyof T & string;
    renderer?: "text" | "itemNameWithIcon";
    sortable?: boolean;
  };

  type Props = {
    rows: T[];
    columns: Column[];
    rowHref?: (row: T) => string;
  };

  let { rows, columns, rowHref }: Props = $props();

  function iconSrc(row: T): string | null {
    const value = (row as T & { displayIconSrc?: unknown }).displayIconSrc;
    return typeof value === "string" && value.length > 0 ? value : null;
  }
</script>

<table class="w-full text-left text-sm">
  <thead class="bg-muted text-muted-foreground">
    <tr>
      {#each columns as col (col.id)}
        <th scope="col" class="p-2">{col.label}</th>
      {/each}
    </tr>
  </thead>
  <tbody>
    {#each rows as row (row.id)}
      <tr class="border-border hover:bg-muted/40 border-b">
        {#each columns as col, i (col.id)}
          <td class="p-2">
            {#if col.renderer === "itemNameWithIcon"}
              <span class="flex items-center gap-2">
                <span
                  class="bg-muted border-border flex size-8 shrink-0 items-center justify-center rounded border"
                  aria-hidden="true"
                >
                  {#if iconSrc(row)}
                    <img
                      class="size-6 object-contain"
                      src={iconSrc(row)!}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                  {/if}
                </span>
                {#if i === 0 && rowHref}
                  <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the rowHref callback is caller-supplied and is expected to wrap with resolve() at the call site -->
                  <a href={rowHref(row)} class="underline">{row[col.field] ?? ""}</a>
                {:else}
                  <span>{row[col.field] ?? ""}</span>
                {/if}
              </span>
            {:else if i === 0 && rowHref}
              <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the rowHref callback is caller-supplied and is expected to wrap with resolve() at the call site -->
              <a href={rowHref(row)} class="underline">{row[col.field] ?? ""}</a>
            {:else}
              {row[col.field] ?? ""}
            {/if}
          </td>
        {/each}
      </tr>
    {/each}
  </tbody>
</table>

{#if rows.length === 0}
  <p class="text-muted-foreground p-4">No rows.</p>
{/if}
```

- [ ] **Step 4: Run component checks**

Run:

```sh
bun run --cwd site smoke:item-icons
bun run --cwd site check
```

Expected: both pass.

- [ ] **Step 5: Commit static table conversion**

Run:

```sh
git add site/src/lib/components/EntityTable.svelte site/scripts/smoke-item-icons.mjs
git commit -m "refactor(site): make entity tables static by default"
```

---

### Task 5: Add prerender output smoke tests

**Files:**

- Create: `site/scripts/smoke-prerender-output.mjs`
- Modify: `site/package.json`
- Modify: `tooling.test.ts`

- [ ] **Step 1: Write the smoke script**

Create `site/scripts/smoke-prerender-output.mjs`:

```js
#!/usr/bin/env bun
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const outputDir = join(import.meta.dirname, "..", ".svelte-kit", "cloudflare");
const overviewPath = firstExisting([
  join(outputDir, "items", "index.html"),
  join(outputDir, "items.html"),
]);

if (!overviewPath) {
  throw new Error(`missing prerendered item overview under ${outputDir}`);
}

const overview = readFileSync(overviewPath, "utf8");
for (const snippet of ["Iron Sword", "Leather Tunic", "/assets/", "item-icon"]) {
  if (!overview.includes(snippet)) throw new Error(`overview HTML missing ${snippet}`);
}
for (const forbidden of ["_app/immutable/entry/app", "data.sqlite", "sqlite-wasm"]) {
  if (overview.includes(forbidden))
    throw new Error(`overview should not be a hydrated SQLite SPA: ${forbidden}`);
}

const detailHtmlPaths = listHtml(join(outputDir, "items"));
for (const path of listHtml(outputDir)) {
  if (path.includes(`${join("items", "fixture-")}`) && !detailHtmlPaths.includes(path)) {
    detailHtmlPaths.push(path);
  }
}
if (detailHtmlPaths.length === 0) throw new Error("missing prerendered item detail pages");

const ironSwordPath = detailHtmlPaths.find((path) => path.includes("fixture-iron-sword"));
if (!ironSwordPath) throw new Error("missing fixture-iron-sword prerendered detail page");
const ironSword = readFileSync(ironSwordPath, "utf8");
for (const snippet of ["Iron Sword", "item-icon", "/assets/"]) {
  if (!ironSword.includes(snippet)) throw new Error(`detail HTML missing ${snippet}`);
}
if (ironSword.includes("_app/immutable/entry/app")) {
  throw new Error("detail page should not ship Svelte hydration entry by default");
}

function firstExisting(paths) {
  return paths.find((path) => existsSync(path)) ?? null;
}

function listHtml(dir) {
  if (!existsSync(dir)) return [];
  const results = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const info = statSync(path);
    if (info.isDirectory()) results.push(...listHtml(path));
    else if (entry === "index.html" || entry.endsWith(".html")) results.push(path);
  }
  return results;
}
```

- [ ] **Step 2: Wire the script in `site/package.json`**

Ensure the scripts block includes:

```json
{
  "smoke:prerender": "bun run scripts/smoke-prerender-output.mjs"
}
```

- [ ] **Step 3: Run smoke before build to verify it fails**

Run:

```sh
rm -rf site/.svelte-kit/cloudflare
bun run --cwd site smoke:prerender
```

Expected: fail with `missing prerendered item overview`.

- [ ] **Step 4: Build synthetic output and run smoke**

Run:

```sh
bun run pipeline:run fixtures/synthetic/snapshot pipeline/dist
bun run --cwd site build
bun run --cwd site smoke:prerender
```

Expected:

- build completes;
- `site/.svelte-kit/cloudflare/items.html` exists with the default `trailingSlash = "never"` policy;
- `site/.svelte-kit/cloudflare/items/fixture-iron-sword.html` exists with the default `trailingSlash = "never"` policy;
- smoke passes and confirms the HTML is not an empty hydrated SPA shell.

- [ ] **Step 5: Run guardrails**

Run:

```sh
bun test tooling.test.ts
bun run --cwd site smoke:item-icons
bun run --cwd site check
```

Expected: all pass.

- [ ] **Step 6: Commit smoke coverage**

Run:

```sh
git add site/scripts/smoke-prerender-output.mjs site/package.json tooling.test.ts
git commit -m "test(site): assert prerendered item output"
```

---

### Task 6: Remove obsolete client SQLite runtime path

**Files:**

- Modify: `site/package.json`
- Delete or stop importing: `site/src/lib/store/index.ts`
- Delete or stop importing: `site/src/lib/store/items.ts`
- Delete or stop importing: `site/src/lib/store/site-meta.ts`
- Modify: `tooling.test.ts`

- [ ] **Step 1: Add a failing guard against browser SQLite runtime use**

Add this test to `describe("site prerender architecture", ...)` in `tooling.test.ts`:

```ts
it("does not depend on browser SQLite for static pages", () => {
  expect(sitePackageJson.dependencies?.["@sqlite.org/sqlite-wasm"]).toBeUndefined();
  const overviewRoute = existsSync("site/src/routes/items/+page.ts")
    ? readFileSync("site/src/routes/items/+page.ts", "utf8")
    : "";
  const detailRoute = existsSync("site/src/routes/items/[id]/+page.ts")
    ? readFileSync("site/src/routes/items/[id]/+page.ts", "utf8")
    : "";
  expect(overviewRoute).not.toContain("$lib/store");
  expect(detailRoute).not.toContain("$lib/store");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```sh
bun test tooling.test.ts
```

Expected: fail because `site/package.json` still lists `@sqlite.org/sqlite-wasm`.

- [ ] **Step 3: Remove the browser SQLite dependency**

Run:

```sh
bun remove --cwd site @sqlite.org/sqlite-wasm
```

If no production code imports `site/src/lib/store/index.ts`, `site/src/lib/store/items.ts`, or `site/src/lib/store/site-meta.ts`, delete those files in the same commit:

```sh
git rm site/src/lib/store/index.ts site/src/lib/store/items.ts site/src/lib/store/site-meta.ts
```

If a future route still imports them, do not delete blindly; instead move that route into a documented CSR opt-in and keep the dependency local to that route. In the current Slice 3.5 scope, no route should need this exception.

- [ ] **Step 4: Run full site checks**

Run:

```sh
bun test tooling.test.ts
bun run typecheck
bun run --cwd site check
bun run --cwd site build
bun run --cwd site smoke:prerender
```

Expected: all pass.

- [ ] **Step 5: Commit runtime dependency cleanup**

Run:

```sh
git add site/package.json bun.lock tooling.test.ts
git add -u site/src/lib/store/index.ts site/src/lib/store/items.ts site/src/lib/store/site-meta.ts
git commit -m "refactor(site): remove browser sqlite runtime"
```

---

### Task 7: Document the static-assets-first rule

**Files:**

- Modify: `site/AGENTS.md`
- Modify: `README.md`
- Modify: `docs/superpowers/roadmap.md`

- [ ] **Step 1: Update site agent guidance**

In `site/AGENTS.md`, add this under `## Hard rules`:

```md
- Default route architecture is SSR + prerender + no CSR. Generated compendium pages should be static HTML served by Cloudflare Workers Static Assets. Opt into CSR or request-time Worker rendering only with a documented route-level reason.
```

Update the deployment section to include:

```md
- `bun run --cwd site build` must leave generated HTML under `.svelte-kit/cloudflare` for ordinary routes such as `/items` and `/items/[id]`; these should be static assets, not empty SPA shells.
```

- [ ] **Step 2: Update README smoke workflow**

In `README.md`, add the prerender smoke to the site verification block:

```sh
bun run pipeline:run fixtures/synthetic/snapshot pipeline/dist
bun run --cwd site build
bun run --cwd site smoke:prerender
```

Add one sentence near deployment notes:

```md
The production site is static-assets-first: generated pages are prerendered to HTML and should be served by Cloudflare Static Assets without Worker invocation; the Worker is retained only for exceptional non-prerendered routes.
```

- [ ] **Step 3: Add roadmap evidence placeholder for closeout**

In `docs/superpowers/roadmap.md`, under Slice 3.5, keep status `ready` until implementation is complete. Do not mark `done` in this task. Add this line under acceptance criteria if not already present:

```md
- Closeout must record the deployed Cloudflare version ID and a production smoke that inspects HTML content for `/items` and one item detail page.
```

- [ ] **Step 4: Run documentation checks**

Run:

```sh
bunx prettier --write README.md site/AGENTS.md docs/superpowers/roadmap.md
bun run format:check
```

Expected: pass.

- [ ] **Step 5: Commit documentation**

Run:

```sh
git add README.md site/AGENTS.md docs/superpowers/roadmap.md
git commit -m "docs(site): document static prerender priority"
```

---

### Task 8: Final verification and deployment smoke

**Files:**

- Modify only if a verification failure reveals a real bug in already-touched files.

- [ ] **Step 1: Run complete local verification**

Run:

```sh
bun run pipeline:run fixtures/synthetic/snapshot pipeline/dist
bun run codegen:validators
bun run typecheck
bun test tooling.test.ts
bun test controller/test
bun run --cwd site smoke:item-icons
bun run --cwd site check
bun run --cwd site build
bun run --cwd site smoke:prerender
bun run format:check
bun run lint
git diff --check
```

Expected: all commands exit zero. `bun run lint` may print existing warnings only if it exits zero.

- [ ] **Step 2: Verify static output manually**

Run:

```sh
test -f site/.svelte-kit/cloudflare/items.html
test -f site/.svelte-kit/cloudflare/items/fixture-iron-sword.html
bun -e 'const fs=require("node:fs"); const html=fs.readFileSync("site/.svelte-kit/cloudflare/items.html","utf8"); if (!html.includes("Iron Sword") || html.includes("_app/immutable/entry/app")) process.exit(1);'
```

Expected: all commands exit zero.

- [ ] **Step 3: Deploy when asked**

Only deploy after the user explicitly asks for production deployment:

```sh
bun run --cwd site cf-deploy
```

Expected: Wrangler reports a new Cloudflare version ID.

- [ ] **Step 4: Production HTTP smoke after deploy**

Run a self-contained production smoke that selects a real item/icon pair from the live generated SQLite:

```sh
bun -e 'import { Database } from "bun:sqlite"; const db = new Database("pipeline/dist/data.sqlite", { readonly: true }); const row = db.query("select id, display_icon_hash from item_overview_rows where display_icon_hash is not null order by name limit 1").get(); if (!row) throw new Error("no item icon row in pipeline/dist/data.sqlite"); const urls = ["https://ardenfall.compendiums.org/items", `https://ardenfall.compendiums.org/items/${row.id}`, "https://ardenfall.compendiums.org/data.sqlite", `https://ardenfall.compendiums.org/assets/${row.display_icon_hash}.webp`]; for (const url of urls) { const res = await fetch(url); console.log(url, res.status, res.headers.get("content-type"), res.headers.get("content-length") ?? "chunked"); if (!res.ok) process.exitCode = 1; const body = await res.text(); if (url.endsWith("/items") && (!body.includes("<table") || body.includes("_app/immutable/entry/app"))) process.exitCode = 1; if (url.includes("/items/") && !body.includes(row.id) && body.includes("_app/immutable/entry/app")) process.exitCode = 1; }}'
```

Expected: all status codes are 200; `/items` response body contains table HTML and does not include the Svelte hydration entry.

- [ ] **Step 5: Mark Slice 3.5 complete**

After production or local smoke passes, update `docs/superpowers/roadmap.md` with the actual implementation commit range, commands that passed, deployed Cloudflare version ID when deployed, smoked item ID, and smoked asset hash. The Slice 3.5 block must say `**Status:** done`, must include a `**Completed:** 2026-05-15 on main` line, and must include a `**Verification evidence:**` line naming the successful static HTML checks for `/items` and one item detail page.

- [ ] **Step 6: Commit closeout**

Run:

```sh
git add docs/superpowers/roadmap.md
git commit -m "docs(site): mark prerender slice complete"
```

- [ ] **Step 7: Final status check**

Run:

```sh
git status --short --branch
```

Expected: clean worktree on `main`, ahead of origin only by the implementation commits unless already pushed.
