# Slice 3 Item Icon Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship behavior-derived item icon assets from mod extraction through pipeline conversion, SQLite metadata, automated site artifact sync, and visible item overview/detail rendering.

**Architecture:** The mod exports item icon sprite pixels plus an asset slot manifest; the pipeline converts PNGs to WebP, writes `asset_refs`, and projects display icon hashes/colors into item read models; the site syncs generated artifacts from `pipeline/dist` and renders primary item icons from typed store fields. Full spell/status-effect entities and rich tooltips remain out of scope.

**Tech Stack:** BepInEx C# `netstandard2.1`, Unity `Sprite`/`Texture2D`, Newtonsoft JSON, Bun/TypeScript pipeline, `sharp` as the single pinned image converter, SQLite via `bun:sqlite`, SvelteKit/Svelte 5, Cloudflare static build.

---

## Required preflight before coding

- Work on the current branch/worktree; do not create an isolated worktree unless the user explicitly requests one.
- Use TDD: write each failing test first, observe the failure, then implement.
- Do not push unless the user explicitly asks.
- Do not commit raw decompiled source bodies. The `.decompiled/` cache remains local and ignored.
- Do not add `cwebp`, host-tool discovery, or a second converter path. `sharp` is the only converter for Slice 3.
- Do not add tooltips, hover cards, `title` attributes, secondary icon overlays, or inventory parity UI.

## File structure

Create during implementation:

- `schemas/asset-manifest.schema.json` — validates snapshot asset slot manifests.
- `pipeline/src/stages/emit-assets.ts` — converts manifest PNGs to WebP and returns final WebP asset refs.
- `pipeline/test/assets.test.ts` — asset manifest loading and asset stage tests.
- `site/scripts/sync-generated-artifacts.mjs` — copies/reconciles `data.sqlite` plus generated assets into `site/static`.
- `site/scripts/smoke-item-icons.mjs` — static smoke guard for icon markup and tooltip-scope exclusions.
- `mod/src/Dtos/AssetManifest.cs` — JSON DTOs for asset slot manifests.
- `mod/src/Assets/SpriteAssetExporter.cs` — runtime sprite crop, hash, and PNG write logic.
- `mod/src/Entities/Item/ItemIconSlots.cs` — item icon/color behavior selection and manifest slot assembly.
- `mod-tests/ItemIconSlotTests.cs` — behavior-derived slot/color tests.
- `mod-tests/SpriteAssetExporterTests.cs` — pure crop/hash tests where Unity runtime allows; otherwise pure helper tests.

Modify during implementation:

- `package.json` / `pipeline/package.json` / `bun.lock` — add direct pinned `sharp` dependency for the pipeline workspace.
- `pipeline/scripts/codegen-validators.ts` — generate validator for `asset-manifest.schema.json`.
- `pipeline/src/types.ts` — add asset manifest and emitted asset ref types; extend `SiteOverviewColumn` shape if descriptor metadata changes there.
- `pipeline/src/stages/load-snapshot.ts` — load optional asset manifest.
- `pipeline/src/stages/emit-sqlite.ts` — consume `emit-assets`, insert `asset_refs`, and emit icon read-model columns.
- `pipeline/src/stages/emit-read-models.ts` — add `display_icon_hash` / `display_icon_color` to item read models.
- `pipeline/src/stages/emit-site-metadata.ts` — declare the icon-bearing overview surface explicitly.
- `pipeline/src/sql/site-metadata-ddl.ts` — add overview column metadata fields needed for non-sortable/media rendering.
- `pipeline/src/cli.ts` — include `emitAssets` in the DAG and report asset output.
- `pipeline/test/read-models.test.ts`, `pipeline/test/site-metadata.test.ts`, `pipeline/test/end-to-end.test.ts` — lock SQLite/read-model/site metadata contracts.
- `fixtures/synthetic/snapshot/` — add synthetic asset manifest and tiny PNG fixture files.
- `site/package.json` — replace `sync:data` with generalized generated artifact sync; add smoke script.
- `site/src/lib/store/items.ts` — expose typed `displayIconSrc` fields.
- `site/src/lib/store/site-meta.ts` — expose new overview column metadata.
- `site/src/lib/components/EntityTable.svelte` — add a minimal cell-render/sortability extension.
- `site/src/routes/items/+page.ts` and `+page.svelte` — render overview icons beside item names.
- `site/src/routes/items/[id]/+page.ts` and `+page.svelte` — render detail header icon/placeholder.
- `.github/workflows/ci.yml` — include site/deploy-tooling path filters, run tooling tests, and keep site job on generated bundle path.
- `tooling.test.ts` — lock generated-artifact sync and CI drift behavior.
- `docs/superpowers/roadmap.md` — mark Slice 3 complete only after final verification succeeds.

---

### Task 1: Pin and prove the canonical image converter

**Files:**

- Modify: `pipeline/package.json`
- Modify: `bun.lock`
- Test: `pipeline/test/assets.test.ts`

- [x] **Step 1: Add the failing converter spike test**

Create `pipeline/test/assets.test.ts` if it does not exist. Start with this test and helper. The base64 fixture is a 1x1 transparent PNG; it keeps the test independent of snapshot fixtures.

```ts
import { describe, expect, it } from "bun:test";
import sharp from "sharp";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

function isWebP(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    Buffer.from(bytes.subarray(0, 4)).toString("ascii") === "RIFF" &&
    Buffer.from(bytes.subarray(8, 12)).toString("ascii") === "WEBP"
  );
}

describe("asset conversion", () => {
  it("converts PNG to WebP through the pinned sharp dependency", async () => {
    const webp = await sharp(tinyPng).webp({ quality: 82 }).toBuffer();

    expect(isWebP(webp)).toBe(true);
  });
});
```

- [x] **Step 2: Run the focused test and observe the dependency failure**

Run:

```sh
bun test pipeline/test/assets.test.ts
```

Expected before adding the dependency: failure resolving `sharp` from `pipeline/test/assets.test.ts`.

- [x] **Step 3: Add `sharp` as the single direct pipeline dependency**

Run:

```sh
bun add --cwd pipeline sharp@^0.34.5
```

Expected: `pipeline/package.json` gains a direct dependency on `sharp`; `bun.lock` changes.

If this command installs `sharp` anywhere other than `pipeline/package.json`, stop and correct the package manager invocation before continuing. Do not add `cwebp` or any fallback dependency.

- [x] **Step 4: Re-run the converter spike**

Run:

```sh
bun test pipeline/test/assets.test.ts
```

Expected: pass. If it does not pass under Bun, stop Slice 3 implementation and revise `docs/superpowers/specs/2026-05-14-slice3-item-icon-asset-design.md`; do not implement a fallback converter.

- [ ] **Step 5: Commit**

```sh
git add pipeline/package.json bun.lock pipeline/test/assets.test.ts
git commit -m "chore(pipeline): pin sharp for asset conversion"
```

---

### Task 2: Add snapshot asset manifest schema and loader support

**Files:**

- Create: `schemas/asset-manifest.schema.json`
- Modify: `pipeline/scripts/codegen-validators.ts`
- Modify: `pipeline/src/types.ts`
- Modify: `pipeline/src/stages/load-snapshot.ts`
- Modify: `pipeline/test/assets.test.ts`
- Modify: `pipeline/test/snapshot.test.ts`
- Modify: `pipeline/test/canonicaliser.test.ts`
- Modify: `pipeline/test/read-models.test.ts`
- Modify: `pipeline/test/end-to-end.test.ts`
- Modify: `fixtures/synthetic/snapshot/asset-manifest.json`
- Modify: `fixtures/synthetic/manifest.json`
- Modify: `fixtures/synthetic/snapshot/items.json`
- Create: `fixtures/synthetic/snapshot/assets/items/fixture-icon-red.png`
- Create: `fixtures/synthetic/snapshot/assets/items/fixture-icon-blue.png`

- [x] **Step 1: Write the failing loader test**

Append this test to `pipeline/test/assets.test.ts`:

```ts
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSnapshot } from "$pipeline/stages/load-snapshot";
import type { StageContext } from "$pipeline/types";

const ctx: StageContext = {
  workspaceRoot: ".",
  snapshotDir: "fixtures/synthetic/snapshot",
  outDir: "pipeline/test/.tmp",
  log: () => undefined,
};

describe("asset manifest loading", () => {
  it("loads item asset slot manifests beside snapshot envelopes", async () => {
    const snap = await loadSnapshot.run({}, ctx);

    expect(snap.assetManifest?.schemaVersion).toBe(1);
    expect(snap.assetManifest?.assets).toContainEqual({
      entityId: "item",
      rowId: "fixture-iron-sword",
      slot: "displayIcon",
      kind: "image",
      pngHash: "fixture-red-png",
      sourcePath: "assets/items/fixture-icon-red.png",
    });
    expect(snap.assetManifest?.itemIconMetadata).toContainEqual({
      entityId: "item",
      rowId: "fixture-iron-sword",
      displayIconColor: { r: 1, g: 1, b: 1, a: 1 },
      secondaryIconColor: null,
    });
  });

  it("rejects invalid asset manifests", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ardenfall-asset-manifest-"));
    try {
      writeFileSync(
        join(dir, "manifest.json"),
        readFileSync("fixtures/synthetic/snapshot/manifest.json"),
      );
      writeFileSync(
        join(dir, "items.json"),
        readFileSync("fixtures/synthetic/snapshot/items.json"),
      );
      writeFileSync(
        join(dir, "asset-manifest.json"),
        JSON.stringify({ schemaVersion: 1, assets: [{ entityId: "item" }] }),
      );

      expect(() => loadSnapshot.run({}, { ...ctx, snapshotDir: dir })).toThrow(
        /invalid snapshot asset manifest/,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
```

- [x] **Step 2: Add synthetic manifest and PNG fixtures**

Create `fixtures/synthetic/snapshot/asset-manifest.json`:

