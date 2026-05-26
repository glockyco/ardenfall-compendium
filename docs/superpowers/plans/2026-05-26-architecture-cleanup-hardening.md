# Architecture Cleanup and Artifact Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the descriptor/read-model/artifact boundary before adding more public entity slices.

**Architecture:** Public routes move from label-derived convention to explicit descriptor data. Pipeline and site read-model logic become entity-owned modules behind thin compatibility facades, while artifact validation and descriptor coverage checks fail early with direct diagnostics.

**Tech Stack:** TypeScript on Bun, Bun SQLite, JSON Schema/Ajv generated validators, SvelteKit 5 static/prerender, Cloudflare Workers Static Assets, Prettier/ESLint/lefthook.

---

## File structure

### Create

- `pipeline/src/entities/item/read-models.ts` — item read-model DDL/emission and entity-node helper ownership.
- `pipeline/src/entities/stat-type/read-models.ts` — stat-type read-model DDL/emission.
- `pipeline/src/entities/item-category/read-models.ts` — item-category read-model DDL/emission.
- `pipeline/src/entities/item-tag/read-models.ts` — item-tag read-model DDL/emission.
- `pipeline/src/entities/registry.ts` — explicit canonicalizer/read-model support registry and descriptor coverage validation.
- `pipeline/src/artifacts/sqlite-validation.ts` — deployable SQLite artifact checks.
- `site/src/lib/server/db.ts` — server-only SQLite helper functions shared by entity read modules.
- `site/src/lib/server/entities/item.ts` — item overview/detail/read accessors.
- `site/src/lib/server/entities/stat-type.ts` — stat-type overview/detail accessors.
- `site/src/lib/server/entities/item-category.ts` — category overview/detail accessors.
- `site/src/lib/server/entities/item-tag.ts` — tag overview/detail accessors.

### Modify

- `schemas/entity.schema.json` — add explicit `site.route` field and validation pattern.
- `entities/item/entity.json` — add `site.route: "/items"`.
- `entities/stat-type/entity.json` — add `site.route: "/stats"`.
- `entities/item-category/entity.json` — add `site.route: "/categories"`.
- `entities/item-tag/entity.json` — add `site.route: "/tags"`.
- `pipeline/src/types.ts` — add `route` to the site descriptor type.
- `pipeline/src/stages/load-descriptors.ts` — keep schema validation and call route/coverage validation where appropriate.
- `pipeline/src/stages/emit-site-metadata.ts` — emit `site_entities.route_path` from `entity.site.route`.
- `pipeline/src/stages/emit-read-models.ts` — shrink to facade exports and orchestration over entity modules.
- `pipeline/src/stages/emit-sqlite.ts` — use registry validation and SQLite artifact validation.
- `pipeline/src/artifacts/manifest.ts` — validate SQLite after writing artifact metadata and before hashing/manifest write.
- `site/src/lib/server/read-models.ts` — shrink to facade exports from `db.ts` and entity modules.
- `site/src/lib/components/EntityTable.svelte` — remove full item tooltip dependency from generic table rendering.
- `site/wrangler.toml` — remove `nodejs_compat` if build/smoke proves it is unnecessary; otherwise keep with a specific comment.
- `pipeline/test/load-descriptors.test.ts` — route validation tests.
- `pipeline/test/site-metadata.test.ts` — descriptor-derived route test.
- `pipeline/test/read-models.test.ts` — update imports and keep entity read-model behavior tests.
- `pipeline/test/artifact-manifest.test.ts` — SQLite validation tests around WAL/SHM sidecars and integrity.
- `tooling.test.ts` — add/adjust static checks for lean overview and Worker compat outcome.

---

## Task 1: Descriptor-owned public route paths

**Files:**

- Modify: `schemas/entity.schema.json`
- Modify: `entities/item/entity.json`
- Modify: `entities/stat-type/entity.json`
- Modify: `entities/item-category/entity.json`
- Modify: `entities/item-tag/entity.json`
- Modify: `pipeline/src/types.ts`
- Modify: `pipeline/src/stages/emit-site-metadata.ts`
- Modify: `pipeline/test/load-descriptors.test.ts`
- Modify: `pipeline/test/site-metadata.test.ts`

- [ ] **Step 1: Add failing route tests**

In `pipeline/test/load-descriptors.test.ts`, add tests that prove descriptors expose stable routes and invalid/missing routes fail through JSON Schema. Use a sandbox because generated validators load repo schemas but the descriptor loader accepts `workspaceRoot`.