```json
{
  "schemaVersion": 1,
  "assets": [
    {
      "entityId": "item",
      "rowId": "fixture-iron-sword",
      "slot": "displayIcon",
      "kind": "image",
      "pngHash": "fixture-red-png",
      "sourcePath": "assets/items/fixture-icon-red.png"
    },
    {
      "entityId": "item",
      "rowId": "fixture-slate-spell",
      "slot": "displayIcon",
      "kind": "image",
      "pngHash": "fixture-blue-png",
      "sourcePath": "assets/items/fixture-icon-blue.png"
    },
    {
      "entityId": "item",
      "rowId": "fixture-throwing-potion",
      "slot": "displayIcon",
      "kind": "image",
      "pngHash": "fixture-blue-png",
      "sourcePath": "assets/items/fixture-icon-blue.png"
    },
    {
      "entityId": "item",
      "rowId": "fixture-throwing-potion",
      "slot": "secondaryIcon",
      "kind": "image",
      "pngHash": "fixture-red-png",
      "sourcePath": "assets/items/fixture-icon-red.png"
    }
  ],
  "itemIconMetadata": [
    {
      "entityId": "item",
      "rowId": "fixture-iron-sword",
      "displayIconColor": { "r": 1, "g": 1, "b": 1, "a": 1 },
      "secondaryIconColor": null
    },
    {
      "entityId": "item",
      "rowId": "fixture-leather-tunic",
      "displayIconColor": { "r": 0.25, "g": 0.2, "b": 0.15, "a": 1 },
      "secondaryIconColor": null
    },
    {
      "entityId": "item",
      "rowId": "fixture-slate-spell",
      "displayIconColor": { "r": 0.2, "g": 0.4, "b": 1, "a": 1 },
      "secondaryIconColor": { "r": 0.9, "g": 0.8, "b": 0.2, "a": 1 }
    },
    {
      "entityId": "item",
      "rowId": "fixture-throwing-potion",
      "displayIconColor": { "r": 0.1, "g": 0.8, "b": 0.2, "a": 1 },
      "secondaryIconColor": { "r": 0.8, "g": 0.1, "b": 0.1, "a": 1 }
    }
  ]
}
```

Create the fixture files with this one-off command. It writes two tiny valid PNGs through the pinned `sharp` dependency so the same decoder used by `emit-assets` accepts them:

```sh
bun --cwd pipeline -e 'const sharp = require("sharp"); await sharp({ create: { width: 1, height: 1, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } } }).png().toFile("../fixtures/synthetic/snapshot/assets/items/fixture-icon-red.png"); await sharp({ create: { width: 1, height: 1, channels: 4, background: { r: 0, g: 0, b: 255, alpha: 1 } } }).png().toFile("../fixtures/synthetic/snapshot/assets/items/fixture-icon-blue.png");'
```

- [x] **Step 3: Expand synthetic item rows and fixture manifest**

Add synthetic rows in `fixtures/synthetic/snapshot/items.json` for `fixture-slate-spell` (`variant: "slate-spell"`) and `fixture-throwing-potion` (`variant: "throwing-potion"`) with the variant fields already required by their descriptors. Keep the existing three rows and add only minimal descriptor-valid fields. Update all existing fixture-count expectations from three rows to five rows in `pipeline/test/snapshot.test.ts`, `pipeline/test/canonicaliser.test.ts`, `pipeline/test/read-models.test.ts`, and both affected assertions in `pipeline/test/end-to-end.test.ts`.

Update `fixtures/synthetic/manifest.json` `selection[0].ids` to include the two new ids, add intended assertions for item icon asset slots, and declare real SHA-256 hashes for every changed fixture file. Compute them after writing the fixture files:

```sh
bun -e 'const { createHash } = require("node:crypto"); const { readFileSync } = require("node:fs"); for (const p of ["snapshot/manifest.json", "snapshot/items.json", "snapshot/asset-manifest.json", "snapshot/assets/items/fixture-icon-red.png", "snapshot/assets/items/fixture-icon-blue.png"]) console.log(`${p} ${createHash("sha256").update(readFileSync(`fixtures/synthetic/${p}`)).digest("hex")}`);'
```

Copy those hashes into `fixtures/synthetic/manifest.json`; do not leave all-zero hashes in the committed fixture manifest.

Run:

```sh
bun run check:fixtures
```

Expected before manifest updates: failure listing undeclared hashes for `snapshot/asset-manifest.json` and PNGs. Expected after manifest updates: pass.

- [x] **Step 4: Run the focused test and observe schema/loader failure**

Run:

```sh
bun test pipeline/test/assets.test.ts
```

Expected: failure because `loadSnapshot` has no `assetManifest` output and no validator.

- [x] **Step 5: Add the asset manifest schema**

Create `schemas/asset-manifest.schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://ardenfall-compendium.example/schemas/asset-manifest.schema.json",
  "title": "Snapshot asset manifest",
  "type": "object",
  "additionalProperties": false,
  "required": ["schemaVersion", "assets", "itemIconMetadata"],
  "properties": {
    "schemaVersion": { "type": "integer", "minimum": 1 },
    "assets": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["entityId", "rowId", "slot", "kind", "pngHash", "sourcePath"],
        "properties": {
          "entityId": { "type": "string", "pattern": "^[a-z][a-z0-9-]*$" },
          "rowId": { "type": "string", "minLength": 1 },
          "slot": { "type": "string", "pattern": "^[a-z][a-zA-Z0-9]*$" },
          "kind": { "enum": ["image"] },
          "pngHash": { "type": "string", "minLength": 1 },
          "sourcePath": { "type": "string", "pattern": "^assets/[^\\0]+\\.png$" }
        }
      }
    },
    "itemIconMetadata": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["entityId", "rowId", "displayIconColor", "secondaryIconColor"],
        "properties": {
          "entityId": { "type": "string", "pattern": "^[a-z][a-z0-9-]*$" },
          "rowId": { "type": "string", "minLength": 1 },
          "displayIconColor": { "$ref": "#/$defs/color" },
          "secondaryIconColor": { "oneOf": [{ "type": "null" }, { "$ref": "#/$defs/color" }] }
        }
      }
    }
  },
  "$defs": {
    "color": {
      "type": "object",
      "additionalProperties": false,
      "required": ["r", "g", "b", "a"],
      "properties": {
        "r": { "type": "number" },
        "g": { "type": "number" },
        "b": { "type": "number" },
        "a": { "type": "number" }
      }
    }
  }
}
```

Modify `pipeline/scripts/codegen-validators.ts` by adding this target after `snapshot.schema.json`:

```ts
{ schema: "schemas/asset-manifest.schema.json", out: "pipeline/dist/validate-asset-manifest.mjs" },
```

Run:

```sh
bun run codegen:validators
```

Expected: writes `pipeline/dist/validate-asset-manifest.mjs` and `.d.mts`.

- [x] **Step 6: Add TypeScript manifest types**

Add to `pipeline/src/types.ts` near the snapshot types:

```ts
export interface SnapshotAssetManifest {
  schemaVersion: number;
  assets: SnapshotAssetEntry[];
  itemIconMetadata: SnapshotItemIconMetadata[];
}

export interface SnapshotAssetEntry {
  entityId: string;
  rowId: string;
  slot: string;
  kind: "image";
  pngHash: string;
  sourcePath: string;
}

export interface SnapshotColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface SnapshotItemIconMetadata {
  entityId: string;
  rowId: string;
  displayIconColor: SnapshotColor;
  secondaryIconColor: SnapshotColor | null;
}
```

- [x] **Step 7: Load and validate the optional manifest**

Modify `pipeline/src/stages/load-snapshot.ts`:

```ts
import { existsSync, readdirSync, readFileSync } from "node:fs";
```

Add the validator import:

```ts
import validateAssetManifest from "../../dist/validate-asset-manifest.mjs";
```

Extend imports from `../types.ts`:

```ts
SnapshotAssetManifest,
```

Extend `LoadSnapshotOutput`:

```ts
assetManifest?: SnapshotAssetManifest;
```

In the existing `for (const fileName of readdirSync(dir))` entity-envelope loop, extend the skip list:

```ts
if (
  fileName === "manifest.json" ||
  fileName === "diagnostics.json" ||
  fileName === "asset-manifest.json"
) {
  continue;
}
```

Inside `run`, after diagnostics validation, add:

```ts
const assetManifestPath = join(dir, "asset-manifest.json");
let assetManifest: SnapshotAssetManifest | undefined;
if (existsSync(assetManifestPath)) {
  assetManifest = JSON.parse(readFileSync(assetManifestPath, "utf8")) as SnapshotAssetManifest;
  if (!validateAssetManifest(assetManifest)) {
    const detail = (validateAssetManifest.errors ?? [])
      .map((e) => `${assetManifestPath}#${e.instancePath} — ${e.message}`)
      .join("\n");
    throw new Error(`invalid snapshot asset manifest at ${assetManifestPath}:\n${detail}`);
  }
}
```

Return:

```ts
return { manifest, envelopes, diagnostics, assetManifest };
```

- [x] **Step 8: Re-run the focused test**

Run:

```sh
bun test pipeline/test/assets.test.ts
```

Expected: pass.

- [x] **Step 9: Commit**

```sh
git add schemas/asset-manifest.schema.json pipeline/scripts/codegen-validators.ts pipeline/src/types.ts pipeline/src/stages/load-snapshot.ts pipeline/test/assets.test.ts pipeline/test/snapshot.test.ts pipeline/test/canonicaliser.test.ts pipeline/test/read-models.test.ts pipeline/test/end-to-end.test.ts fixtures/synthetic/manifest.json fixtures/synthetic/snapshot/manifest.json fixtures/synthetic/snapshot/items.json fixtures/synthetic/snapshot/asset-manifest.json fixtures/synthetic/snapshot/assets/items/fixture-icon-red.png fixtures/synthetic/snapshot/assets/items/fixture-icon-blue.png pipeline/dist/validate-asset-manifest.mjs pipeline/dist/validate-asset-manifest.d.mts pipeline/dist/validate-diagnostics.mjs pipeline/dist/validate-digest.mjs pipeline/dist/validate-fixture-manifest.mjs
git commit -m "feat(pipeline): load snapshot asset manifests"
```

---

### Task 3: Emit WebP assets and SQLite `asset_refs`

**Files:**

- Create: `pipeline/src/stages/emit-assets.ts`
- Modify: `pipeline/src/stages/emit-sqlite.ts`
- Modify: `pipeline/src/cli.ts`
- Modify: `pipeline/test/assets.test.ts`
- Modify: `pipeline/test/end-to-end.test.ts`

- [x] **Step 1: Write failing asset stage tests**

Append to `pipeline/test/assets.test.ts`:

```ts
import { existsSync, mkdirSync } from "node:fs";
import { Database } from "bun:sqlite";
import { emitAssets } from "$pipeline/stages/emit-assets";
import { emitSqlite } from "$pipeline/stages/emit-sqlite";
import { loadDescriptors } from "$pipeline/stages/load-descriptors";