```ts
it("loads explicit public routes from entity descriptors", async () => {
  const result = await loadDescriptors.run({}, ctx);

  expect(result.entities.item?.site?.route).toBe("/items");
  expect(result.entities["stat-type"]?.site?.route).toBe("/stats");
  expect(result.entities["item-category"]?.site?.route).toBe("/categories");
  expect(result.entities["item-tag"]?.site?.route).toBe("/tags");
});

it("rejects public descriptors without a route", async () => {
  const root = mkdtempSync(join(tmpdir(), "ardenfall-missing-route-"));
  try {
    const entityDir = join(root, "entities", "thing");
    mkdirSync(entityDir, { recursive: true });
    writeFileSync(
      join(entityDir, "entity.json"),
      `${JSON.stringify(
        {
          $schema: "../../schemas/entity.schema.json",
          id: "thing",
          label: { singular: "Thing", plural: "Things" },
          extraction: { root: "Thing.Root", walker: "ThingWalker" },
          fields: [{ name: "id", type: "id", from: "id", missingPolicy: "fatal" }],
          site: { overview: { columns: ["id"] } },
          map: null,
        },
        null,
        2,
      )}\n`,
    );

    expect(() =>
      loadDescriptors.run(
        {},
        { workspaceRoot: root, snapshotDir: "", outDir: "", log: () => undefined },
      ),
    ).toThrow(/entity\.json#\/site — must have required property 'route'/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it("rejects malformed public routes", async () => {
  const root = mkdtempSync(join(tmpdir(), "ardenfall-bad-route-"));
  try {
    const entityDir = join(root, "entities", "thing");
    mkdirSync(entityDir, { recursive: true });
    writeFileSync(
      join(entityDir, "entity.json"),
      `${JSON.stringify(
        {
          $schema: "../../schemas/entity.schema.json",
          id: "thing",
          label: { singular: "Thing", plural: "Things" },
          extraction: { root: "Thing.Root", walker: "ThingWalker" },
          fields: [{ name: "id", type: "id", from: "id", missingPolicy: "fatal" }],
          site: { route: "Things", overview: { columns: ["id"] } },
          map: null,
        },
        null,
        2,
      )}\n`,
    );

    expect(() =>
      loadDescriptors.run(
        {},
        { workspaceRoot: root, snapshotDir: "", outDir: "", log: () => undefined },
      ),
    ).toThrow(/entity\.json#\/site\/route — must match pattern/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
```

In `pipeline/test/site-metadata.test.ts`, strengthen the current route check so label changes cannot affect the emitted route:

```ts
expect(ent.route_path).toBe(desc.entities.item?.site?.route);
expect(ent.route_path).toBe("/items");
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
bun test pipeline/test/load-descriptors.test.ts pipeline/test/site-metadata.test.ts
```

Expected: FAIL because `site.route` is not in the schema/types/descriptors.

- [ ] **Step 3: Add `site.route` to schema and descriptors**

In `schemas/entity.schema.json`, change the `site` definition to require `route` and validate it:

```json
"site": {
  "type": "object",
  "additionalProperties": false,
  "required": ["route"],
  "properties": {
    "route": {
      "type": "string",
      "pattern": "^/$|^/[a-z0-9]+(?:-[a-z0-9]+)*(?:/[a-z0-9]+(?:-[a-z0-9]+)*)*$"
    },
    "overview": { "$ref": "#/$defs/siteOverview" },
    "detail": { "$ref": "#/$defs/siteDetail" }
  }
}
```

Add these properties inside each descriptor's existing `site` object:

```json
"route": "/items"
```

```json
"route": "/stats"
```

```json
"route": "/categories"
```

```json
"route": "/tags"
```

In `pipeline/src/types.ts`, add the route to the site descriptor type. The resulting shape should include:

```ts
export interface SiteSpec {
  route: string;
  overview?: SiteOverview;
  detail?: SiteDetail;
}
```

If the project currently uses a type alias rather than this exact interface name, add `route: string` to the existing site spec type instead of introducing a duplicate type.

- [ ] **Step 4: Emit descriptor route from site metadata**

In `pipeline/src/stages/emit-site-metadata.ts`, replace the label-derived route expression:

```ts
`/${entity.label.plural.toLowerCase()}`,
```

with:

```ts
entity.site?.route ?? failMissingRoute(entityId),
```

Add this helper near `valueKindOf`:

```ts
function failMissingRoute(entityId: string): never {
  throw new Error(`descriptor '${entityId}' is missing site.route`);
}
```

- [ ] **Step 5: Regenerate validators**

Run:

```bash
bun run codegen:validators
```

Expected: generated validator files update cleanly.

- [ ] **Step 6: Run focused tests**

Run:

```bash
bun test pipeline/test/load-descriptors.test.ts pipeline/test/site-metadata.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit route contract**

Run:

```bash
git add schemas/entity.schema.json entities/item/entity.json entities/stat-type/entity.json entities/item-category/entity.json entities/item-tag/entity.json pipeline/src/types.ts pipeline/src/stages/emit-site-metadata.ts pipeline/test/load-descriptors.test.ts pipeline/test/site-metadata.test.ts pipeline/dist/validate-entity.mjs pipeline/dist/validate-entity.d.mts
git commit -m "fix(pipeline): make entity routes descriptor-owned"
```

---

## Task 2: Pipeline entity read-model modules and coverage diagnostics

**Files:**

- Create: `pipeline/src/entities/item/read-models.ts`
- Create: `pipeline/src/entities/stat-type/read-models.ts`
- Create: `pipeline/src/entities/item-category/read-models.ts`
- Create: `pipeline/src/entities/item-tag/read-models.ts`
- Create: `pipeline/src/entities/registry.ts`
- Modify: `pipeline/src/stages/emit-read-models.ts`
- Modify: `pipeline/src/stages/emit-sqlite.ts`
- Modify: `pipeline/test/read-models.test.ts`
- Modify: `pipeline/test/load-descriptors.test.ts`

- [ ] **Step 1: Add failing coverage tests**

In `pipeline/test/load-descriptors.test.ts`, import the future coverage helper:

```ts
import { validateDescriptorCoverage } from "$pipeline/entities/registry";
```

Add tests:

```ts
it("accepts every committed public descriptor in the pipeline support registry", async () => {
  const result = await loadDescriptors.run({}, ctx);
  expect(() => validateDescriptorCoverage(result)).not.toThrow();
});