function tempOut(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

describe("emitAssets", () => {
  it("converts manifest PNGs to content-addressed WebP files", async () => {
    const outDir = tempOut("ardenfall-assets-");
    try {
      const snap = await loadSnapshot.run({}, ctx);
      const result = await emitAssets.run({ "load-snapshot": snap }, { ...ctx, outDir });

      expect(result.refs).toHaveLength(4);
      expect(result.refs.every((ref) => ref.assetHash.match(/^[a-f0-9]{64}$/))).toBe(true);
      for (const ref of result.refs) {
        expect(existsSync(join(outDir, "assets", `${ref.assetHash}.webp`))).toBe(true);
      }
      expect(result.refs).toContainEqual(
        expect.objectContaining({
          entityId: "item",
          entityRowId: "fixture-iron-sword",
          slot: "displayIcon",
          assetKind: "image",
        }),
      );
      expect(result.refs).toContainEqual(
        expect.objectContaining({
          entityId: "item",
          entityRowId: "fixture-throwing-potion",
          slot: "secondaryIcon",
          assetKind: "image",
        }),
      );
      const uniqueHashes = new Set(result.refs.map((ref) => ref.assetHash));
      expect(uniqueHashes.size).toBe(2);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it("fails loudly when a referenced PNG is missing", async () => {
    const outDir = tempOut("ardenfall-assets-missing-");
    try {
      const snap = await loadSnapshot.run({}, ctx);
      const badSnap = {
        ...snap,
        assetManifest: {
          schemaVersion: 1,
          assets: [
            {
              entityId: "item",
              rowId: "fixture-iron-sword",
              slot: "displayIcon",
              kind: "image" as const,
              pngHash: "missing",
              sourcePath: "assets/items/missing.png",
            },
          ],
          itemIconMetadata: [],
        },
      };

      await expect(
        emitAssets.run({ "load-snapshot": badSnap }, { ...ctx, outDir }),
      ).rejects.toThrow(/missing snapshot asset/);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});

describe("asset_refs", () => {
  it("persists emitted asset references into SQLite", async () => {
    const outDir = tempOut("ardenfall-asset-refs-");
    try {
      const desc = await loadDescriptors.run({}, ctx);
      const snap = await loadSnapshot.run({}, ctx);
      const emitted = await emitAssets.run({ "load-snapshot": snap }, { ...ctx, outDir });

      await emitSqlite.run(
        { "load-descriptors": desc, "load-snapshot": snap, "emit-assets": emitted },
        { ...ctx, outDir },
      );

      const db = new Database(join(outDir, "data.sqlite"), { readonly: true });
      try {
        const refs = db
          .query(
            "SELECT entity_id, entity_row_id, slot, asset_kind, asset_hash FROM asset_refs ORDER BY entity_row_id, slot",
          )
          .all();
        expect(refs).toContainEqual(
          expect.objectContaining({
            entity_id: "item",
            entity_row_id: "fixture-iron-sword",
            slot: "displayIcon",
            asset_kind: "image",
          }),
        );
        expect(refs).toContainEqual(
          expect.objectContaining({
            entity_id: "item",
            entity_row_id: "fixture-throwing-potion",
            slot: "secondaryIcon",
            asset_kind: "image",
          }),
        );
      } finally {
        db.close();
      }
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});
```

- [x] **Step 2: Run tests and observe missing stage failures**

Run:

```sh
bun test pipeline/test/assets.test.ts
```

Expected: TypeScript/import failures for `emit-assets` and `emitSqlite` input shape.

- [x] **Step 3: Add emitted asset types**

Add to `pipeline/src/types.ts`:

```ts
export interface EmittedAssetRef {
  entityId: string;
  entityRowId: string;
  slot: string;
  assetKind: "image";
  assetHash: string;
  outputPath: string;
}
```

- [x] **Step 4: Implement `emit-assets`**

Create `pipeline/src/stages/emit-assets.ts`:

```ts
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import type { EmittedAssetRef, SnapshotItemIconMetadata, Stage } from "../types.ts";
import type { LoadSnapshotOutput } from "./load-snapshot.ts";

export interface EmitAssetsInputs {
  "load-snapshot": LoadSnapshotOutput;
}

export interface EmitAssetsOutput {
  assetsDir: string;
  refs: EmittedAssetRef[];
  itemIconMetadata: SnapshotItemIconMetadata[];
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertSnapshotRelativePng(path: string): void {
  if (
    !path.startsWith("assets/") ||
    !path.endsWith(".png") ||
    path.includes("..") ||
    path.includes("\0")
  ) {
    throw new Error(`invalid snapshot asset path: ${path}`);
  }
}

export const emitAssets: Stage<EmitAssetsInputs, EmitAssetsOutput> = {
  id: "emit-assets",
  inputs: ["load-snapshot"],
  async run(inputs, ctx) {
    const manifest = inputs["load-snapshot"].assetManifest;
    const assetsDir = join(ctx.outDir, "assets");
    mkdirSync(assetsDir, { recursive: true });
    if (!manifest) return { assetsDir, refs: [], itemIconMetadata: [] };

    const refs: EmittedAssetRef[] = [];
    const convertedByPngHash = new Map<string, { hash: string; outputPath: string }>();

    for (const asset of manifest.assets) {
      assertSnapshotRelativePng(asset.sourcePath);
      const source = join(ctx.snapshotDir, asset.sourcePath);
      if (!existsSync(source)) throw new Error(`missing snapshot asset: ${asset.sourcePath}`);
      const info = statSync(source);
      if (!info.isFile() || info.size === 0)
        throw new Error(`invalid empty snapshot asset: ${asset.sourcePath}`);

      let converted = convertedByPngHash.get(asset.pngHash);
      if (!converted) {
        const png = readFileSync(source);
        const webp = await sharp(png).webp({ quality: 82 }).toBuffer();
        const hash = sha256Hex(webp);
        const outputPath = join(assetsDir, `${hash}.webp`);
        if (!existsSync(outputPath)) writeFileSync(outputPath, webp);
        converted = { hash, outputPath };
        convertedByPngHash.set(asset.pngHash, converted);
      }

      refs.push({
        entityId: asset.entityId,
        entityRowId: asset.rowId,
        slot: asset.slot,
        assetKind: asset.kind,
        assetHash: converted.hash,
        outputPath: converted.outputPath,
      });
    }

    return { assetsDir, refs, itemIconMetadata: manifest.itemIconMetadata };
  },
};
```

- [x] **Step 5: Wire SQLite insertion**

Modify `pipeline/src/stages/emit-sqlite.ts` imports:

```ts
import type { EmitAssetsOutput } from "./emit-assets.ts";
```

Extend `EmitSqliteInputs`:

```ts
"emit-assets"?: EmitAssetsOutput;
```

Change the stage inputs:

```ts
inputs: ["load-descriptors", "load-snapshot", "emit-assets"],
```

After `emitItemReadModels(db, desc);`, insert asset refs. Task 4 will move this insertion before read-model emission and pass through icon color metadata.

```ts
const assetRefInsert = db.prepare(
  `INSERT INTO asset_refs (entity_id, entity_row_id, slot, asset_kind, asset_hash) VALUES (?, ?, ?, ?, ?)`,
);
for (const ref of inputs["emit-assets"]?.refs ?? []) {
  assetRefInsert.run(ref.entityId, ref.entityRowId, ref.slot, ref.assetKind, ref.assetHash);
}
```

- [x] **Step 6: Wire CLI stage order**

Modify `pipeline/src/cli.ts`:

```ts
import { emitAssets } from "./stages/emit-assets";
```

Change stages:

```ts
const stages = [loadDescriptors, loadSnapshot, validate, emitAssets, emitSqlite] as Stage<
  unknown,
  unknown
>[];
```

After SQLite output logging, add:

```ts
const a = result["emit-assets"] as { refs: unknown[]; assetsDir: string };
console.warn(`wrote ${a.refs.length} asset refs to ${a.assetsDir}`);
```

- [x] **Step 7: Update end-to-end pipeline test**

In `pipeline/test/end-to-end.test.ts`, import `emitAssets` and add it to all stage arrays:

```ts
import { emitAssets } from "$pipeline/stages/emit-assets";
```

```ts
const stages = [loadDescriptors, loadSnapshot, validate, emitAssets, emitSqlite] as Stage<
  unknown,
  unknown
>[];
```

Add assertions in the first test after overview count:

```ts
const assetRefCount = (db.query("SELECT COUNT(*) c FROM asset_refs").get() as { c: number }).c;
expect(assetRefCount).toBe(4);
```

Before closing the temp dir, assert at least one WebP file exists:

```ts
expect(existsSync(join(out, "assets"))).toBe(true);
```

- [x] **Step 8: Run focused tests**

Run:

```sh
bun test pipeline/test/assets.test.ts pipeline/test/end-to-end.test.ts
```

Expected: pass.

- [x] **Step 9: Commit**

```sh
git add pipeline/src/types.ts pipeline/src/stages/emit-assets.ts pipeline/src/stages/emit-sqlite.ts pipeline/src/cli.ts pipeline/test/assets.test.ts pipeline/test/end-to-end.test.ts
git commit -m "feat(pipeline): emit item icon webp assets"
```

---

### Task 4: Add display icon read models and explicit metadata

**Files:**

- Modify: `pipeline/src/stages/emit-read-models.ts`
- Modify: `pipeline/src/stages/emit-site-metadata.ts`
- Modify: `pipeline/src/sql/site-metadata-ddl.ts`
- Modify: `pipeline/src/types.ts`
- Modify: `pipeline/test/read-models.test.ts`
- Modify: `pipeline/test/site-metadata.test.ts`

- [x] **Step 1: Write failing read-model assertions**

In `pipeline/test/read-models.test.ts`, update the setup to include asset refs before `emitItemReadModels`:

```ts
db.exec(`
  CREATE TABLE asset_refs (
    entity_id TEXT NOT NULL,
    entity_row_id TEXT NOT NULL,
    slot TEXT NOT NULL,
    asset_kind TEXT NOT NULL,
    asset_hash TEXT NOT NULL,
    PRIMARY KEY (entity_id, entity_row_id, slot)
  );
`);
db.run(
  "INSERT INTO asset_refs (entity_id, entity_row_id, slot, asset_kind, asset_hash) VALUES (?, ?, ?, ?, ?)",
  "item",
  "fixture-iron-sword",
  "displayIcon",
  "image",
  "a".repeat(64),
);
const iconMetadata = [
  {
    entityId: "item",
    rowId: "fixture-iron-sword",
    displayIconColor: { r: 1, g: 1, b: 1, a: 1 },
    secondaryIconColor: null,
  },
  {
    entityId: "item",
    rowId: "fixture-leather-tunic",
    displayIconColor: { r: 0.25, g: 0.2, b: 0.15, a: 1 },
    secondaryIconColor: null,
  },
];
```

Change the overview query and assertions:

```ts
const overview = db
  .query(
    "SELECT id, name, variant, display_icon_hash, display_icon_color FROM item_overview_rows ORDER BY name",
  )
  .all() as {
  id: string;
  name: string;
  variant: string;
  display_icon_hash: string | null;
  display_icon_color: string | null;
}[];
expect(overview.find((r) => r.id === "fixture-iron-sword")?.display_icon_hash).toBe("a".repeat(64));
expect(overview.find((r) => r.id === "fixture-leather-tunic")?.display_icon_hash).toBeNull();
expect(overview.find((r) => r.id === "fixture-iron-sword")?.display_icon_color).toBe(
  JSON.stringify({ r: 1, g: 1, b: 1, a: 1 }),
);
expect(overview.find((r) => r.id === "fixture-leather-tunic")?.display_icon_color).toBe(
  JSON.stringify({ r: 0.25, g: 0.2, b: 0.15, a: 1 }),
);
```

Change the detail query assertion:

```ts
const detailIcon = db
  .query(
    "SELECT display_icon_hash, display_icon_color FROM item_detail_rows WHERE id = 'fixture-iron-sword'",
  )
  .get() as { display_icon_hash: string | null; display_icon_color: string | null };
expect(detailIcon.display_icon_hash).toBe("a".repeat(64));
expect(detailIcon.display_icon_color).toBe(JSON.stringify({ r: 1, g: 1, b: 1, a: 1 }));
```

- [x] **Step 2: Write failing metadata assertions**

In `pipeline/test/site-metadata.test.ts`, update the overview column query:

```ts
const cols = db
  .query(
    "SELECT field_id, renderer, sortable FROM site_overview_columns WHERE entity_id = 'item' ORDER BY position",
  )
  .all() as { field_id: string; renderer: string; sortable: number }[];
expect(cols).toEqual([
  { field_id: "name", renderer: "itemNameWithIcon", sortable: 1 },
  { field_id: "value", renderer: "text", sortable: 1 },
  { field_id: "weight", renderer: "text", sortable: 1 },
  { field_id: "variant", renderer: "text", sortable: 1 },
]);
```

- [x] **Step 3: Run focused tests and observe failures**

Run:

```sh
bun test pipeline/test/read-models.test.ts pipeline/test/site-metadata.test.ts
```

Expected: failures for missing columns `display_icon_hash`, `display_icon_color`, `renderer`, and `sortable`.

- [x] **Step 4: Extend overview metadata DDL and types**

Modify `pipeline/src/sql/site-metadata-ddl.ts` `site_overview_columns` table:

```sql
CREATE TABLE site_overview_columns (
  entity_id        TEXT NOT NULL,
  column_id        TEXT NOT NULL,
  field_id         TEXT NOT NULL,
  position         INTEGER NOT NULL,
  renderer         TEXT NOT NULL DEFAULT 'text',
  sortable         INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (entity_id, column_id)
);
```

Do not change `entity.json` for overview column metadata in this task. Emit deterministic metadata for the item name column from `emit-site-metadata.ts` so the existing descriptor schema remains stable.

- [x] **Step 5: Emit explicit renderer metadata**

Modify `pipeline/src/stages/emit-site-metadata.ts` insert statement:

```ts
const insertColumn = db.prepare(
  `INSERT INTO site_overview_columns (entity_id, column_id, field_id, position, renderer, sortable) VALUES (?, ?, ?, ?, ?, ?)`,
);
```

Change overview column insertion:

```ts
overview.columns.forEach((field, i) => {
  const renderer = entityId === "item" && field === "name" ? "itemNameWithIcon" : "text";
  insertColumn.run(entityId, `col_${field}`, field, i, renderer, 1);
});
```

This keeps the descriptor as the source for visible columns while declaring the media renderer in emitted site metadata.

- [x] **Step 6: Extend read-model DDL and inserts**

Modify `pipeline/src/stages/emit-read-models.ts` `ITEM_READ_MODEL_DDL`:

```sql
CREATE TABLE item_overview_rows (
  id                  TEXT NOT NULL PRIMARY KEY,
  name                TEXT,
  weight              REAL,
  value               INTEGER,
  variant             TEXT,
  display_icon_hash   TEXT,
  display_icon_color  TEXT
);
CREATE TABLE item_detail_rows (
  id                  TEXT NOT NULL PRIMARY KEY,
  name                TEXT,
  variant             TEXT,
  display_icon_hash   TEXT,
  display_icon_color  TEXT,
  fields_json         TEXT NOT NULL
);
```

Change `emitItemReadModels` signature and prepare metadata maps:

```ts
import type { SnapshotItemIconMetadata } from "../types.ts";

export function emitItemReadModels(
  db: Database,
  desc: LoadDescriptorsOutput,
  itemIconMetadata: SnapshotItemIconMetadata[] = [],
): void {
  const colorByItem = new Map(
    itemIconMetadata
      .filter((entry) => entry.entityId === "item")
      .map((entry) => [entry.rowId, JSON.stringify(entry.displayIconColor)]),
  );
```

Change overview insertion to a prepared statement so the color metadata stays outside canonical item fields:

```ts
const overviewInsert = db.prepare(
  `INSERT INTO item_overview_rows (id, name, weight, value, variant, display_icon_hash, display_icon_color) VALUES (?, ?, ?, ?, ?, ?, ?)`,
);
const overviewSource = db
  .query(
    `SELECT i.id, i.name, i.weight, i.value, i.variant, ar.asset_hash AS display_icon_hash
     FROM items i
     LEFT JOIN asset_refs ar
       ON ar.entity_id = 'item'
      AND ar.entity_row_id = i.id
      AND ar.slot = 'displayIcon'
      AND ar.asset_kind = 'image'`,
  )
  .all() as {
  id: string;
  name: string | null;
  weight: number | null;
  value: number | null;
  variant: string | null;
  display_icon_hash: string | null;
}[];
for (const row of overviewSource) {
  overviewInsert.run(
    row.id,
    row.name,
    row.weight,
    row.value,
    row.variant,
    row.display_icon_hash,
    colorByItem.get(row.id) ?? null,
  );
}
```

Change detail insert statement:

```ts
const insertDetail = db.prepare(
  `INSERT INTO item_detail_rows (id, name, variant, display_icon_hash, display_icon_color, fields_json) VALUES (?, ?, ?, ?, ?, ?)`,
);
```

Before the detail loop, prepare icon lookup:

```ts
const displayIconByItem = new Map<string, string | null>();
for (const row of db
  .query(
    `SELECT entity_row_id, asset_hash FROM asset_refs WHERE entity_id = 'item' AND slot = 'displayIcon' AND asset_kind = 'image'`,
  )
  .all() as { entity_row_id: string; asset_hash: string }[]) {
  displayIconByItem.set(row.entity_row_id, row.asset_hash);
}
```

Change `insertDetail.run`:

```ts
insertDetail.run(
  item.id,
  item.name,
  item.variant,
  displayIconByItem.get(item.id) ?? null,
  colorByItem.get(item.id) ?? null,
  JSON.stringify(fields),
);
```

- [x] **Step 7: Ensure `emit-sqlite` inserts refs before read models**

In `pipeline/src/stages/emit-sqlite.ts`, move asset ref insertion before read models and pass color metadata from `emit-assets`:

```ts
emitSiteMetadata(db, desc);
const assetRefInsert = db.prepare(
  `INSERT INTO asset_refs (entity_id, entity_row_id, slot, asset_kind, asset_hash) VALUES (?, ?, ?, ?, ?)`,
);
for (const ref of inputs["emit-assets"]?.refs ?? []) {
  assetRefInsert.run(ref.entityId, ref.entityRowId, ref.slot, ref.assetKind, ref.assetHash);
}
emitItemReadModels(db, desc, inputs["emit-assets"]?.itemIconMetadata ?? []);
```

- [x] **Step 8: Run focused tests**

Run:

```sh
bun test pipeline/test/read-models.test.ts pipeline/test/site-metadata.test.ts pipeline/test/assets.test.ts pipeline/test/end-to-end.test.ts
```

Expected: pass.

- [x] **Step 9: Commit**

```sh
git add pipeline/src/stages/emit-read-models.ts pipeline/src/stages/emit-site-metadata.ts pipeline/src/sql/site-metadata-ddl.ts pipeline/src/types.ts pipeline/test/read-models.test.ts pipeline/test/site-metadata.test.ts pipeline/src/stages/emit-sqlite.ts
git commit -m "feat(pipeline): expose item icon read models"
```

---

### Task 5: Generalize site generated-artifact sync and CI contract

**Files:**

- Create: `site/scripts/sync-generated-artifacts.mjs`
- Remove: `site/scripts/sync-data-sqlite.mjs` after replacement is green
- Modify: `site/package.json`
- Modify: `tooling.test.ts`
- Modify: `.github/workflows/ci.yml`
- Modify: `site/AGENTS.md`

- [ ] **Step 1: Write failing tooling tests for artifact sync**

Modify `tooling.test.ts` imports:

```ts
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
```

Replace the import:

```ts
import { syncGeneratedArtifacts } from "./site/scripts/sync-generated-artifacts.mjs";
```

Replace the deployment tooling tests with:

```ts
describe("site deployment tooling", () => {
  it("deploys by syncing generated pipeline artifacts before build", () => {
    expect(sitePackageJson.scripts["sync:generated"]).toBe(
      "bun run scripts/sync-generated-artifacts.mjs",
    );
    expect(sitePackageJson.scripts.build).toBe("bun run sync:generated && vite build");
    expect(sitePackageJson.scripts["cf-deploy"]).toBe("bun run build && wrangler deploy");
    expect(existsSync("site/scripts/sync-generated-artifacts.mjs")).toBe(true);
  });

  it("copies SQLite and assets while pruning stale managed assets", () => {
    const root = mkdtempSync(join(tmpdir(), "ardenfall-site-generated-"));
    try {
      const source = join(root, "pipeline", "dist");
      const target = join(root, "site", "static");
      mkdirSync(join(source, "assets"), { recursive: true });
      mkdirSync(join(target, "assets"), { recursive: true });
      writeFileSync(join(source, "data.sqlite"), "sqlite bytes");
      writeFileSync(join(source, "assets", "fresh.webp"), "fresh");
      writeFileSync(join(target, "assets", "stale.webp"), "stale");

      const result = syncGeneratedArtifacts({ sourceDir: source, targetDir: target });

      expect(result.sqliteBytes).toBe(12);
      expect(readFileSync(join(target, "data.sqlite"), "utf8")).toBe("sqlite bytes");
      expect(readFileSync(join(target, "assets", "fresh.webp"), "utf8")).toBe("fresh");
      expect(existsSync(join(target, "assets", "stale.webp"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects missing and empty generated asset bundles", () => {
    const root = mkdtempSync(join(tmpdir(), "ardenfall-site-generated-invalid-"));
    try {
      const source = join(root, "pipeline", "dist");
      const target = join(root, "site", "static");
      mkdirSync(source, { recursive: true });
      writeFileSync(join(source, "data.sqlite"), "sqlite bytes");

      expect(() => syncGeneratedArtifacts({ sourceDir: source, targetDir: target })).toThrow(
        /Missing generated asset bundle/,
      );

      mkdirSync(join(source, "assets"), { recursive: true });
      writeFileSync(join(source, "assets", "empty.webp"), "");
      expect(() => syncGeneratedArtifacts({ sourceDir: source, targetDir: target })).toThrow(
        /Invalid generated asset/,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

Extend CI test:

```ts
expect(ciWorkflow).toContain("bun test tooling.test.ts");
expect(ciWorkflow).toContain("site: ${{ steps.filter.outputs.site }}");
expect(ciWorkflow).toContain("- 'site/**'");
expect(ciWorkflow).toContain("- 'tooling.test.ts'");
expect(ciWorkflow).toContain("needs.changes.outputs.site == 'true'");
expect(ciWorkflow).toContain("needs.changes.outputs.fixtures == 'true'");
```

- [ ] **Step 2: Run tooling tests and observe failure**

Run:

```sh
bun test tooling.test.ts
```

Expected: import/package/CI assertions fail.

- [ ] **Step 3: Implement generated artifact sync**

Create `site/scripts/sync-generated-artifacts.mjs`:

```js
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const defaultSourceDir = resolve(import.meta.dirname, "../../pipeline/dist");
const defaultTargetDir = resolve(import.meta.dirname, "../static");

function assertNonEmptyFile(path, label) {
  if (!existsSync(path)) {
    throw new Error(
      `Missing generated ${label} at ${path}. Run controller export or pipeline:run before deploying.`,
    );
  }
  const info = statSync(path);
  if (!info.isFile() || info.size === 0) {
    throw new Error(`Invalid generated ${label} at ${path}. Expected a non-empty file.`);
  }
  return info.size;
}

function listFilesRecursive(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFilesRecursive(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function copyTree(source, target) {
  mkdirSync(target, { recursive: true });
  for (const sourcePath of listFilesRecursive(source)) {
    const relative = sourcePath.slice(source.length + 1);
    const targetPath = join(target, relative);
    assertNonEmptyFile(sourcePath, `asset ${relative}`);
    mkdirSync(dirname(targetPath), { recursive: true });
    copyFileSync(sourcePath, targetPath);
  }
}

export function syncGeneratedArtifacts({
  sourceDir = defaultSourceDir,
  targetDir = defaultTargetDir,
} = {}) {
  const sqliteSource = join(sourceDir, "data.sqlite");
  const sqliteBytes = assertNonEmptyFile(sqliteSource, "SQLite output");

  const sourceAssets = join(sourceDir, "assets");
  if (!existsSync(sourceAssets) || !statSync(sourceAssets).isDirectory()) {
    throw new Error(
      `Missing generated asset bundle at ${sourceAssets}. Run pipeline:run before deploying.`,
    );
  }
  const assetFiles = listFilesRecursive(sourceAssets).filter((path) => path.endsWith(".webp"));
  if (assetFiles.length === 0) {
    throw new Error(`Missing generated WebP assets under ${sourceAssets}.`);
  }

  mkdirSync(targetDir, { recursive: true });
  copyFileSync(sqliteSource, join(targetDir, "data.sqlite"));

  const targetAssets = join(targetDir, "assets");
  rmSync(targetAssets, { recursive: true, force: true });
  copyTree(sourceAssets, targetAssets);

  return { sourceDir, targetDir, sqliteBytes, assetCount: assetFiles.length };
}

if (import.meta.main) {
  const result = syncGeneratedArtifacts();
  process.stdout.write(
    `synced generated artifacts ${result.sourceDir} -> ${result.targetDir} (${result.sqliteBytes} sqlite bytes, ${result.assetCount} assets)\n`,
  );
}
```

- [ ] **Step 4: Update site scripts and guidance**

Modify `site/package.json` scripts:

```json
"build": "bun run sync:generated && vite build",
"sync:generated": "bun run scripts/sync-generated-artifacts.mjs",
"cf-deploy": "bun run build && wrangler deploy"
```

Remove `sync:data`.

Update `site/AGENTS.md` deployment line to say the script syncs `pipeline/dist/data.sqlite` and `pipeline/dist/assets/` into `site/static`.

- [ ] **Step 5: Update CI filters and tooling test execution**

Modify `.github/workflows/ci.yml` `changes.outputs`:

```yaml
site: ${{ steps.filter.outputs.site }}
```

Add filters:

```yaml
site:
  - "site/**"
  - "tooling.test.ts"
  - ".github/workflows/ci.yml"
  - "package.json"
  - "bun.lock"
  - "fixtures/**"
```

Change the site job:

```yaml
needs: changes
if: github.event_name == 'push' || needs.changes.outputs.pipeline == 'true' || needs.changes.outputs.site == 'true' || needs.changes.outputs.fixtures == 'true'
```

Add after `bun run codegen:validators` in a job that runs on every PR, preferably `lint`:

```yaml
- run: bun test tooling.test.ts
```

Keep the site job generating into `pipeline/dist`:

```yaml
- name: build synthetic generated artifacts for static prerender
  run: bun run pipeline:run fixtures/synthetic/snapshot pipeline/dist
```

- [ ] **Step 6: Remove old sync script**

After tests pass with the new script, delete:

```text
site/scripts/sync-data-sqlite.mjs
```

- [ ] **Step 7: Run focused tests**

Run:

```sh
bun test tooling.test.ts
bun run pipeline:run fixtures/synthetic/snapshot pipeline/dist
bun run --cwd site build
```

Expected:

- tooling tests pass;
- pipeline run writes `pipeline/dist/data.sqlite` and `pipeline/dist/assets/`;
- site build syncs both SQLite and assets before Vite build.

- [ ] **Step 9: Commit**

```sh
git add site/scripts/sync-generated-artifacts.mjs site/package.json site/AGENTS.md tooling.test.ts .github/workflows/ci.yml
git rm site/scripts/sync-data-sqlite.mjs
git commit -m "fix(site): sync generated deploy artifacts"
```

---

### Task 6: Wire site store and icon rendering

**Files:**

- Modify: `site/src/lib/store/items.ts`
- Modify: `site/src/lib/store/site-meta.ts`
- Modify: `site/src/lib/components/EntityTable.svelte`
- Modify: `site/src/routes/items/+page.ts`
- Modify: `site/src/routes/items/+page.svelte`
- Modify: `site/src/routes/items/[id]/+page.ts`
- Modify: `site/src/routes/items/[id]/+page.svelte`
- Create: `site/scripts/smoke-item-icons.mjs`
- Modify: `site/package.json`

- [ ] **Step 1: Add failing store and smoke tests**

Add script to `site/package.json`:

```json
"smoke:item-icons": "bun run scripts/smoke-item-icons.mjs"
```

Create `site/scripts/smoke-item-icons.mjs`:

```js
#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { join } from "node:path";

const overview = readFileSync(
  join(import.meta.dirname, "..", "src", "routes", "items", "+page.svelte"),
  "utf8",
);
const detail = readFileSync(
  join(import.meta.dirname, "..", "src", "routes", "items", "[id]", "+page.svelte"),
  "utf8",
);
const table = readFileSync(
  join(import.meta.dirname, "..", "src", "lib", "components", "EntityTable.svelte"),
  "utf8",
);
const store = readFileSync(
  join(import.meta.dirname, "..", "src", "lib", "store", "items.ts"),
  "utf8",
);

const required = [
  [store, "displayIconSrc"],
  [store, "display_icon_hash"],
  [table, "itemNameWithIcon"],
  [table, "sortable?: boolean"],
  [detail, "item-icon"],
  [detail, "{#if data.displayIconSrc}"],
  [detail, 'aria-hidden="true"'],
  [detail, 'alt=""'],
];

for (const [source, snippet] of required) {
  if (!source.includes(snippet)) throw new Error(`missing item icon snippet: ${snippet}`);
}

const overviewIconRequired = ['aria-hidden="true"', 'alt=""', "iconSrc(row)"];
for (const snippet of overviewIconRequired) {
  if (!table.includes(snippet)) {
    throw new Error(`overview item icon must stay decorative and data-driven: ${snippet}`);
  }
}

const detailWrapperIndex = detail.indexOf('class="item-icon');
const detailImageGuardIndex = detail.indexOf("{#if data.displayIconSrc}");
if (
  detailWrapperIndex < 0 ||
  detailImageGuardIndex < 0 ||
  detailWrapperIndex > detailImageGuardIndex
) {
  throw new Error("detail placeholder wrapper must exist outside the displayIconSrc branch.");
}
if (!detail.slice(detailWrapperIndex, detailImageGuardIndex).includes('aria-hidden="true"')) {
  throw new Error("detail placeholder wrapper must remain decorative.");
}

if (!table.includes("row[col.field]") || !table.includes("rowHref(row)")) {
  throw new Error("EntityTable must keep the row field as linked accessible text.");
}
if (!table.includes("const av = a[field]") || !table.includes("toggleSort(col)")) {
  throw new Error("EntityTable sorting must remain field-driven.");
}
const forbidden = ["title=", "Tooltip", "popover", "hovercard", "secondaryIcon"];
for (const snippet of forbidden) {
  if (overview.includes(snippet) || detail.includes(snippet) || table.includes(snippet)) {
    throw new Error(`Slice 3 item UI must not include tooltip/overlay snippet: ${snippet}`);
  }
}
```

Run:

```sh
bun run --cwd site smoke:item-icons
```

Expected: failure because icon rendering is not wired.

- [ ] **Step 2: Update store types and mapping**

Modify `site/src/lib/store/items.ts`:

```ts
import { query, queryOne } from "./index.js";

const assetSrc = (hash: string | null): string | null => (hash ? `/assets/${hash}.webp` : null);

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

export const listItemsOverview = async (): Promise<ItemOverviewRow[]> => {
  const rows = await query<ItemOverviewRecord>("SELECT * FROM item_overview_rows ORDER BY name");
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    weight: row.weight,
    value: row.value,
    variant: row.variant,
    displayIconSrc: assetSrc(row.display_icon_hash),
    displayIconColor: row.display_icon_color,
  }));
};

export const getItemDetail = async (id: string): Promise<ItemDetailRow | undefined> => {
  const row = await queryOne<ItemDetailRecord>("SELECT * FROM item_detail_rows WHERE id = ?", [id]);
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

- [ ] **Step 3: Update overview metadata store type**

Modify `site/src/lib/store/site-meta.ts` `SiteOverviewColumn`:

```ts
export interface SiteOverviewColumn {
  entity_id: string;
  column_id: string;
  field_id: string;
  position: number;
  renderer: "text" | "itemNameWithIcon";
  sortable: number;
}
```

- [ ] **Step 4: Add minimal table renderer/sort extension**

Modify `site/src/lib/components/EntityTable.svelte`:

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
  let sortField = $state<(keyof T & string) | null>(null);
  let sortDir = $state<"asc" | "desc">("asc");

  const sortedRows = $derived.by(() => {
    if (!sortField) return rows;
    const field = sortField;
    return [...rows].sort((a, b) => {
      const av = a[field];
      const bv = b[field];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  });

  function toggleSort(col: Column) {
    if (col.sortable === false) return;
    const field = col.field;
    if (sortField === field) {
      sortDir = sortDir === "asc" ? "desc" : "asc";
    } else {
      sortField = field;
      sortDir = "asc";
    }
  }

  function ariaSort(col: Column): "ascending" | "descending" | "none" {
    if (col.sortable === false || sortField !== col.field) return "none";
    return sortDir === "asc" ? "ascending" : "descending";
  }

  function iconSrc(row: T): string | null {
    const value = (row as T & { displayIconSrc?: unknown }).displayIconSrc;
    return typeof value === "string" && value.length > 0 ? value : null;
  }
</script>

<table class="w-full text-left text-sm">
  <thead class="bg-muted text-muted-foreground">
    <tr>
      {#each columns as col (col.id)}
        <th
          scope="col"
          aria-sort={ariaSort(col)}
          class={col.sortable === false
            ? "p-2 select-none"
            : "hover:bg-secondary cursor-pointer p-2 select-none"}
          onclick={() => toggleSort(col)}
        >
          {col.label}
          {#if sortField === col.field && col.sortable !== false}
            <span aria-hidden="true">{sortDir === "asc" ? "▲" : "▼"}</span>
          {/if}
        </th>
      {/each}
    </tr>
  </thead>
  <tbody>
    {#each sortedRows as row (row.id)}
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
                  <a href={rowHref(row)} class="underline">{row[col.field] ?? ""}</a>
                {:else}
                  <span>{row[col.field] ?? ""}</span>
                {/if}
              </span>
            {:else if i === 0 && rowHref}
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

- [ ] **Step 5: Pass metadata renderer through the page load**

Modify `site/src/routes/items/+page.ts` column mapping:

```ts
return {
  id: c.column_id,
  label: field?.label ?? c.field_id,
  field: c.field_id as keyof ItemOverviewRow & string,
  renderer: c.renderer,
  sortable: c.sortable !== 0,
};
```

`+page.svelte` already passes columns to `EntityTable`; do not add visible debug output or duplicate icon markup there. The overview icon branch belongs in `EntityTable.svelte`.

- [ ] **Step 6: Add detail icon data and rendering**

Modify `site/src/routes/items/[id]/+page.ts` return:

```ts
return {
  id: detail.id,
  name: detail.name,
  variant: detail.variant,
  displayIconSrc: detail.displayIconSrc,
  sections,
};
```

Modify `site/src/routes/items/[id]/+page.svelte` header:

```svelte
<a class="text-sm underline" href={resolve("/items")}>← back to items</a>
<div class="mt-2 flex items-center gap-3">
  <div
    class="item-icon bg-muted border-border flex size-14 shrink-0 items-center justify-center rounded border"
    aria-hidden="true"
  >
    {#if data.displayIconSrc}
      <img
        class="size-11 object-contain"
        src={data.displayIconSrc}
        alt=""
        loading="eager"
        decoding="async"
      />
    {/if}
  </div>
  <div>
    <h1 class="text-2xl font-bold">{data.name ?? data.id}</h1>
    {#if data.variant}
      <p class="text-muted-foreground">{data.variant}</p>
    {/if}
  </div>
</div>
```

Remove the old standalone `<h1>` and variant paragraph so headings do not duplicate.

- [ ] **Step 7: Run focused site checks**

Run:

```sh
bun run --cwd site smoke:item-icons
bun run --cwd site check
```

Expected: pass.

- [ ] **Step 9: Commit**

```sh
git add site/src/lib/store/items.ts site/src/lib/store/site-meta.ts site/src/lib/components/EntityTable.svelte site/src/routes/items/+page.ts site/src/routes/items/+page.svelte site/src/routes/items/[id]/+page.ts site/src/routes/items/[id]/+page.svelte site/scripts/smoke-item-icons.mjs site/package.json
git commit -m "feat(site): render item display icons"
```

---

### Task 7: Add mod asset manifest and behavior-derived icon slots

**Files:**

- Create: `mod/src/Dtos/AssetManifest.cs`
- Create: `mod/src/Assets/SpriteAssetExporter.cs`
- Create: `mod/src/Entities/Item/ItemIconSlots.cs`
- Modify: `mod/src/Entities/Item/ItemExtractor.cs`
- Modify: `mod/src/Extraction/ItemExtractionService.cs`
- Modify: `mod/src/Extraction/IItemExtractionCache.cs`
- Modify: `mod/src/Control/Handlers/RunFinalizeCommand.cs`
- Modify: `mod/src/Extraction/ExtractionService.cs` only for the legacy direct extraction path
- Modify: `mod/src/Emit/SnapshotWriter.cs`
- Create: `mod-tests/ItemIconSlotTests.cs`
- Create: `mod-tests/SpriteAssetExporterTests.cs`
- Modify: `mod-tests/RunFinalizeCommandTests.cs`

- [ ] **Step 1: Confirm the snapshot finalization path**

The normal control-plane publication path is `ItemExtractionService` → `EntityExportBatchCommand` chunk files → `RunFinalizeCommand` published snapshot. The older `ExtractionService` direct path also writes snapshots, but it is not the path used by `run.finalize`. Thread in-memory asset planning through `ItemExtractionService`/`IItemExtractionCache` and write assets plus `asset-manifest.json` in `RunFinalizeCommand`; then mirror the same helper into `ExtractionService` so both paths stay equivalent.

- [ ] **Step 2: Write failing icon slot behavior tests**

Create `mod-tests/ItemIconSlotTests.cs` with tests that do not require full spell/status-effect export:

```csharp
using Ardenfall;
using Ardenfall.Item;
using ArdenfallCompendium.Entities.Item;
using UnityEngine;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class ItemIconSlotTests
{
    [Fact]
    public void BaseItemColorUsesCategoryColorOrWhite()
    {
        var category = ScriptableObject.CreateInstance<ItemCategory>();
        category.categoryColor = new Color(0.2f, 0.3f, 0.4f, 1f);
        var color = ItemIconSlots.BaseDisplayColor(category);
        Assert.Equal(0.2f, color.r);
        Assert.Equal(0.3f, color.g);
        Assert.Equal(0.4f, color.b);
        Assert.Equal(1f, color.a);

        var fallback = ItemIconSlots.BaseDisplayColor(null);
        Assert.Equal(Color.white, fallback);
    }

    [Fact]
    public void SlateSpellColorUsesSpellIconColorOrWhite()
    {
        Assert.Equal(Color.white, ItemIconSlots.SlateSpellDisplayColor(null));
        var iconColor = new Color(0.2f, 0.4f, 1f, 1f);
        Assert.Equal(iconColor, ItemIconSlots.SlateSpellDisplayColor(iconColor));
    }

    [Fact]
    public void ThrowingPotionColorUsesStatusEffectIconColorOrWhite()
    {
        Assert.Equal(Color.white, ItemIconSlots.ThrowingPotionDisplayColor(null));
        var iconColor = new Color(0.1f, 0.8f, 0.2f, 1f);
        Assert.Equal(iconColor, ItemIconSlots.ThrowingPotionDisplayColor(iconColor));
    }
}
```

- [ ] **Step 3: Write failing sprite crop/hash tests**

Create `mod-tests/SpriteAssetExporterTests.cs` around a pure helper that takes raw RGBA bytes, width, height, and crop rect:

```csharp
using ArdenfallCompendium.Assets;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class SpriteAssetExporterTests
{
    [Fact]
    public void CropRgbaUsesRectPixelsInsteadOfWholeTexture()
    {
        var rgba = new byte[]
        {
            255, 0, 0, 255,     0, 255, 0, 255,
            0, 0, 255, 255,     255, 255, 0, 255,
        };

        var crop = SpriteAssetExporter.CropRgba(rgba, textureWidth: 2, textureHeight: 2, x: 1, y: 0, width: 1, height: 2);

        Assert.Equal(new byte[] { 0, 255, 0, 255, 255, 255, 0, 255 }, crop);
    }

    [Fact]
    public void Sha256HexIsContentStable()
    {
        var hash = SpriteAssetExporter.Sha256Hex(new byte[] { 1, 2, 3 });

        Assert.Equal("039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81", hash);
    }
}
```

- [ ] **Step 4: Run mod tests and observe failures**

Run:

```sh
dotnet test mod-tests/ArdenfallCompendium.Tests.csproj --filter "ItemIconSlotTests|SpriteAssetExporterTests"
```

Expected: compile failures for missing classes.

- [ ] **Step 5: Add asset manifest DTOs**

Create `mod/src/Dtos/AssetManifest.cs`:

```csharp
using System.Collections.Generic;
using Newtonsoft.Json;
using UnityEngine;

namespace ArdenfallCompendium.Dtos;

public sealed class AssetManifest
{
    [JsonProperty("schemaVersion")] public int SchemaVersion { get; init; } = 1;
    [JsonProperty("assets")] public List<AssetManifestEntry> Assets { get; init; } = new();
    [JsonProperty("itemIconMetadata")] public List<ItemIconMetadataEntry> ItemIconMetadata { get; init; } = new();
}

public sealed class AssetManifestEntry
{
    [JsonProperty("entityId")] public string EntityId { get; init; } = "";
    [JsonProperty("rowId")] public string RowId { get; init; } = "";
    [JsonProperty("slot")] public string Slot { get; init; } = "";
    [JsonProperty("kind")] public string Kind { get; init; } = "image";
    [JsonProperty("pngHash")] public string PngHash { get; init; } = "";
    [JsonProperty("sourcePath")] public string SourcePath { get; init; } = "";
}

public sealed class ItemIconMetadataEntry
{
    [JsonProperty("entityId")] public string EntityId { get; init; } = "item";
    [JsonProperty("rowId")] public string RowId { get; init; } = "";
    [JsonProperty("displayIconColor")] public AssetColorSnapshot DisplayIconColor { get; init; } = new();
    [JsonProperty("secondaryIconColor")] public AssetColorSnapshot? SecondaryIconColor { get; init; }
}

public sealed class AssetColorSnapshot
{
    [JsonProperty("r")] public float R { get; init; } = 1f;
    [JsonProperty("g")] public float G { get; init; } = 1f;
    [JsonProperty("b")] public float B { get; init; } = 1f;
    [JsonProperty("a")] public float A { get; init; } = 1f;

    public static AssetColorSnapshot FromColor(Color color) => new() { R = color.r, G = color.g, B = color.b, A = color.a };
}
```

- [ ] **Step 6: Add sprite exporter helpers**

Create `mod/src/Assets/SpriteAssetExporter.cs`:

```csharp
using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using UnityEngine;

namespace ArdenfallCompendium.Assets;

public sealed record SpriteAssetExport(string PngHash, string SourcePath);

public sealed class SpriteAssetExporter
{
    public static byte[] CropRgba(byte[] rgba, int textureWidth, int textureHeight, int x, int y, int width, int height)
    {
        if (textureWidth <= 0 || textureHeight <= 0 || width <= 0 || height <= 0) throw new ArgumentOutOfRangeException(nameof(width));
        if (x < 0 || y < 0 || x + width > textureWidth || y + height > textureHeight) throw new ArgumentOutOfRangeException(nameof(x));
        var output = new byte[width * height * 4];
        for (var row = 0; row < height; row++)
        {
            var sourceOffset = ((y + row) * textureWidth + x) * 4;
            var targetOffset = row * width * 4;
            Buffer.BlockCopy(rgba, sourceOffset, output, targetOffset, width * 4);
        }
        return output;
    }

    public static string Sha256Hex(byte[] bytes)
    {
        using var sha = SHA256.Create();
        var hash = sha.ComputeHash(bytes);
        var sb = new StringBuilder(hash.Length * 2);
        foreach (var b in hash) sb.Append(b.ToString("x2"));
        return sb.ToString();
    }

    public SpriteAssetExport WriteSpritePng(Sprite sprite, string stagingDir, string entityId)
    {
        if (sprite == null) throw new ArgumentNullException(nameof(sprite));
        var texture = sprite.texture;
        var rect = sprite.textureRect;
        var x = Mathf.RoundToInt(rect.x);
        var y = Mathf.RoundToInt(rect.y);
        var width = Mathf.RoundToInt(rect.width);
        var height = Mathf.RoundToInt(rect.height);
        var previous = RenderTexture.active;
        var rt = RenderTexture.GetTemporary(texture.width, texture.height, 0, RenderTextureFormat.ARGB32);
        try
        {
            Graphics.Blit(texture, rt);
            RenderTexture.active = rt;
            var readable = new Texture2D(texture.width, texture.height, TextureFormat.RGBA32, false);
            readable.ReadPixels(new Rect(0, 0, texture.width, texture.height), 0, 0);
            readable.Apply();
            var cropped = CropRgba(readable.GetRawTextureData().ToArray(), readable.width, readable.height, x, y, width, height);
            var croppedTexture = new Texture2D(width, height, TextureFormat.RGBA32, false);
            croppedTexture.LoadRawTextureData(cropped);
            croppedTexture.Apply();
            var png = croppedTexture.EncodeToPNG();
            var hash = Sha256Hex(png);
            var relativePath = $"assets/{entityId}/{hash}.png";
            var fullPath = Path.Combine(stagingDir, relativePath.Replace('/', Path.DirectorySeparatorChar));
            Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);
            if (!File.Exists(fullPath)) File.WriteAllBytes(fullPath, png);
            return new SpriteAssetExport(hash, relativePath);
        }
        finally
        {
            RenderTexture.active = previous;
            RenderTexture.ReleaseTemporary(rt);
        }
    }
}
```

- [ ] **Step 7: Add icon slot behavior helpers**

Create `mod/src/Entities/Item/ItemIconSlots.cs`:

```csharp
using Ardenfall;
using Ardenfall.Item;
using ArdenfallCompendium.Assets;
using ArdenfallCompendium.Dtos;
using UnityEngine;

namespace ArdenfallCompendium.Entities.Item;

public static class ItemIconSlots
{
    public static Color BaseDisplayColor(ItemCategory? category) => category?.categoryColor ?? Color.white;

    public static Color SlateSpellDisplayColor(Color? spellIconColor) => spellIconColor ?? Color.white;

    public static Color ThrowingPotionDisplayColor(Color? statusEffectIconColor) => statusEffectIconColor ?? Color.white;

    private static Color? SlateSpellIconColor(SlateSpellItemData slate) =>
        slate.spellData.Get()?.spellData?.Color?.IconColor;

    private static Color? ThrowingPotionIconColor(ThrowingPotionData potion)
    {
        var effects = potion.areaOfEffect.Get();
        return effects != null && effects.Length > 0 ? effects[0]?.StatusEffect?.Color?.IconColor : null;
    }

    public static Sprite? DisplayIcon(ItemData item)
    {
        if (item is SlateSpellItemData slate)
        {
            var spellIcon = slate.spellData.Get()?.spellData?.icon;
            if (spellIcon != null) return spellIcon;
        }
        if (item is ThrowingPotionData potion)
        {
            var effects = potion.areaOfEffect.Get();
            var statusIcon = effects != null && effects.Length > 0 ? effects[0]?.StatusEffect?.statusEffectIcon : null;
            if (statusIcon != null) return statusIcon;
        }
        return item.icon.Get() ?? item.category.Get()?.defaultItemIcon;
    }

    public static Color DisplayColor(ItemData item)
    {
        if (item is SlateSpellItemData slate) return SlateSpellDisplayColor(SlateSpellIconColor(slate));
        if (item is ThrowingPotionData potion)
        {
            return ThrowingPotionDisplayColor(ThrowingPotionIconColor(potion));
        }
        return BaseDisplayColor(item.category.Get());
    }

    public static Sprite? SecondaryIcon(ItemData item)
    {
        if (item is SlateSpellItemData || item is ThrowingPotionData) return item.icon.Get();
        return null;
    }

    public static Color? SecondaryColor(ItemData item)
    {
        if (item is SlateSpellItemData slate) return slate.quickslotSecondaryColor.Get();
        if (item is ThrowingPotionData potion) return potion.quickslotSecondaryColor.Get();
        return null;
    }
}

public sealed record ItemIconAssetSlot(string RowId, string Slot, Sprite Sprite);

public sealed class ItemIconAssetPlan
{
    public List<ItemIconAssetSlot> Slots { get; } = new();
    public AssetManifest Manifest { get; } = new();
}

public static class ItemIconAssetPlanner
{
    public static void CaptureItem(ItemIconAssetPlan plan, ItemData item, string rowId)
    {
        CaptureSlot(plan, rowId, "displayIcon", ItemIconSlots.DisplayIcon(item));
        CaptureSlot(plan, rowId, "secondaryIcon", ItemIconSlots.SecondaryIcon(item));
        var secondaryColor = ItemIconSlots.SecondaryColor(item);
        plan.Manifest.ItemIconMetadata.Add(new ItemIconMetadataEntry
        {
            EntityId = "item",
            RowId = rowId,
            DisplayIconColor = AssetColorSnapshot.FromColor(ItemIconSlots.DisplayColor(item)),
            SecondaryIconColor = secondaryColor.HasValue ? AssetColorSnapshot.FromColor(secondaryColor.Value) : null,
        });
    }

    private static void CaptureSlot(ItemIconAssetPlan plan, string rowId, string slot, Sprite? sprite)
    {
        if (sprite != null) plan.Slots.Add(new ItemIconAssetSlot(rowId, slot, sprite));
    }
}

public sealed class ItemAssetManifestWriter
{
    private readonly SpriteAssetExporter _exporter;

    public ItemAssetManifestWriter(SpriteAssetExporter exporter)
    {
        _exporter = exporter;
    }

    public void WriteSlots(string outputDir, ItemIconAssetPlan plan)
    {
        foreach (var slot in plan.Slots)
        {
            var exported = _exporter.WriteSpritePng(slot.Sprite, outputDir, "item");
            plan.Manifest.Assets.Add(new AssetManifestEntry
            {
                EntityId = "item",
                RowId = slot.RowId,
                Slot = slot.Slot,
                Kind = "image",
                PngHash = exported.PngHash,
                SourcePath = exported.SourcePath,
            });
        }
    }
}
```

- [ ] **Step 8: Thread asset manifest writing through snapshot finalization**

Extend `SnapshotWriter` with:

```csharp
public void WriteAssetManifest(string stagingDir, AssetManifest manifest)
{
    var json = JsonConvert.SerializeObject(manifest, JsonSettings.Default);
    File.WriteAllText(Path.Combine(stagingDir, "asset-manifest.json"), json);
}
```

Modify `mod/src/Entities/Item/ItemExtractor.cs` constructors and fields:

```csharp
private readonly IItemAssetSource _source;
private readonly ItemIconAssetPlan? _assetPlan;

public ItemExtractor()
    : this(new BuiltLookupTableItemAssetSource(), assetPlan: null)
{
}

public ItemExtractor(IItemAssetSource source)
    : this(source, assetPlan: null)
{
}

public ItemExtractor(IItemAssetSource source, ItemIconAssetPlan? assetPlan)
{
    _source = source;
    _assetPlan = assetPlan;
}
```

Inside `Walk()`, after `variantId` is assigned and before yielding `ItemSnapshotRow`, add:

```csharp
if (_assetPlan != null) ItemIconAssetPlanner.CaptureItem(_assetPlan, asset, guid);
```

This capture step is pure in-memory planning: it stores sprite references and color metadata in the cache state, but it does not write files. `entity.plan` therefore remains read-only with respect to the filesystem.

Modify `mod/src/Extraction/IItemExtractionCache.cs`:

```csharp
IReadOnlyList<ItemSnapshotRow> GetOrExtract(CompendiumRun run);
ItemIconAssetPlan GetAssetPlan(CompendiumRun run);
IReadOnlyList<Diagnostic> GetWalkerDiagnostics(CompendiumRun run);
```

Update `mod-tests/RunFinalizeCommandTests.cs` in the same step: add `GetAssetPlan(CompendiumRun run)` to its fake `IItemExtractionCache` implementation and return an `ItemIconAssetPlan`. Existing tests that do not cover assets use an empty plan. Add one focused finalize test with a fake plan containing one `ItemIconAssetSlot` and assert `run.finalize` writes `asset-manifest.json`, returns it in artifacts, and keeps the manifest hash in the published snapshot manifest.

Modify `mod/src/Extraction/ItemExtractionService.cs` state creation:

```csharp
var assetPlan = new ItemIconAssetPlan();
var extractor = new ItemExtractor(_source, assetPlan);
var rows = new List<ItemSnapshotRow>();
foreach (var row in extractor.Walk()) rows.Add(row);

state = new ExtractionState(rows, assetPlan, extractor.Diagnostics.AsReadOnly());
```

Change the state record and add:

```csharp
public ItemIconAssetPlan GetAssetPlan(CompendiumRun run) => GetState(run).AssetPlan;

private sealed record ExtractionState(
    IReadOnlyList<ItemSnapshotRow> Rows,
    ItemIconAssetPlan AssetPlan,
    IReadOnlyList<Diagnostic> WalkerDiagnostics);
```

Modify `mod/src/Control/Handlers/RunFinalizeCommand.cs` after writing `items.json` and before building hashes:

```csharp
var assetPlan = _items.GetAssetPlan(run);
new ItemAssetManifestWriter(new SpriteAssetExporter()).WriteSlots(publishedDir, assetPlan);
var assetManifest = assetPlan.Manifest;
var assetManifestJson = JsonConvert.SerializeObject(assetManifest, JsonSettings.Default);
var assetManifestPath = Path.Combine(publishedDir, "asset-manifest.json");
File.WriteAllText(assetManifestPath, assetManifestJson);
var assetManifestHash = ManifestBuilder.Sha256Hex(assetManifestJson);
```

Add `asset-manifest.json` to manifest hashes:

```csharp
var hashes = new Dictionary<string, string>
{
    ["items.json"] = itemHash,
    ["asset-manifest.json"] = assetManifestHash,
};
```

Include `asset-manifest` in returned artifacts.

Mirror the same `ItemIconAssetPlan`/`ItemAssetManifestWriter` wiring in `mod/src/Extraction/ExtractionService.cs` so the legacy direct extraction path also writes assets and `asset-manifest.json` inside its staging directory before `Publish`.

Keep asset writes out of `entity.plan`; only `run.finalize` and the legacy direct extraction path write PNGs or `asset-manifest.json`.

- [ ] **Step 9: Keep color metadata out of canonical item fields**

Do not add `displayIconColorJson` or `secondaryIconColorJson` to `entities/item/entity.json`, and do not write those values from `ExtractItem.Extract`. The approved boundary is the asset/read-model contract, not canonical gameplay fields.

The color metadata is emitted by `ItemIconAssetPlanner.CaptureItem(...)` into `AssetManifest.ItemIconMetadata`, then Task 4 projects it into `item_overview_rows.display_icon_color` and `item_detail_rows.display_icon_color`.

Add an assertion to `mod-tests/ItemIconSlotTests.cs` that `ItemIconAssetPlanner.CaptureItem(...)` appends one `ItemIconMetadataEntry` for an item even when no icon sprite is exported. Use the smallest constructible item fixture already used by existing mod tests, and assert the plan has zero `slots` entries, zero manifest `assets` entries, and one `itemIconMetadata` entry.

- [ ] **Step 10: Run focused mod tests**

Run:

```sh
dotnet test mod-tests/ArdenfallCompendium.Tests.csproj --filter "ItemIconSlotTests|SpriteAssetExporterTests|RunFinalizeCommandTests|ItemAdapterBehaviorTests"
```

Expected: pass.

- [ ] **Step 11: Commit**

```sh
git add mod/src/Dtos/AssetManifest.cs mod/src/Assets/SpriteAssetExporter.cs mod/src/Entities/Item/ItemIconSlots.cs mod/src/Entities/Item/ItemExtractor.cs mod/src/Extraction/IItemExtractionCache.cs mod/src/Extraction/ItemExtractionService.cs mod/src/Extraction/ExtractionService.cs mod/src/Control/Handlers/RunFinalizeCommand.cs mod/src/Emit/SnapshotWriter.cs mod-tests/ItemIconSlotTests.cs mod-tests/SpriteAssetExporterTests.cs mod-tests/RunFinalizeCommandTests.cs
git commit -m "feat(mods): export item icon asset slots"
```

---

### Task 8: Final integration verification and roadmap closeout

**Files:**

- Modify: `docs/superpowers/roadmap.md`

- [ ] **Step 1: Run generated validator and type gates**

Run:

```sh
bun run codegen:validators
bun run typecheck
```

Expected: both pass.

- [ ] **Step 2: Run pipeline and tooling tests**

Run:

```sh
bun test pipeline/test
bun test tooling.test.ts
bun run check:fixtures
```

Expected: all tests pass.

- [ ] **Step 3: Run site checks and build through generated artifact sync**

Run:

```sh
bun run pipeline:run fixtures/synthetic/snapshot pipeline/dist
bun run --cwd site smoke:item-icons
bun run --cwd site check
bun run --cwd site build
```

Expected:

- pipeline emits `pipeline/dist/data.sqlite` and at least one `pipeline/dist/assets/*.webp`;
- site smoke passes;
- Svelte check passes;
- build syncs generated SQLite/assets and completes.
- `site/static/data.sqlite` exists after build and at least one `site/static/assets/*.webp` exists after sync;

- [ ] **Step 4: Run mod formatting/tests where local libs are available**

Run:

```sh
dotnet format mod/ArdenfallCompendium.csproj --verify-no-changes
dotnet test mod-tests/ArdenfallCompendium.Tests.csproj
```

Expected: pass when `mod/libs/` contains local Ardenfall/Unity/HotRepl DLLs. If the environment lacks redistributable game DLLs, record the exact missing reference error and still complete all JS/site gates.

- [ ] **Step 5: Run full lint/format gates**

Run:

```sh
bun run format:check
bun run lint
git diff --check
```

Expected: pass. Existing allowed warnings in decompile tooling may remain only if lint exits zero.

- [ ] **Step 6: Update roadmap status**

After all applicable gates pass, update `docs/superpowers/roadmap.md` Slice 3 status from `planned` to `done` and add a concise evidence note naming the successful synthetic pipeline/site build and any live smoke snapshot if one was run.

Do not mark Slice 3 done if generated assets do not flow through `site build` or if item pages do not render icons/placeholders.

- [ ] **Step 7: Commit closeout**

```sh
git add docs/superpowers/roadmap.md
git commit -m "docs(items): mark item icon slice complete"
```

- [ ] **Step 8: Final status check**

Run:

```sh
git status --short --branch
```

Expected: clean working tree, branch ahead by implementation commits only.