it("reports missing canonicalizer and read-model support by descriptor id", () => {
  expect(() =>
    validateDescriptorCoverage({
      entities: {
        location: {
          id: "location",
          label: { singular: "Location", plural: "Locations" },
          extraction: { root: "Location.Root" },
          fields: [{ name: "id", type: "id", from: "id", missingPolicy: "fatal" }],
          site: { route: "/locations", overview: { columns: ["id"] } },
          map: null,
        },
      },
      variants: { location: [] },
    }),
  ).toThrow(
    /descriptor 'location' has no pipeline canonicalizer[\s\S]*descriptor 'location' has no read-model emitter for public route '\/locations'/,
  );
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
bun test pipeline/test/load-descriptors.test.ts
```

Expected: FAIL because `pipeline/src/entities/registry.ts` does not exist.

- [ ] **Step 3: Move item read-model code into an entity module**

Create `pipeline/src/entities/item/read-models.ts` by moving the item-owned exports and private helpers from `pipeline/src/stages/emit-read-models.ts` without changing behavior. The new file must export exactly these public names:

```ts
export { ITEM_READ_MODEL_DDL, emitItemReadModels, prepareEntityNodeWriter };
export type { EntityNodeInput, EntityNodeWriter };
```

`ITEM_READ_MODEL_DDL` must contain the existing DDL for `item_overview_rows`, `item_presentation_rows`, `item_overview_filters`, and `item_overview_categories`. `emitItemReadModels` must keep its current signature:

```ts
export function emitItemReadModels(
  db: Database,
  desc: LoadDescriptorsOutput,
  itemIconMetadata: SnapshotItemIconMetadata[] = [],
  itemEnvelope?: SnapshotEnvelope,
  masterTooltip?: MasterTooltipVocabulary,
): void;
```

Keep all helper functions used only by item emission in this file too, including term collection, title casing, alias keys, presentation translation helpers, and diagnostic insertion helpers.

Preserve imports exactly where needed:

```ts
import type { Database } from "bun:sqlite";
import type { LoadDescriptorsOutput } from "../../stages/load-descriptors.ts";
import type {
  MasterTooltipVocabulary,
  SnapshotEnvelope,
  SnapshotItemIconMetadata,
} from "../../types.ts";
import { translateRichTextV1 } from "../../rich-text/rich-text-v1.ts";
import {
  ENTITY_GRAPH_DDL,
  auditEntityGraph,
  insertPipelineDiagnostics,
} from "../../relationships/relationship-graph.ts";
import type { RichTextNode } from "../../rich-text/rich-text-v1.ts";
import { deriveShortId, deriveSlug } from "../../slug/derive-slug.ts";
```

- [ ] **Step 4: Move stat/category/tag read-model code into entity modules**

Create `pipeline/src/entities/stat-type/read-models.ts` by moving the stat-type DDL and emitter from `pipeline/src/stages/emit-read-models.ts`. The new module must export:

```ts
export { STAT_TYPE_READ_MODEL_DDL, emitStatTypeReadModels };
```

`emitStatTypeReadModels` must keep the current signature:

```ts
export function emitStatTypeReadModels(db: Database, masterTooltip?: MasterTooltipVocabulary): void;
```

Create `pipeline/src/entities/item-category/read-models.ts` by moving the item-category DDL and emitter. The new module must export:

```ts
export { ITEM_CATEGORY_READ_MODEL_DDL, emitItemCategoryReadModels };
```

Create `pipeline/src/entities/item-tag/read-models.ts` by moving the item-tag DDL and emitter. The new module must export:

```ts
export { ITEM_TAG_READ_MODEL_DDL, emitItemTagReadModels };
```

Move each emitter's private helpers from `pipeline/src/stages/emit-read-models.ts` into the matching entity file. Use relative imports rooted at the new location.

- [ ] **Step 5: Turn `emit-read-models.ts` into a facade/orchestrator**

Replace `pipeline/src/stages/emit-read-models.ts` with facade exports and one orchestration helper:

```ts
import type { Database } from "bun:sqlite";
import type { LoadDescriptorsOutput } from "./load-descriptors.ts";
import type { LoadSnapshotOutput } from "./load-snapshot.ts";
import type { EmitAssetsOutput } from "./emit-assets.ts";

export {
  ITEM_READ_MODEL_DDL,
  emitItemReadModels,
  prepareEntityNodeWriter,
  type EntityNodeInput,
  type EntityNodeWriter,
} from "../entities/item/read-models.ts";
export {
  STAT_TYPE_READ_MODEL_DDL,
  emitStatTypeReadModels,
} from "../entities/stat-type/read-models.ts";
export {
  ITEM_CATEGORY_READ_MODEL_DDL,
  emitItemCategoryReadModels,
} from "../entities/item-category/read-models.ts";
export {
  ITEM_TAG_READ_MODEL_DDL,
  emitItemTagReadModels,
} from "../entities/item-tag/read-models.ts";

import { emitItemReadModels } from "../entities/item/read-models.ts";
import { emitStatTypeReadModels } from "../entities/stat-type/read-models.ts";
import { emitItemCategoryReadModels } from "../entities/item-category/read-models.ts";
import { emitItemTagReadModels } from "../entities/item-tag/read-models.ts";

export function emitReadModels(
  db: Database,
  desc: LoadDescriptorsOutput,
  snapshot: LoadSnapshotOutput,
  assets?: EmitAssetsOutput,
): void {
  const itemEnvelope = snapshot.envelopes.item;
  if (!itemEnvelope) throw new Error("emit-read-models: missing item envelope");
  emitItemReadModels(
    db,
    desc,
    assets?.itemIconMetadata ?? [],
    itemEnvelope,
    snapshot.masterTooltip,
  );

  if (snapshot.envelopes["stat-type"]) emitStatTypeReadModels(db, snapshot.masterTooltip);
  if (snapshot.envelopes["item-category"]) emitItemCategoryReadModels(db);
  if (snapshot.envelopes["item-tag"]) emitItemTagReadModels(db);
}
```

- [ ] **Step 6: Add pipeline support registry and coverage diagnostics**

Create `pipeline/src/entities/registry.ts`:

```ts
import type { LoadDescriptorsOutput } from "../stages/load-descriptors.ts";

export const canonicalizerSupport = {
  item: true,
  "stat-type": true,
  "item-category": true,
  "item-tag": true,
} as const satisfies Record<string, true>;

export const readModelSupport = {
  item: true,
  "stat-type": true,
  "item-category": true,
  "item-tag": true,
} as const satisfies Record<string, true>;

const hasOwn = <T extends object>(object: T, key: string): key is keyof T =>
  Object.prototype.hasOwnProperty.call(object, key);

export function validateDescriptorCoverage(desc: LoadDescriptorsOutput): void {
  const errors: string[] = [];
  for (const [entityId, entity] of Object.entries(desc.entities)) {
    if (!hasOwn(canonicalizerSupport, entityId)) {
      errors.push(`descriptor '${entityId}' has no pipeline canonicalizer`);
    }
    if (entity.site && !hasOwn(readModelSupport, entityId)) {
      errors.push(
        `descriptor '${entityId}' has no read-model emitter for public route '${entity.site.route}'`,
      );
    }
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
}
```

- [ ] **Step 7: Use registry/orchestrator from SQLite emission**

In `pipeline/src/stages/emit-sqlite.ts`, import:

```ts
import { validateDescriptorCoverage } from "../entities/registry";
import { emitReadModels } from "./emit-read-models";
```

After `const desc = inputs["load-descriptors"];`, call:

```ts
validateDescriptorCoverage(desc);
```

Replace the four direct read-model emission calls with:

```ts
emitReadModels(db, desc, inputs["load-snapshot"], inputs["emit-assets"]);
```

Keep canonicalizer calls explicit for now; this task adds coverage diagnostics without changing canonical table behavior.

- [ ] **Step 8: Run focused tests**

Run:

```bash
bun test pipeline/test/load-descriptors.test.ts pipeline/test/read-models.test.ts pipeline/test/end-to-end.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit pipeline read-model split**

Run:

```bash
git add pipeline/src/entities/item/read-models.ts pipeline/src/entities/stat-type/read-models.ts pipeline/src/entities/item-category/read-models.ts pipeline/src/entities/item-tag/read-models.ts pipeline/src/entities/registry.ts pipeline/src/stages/emit-read-models.ts pipeline/src/stages/emit-sqlite.ts pipeline/test/read-models.test.ts pipeline/test/load-descriptors.test.ts
git commit -m "refactor(pipeline): split entity read-model emitters"
```

---

## Task 3: Site entity read modules and lean item overview payload

**Files:**

- Create: `site/src/lib/server/db.ts`
- Create: `site/src/lib/server/entities/item.ts`
- Create: `site/src/lib/server/entities/stat-type.ts`
- Create: `site/src/lib/server/entities/item-category.ts`
- Create: `site/src/lib/server/entities/item-tag.ts`
- Modify: `site/src/lib/server/read-models.ts`
- Modify: `site/src/lib/components/EntityTable.svelte`
- Modify: `tooling.test.ts`

- [ ] **Step 1: Add failing lean-overview static test**

In `tooling.test.ts`, add file reads near the existing site reads:

```ts
const siteEntityTable = readFileSync("site/src/lib/components/EntityTable.svelte", "utf8");
const siteReadModels = readFileSync("site/src/lib/server/read-models.ts", "utf8");
```

Add a test under the site/static architecture describe block or create a new `describe("site read model boundaries", () => {})` block:

```ts
it("does not bulk-attach full item presentation rows to the item overview payload", () => {
  expect(siteReadModels).not.toContain("attachItemTooltips");
  expect(siteReadModels).not.toContain("SELECT * FROM item_presentation_rows WHERE id IN");
  expect(siteEntityTable).not.toContain("ItemTooltipCard");
  expect(siteEntityTable).not.toContain("ItemPresentationRow");
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
bun test tooling.test.ts
```

Expected: FAIL because the old read model and generic table still attach/render full tooltips.

- [ ] **Step 3: Create shared site DB helper**

Create `site/src/lib/server/db.ts` by moving the DB-only helpers from `read-models.ts`:

```ts
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const dbPath = () => join(process.cwd(), "static", "data.sqlite");
const require = createRequire(import.meta.url);

type SqlParams = readonly unknown[] | Record<string, unknown>;
type SqliteStatement = {
  all: (params?: SqlParams) => unknown[];
  get: (params?: SqlParams) => unknown;
};
type SqliteDatabase = {
  prepare: (sql: string) => SqliteStatement;
  close: () => void;
};

let db: { path: string; handle: SqliteDatabase } | null = null;

function getDb(): SqliteDatabase {
  const path = dbPath();
  if (db?.path === path) return db.handle;
  db?.handle.close();
  db = { path, handle: openReadonlyDatabase(path) };
  return db.handle;
}

function openReadonlyDatabase(path: string): SqliteDatabase {
  if (!existsSync(path)) throw new Error(`generated SQLite artifact not found at ${path}`);
  const betterSqlite = require("better-sqlite3") as {
    default?: new (
      file: string,
      options: { readonly: boolean; fileMustExist: boolean },
    ) => SqliteDatabase;
  } & (new (
    file: string,
    options: { readonly: boolean; fileMustExist: boolean },
  ) => SqliteDatabase);
  const Database = betterSqlite.default ?? betterSqlite;
  return new Database(path, { readonly: true, fileMustExist: true });
}

export function prepareStatement(sql: string): SqliteStatement {
  return getDb().prepare(sql);
}

export function all<T>(sql: string, params: SqlParams = []): T[] {
  return prepareStatement(sql).all(params) as T[];
}

export function get<T>(sql: string, params: SqlParams = []): T | undefined {
  return prepareStatement(sql).get(params) as T | undefined;
}

export const assetSrc = (hash: string | null): string | null =>
  hash ? `/assets/${hash}.webp` : null;

export const colorChannel = (value: number): number =>
  Math.round(Math.max(0, Math.min(1, value)) * 255);

export const colorCss = (json: string | null): string | null => {
  if (!json) return null;
  const color = JSON.parse(json) as { r: number; g: number; b: number; a?: number };
  const alpha = color.a ?? 1;
  return `rgba(${colorChannel(color.r)} ${colorChannel(color.g)} ${colorChannel(color.b)} / ${alpha})`;
};
```

If the exact `better-sqlite3` type shape in the current file differs, preserve the current working implementation while moving it into this file.

- [ ] **Step 4: Create item site read module without bulk tooltip attachment**

Create `site/src/lib/server/entities/item.ts`. Move item-related interfaces and functions from `read-models.ts`, but change `listItemsOverview`, `listItemsByVariant`, `listItemsByCategory`, and `listItemsByTag` so they map overview records directly and do not query `item_presentation_rows`.

The key mapper should be:

```ts
const toItemOverviewRow = (row: ItemOverviewRecord): ItemOverviewRow => ({
  id: row.id,
  name: row.name,
  weight: row.weight,
  value: row.value,
  variant: row.variant,
  displayIconSrc: assetSrc(row.display_icon_hash),
  displayIconColor: row.display_icon_color,
});
```

The overview accessor should become:

```ts
export const listItemsOverview = (): ItemOverviewRow[] =>
  all<ItemOverviewRecord>("SELECT * FROM item_overview_rows ORDER BY name").map(toItemOverviewRow);
```

Keep `getItemPresentation`, `listItemIds`, category/filter helpers, relationship helpers, and item presentation JSON parsing in this module.

Update `ItemOverviewRow` so it no longer has a `tooltip` property.

- [ ] **Step 5: Create remaining site entity modules**

Create `site/src/lib/server/entities/stat-type.ts`, `site/src/lib/server/entities/item-category.ts`, and `site/src/lib/server/entities/item-tag.ts` by moving the matching interfaces/functions from `read-models.ts` and importing shared helpers from `../db`.

Each module should own its overview/presentation record interfaces and public row interfaces.

- [ ] **Step 6: Shrink `read-models.ts` to shared metadata and facade exports**

Keep shared metadata interfaces/functions in `site/src/lib/server/read-models.ts`. Their definitions must remain source-compatible with current route loaders:

```ts
import { all, get } from "./db";

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

export type {
  ItemOverviewRow,
  ItemPresentationRow,
  RichTextDocument,
  RichTextNode,
  ItemPresentationStatRow,
  ItemPresentationRequirement,
  ItemPresentationEffect,
  ItemPresentationDurability,
  ItemPresentationStateFact,
  ItemPresentationOmission,
  ItemPresentationDiagnostic,
  RelationshipSection,
  RelationshipEdge,
  ItemOverviewCategory,
  ItemOverviewFilter,
  EntityNode,
  EntityNodeRow,
} from "./entities/item";
export {
  listItemsOverview,
  listItemsByVariant,
  listItemsByCategory,
  listItemsByTag,
  listItemOverviewCategories,
  listItemOverviewFilters,
  listItemIds,
  getItemPresentation,
  listRelationshipSections,
  listTermIds,
  getTerm,
  getEntityNodeBySlug,
  getEntityNodeByShortId,
} from "./entities/item";

export type { StatTypeOverviewRow, StatTypePresentationRow } from "./entities/stat-type";
export { listStatTypes, getStatTypePresentation } from "./entities/stat-type";

export type {
  ItemCategoryOverviewRow,
  ItemCategoryPresentationRow,
} from "./entities/item-category";
export { listItemCategories, getItemCategoryPresentation } from "./entities/item-category";

export type { ItemTagOverviewRow, ItemTagPresentationRow } from "./entities/item-tag";
export { listItemTags, getItemTagPresentation } from "./entities/item-tag";
```

Do not change route loaders in this task; the facade preserves their imports.

- [ ] **Step 7: Remove tooltip rendering from generic `EntityTable`**

In `site/src/lib/components/EntityTable.svelte`, remove:

```svelte
import ItemTooltipCard from "$lib/components/items/ItemTooltipCard.svelte"; import type {ItemPresentationRow}
from "$lib/server/read-models";
```

Remove the `tooltip(row)` function and the conditional block that renders `<ItemTooltipCard>`. Keep icon rendering and links.

The item renderer branch should become:

```svelte
{#if col.renderer === "itemNameWithIcon"}
  <span class="flex items-center gap-2">
    <ItemIcon src={iconSrc(row)} displayIconColor={iconColor(row)} size="sm" />
    {#if i === 0 && rowHref}
      <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the rowHref callback is caller-supplied and is expected to wrap with resolve() at the call site -->
      <a href={rowHref(row)} class="underline">{row[col.field] ?? ""}</a>
    {:else}
      <span>{row[col.field] ?? ""}</span>
    {/if}
  </span>
```

- [ ] **Step 8: Run focused site/tooling checks**

Run:

```bash
bun test tooling.test.ts
bun run --cwd site check
bun run artifact:fixture synthetic fixtures/synthetic/snapshot
bun run --cwd site build:fixture
bun run --cwd site smoke:prerender
```

Expected: all PASS; `/items` still prerenders static item text and links.

- [ ] **Step 9: Commit site read-model split and lean overview**

Run:

```bash
git add site/src/lib/server/db.ts site/src/lib/server/entities/item.ts site/src/lib/server/entities/stat-type.ts site/src/lib/server/entities/item-category.ts site/src/lib/server/entities/item-tag.ts site/src/lib/server/read-models.ts site/src/lib/components/EntityTable.svelte tooling.test.ts
git commit -m "perf(site): slim item overview read model"
```

---

## Task 4: SQLite artifact validation

**Files:**

- Create: `pipeline/src/artifacts/sqlite-validation.ts`
- Modify: `pipeline/src/stages/emit-sqlite.ts`
- Modify: `pipeline/src/artifacts/manifest.ts`
- Modify: `pipeline/test/artifact-manifest.test.ts`

- [ ] **Step 1: Add failing SQLite validation tests**

In `pipeline/test/artifact-manifest.test.ts`, import the future helper and `existsSync`:

```ts
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { validateDeployableSqlite } from "../src/artifacts/sqlite-validation";
```

Add tests:

```ts
describe("deployable SQLite validation", () => {
  it("accepts a closed SQLite database with no WAL sidecars", () => {
    const root = mkdtempSync(join(tmpdir(), "ardenfall-sqlite-valid-"));
    try {
      const sqlitePath = join(root, "data.sqlite");
      const db = new Database(sqlitePath);
      db.exec("CREATE TABLE ok_table (id TEXT PRIMARY KEY);");
      db.close();

      expect(validateDeployableSqlite(sqlitePath)).toEqual({ ok: true });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects WAL and SHM sidecars next to a deployable database", () => {
    const root = mkdtempSync(join(tmpdir(), "ardenfall-sqlite-sidecar-"));
    try {
      const sqlitePath = join(root, "data.sqlite");
      const db = new Database(sqlitePath);
      db.exec("CREATE TABLE ok_table (id TEXT PRIMARY KEY);");
      db.close();
      writeFileSync(`${sqlitePath}-wal`, "leftover wal");
      writeFileSync(`${sqlitePath}-shm`, "leftover shm");

      expect(() => validateDeployableSqlite(sqlitePath)).toThrow(/unexpected WAL sidecar/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
bun test pipeline/test/artifact-manifest.test.ts
```

Expected: FAIL because `sqlite-validation.ts` does not exist.

- [ ] **Step 3: Implement SQLite validation helper**

Create `pipeline/src/artifacts/sqlite-validation.ts`:

```ts
import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";

export interface DeployableSqliteValidation {
  ok: true;
}

export function validateDeployableSqlite(sqlitePath: string): DeployableSqliteValidation {
  const walPath = `${sqlitePath}-wal`;
  const shmPath = `${sqlitePath}-shm`;
  if (existsSync(walPath)) {
    throw new Error(`SQLite artifact has unexpected WAL sidecar: ${walPath}`);
  }
  if (existsSync(shmPath)) {
    throw new Error(`SQLite artifact has unexpected SHM sidecar: ${shmPath}`);
  }

  const db = new Database(sqlitePath, { readonly: true });
  try {
    const row = db.query("PRAGMA integrity_check").get() as { integrity_check: string } | null;
    if (row?.integrity_check !== "ok") {
      throw new Error(`SQLite integrity_check failed: ${row?.integrity_check ?? "no result"}`);
    }
  } finally {
    db.close();
  }

  return { ok: true };
}
```

- [ ] **Step 4: Validate after SQLite emission close and before rename result**

In `pipeline/src/stages/emit-sqlite.ts`, import:

```ts
import { validateDeployableSqlite } from "../artifacts/sqlite-validation";
```

After `renameSync(tempPath, outputPath);`, call:

```ts
validateDeployableSqlite(outputPath);
```

Then return byte size. This ensures only final files are validated as deployable artifacts.

- [ ] **Step 5: Validate after artifact metadata write and before manifest hashing**

In `pipeline/src/artifacts/manifest.ts`, import:

```ts
import { validateDeployableSqlite } from "./sqlite-validation";
```

After the `writeArtifactMetadata` call, call:

```ts
validateDeployableSqlite(sqlitePath);
```

Keep `const sqliteBytes = Bun.file(sqlitePath).size;` and `sha256File(sqlitePath)` after validation.

- [ ] **Step 6: Run focused tests**

Run:

```bash
bun test pipeline/test/artifact-manifest.test.ts pipeline/test/end-to-end.test.ts
bun run artifact:fixture synthetic fixtures/synthetic/snapshot
```

Expected: PASS, and no sidecars exist beside generated `data.sqlite`.

- [ ] **Step 7: Commit SQLite validation**

Run:

```bash
git add pipeline/src/artifacts/sqlite-validation.ts pipeline/src/stages/emit-sqlite.ts pipeline/src/artifacts/manifest.ts pipeline/test/artifact-manifest.test.ts
git commit -m "fix(pipeline): validate SQLite release artifacts"
```

---

## Task 5: Worker `nodejs_compat` audit

**Files:**

- Modify: `site/wrangler.toml`
- Modify: `tooling.test.ts`

- [ ] **Step 1: Add a tooling assertion for the intended outcome**

In `tooling.test.ts`, add a test that expects `nodejs_compat` to be absent. This is intentionally written first to force the audit result.

```ts
it("keeps Cloudflare Worker compatibility surface minimal", () => {
  expect(siteWranglerConfig).not.toContain("nodejs_compat");
});
```

- [ ] **Step 2: Remove `nodejs_compat` locally**

Edit `site/wrangler.toml` and delete this line:

```toml
compatibility_flags = ["nodejs_compat"]
```

- [ ] **Step 3: Run build and smoke audit**

Run:

```bash
bun run --cwd site check
bun run artifact:fixture synthetic fixtures/synthetic/snapshot
bun run --cwd site build:fixture
bun run --cwd site smoke:prerender
bun test tooling.test.ts
```

Expected if removable: all PASS.

If any command fails specifically because Cloudflare/Vite/SvelteKit output requires Node compatibility in the Worker, revert the deletion, replace the tooling test with this assertion:

```ts
it("documents why the Cloudflare Worker still uses nodejs_compat", () => {
  expect(siteWranglerConfig).toContain("nodejs_compat");
  expect(siteWranglerConfig).toContain("Required because");
});
```

Then add a specific comment above `compatibility_flags` in `site/wrangler.toml`, for example:

```toml
# Required because <exact observed dependency/error> still needs Node compatibility in the emitted Worker.
compatibility_flags = ["nodejs_compat"]
```

Do not keep `nodejs_compat` without a real observed reason.

- [ ] **Step 4: Commit Worker compatibility result**

If removed:

```bash
git add site/wrangler.toml tooling.test.ts
git commit -m "chore(site): remove unused Worker Node compatibility"
```

If retained with a documented reason:

```bash
git add site/wrangler.toml tooling.test.ts
git commit -m "docs(site): document Worker Node compatibility"
```

---

## Task 6: Final verification and cleanup

**Files:**

- Review all changed files.
- Do not create additional docs unless verification discovers a contract mismatch.

- [ ] **Step 1: Run generated validator freshness check**

Run:

```bash
bun run check:validators
```

Expected: PASS with no validator diff.

- [ ] **Step 2: Run pipeline and tooling tests**

Run:

```bash
bun test pipeline/test tooling.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run TypeScript typecheck**

Run:

```bash
bun run typecheck
```

Expected: PASS.

- [ ] **Step 4: Run site checks and fixture build smoke**

Run:

```bash
bun run --cwd site check
bun run artifact:fixture synthetic fixtures/synthetic/snapshot
bun run --cwd site build:fixture
bun run --cwd site smoke:prerender
```

Expected: PASS. Confirm prerendered `/items` HTML still contains fixture item text and item detail HTML still exists.

- [ ] **Step 5: Run formatting/lint gates**

Run:

```bash
bun run format:check
bun run lint
git diff --check
```

Expected: PASS.

- [ ] **Step 6: Inspect commit structure**

Run:

```bash
git status --short
git log --oneline -6
```

Expected: working tree is clean except intentional untracked local/generated files, and commits are atomic:

```text
fix(pipeline): make entity routes descriptor-owned
refactor(pipeline): split entity read-model emitters
perf(site): slim item overview read model
fix(pipeline): validate SQLite release artifacts
chore(site): remove unused Worker Node compatibility
```

If `nodejs_compat` had to be retained, the last commit should instead be:

```text
docs(site): document Worker Node compatibility
```

- [ ] **Step 7: Report exact verification evidence**

In the final response, report only observed command results. Do not claim production deployment or live export behavior unless those were actually run.
