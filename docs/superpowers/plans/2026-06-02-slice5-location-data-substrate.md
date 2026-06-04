# Slice 5 Location Data Substrate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract Ardenfall `LocationAsset` data into deterministic canonical SQLite location/map read models without shipping public map UI.

**Architecture:** The mod emits explicit location DTOs from live `LocationAsset` runtime assets. The pipeline canonicalises source Unity `Vector3` values into compendium Cartesian map coordinates exactly once, emits descriptor-owned `map_layers` metadata, and produces location map read models for the future deck.gl map slice. The site does not gain a public `/map` or `/locations` route in this slice.

**Tech Stack:** C# / BepInEx 5 / HotRepl typed commands, Newtonsoft.Json DTOs, Unity `Vector3` and `Bounds`, Bun TypeScript pipeline, Bun SQLite, JSON Schema/Ajv validators, Prettier/ESLint/lefthook.

---

## Grounding sources

Before executing code tasks, read these sources in this order:

1. `docs/superpowers/specs/2026-06-02-slice5-location-data-substrate-design.md`.
2. `mod/AGENTS.md`, `pipeline/AGENTS.md`, and `site/AGENTS.md`.
3. Decompiled source cache:
   - `.decompiled/0.0.10.91-63c576261184/csharp/Ardenfall/LocationAsset.cs`
   - `.decompiled/0.0.10.91-63c576261184/csharp/Ardenfall/MapLocationManager.cs`
   - `.decompiled/0.0.10.91-63c576261184/csharp/Ardenfall/MapData.cs`
   - `.decompiled/0.0.10.91-63c576261184/csharp/Ardenfall/UI/LocationInfoUI.cs`
   - `.decompiled/0.0.10.91-63c576261184/csharp/Ardenfall/Nodes/AddLocationMapMarker.cs`
4. Official docs already cited by the design spec:
   - Unity coordinates: https://learn.microsoft.com/en-us/windows/mixed-reality/develop/unity/coordinate-systems-in-unity
   - Unity `Vector3`: https://docs.unity3d.com/ScriptReference/Vector3.html
   - Unity `Bounds`: https://docs.unity3d.com/ScriptReference/Bounds.html
   - Unity `Bounds.Contains`: https://docs.unity3d.com/ScriptReference/Bounds.Contains.html
   - deck.gl `OrthographicView`: https://deck.gl/docs/api-reference/core/orthographic-view
   - deck.gl `TileLayer`: https://deck.gl/docs/api-reference/geo-layers/tile-layer

Source facts this plan depends on:

- `LocationAsset : ScriptableObject` has `enabled`, `locationName`, `locationID`, `map`, `showOnMap`, `showOnMapDebugOnly`, `icon`, `mapPosition`, `allowFastTravel`, `fastTravelPosition`, `displayOnEnterVolume`, and `List<LocationAsset.Volume> volumes`.
- `LocationAsset.Volume` has `Vector3 center` and `Vector3 size`.
- `LocationAsset.IsInside(Vector3 worldPosition, MapData map)` rejects mismatched maps and checks each volume with `new Bounds { center = volume.center, size = volume.size }.Contains(worldPosition)`.
- `MapLocationManager.GetLocations()` returns `BuiltLookupTable.GetAssetsOfType<LocationAsset>().Where(loc => loc.enabled).ToList()`.
- `MapLocationManager` save state keys by `location.locationID`, so `locationID` is captured as `gameLocationId`, but compendium row id remains the `BuiltLookupTable` GUID.
- Unity `Bounds` is axis-aligned; `Bounds.Contains` includes points on min/max edges and returns false if any extents are negative. Since extents are `size / 2`, negative source sizes are invalid for gameplay containment and must be diagnosed.
- Future deck.gl map work should consume already-canonical Cartesian coordinates. Slice 5 emits `map_x = source.x`, `map_y = -source.z`, and `elevation = source.y`.

## File structure

### Create

- `docs/superpowers/specs/2026-06-02-location-source-audit.md` — source audit with decompile hashes, official-doc references, and extraction decisions.
- `entities/location/entity.json` — descriptor-owned location fields and map layer metadata; no public `site` route.
- `mod/src/Entities/Location/LocationSnapshot.cs` — JSON DTOs for location rows, vectors, and volumes.
- `mod/src/Entities/Location/ILocationAssetSource.cs` — testable asset-source abstraction plus `BuiltLookupTableLocationAssetSource`.
- `mod/src/Entities/Location/LocationExtractor.cs` — location walker that emits explicit DTOs and diagnostics.
- `mod/src/Extraction/ILocationExtractionCache.cs` — finalize-time cache interface.
- `mod/src/Extraction/LocationExtractionService.cs` — per-run extraction cache for locations.
- `mod-tests/LocationExtractorTests.cs` — extractor tests for rows, GUID failures, disabled source filtering, and volume diagnostics.
- `mod-tests/LocationSnapshotTests.cs` — JSON contract test for location envelope shape.
- `pipeline/src/sql/location-ddl.ts` — canonical location table DDL.
- `pipeline/src/entities/location/canonicaliser.ts` — location canonicalisation and coordinate transform helpers.
- `pipeline/src/entities/location/read-models.ts` — `location_map_points` / `location_map_volumes` read-model emission.
- `pipeline/test/location-canonicaliser.test.ts` — coordinate, volume, and diagnostic tests.
- `fixtures/synthetic/snapshot/locations.json` — synthetic point + area location envelope.

### Modify

- `docs/superpowers/roadmap.md` — reflect actual implemented state and Slice 5 scope without changelog prose.
- `docs/superpowers/plans/` — remove completed active plans once roadmap/spec state captures their implemented state.
- `schemas/entity.schema.json` — extend `map` metadata with `renderKind`, `legendLabel`, and `zOrder`.
- `pipeline/src/types.ts` — add `SiteMap.renderKind`, `legendLabel`, `zOrder`, and location snapshot field types.
- `pipeline/src/sql/site-metadata-ddl.ts` — add `map_layers` table.
- `pipeline/src/stages/emit-site-metadata.ts` — emit map layers for descriptors with `map`, even when `site` is absent.
- `pipeline/src/entities/registry.ts` — add location canonicalizer and map-read-model support coverage.
- `pipeline/src/stages/emit-sqlite.ts` — run location DDL/canonicaliser and location map read models.
- `pipeline/src/stages/emit-read-models.ts` — facade exports and orchestrator call for location read models.
- `pipeline/test/load-descriptors.test.ts` — descriptor and coverage tests for map-only location.
- `pipeline/test/site-metadata.test.ts` — `map_layers` emission tests.
- `pipeline/test/read-models.test.ts` — location map read-model tests.
- `pipeline/test/end-to-end.test.ts` — assert fixture build contains location tables and map metadata.
- `controller/src/validate-snapshot.ts` — require `locations.json` and manifest `counts.location`.
- `controller/test/export-orchestrator.test.ts` — update validation fixtures for location artifacts.
- `mod/src/Control/CompendiumCommandRegistry.cs` — inject location extraction cache into `RunFinalizeCommand`.
- `mod/src/Control/Handlers/RunFinalizeCommand.cs` — write `locations.json`, count it, include diagnostics/artifact refs.
- `mod-tests/RunFinalizeCommandTests.cs` — verify finalize emits and counts locations.
- `mod-tests/TypedCommandRegistryTests.cs` — update constructor call sites if needed.
- `fixtures/synthetic/manifest.json` — add location selection and hashes.
- `fixtures/synthetic/snapshot/manifest.json` — add location count and `locations.json` hash.
- `pipeline/dist/validate-entity.mjs` and `pipeline/dist/validate-entity.d.mts` — generated by `bun run codegen:validators`.

---

## Task 1: Source audit and roadmap reconciliation

**Files:**

- Create: `docs/superpowers/specs/2026-06-02-location-source-audit.md`
- Modify: `docs/superpowers/roadmap.md`
- Remove: completed active plan files only after roadmap/spec state captures their current state

- [ ] **Step 1: Write the source audit document**

Create `docs/superpowers/specs/2026-06-02-location-source-audit.md` with this content, then adjust only if re-reading the decompiled source contradicts it:

````markdown
# Location Source Audit

Date: 2026-06-02
Status: Accepted for Slice 5 implementation

## Sources and hashes

Game version: `0.0.10.91`

Assembly audited:

```text
mod/libs/Assembly-CSharp.dll
sha256 63c57626118485d98c8f78614fe77f14723ad57e663c4055b8989a8cb82147c3
```

Local decompile output, ignored by git:

```text
.decompiled/0.0.10.91-63c576261184/
```

Official API references used for geometry decisions:

- Unity `Vector3`: https://docs.unity3d.com/ScriptReference/Vector3.html
- Unity `Bounds`: https://docs.unity3d.com/ScriptReference/Bounds.html
- Unity `Bounds.Contains`: https://docs.unity3d.com/ScriptReference/Bounds.Contains.html
- deck.gl `OrthographicView`: https://deck.gl/docs/api-reference/core/orthographic-view
- deck.gl `TileLayer`: https://deck.gl/docs/api-reference/geo-layers/tile-layer

## Authoritative runtime source

`MapLocationManager.GetLocations()` is the runtime location inventory. It lazily
loads `BuiltLookupTable.GetAssetsOfType<LocationAsset>()`, filters to
`loc.enabled`, and caches the result. Slice 5 follows this source order through a
`BuiltLookupTableLocationAssetSource` so disabled locations do not silently enter
public map data.

`LocationAsset` is the location content asset. Relevant fields:

| Field                  | Meaning in compendium                                              |
| ---------------------- | ------------------------------------------------------------------ |
| `locationName`         | public display name                                                |
| `locationID`           | game state key, captured as `gameLocationId`                       |
| `map`                  | source map asset; captured as asset ref plus `map.id`              |
| `showOnMap`            | marker should appear on game map                                   |
| `showOnMapDebugOnly`   | marker is debug-only in game; keep as data, do not show by default |
| `icon`                 | future marker icon asset; no asset export in Slice 5               |
| `mapPosition`          | point marker source position                                       |
| `allowFastTravel`      | fast-travel flag                                                   |
| `fastTravelPosition`   | fast-travel source position                                        |
| `displayOnEnterVolume` | discovery banner behavior flag                                     |
| `volumes`              | axis-aligned enter/discovery volumes                               |

## Identity decision

The compendium row id is the `BuiltLookupTable` GUID for the `LocationAsset`.
`locationID` remains a captured field because game state and FlowCanvas nodes use
it, but it is not the compendium primary key. A GUID-missing location emits
`lookupAssetGuidMissing` on field `id` and no row.

## Geometry decision

Unity `Vector3` source coordinates are preserved in snapshot fields. Pipeline
canonicalisation emits compendium map coordinates once:

```text
map_x = source.x
map_y = -source.z
elevation = source.y
```

`LocationAsset.Volume` is converted as an axis-aligned box because game behavior
uses `new Bounds { center = volume.center, size = volume.size }.Contains(...)`.
Negative size components are invalid because Unity documents that negative
`Bounds.extents` make `Bounds.Contains` always false. Zero horizontal size is a
degenerate map area and is diagnostic-only; the row remains available for audit.

## Slice 5 exclusions

- no public `/map` route;
- no public `/locations` route;
- no deck.gl dependency;
- no tile capture;
- no marker icon export;
- no map-supporting entities.
````

- [ ] **Step 2: Reconcile `docs/superpowers/roadmap.md` state**

Update the roadmap so it describes implemented and planned state only:

- Add a done entry after Slice 4 for **Slice 4.5 — Items presentation closure** with deliverables: stat/category/tag/term public entities, slug routes, tooltip composer closure, item relationship target closure.
- Add a done entry for **Operational slice — HotRepl Phase 4a control migration** if the existing HotRepl entry does not already capture Phase 4a terms from `mod/AGENTS.md`.
- Add a done entry for **Architecture cleanup and artifact hardening** with deliverables: descriptor-owned routes, entity-owned read models, lean item overview, SQLite artifact validation, Worker `nodejs_compat` outcome, descriptor coverage diagnostics.
- Update Slice 5 to reference `docs/superpowers/specs/2026-06-02-slice5-location-data-substrate-design.md` and this audit.
- Keep prose state-oriented. Do not list commit hashes except where existing roadmap style already requires a merge/completion reference.

- [ ] **Step 3: Remove completed active plans captured by roadmap/specs**

After the roadmap captures the implemented state, remove completed active implementation plans that are no longer active:

```text
docs/superpowers/plans/2026-05-20-items-presentation-closure.md
docs/superpowers/plans/2026-05-20-items-presentation-closure/
docs/superpowers/plans/2026-05-20-hotrepl-export-correctness.md
docs/superpowers/plans/2026-05-22-ardenfall-hotrepl-v2-migration.md
docs/superpowers/plans/2026-05-23-hotrepl-phase4a-consumer-migration.md
docs/superpowers/plans/2026-05-26-architecture-cleanup-hardening.md
```

Do not remove `docs/superpowers/plans/2026-06-02-slice5-location-data-substrate.md`; it is the active plan.

- [ ] **Step 4: Verify docs formatting**

Run:

```bash
bunx prettier --check docs/superpowers/roadmap.md docs/superpowers/specs/2026-06-02-location-source-audit.md docs/superpowers/plans/2026-06-02-slice5-location-data-substrate.md
```

Expected: PASS.

- [ ] **Step 5: Commit docs state**

```bash
git add docs/superpowers/roadmap.md docs/superpowers/specs/2026-06-02-location-source-audit.md docs/superpowers/plans
git commit -m "docs: reconcile roadmap for location slice"
```

---

## Task 2: Location descriptor and map-layer metadata

**Files:**

- Create: `entities/location/entity.json`
- Modify: `schemas/entity.schema.json`
- Modify: `pipeline/src/types.ts`
- Modify: `pipeline/src/sql/site-metadata-ddl.ts`
- Modify: `pipeline/src/stages/emit-site-metadata.ts`
- Modify: `pipeline/src/entities/registry.ts`
- Modify: `pipeline/test/load-descriptors.test.ts`
- Modify: `pipeline/test/site-metadata.test.ts`
- Generated: `pipeline/dist/validate-entity.mjs`
- Generated: `pipeline/dist/validate-entity.d.mts`

- [ ] **Step 1: Add failing descriptor and map metadata tests**

In `pipeline/test/load-descriptors.test.ts`, add this case after the item-tag descriptor test:

```ts
it("loads the map-only location descriptor", async () => {
  const result = await loadDescriptors.run(
    {},
    {
      workspaceRoot: ".",
      snapshotDir: "",
      outDir: "",
      log: () => undefined,
    },
  );
  const location = result.entities.location;
  if (!location) throw new Error("location entity not loaded");

  expect(location.site).toBeUndefined();
  expect(location.map).toEqual({
    layer: "locations",
    renderKind: "point-or-polygon",
    icon: "location",
    color: [120, 170, 255],
    radius: 6,
    tooltip: ["name"],
    legendLabel: "Locations",
    zOrder: 100,
  });
  expect(location.fields.map((field) => field.name)).toEqual([
    "id",
    "gameLocationId",
    "name",
    "enabled",
    "mapId",
    "showOnMap",
    "showOnMapDebugOnly",
    "allowFastTravel",
    "displayOnEnterVolume",
  ]);
});
```

Update the coverage test in the same file so the committed map-only location descriptor is accepted:

```ts
it("accepts every committed public or mapped descriptor in the pipeline support registry", async () => {
  const result = await loadDescriptors.run(
    {},
    {
      workspaceRoot: ".",
      snapshotDir: "",
      outDir: "",
      log: () => undefined,
    },
  );
  expect(() => validateDescriptorCoverage(result)).not.toThrow();
});
```

Add this coverage-failure case after the existing public-route failure test:

```ts
it("reports missing map read-model support by descriptor id", () => {
  expect(() =>
    validateDescriptorCoverage({
      entities: {
        location: {
          id: "location",
          label: { singular: "Location", plural: "Locations" },
          extraction: { root: "MapLocationManager.GetLocations" },
          fields: [{ name: "id", type: "id", from: "guid", missingPolicy: "fatal" }],
          map: { layer: "locations" },
        },
      },
      variants: { location: [] },
    }),
  ).toThrow(/descriptor 'location' has no map read-model emitter for layer 'locations'/);
});
```

In `pipeline/test/site-metadata.test.ts`, add this test:

```ts
it("emits descriptor-owned map layers for map-only entities", async () => {
  const desc = await loadDescriptors.run({}, ctx);
  const db = new Database(":memory:");
  db.exec(SITE_METADATA_DDL);

  emitSiteMetadata(db, desc);

  const layer = db
    .query(
      `SELECT layer_id, entity_id, source_table, render_kind, icon, color_json,
              radius, tooltip_fields_json, filters_json, legend_label, z_order
       FROM map_layers WHERE layer_id = 'locations'`,
    )
    .get() as {
    layer_id: string;
    entity_id: string;
    source_table: string;
    render_kind: string;
    icon: string | null;
    color_json: string;
    radius: number | null;
    tooltip_fields_json: string;
    filters_json: string;
    legend_label: string;
    z_order: number;
  };

  expect(layer).toEqual({
    layer_id: "locations",
    entity_id: "location",
    source_table: "location_map_points",
    render_kind: "point-or-polygon",
    icon: "location",
    color_json: JSON.stringify([120, 170, 255]),
    radius: 6,
    tooltip_fields_json: JSON.stringify(["name"]),
    filters_json: JSON.stringify([]),
    legend_label: "Locations",
    z_order: 100,
  });

  expect(db.query("SELECT * FROM site_entities WHERE entity_id = 'location'").get()).toBeNull();
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
bun test pipeline/test/load-descriptors.test.ts pipeline/test/site-metadata.test.ts
```

Expected: FAIL because `entities/location/entity.json`, extended map schema fields, `map_layers`, and registry support are missing.

- [ ] **Step 3: Add the location descriptor**

Create `entities/location/entity.json`:

```json
{
  "$schema": "../../schemas/entity.schema.json",
  "id": "location",
  "label": {
    "singular": "Location",
    "plural": "Locations"
  },
  "extraction": {
    "root": "MapLocationManager.GetLocations",
    "walker": "LocationWalker"
  },
  "fields": [
    { "name": "id", "type": "id", "from": "guid", "missingPolicy": "fatal" },
    {
      "name": "gameLocationId",
      "type": "string",
      "from": "locationID",
      "missingPolicy": "fatal",
      "label": "Game location ID"
    },
    { "name": "name", "type": "string", "from": "locationName", "missingPolicy": "fatal" },
    { "name": "enabled", "type": "boolean", "from": "enabled", "missingPolicy": "fatal" },
    { "name": "mapId", "type": "string", "from": "map.id", "missingPolicy": "diagnostic" },
    { "name": "showOnMap", "type": "boolean", "from": "showOnMap", "missingPolicy": "fatal" },
    {
      "name": "showOnMapDebugOnly",
      "type": "boolean",
      "from": "showOnMapDebugOnly",
      "missingPolicy": "fatal",
      "label": "Debug-only map marker"
    },
    {
      "name": "allowFastTravel",
      "type": "boolean",
      "from": "allowFastTravel",
      "missingPolicy": "fatal",
      "label": "Allows fast travel"
    },
    {
      "name": "displayOnEnterVolume",
      "type": "boolean",
      "from": "displayOnEnterVolume",
      "missingPolicy": "fatal",
      "label": "Displays on enter"
    }
  ],
  "map": {
    "layer": "locations",
    "renderKind": "point-or-polygon",
    "icon": "location",
    "color": [120, 170, 255],
    "radius": 6,
    "tooltip": ["name"],
    "legendLabel": "Locations",
    "zOrder": 100
  }
}
```

Do not add a `site` object in this slice.

- [ ] **Step 4: Extend the map schema and TS type**

In `schemas/entity.schema.json`, change the `siteMap` definition to require `layer` and `renderKind` and add the new fields:

```json
"siteMap": {
  "type": "object",
  "additionalProperties": false,
  "required": ["layer", "renderKind"],
  "properties": {
    "layer": { "type": "string" },
    "renderKind": {
      "enum": ["point", "polygon", "point-or-polygon", "arc", "radius", "relation-overlay", "custom"]
    },
    "icon": { "type": "string" },
    "color": {
      "type": "array",
      "items": { "type": "integer", "minimum": 0, "maximum": 255 },
      "minItems": 3,
      "maxItems": 4
    },
    "radius": { "type": "number", "minimum": 0 },
    "filters": { "type": "array", "items": { "$ref": "#/$defs/filter" } },
    "tooltip": { "type": "array", "items": { "type": "string" } },
    "legendLabel": { "type": "string", "minLength": 1 },
    "zOrder": { "type": "integer" }
  }
}
```

In `pipeline/src/types.ts`, update `SiteMap`:

```ts
export interface SiteMap {
  layer: string;
  renderKind:
    | "point"
    | "polygon"
    | "point-or-polygon"
    | "arc"
    | "radius"
    | "relation-overlay"
    | "custom";
  icon?: string;
  color?: number[];
  radius?: number;
  filters?: SiteFilter[];
  tooltip?: string[];
  legendLabel?: string;
  zOrder?: number;
}
```

- [ ] **Step 5: Add `map_layers` DDL**

In `pipeline/src/sql/site-metadata-ddl.ts`, append this table before the closing backtick:

```ts
CREATE TABLE map_layers (
  layer_id             TEXT PRIMARY KEY,
  entity_id            TEXT NOT NULL,
  source_table          TEXT NOT NULL,
  render_kind           TEXT NOT NULL,
  icon                  TEXT,
  color_json            TEXT NOT NULL,
  radius                REAL,
  tooltip_fields_json   TEXT NOT NULL,
  filters_json          TEXT NOT NULL,
  legend_label          TEXT NOT NULL,
  z_order               INTEGER NOT NULL DEFAULT 0
);
```

- [ ] **Step 6: Emit map layers from descriptors**

In `pipeline/src/stages/emit-site-metadata.ts`, add this prepared statement after `insertReadModel`:

```ts
const insertMapLayer = db.prepare(
  `INSERT INTO map_layers (
    layer_id, entity_id, source_table, render_kind, icon, color_json, radius,
    tooltip_fields_json, filters_json, legend_label, z_order
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);
```

Inside the transaction, before the `if (!entity.site) continue;` site block, add:

```ts
if (entity.map) {
  insertMapLayer.run(
    entity.map.layer,
    entityId,
    `${entityId}_map_points`,
    entity.map.renderKind,
    entity.map.icon ?? null,
    JSON.stringify(entity.map.color ?? [255, 255, 255]),
    entity.map.radius ?? null,
    JSON.stringify(entity.map.tooltip ?? []),
    JSON.stringify(entity.map.filters ?? []),
    entity.map.legendLabel ?? entity.label.plural,
    entity.map.zOrder ?? 0,
  );
}
if (!entity.site) continue;
```

Keep all existing site metadata behavior after that line unchanged.

- [ ] **Step 7: Add registry coverage for mapped descriptors**

In `pipeline/src/entities/registry.ts`, add location support:

```ts
export const canonicalizerSupport = {
  item: true,
  "stat-type": true,
  "item-category": true,
  "item-tag": true,
  location: true,
} as const satisfies Record<string, true>;

export const readModelSupport = {
  item: true,
  "stat-type": true,
  "item-category": true,
  "item-tag": true,
} as const satisfies Record<string, true>;

export const mapReadModelSupport = {
  location: true,
} as const satisfies Record<string, true>;
```

In `validateDescriptorCoverage`, add this check after the public-site check:

```ts
if (entity.map && !hasOwn(mapReadModelSupport, entityId)) {
  errors.push(
    `descriptor '${entityId}' has no map read-model emitter for layer '${entity.map.layer}'`,
  );
}
```

- [ ] **Step 8: Regenerate validators**

Run:

```bash
bun run codegen:validators
```

Expected: generated validator files update cleanly.

- [ ] **Step 9: Run focused tests**

Run:

```bash
bun test pipeline/test/load-descriptors.test.ts pipeline/test/site-metadata.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit descriptor and metadata contract**

```bash
git add entities/location/entity.json schemas/entity.schema.json pipeline/src/types.ts pipeline/src/sql/site-metadata-ddl.ts pipeline/src/stages/emit-site-metadata.ts pipeline/src/entities/registry.ts pipeline/test/load-descriptors.test.ts pipeline/test/site-metadata.test.ts pipeline/dist/validate-entity.mjs pipeline/dist/validate-entity.d.mts
git commit -m "feat(pipeline): add location map descriptor"
```

---

## Task 3: Location canonical tables and coordinate transform

**Files:**

- Create: `pipeline/src/sql/location-ddl.ts`
- Create: `pipeline/src/entities/location/canonicaliser.ts`
- Create: `pipeline/test/location-canonicaliser.test.ts`
- Modify: `pipeline/src/types.ts`

- [ ] **Step 1: Add failing canonicalisation tests**

Create `pipeline/test/location-canonicaliser.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { canonicaliseLocations, sourceToMapPoint } from "$pipeline/entities/location/canonicaliser";
import { LOCATION_DDL } from "$pipeline/sql/location-ddl";
import type { SnapshotEnvelope } from "$pipeline/types";

const envelope: SnapshotEnvelope = {
  entityId: "location",
  schemaVersion: 1,
  rows: [
    {
      id: "11111111.fixture-town",
      fields: {
        id: "11111111.fixture-town",
        gameLocationId: "town",
        name: "Harbor Town",
        enabled: true,
        mapId: "ardenfall",
        mapRef: { kind: "lookupAsset", guid: "map-guid", unityType: "MapData", name: "Ardenfall" },
        showOnMap: true,
        showOnMapDebugOnly: false,
        iconRef: {
          kind: "missing",
          reason: "not-exported-in-slice-5",
          source: "LocationAsset.icon",
        },
        mapPosition: { x: 12, y: 3, z: -8 },
        allowFastTravel: true,
        fastTravelPosition: { x: 14, y: 4, z: -10 },
        displayOnEnterVolume: true,
        volumes: [
          {
            index: 0,
            center: { x: 10, y: 2, z: -20 },
            size: { x: 6, y: 4, z: 8 },
          },
        ],
      },
    },
  ],
};

describe("sourceToMapPoint", () => {
  it("maps Unity x/z to compendium x/y and preserves elevation", () => {
    expect(sourceToMapPoint({ x: 12, y: 3, z: -8 })).toEqual({ x: 12, y: 8, elevation: 3 });
    expect(sourceToMapPoint({ x: -5, y: -2, z: 9 })).toEqual({ x: -5, y: -9, elevation: -2 });
  });
});

describe("canonicaliseLocations", () => {
  it("inserts locations and axis-aligned volume geometry", () => {
    const db = new Database(":memory:");
    db.exec(LOCATION_DDL);

    canonicaliseLocations(db, envelope);

    const location = db
      .query(
        `SELECT id, game_location_id, name, enabled, map_id, show_on_map,
                show_on_map_debug_only, map_x, map_y, elevation,
                fast_travel_map_x, fast_travel_map_y, fast_travel_elevation
         FROM locations WHERE id = '11111111.fixture-town'`,
      )
      .get() as Record<string, unknown>;

    expect(location).toEqual({
      id: "11111111.fixture-town",
      game_location_id: "town",
      name: "Harbor Town",
      enabled: 1,
      map_id: "ardenfall",
      show_on_map: 1,
      show_on_map_debug_only: 0,
      map_x: 12,
      map_y: 8,
      elevation: 3,
      fast_travel_map_x: 14,
      fast_travel_map_y: 10,
      fast_travel_elevation: 4,
    });

    const volume = db
      .query(
        `SELECT id, location_id, volume_index, kind, map_min_x, map_min_y,
                map_max_x, map_max_y, elevation_min, elevation_max, geometry_json
         FROM location_volumes WHERE location_id = '11111111.fixture-town'`,
      )
      .get() as {
      id: string;
      location_id: string;
      volume_index: number;
      kind: string;
      map_min_x: number;
      map_min_y: number;
      map_max_x: number;
      map_max_y: number;
      elevation_min: number;
      elevation_max: number;
      geometry_json: string;
    };

    expect(volume.id).toBe("11111111.fixture-town:volume:0");
    expect(volume.kind).toBe("axis-aligned-box");
    expect(volume.map_min_x).toBe(7);
    expect(volume.map_max_x).toBe(13);
    expect(volume.map_min_y).toBe(16);
    expect(volume.map_max_y).toBe(24);
    expect(volume.elevation_min).toBe(0);
    expect(volume.elevation_max).toBe(4);
    expect(JSON.parse(volume.geometry_json)).toEqual({
      schemaVersion: 1,
      kind: "axis-aligned-box",
      ring: [
        [7, 16],
        [13, 16],
        [13, 24],
        [7, 24],
        [7, 16],
      ],
    });
  });

  it("rejects non-finite source coordinates", () => {
    const db = new Database(":memory:");
    db.exec(LOCATION_DDL);

    expect(() =>
      canonicaliseLocations(db, {
        entityId: "location",
        schemaVersion: 1,
        rows: [
          {
            id: "bad-location",
            fields: {
              id: "bad-location",
              gameLocationId: "bad",
              name: "Bad",
              enabled: true,
              mapId: "ardenfall",
              showOnMap: true,
              showOnMapDebugOnly: false,
              mapPosition: { x: Number.NaN, y: 0, z: 0 },
              allowFastTravel: false,
              fastTravelPosition: null,
              displayOnEnterVolume: false,
              volumes: [],
            },
          },
        ],
      }),
    ).toThrow(/location 'bad-location' has non-finite mapPosition.x/);
  });

  it("diagnoses negative or degenerate volume sizes without inventing geometry", () => {
    const db = new Database(":memory:");
    db.exec(LOCATION_DDL);

    canonicaliseLocations(db, {
      entityId: "location",
      schemaVersion: 1,
      rows: [
        {
          id: "degenerate-location",
          fields: {
            id: "degenerate-location",
            gameLocationId: "degenerate",
            name: "Degenerate",
            enabled: true,
            mapId: "ardenfall",
            showOnMap: true,
            showOnMapDebugOnly: false,
            mapPosition: { x: 0, y: 0, z: 0 },
            allowFastTravel: false,
            fastTravelPosition: null,
            displayOnEnterVolume: false,
            volumes: [
              { index: 0, center: { x: 0, y: 0, z: 0 }, size: { x: -1, y: 1, z: 1 } },
              { index: 1, center: { x: 0, y: 0, z: 0 }, size: { x: 0, y: 1, z: 0 } },
            ],
          },
        },
      ],
    });

    const rows = db
      .query(
        "SELECT volume_index, kind, geometry_json, diagnostics_json FROM location_volumes ORDER BY volume_index",
      )
      .all() as {
      volume_index: number;
      kind: string;
      geometry_json: string | null;
      diagnostics_json: string;
    }[];

    expect(rows[0]).toEqual({
      volume_index: 0,
      kind: "invalid-axis-aligned-box",
      geometry_json: null,
      diagnostics_json: JSON.stringify([
        { severity: "diagnostic", code: "locationVolumeNegativeSize", field: "volumes[0].size" },
      ]),
    });
    expect(rows[1].kind).toBe("degenerate-axis-aligned-box");
    expect(JSON.parse(rows[1].diagnostics_json)).toEqual([
      { severity: "diagnostic", code: "locationVolumeDegenerateSize", field: "volumes[1].size" },
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
bun test pipeline/test/location-canonicaliser.test.ts
```

Expected: FAIL because `location-ddl.ts` and `location/canonicaliser.ts` do not exist.

- [ ] **Step 3: Add location snapshot TypeScript types**

In `pipeline/src/types.ts`, add these interfaces after `SnapshotDiagnostic`:

```ts
export interface SnapshotVector3 {
  x: number;
  y: number;
  z: number;
}

export interface LocationSnapshotVolume {
  index: number;
  center: SnapshotVector3;
  size: SnapshotVector3;
}

export interface LocationSnapshotFields {
  id: string;
  gameLocationId: string;
  name: string;
  enabled: boolean;
  mapId: string | null;
  mapRef?: SnapshotRef | null;
  showOnMap: boolean;
  showOnMapDebugOnly: boolean;
  iconRef?: SnapshotRef | null;
  mapPosition: SnapshotVector3;
  allowFastTravel: boolean;
  fastTravelPosition: SnapshotVector3 | null;
  displayOnEnterVolume: boolean;
  volumes: LocationSnapshotVolume[];
}
```

- [ ] **Step 4: Add location DDL**

Create `pipeline/src/sql/location-ddl.ts`:

```ts
export const LOCATION_DDL = `
CREATE TABLE locations (
  id                         TEXT PRIMARY KEY,
  game_location_id           TEXT NOT NULL,
  name                       TEXT NOT NULL,
  enabled                    INTEGER NOT NULL,
  map_id                     TEXT,
  map_ref_json               TEXT,
  show_on_map                INTEGER NOT NULL,
  show_on_map_debug_only     INTEGER NOT NULL,
  icon_ref_json              TEXT,
  source_map_position_json   TEXT NOT NULL,
  map_x                      REAL NOT NULL,
  map_y                      REAL NOT NULL,
  elevation                  REAL NOT NULL,
  allow_fast_travel          INTEGER NOT NULL,
  source_fast_travel_json    TEXT,
  fast_travel_map_x          REAL,
  fast_travel_map_y          REAL,
  fast_travel_elevation      REAL,
  display_on_enter_volume    INTEGER NOT NULL
);
CREATE TABLE location_volumes (
  id                    TEXT PRIMARY KEY,
  location_id           TEXT NOT NULL REFERENCES locations(id),
  volume_index          INTEGER NOT NULL,
  kind                  TEXT NOT NULL,
  source_center_json    TEXT NOT NULL,
  source_size_json      TEXT NOT NULL,
  map_min_x             REAL,
  map_min_y             REAL,
  map_max_x             REAL,
  map_max_y             REAL,
  elevation_min         REAL,
  elevation_max         REAL,
  geometry_json         TEXT,
  diagnostics_json      TEXT NOT NULL DEFAULT '[]',
  UNIQUE(location_id, volume_index)
);
`;
```

- [ ] **Step 5: Add canonicalizer implementation**

Create `pipeline/src/entities/location/canonicaliser.ts`:

```ts
import type { Database } from "bun:sqlite";
import type {
  LocationSnapshotFields,
  LocationSnapshotVolume,
  SnapshotEnvelope,
  SnapshotVector3,
} from "../../types.ts";

export interface MapPoint {
  x: number;
  y: number;
  elevation: number;
}

interface VolumeDiagnostic {
  severity: "diagnostic";
  code: "locationVolumeNegativeSize" | "locationVolumeDegenerateSize";
  field: string;
}

export function sourceToMapPoint(point: SnapshotVector3): MapPoint {
  assertFiniteVector(point, "mapPosition");
  return { x: point.x, y: -point.z, elevation: point.y };
}

export function canonicaliseLocations(db: Database, envelope: SnapshotEnvelope): void {
  const locationInsert = db.prepare(
    `INSERT INTO locations (
      id, game_location_id, name, enabled, map_id, map_ref_json,
      show_on_map, show_on_map_debug_only, icon_ref_json,
      source_map_position_json, map_x, map_y, elevation,
      allow_fast_travel, source_fast_travel_json, fast_travel_map_x,
      fast_travel_map_y, fast_travel_elevation, display_on_enter_volume
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const volumeInsert = db.prepare(
    `INSERT INTO location_volumes (
      id, location_id, volume_index, kind, source_center_json, source_size_json,
      map_min_x, map_min_y, map_max_x, map_max_y, elevation_min, elevation_max,
      geometry_json, diagnostics_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const tx = db.transaction(() => {
    for (const row of envelope.rows as Array<{ id: string; fields: LocationSnapshotFields }>) {
      const fields = row.fields;
      const point = sourceToMapPointForRow(row.id, fields.mapPosition, "mapPosition");
      const fastTravel = fields.fastTravelPosition
        ? sourceToMapPointForRow(row.id, fields.fastTravelPosition, "fastTravelPosition")
        : null;

      locationInsert.run(
        row.id,
        fields.gameLocationId,
        fields.name,
        fields.enabled ? 1 : 0,
        fields.mapId ?? null,
        fields.mapRef ? JSON.stringify(fields.mapRef) : null,
        fields.showOnMap ? 1 : 0,
        fields.showOnMapDebugOnly ? 1 : 0,
        fields.iconRef ? JSON.stringify(fields.iconRef) : null,
        JSON.stringify(fields.mapPosition),
        point.x,
        point.y,
        point.elevation,
        fields.allowFastTravel ? 1 : 0,
        fields.fastTravelPosition ? JSON.stringify(fields.fastTravelPosition) : null,
        fastTravel?.x ?? null,
        fastTravel?.y ?? null,
        fastTravel?.elevation ?? null,
        fields.displayOnEnterVolume ? 1 : 0,
      );

      for (const volume of fields.volumes) {
        const canonical = canonicaliseVolume(row.id, volume);
        volumeInsert.run(
          `${row.id}:volume:${volume.index}`,
          row.id,
          volume.index,
          canonical.kind,
          JSON.stringify(volume.center),
          JSON.stringify(volume.size),
          canonical.mapMinX,
          canonical.mapMinY,
          canonical.mapMaxX,
          canonical.mapMaxY,
          canonical.elevationMin,
          canonical.elevationMax,
          canonical.geometry ? JSON.stringify(canonical.geometry) : null,
          JSON.stringify(canonical.diagnostics),
        );
      }
    }
  });
  tx();
}

function canonicaliseVolume(locationId: string, volume: LocationSnapshotVolume) {
  assertFiniteVectorForRow(locationId, volume.center, `volumes[${volume.index}].center`);
  assertFiniteVectorForRow(locationId, volume.size, `volumes[${volume.index}].size`);

  const diagnostics: VolumeDiagnostic[] = [];
  if (volume.size.x < 0 || volume.size.y < 0 || volume.size.z < 0) {
    diagnostics.push({
      severity: "diagnostic",
      code: "locationVolumeNegativeSize",
      field: `volumes[${volume.index}].size`,
    });
    return nullVolume("invalid-axis-aligned-box", diagnostics);
  }

  const halfX = volume.size.x / 2;
  const halfY = volume.size.y / 2;
  const halfZ = volume.size.z / 2;
  const sourceMinX = volume.center.x - halfX;
  const sourceMaxX = volume.center.x + halfX;
  const sourceMinZ = volume.center.z - halfZ;
  const sourceMaxZ = volume.center.z + halfZ;
  const mapMinX = sourceMinX;
  const mapMaxX = sourceMaxX;
  const mapMinY = -sourceMaxZ;
  const mapMaxY = -sourceMinZ;
  const elevationMin = volume.center.y - halfY;
  const elevationMax = volume.center.y + halfY;

  if (volume.size.x === 0 || volume.size.z === 0) {
    diagnostics.push({
      severity: "diagnostic",
      code: "locationVolumeDegenerateSize",
      field: `volumes[${volume.index}].size`,
    });
  }

  const kind = diagnostics.length > 0 ? "degenerate-axis-aligned-box" : "axis-aligned-box";
  const geometry = {
    schemaVersion: 1,
    kind: "axis-aligned-box",
    ring: [
      [mapMinX, mapMinY],
      [mapMaxX, mapMinY],
      [mapMaxX, mapMaxY],
      [mapMinX, mapMaxY],
      [mapMinX, mapMinY],
    ],
  };

  return {
    kind,
    mapMinX,
    mapMinY,
    mapMaxX,
    mapMaxY,
    elevationMin,
    elevationMax,
    geometry,
    diagnostics,
  };
}

function nullVolume(kind: string, diagnostics: VolumeDiagnostic[]) {
  return {
    kind,
    mapMinX: null,
    mapMinY: null,
    mapMaxX: null,
    mapMaxY: null,
    elevationMin: null,
    elevationMax: null,
    geometry: null,
    diagnostics,
  };
}

function sourceToMapPointForRow(
  locationId: string,
  point: SnapshotVector3,
  field: string,
): MapPoint {
  assertFiniteVectorForRow(locationId, point, field);
  return { x: point.x, y: -point.z, elevation: point.y };
}

function assertFiniteVector(point: SnapshotVector3, field: string): void {
  for (const axis of ["x", "y", "z"] as const) {
    if (!Number.isFinite(point[axis])) throw new Error(`${field}.${axis} must be finite`);
  }
}

function assertFiniteVectorForRow(locationId: string, point: SnapshotVector3, field: string): void {
  for (const axis of ["x", "y", "z"] as const) {
    if (!Number.isFinite(point[axis])) {
      throw new Error(`location '${locationId}' has non-finite ${field}.${axis}`);
    }
  }
}
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
bun test pipeline/test/location-canonicaliser.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit canonical tables and transform**

```bash
git add pipeline/src/types.ts pipeline/src/sql/location-ddl.ts pipeline/src/entities/location/canonicaliser.ts pipeline/test/location-canonicaliser.test.ts
git commit -m "feat(pipeline): canonicalise location geometry"
```

---

## Task 4: Location map read models and SQLite orchestration

**Files:**

- Create: `pipeline/src/entities/location/read-models.ts`
- Modify: `pipeline/src/stages/emit-read-models.ts`
- Modify: `pipeline/src/stages/emit-sqlite.ts`
- Modify: `pipeline/test/read-models.test.ts`
- Modify: `pipeline/test/end-to-end.test.ts`

- [ ] **Step 1: Add failing read-model test**

In `pipeline/test/read-models.test.ts`, add imports:

```ts
import { canonicaliseLocations } from "$pipeline/entities/location/canonicaliser";
import { emitLocationReadModels } from "$pipeline/stages/emit-read-models";
import { LOCATION_DDL } from "$pipeline/sql/location-ddl";
```

Add this test near the other entity read-model tests:

```ts
describe("emitLocationReadModels", () => {
  it("builds map point and volume read models from canonical locations", () => {
    const db = new Database(":memory:");
    db.exec(LOCATION_DDL);
    canonicaliseLocations(db, {
      entityId: "location",
      schemaVersion: 1,
      rows: [
        {
          id: "11111111.fixture-town",
          fields: {
            id: "11111111.fixture-town",
            gameLocationId: "town",
            name: "Harbor Town",
            enabled: true,
            mapId: "ardenfall",
            showOnMap: true,
            showOnMapDebugOnly: false,
            mapPosition: { x: 12, y: 3, z: -8 },
            allowFastTravel: true,
            fastTravelPosition: { x: 14, y: 4, z: -10 },
            displayOnEnterVolume: true,
            volumes: [{ index: 0, center: { x: 10, y: 2, z: -20 }, size: { x: 6, y: 4, z: 8 } }],
          },
        },
      ],
    });

    emitLocationReadModels(db);

    expect(db.query("SELECT * FROM location_map_points").get()).toEqual({
      id: "11111111.fixture-town",
      name: "Harbor Town",
      map_id: "ardenfall",
      map_x: 12,
      map_y: 8,
      elevation: 3,
      show_on_map: 1,
      show_on_map_debug_only: 0,
      allow_fast_travel: 1,
    });

    const volume = db
      .query("SELECT location_id, name, geometry_json FROM location_map_volumes")
      .get() as {
      location_id: string;
      name: string;
      geometry_json: string;
    };
    expect(volume.location_id).toBe("11111111.fixture-town");
    expect(volume.name).toBe("Harbor Town");
    expect(JSON.parse(volume.geometry_json).ring).toEqual([
      [7, 16],
      [13, 16],
      [13, 24],
      [7, 24],
      [7, 16],
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
bun test pipeline/test/read-models.test.ts
```

Expected: FAIL because `emitLocationReadModels` does not exist.

- [ ] **Step 3: Add location read-model emitter**

Create `pipeline/src/entities/location/read-models.ts`:

```ts
import type { Database } from "bun:sqlite";

export const LOCATION_READ_MODEL_DDL = `
CREATE TABLE location_map_points (
  id                         TEXT PRIMARY KEY,
  name                       TEXT NOT NULL,
  map_id                     TEXT,
  map_x                      REAL NOT NULL,
  map_y                      REAL NOT NULL,
  elevation                  REAL NOT NULL,
  show_on_map                INTEGER NOT NULL,
  show_on_map_debug_only     INTEGER NOT NULL,
  allow_fast_travel          INTEGER NOT NULL
);
CREATE TABLE location_map_volumes (
  id                         TEXT PRIMARY KEY,
  location_id                TEXT NOT NULL,
  name                       TEXT NOT NULL,
  map_id                     TEXT,
  geometry_json              TEXT NOT NULL,
  elevation_min              REAL,
  elevation_max              REAL
);
`;

export function emitLocationReadModels(db: Database): void {
  db.exec(LOCATION_READ_MODEL_DDL);
  db.exec(`
    INSERT INTO location_map_points (
      id, name, map_id, map_x, map_y, elevation,
      show_on_map, show_on_map_debug_only, allow_fast_travel
    )
    SELECT id, name, map_id, map_x, map_y, elevation,
           show_on_map, show_on_map_debug_only, allow_fast_travel
    FROM locations
    WHERE enabled = 1 AND show_on_map = 1 AND show_on_map_debug_only = 0
    ORDER BY name;
  `);
  db.exec(`
    INSERT INTO location_map_volumes (
      id, location_id, name, map_id, geometry_json, elevation_min, elevation_max
    )
    SELECT v.id, v.location_id, l.name, l.map_id, v.geometry_json, v.elevation_min, v.elevation_max
    FROM location_volumes v
    JOIN locations l ON l.id = v.location_id
    WHERE l.enabled = 1
      AND v.geometry_json IS NOT NULL
    ORDER BY l.name, v.volume_index;
  `);
}
```

- [ ] **Step 4: Export and orchestrate location read models**

In `pipeline/src/stages/emit-read-models.ts`, add exports:

```ts
export {
  LOCATION_READ_MODEL_DDL,
  emitLocationReadModels,
} from "../entities/location/read-models.ts";
```

Add import:

```ts
import { emitLocationReadModels } from "../entities/location/read-models.ts";
```

At the end of `emitReadModels`, add:

```ts
if (snapshot.envelopes.location) {
  emitLocationReadModels(db);
}
```

- [ ] **Step 5: Wire location DDL/canonicalizer into `emit-sqlite`**

In `pipeline/src/stages/emit-sqlite.ts`, add imports:

```ts
import { canonicaliseLocations } from "../entities/location/canonicaliser";
import { LOCATION_DDL } from "../sql/location-ddl";
```

After item-tag canonicalisation, add:

```ts
const locationEnvelope = inputs["load-snapshot"].envelopes.location;
if (locationEnvelope) {
  db.exec(LOCATION_DDL);
  canonicaliseLocations(db, locationEnvelope);
}
```

- [ ] **Step 6: Add end-to-end fixture assertion scaffold**

In `pipeline/test/end-to-end.test.ts`, after the existing SQLite assertions, add assertions that will pass once Task 6 adds `locations.json`:

```ts
const locationCount = db.query("SELECT count(*) AS count FROM locations").get() as {
  count: number;
};
expect(locationCount.count).toBe(2);
const mapLayer = db.query("SELECT layer_id FROM map_layers WHERE layer_id = 'locations'").get();
expect(mapLayer).toEqual({ layer_id: "locations" });
```

If the current end-to-end test opens `pipeline/dist/data.sqlite` indirectly, keep the assertions inside that existing database scope rather than adding a second database open.

- [ ] **Step 7: Run focused tests**

Run:

```bash
bun test pipeline/test/read-models.test.ts
```

Expected: PASS.

Run:

```bash
bun test pipeline/test/end-to-end.test.ts
```

Expected: FAIL until the synthetic fixture includes `locations.json` in Task 6.

- [ ] **Step 8: Commit read-model orchestration**

```bash
git add pipeline/src/entities/location/read-models.ts pipeline/src/stages/emit-read-models.ts pipeline/src/stages/emit-sqlite.ts pipeline/test/read-models.test.ts pipeline/test/end-to-end.test.ts
git commit -m "feat(pipeline): emit location map read models"
```

---

## Task 5: Mod location extraction and finalize output

**Files:**

- Create: `mod/src/Entities/Location/LocationSnapshot.cs`
- Create: `mod/src/Entities/Location/ILocationAssetSource.cs`
- Create: `mod/src/Entities/Location/LocationExtractor.cs`
- Create: `mod/src/Extraction/ILocationExtractionCache.cs`
- Create: `mod/src/Extraction/LocationExtractionService.cs`
- Create: `mod-tests/LocationExtractorTests.cs`
- Create: `mod-tests/LocationSnapshotTests.cs`
- Modify: `mod/src/Control/CompendiumCommandRegistry.cs`
- Modify: `mod/src/Control/Handlers/RunFinalizeCommand.cs`
- Modify: `mod-tests/RunFinalizeCommandTests.cs`
- Modify: `mod-tests/TypedCommandRegistryTests.cs`

- [ ] **Step 1: Add failing extractor tests**

Create `mod-tests/LocationExtractorTests.cs`:

```csharp
using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using Ardenfall;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.Location;
using UnityEngine;
using Xunit;
using UnityObject = UnityEngine.Object;

namespace ArdenfallCompendium.Tests;

public sealed class LocationExtractorTests
{
    [Fact]
    public void ExtractsEnabledLocationWithMapPointAndVolume()
    {
        var source = new FakeLocationAssetSource(new[]
        {
            FakeLocationAssetSource.Build(
                guid: "11111111.fixture-town",
                assetName: "Town Asset",
                locationId: "town",
                locationName: "Harbor Town",
                mapId: "ardenfall",
                mapPosition: new LocationVector3Snapshot(12f, 3f, -8f),
                fastTravelPosition: new LocationVector3Snapshot(14f, 4f, -10f),
                volumes: new[]
                {
                    new LocationVolumeSnapshot(0, new LocationVector3Snapshot(10f, 2f, -20f), new LocationVector3Snapshot(6f, 4f, 8f)),
                })
        });
        var extractor = new LocationExtractor(source);

        var row = Assert.Single(extractor.Walk());

        Assert.Equal("11111111.fixture-town", row.Id);
        Assert.Equal("town", row.Fields.GameLocationId);
        Assert.Equal("Harbor Town", row.Fields.Name);
        Assert.True(row.Fields.Enabled);
        Assert.Equal("ardenfall", row.Fields.MapId);
        Assert.True(row.Fields.ShowOnMap);
        Assert.False(row.Fields.ShowOnMapDebugOnly);
        Assert.True(row.Fields.AllowFastTravel);
        Assert.True(row.Fields.DisplayOnEnterVolume);
        Assert.Equal(12f, row.Fields.MapPosition.X);
        var volume = Assert.Single(row.Fields.Volumes);
        Assert.Equal(0, volume.Index);
        Assert.Equal(10f, volume.Center.X);
        Assert.Equal(8f, volume.Size.Z);
    }

    [Fact]
    public void DiagnosesLocationMissingGuid()
    {
        var source = new FakeLocationAssetSource(new[]
        {
            FakeLocationAssetSource.BuildWithoutGuid("No Guid Location"),
        });
        var extractor = new LocationExtractor(source);

        var rows = extractor.Walk().ToList();

        Assert.Empty(rows);
        Assert.Contains(extractor.Diagnostics, d => d.Code == "lookupAssetGuidMissing" && d.Field == "id");
    }

    [Fact]
    public void BuiltLookupSourceSkipsUnityNullAndDisabledLocations()
    {
        var enabled = RuntimeLocation("enabled", enabled: true);
        var disabled = RuntimeLocation("disabled", enabled: false);
        var source = new BuiltLookupTableLocationAssetSource(
            lookupLocations: () => new[] { enabled, disabled },
            isUnityNull: asset => ReferenceEquals(asset, disabled));

        Assert.Single(source.EnumerateLocations());
    }

    private sealed class FakeLocationAssetSource : ILocationAssetSource
    {
        private readonly IReadOnlyList<LocationAssetRecord> _assets;

        public FakeLocationAssetSource(IReadOnlyList<LocationAssetRecord> assets)
        {
            _assets = assets;
        }

        public IEnumerable<LocationAssetRecord> EnumerateLocations() => _assets;

        public static LocationAssetRecord Build(
            string guid,
            string assetName,
            string locationId,
            string locationName,
            string mapId,
            LocationVector3Snapshot mapPosition,
            LocationVector3Snapshot? fastTravelPosition,
            IReadOnlyList<LocationVolumeSnapshot> volumes) => new(
                Guid: guid,
                AssetName: assetName,
                Enabled: true,
                LocationName: locationName,
                GameLocationId: locationId,
                MapRef: new SnapshotRef.LookupAsset { Guid = "map-guid", UnityType = "MapData", Name = mapId },
                MapId: mapId,
                ShowOnMap: true,
                ShowOnMapDebugOnly: false,
                IconRef: new SnapshotRef.Missing { Reason = "not-exported-in-slice-5", Source = "LocationAsset.icon" },
                MapPosition: mapPosition,
                AllowFastTravel: fastTravelPosition != null,
                FastTravelPosition: fastTravelPosition,
                DisplayOnEnterVolume: true,
                Volumes: volumes);

        public static LocationAssetRecord BuildWithoutGuid(string name) => new(
            Guid: null,
            AssetName: name,
            Enabled: true,
            LocationName: name,
            GameLocationId: "missing-guid",
            MapRef: null,
            MapId: null,
            ShowOnMap: true,
            ShowOnMapDebugOnly: false,
            IconRef: null,
            MapPosition: new LocationVector3Snapshot(0f, 0f, 0f),
            AllowFastTravel: false,
            FastTravelPosition: null,
            DisplayOnEnterVolume: false,
            Volumes: new List<LocationVolumeSnapshot>());
    }

    private static LocationAsset RuntimeLocation(string id, bool enabled)
    {
        var location = (LocationAsset)RuntimeHelpers.GetUninitializedObject(typeof(LocationAsset));
        location.locationID = id;
        location.locationName = id;
        location.enabled = enabled;
        location.mapPosition = Vector3.zero;
        location.fastTravelPosition = Vector3.zero;
        location.volumes = new List<LocationAsset.Volume>();
        return location;
    }
}
```

- [ ] **Step 2: Add failing snapshot contract test**

Create `mod-tests/LocationSnapshotTests.cs`:

```csharp
using System.Collections.Generic;
using ArdenfallCompendium.Entities.Location;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class LocationSnapshotTests
{
    [Fact]
    public void SerializesLocationEnvelopeWithEntityIdAndRows()
    {
        var envelope = new LocationSnapshotEnvelope
        {
            Rows = new List<LocationSnapshotRow>
            {
                new()
                {
                    Id = "11111111.fixture-town",
                    Fields = new LocationSnapshot(
                        Id: "11111111.fixture-town",
                        GameLocationId: "town",
                        Name: "Harbor Town",
                        Enabled: true,
                        MapRef: null,
                        MapId: "ardenfall",
                        ShowOnMap: true,
                        ShowOnMapDebugOnly: false,
                        IconRef: null,
                        MapPosition: new LocationVector3Snapshot(12f, 3f, -8f),
                        AllowFastTravel: true,
                        FastTravelPosition: new LocationVector3Snapshot(14f, 4f, -10f),
                        DisplayOnEnterVolume: true,
                        Volumes: new List<LocationVolumeSnapshot>
                        {
                            new(0, new LocationVector3Snapshot(10f, 2f, -20f), new LocationVector3Snapshot(6f, 4f, 8f)),
                        })
                }
            }
        };

        var json = JsonConvert.SerializeObject(envelope);
        var parsed = JObject.Parse(json);

        Assert.Equal("location", parsed["entityId"]?.Value<string>());
        Assert.Equal(1, parsed["schemaVersion"]?.Value<int>());
        Assert.Equal("Harbor Town", parsed["rows"]?[0]?["fields"]?["name"]?.Value<string>());
        Assert.Equal(10f, parsed["rows"]?[0]?["fields"]?["volumes"]?[0]?["center"]?["x"]?.Value<float>());
    }
}
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
dotnet test mod-tests/ArdenfallCompendium.Tests.csproj --nologo -v q --filter "LocationExtractorTests|LocationSnapshotTests"
```

Expected: FAIL because location DTO/source/extractor files do not exist.

- [ ] **Step 4: Add location DTOs**

Create `mod/src/Entities/Location/LocationSnapshot.cs`:

```csharp
using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Entities.Location;

public sealed record LocationVector3Snapshot(
    [property: JsonProperty("x")] float X,
    [property: JsonProperty("y")] float Y,
    [property: JsonProperty("z")] float Z);

public sealed record LocationVolumeSnapshot(
    [property: JsonProperty("index")] int Index,
    [property: JsonProperty("center")] LocationVector3Snapshot Center,
    [property: JsonProperty("size")] LocationVector3Snapshot Size);

public sealed record LocationSnapshot(
    [property: JsonProperty("id")] string Id,
    [property: JsonProperty("gameLocationId")] string GameLocationId,
    [property: JsonProperty("name")] string Name,
    [property: JsonProperty("enabled")] bool Enabled,
    [property: JsonProperty("mapRef")] SnapshotRef? MapRef,
    [property: JsonProperty("mapId")] string? MapId,
    [property: JsonProperty("showOnMap")] bool ShowOnMap,
    [property: JsonProperty("showOnMapDebugOnly")] bool ShowOnMapDebugOnly,
    [property: JsonProperty("iconRef")] SnapshotRef? IconRef,
    [property: JsonProperty("mapPosition")] LocationVector3Snapshot MapPosition,
    [property: JsonProperty("allowFastTravel")] bool AllowFastTravel,
    [property: JsonProperty("fastTravelPosition")] LocationVector3Snapshot? FastTravelPosition,
    [property: JsonProperty("displayOnEnterVolume")] bool DisplayOnEnterVolume,
    [property: JsonProperty("volumes")] IReadOnlyList<LocationVolumeSnapshot> Volumes);

public sealed class LocationSnapshotRow
{
    [JsonProperty("id")] public string Id { get; init; } = "";
    [JsonProperty("fields")] public LocationSnapshot Fields { get; init; } = null!;
    [JsonProperty("diagnostics")] public List<Diagnostic> Diagnostics { get; init; } = new();
}

public sealed class LocationSnapshotEnvelope
{
    [JsonProperty("entityId")] public string EntityId { get; init; } = "location";
    [JsonProperty("schemaVersion")] public int SchemaVersion { get; init; } = 1;
    [JsonProperty("rows")] public List<LocationSnapshotRow> Rows { get; init; } = new();
}
```

- [ ] **Step 5: Add asset source abstraction**

Create `mod/src/Entities/Location/ILocationAssetSource.cs`:

```csharp
using System;
using System.Collections.Generic;
using System.Linq;
using Ardenfall;
using ArdenfallCompendium.Dtos;
using UnityEngine;
using UnityObject = UnityEngine.Object;

namespace ArdenfallCompendium.Entities.Location;

public sealed record LocationAssetRecord(
    string? Guid,
    string AssetName,
    bool Enabled,
    string? LocationName,
    string? GameLocationId,
    SnapshotRef? MapRef,
    string? MapId,
    bool ShowOnMap,
    bool ShowOnMapDebugOnly,
    SnapshotRef? IconRef,
    LocationVector3Snapshot MapPosition,
    bool AllowFastTravel,
    LocationVector3Snapshot? FastTravelPosition,
    bool DisplayOnEnterVolume,
    IReadOnlyList<LocationVolumeSnapshot> Volumes);

public interface ILocationAssetSource
{
    IEnumerable<LocationAssetRecord> EnumerateLocations();
}

public sealed class BuiltLookupTableLocationAssetSource : ILocationAssetSource
{
    private readonly Func<IEnumerable<LocationAsset>> _lookupLocations;
    private readonly Func<UnityObject?, bool> _isUnityNull;

    public BuiltLookupTableLocationAssetSource()
        : this(
            lookupLocations: () => BuiltLookupTable.GetAssetsOfType<LocationAsset>(),
            isUnityNull: IsUnityNull)
    {
    }

    public BuiltLookupTableLocationAssetSource(
        Func<IEnumerable<LocationAsset>> lookupLocations,
        Func<UnityObject?, bool> isUnityNull)
    {
        _lookupLocations = lookupLocations;
        _isUnityNull = isUnityNull;
    }

    public IEnumerable<LocationAssetRecord> EnumerateLocations()
    {
        foreach (var asset in _lookupLocations())
        {
            if (_isUnityNull(asset)) continue;
            if (!asset.enabled) continue;
            yield return ToRecord(asset);
        }
    }

    private LocationAssetRecord ToRecord(LocationAsset asset)
    {
        var resolver = new ArdenfallCompendium.Walker.RefResolver();
        var mapRef = resolver.ResolveAsset(asset.map, "mapRef", LookupGuid(asset) ?? asset.locationID ?? asset.name, MissingPolicy.Diagnostic, "LocationAsset.map");
        var iconRef = resolver.ResolveAsset(asset.icon, "iconRef", LookupGuid(asset) ?? asset.locationID ?? asset.name, MissingPolicy.OptionalEmpty, "LocationAsset.icon");
        return new LocationAssetRecord(
            Guid: LookupGuid(asset),
            AssetName: SafeName(asset),
            Enabled: asset.enabled,
            LocationName: asset.locationName,
            GameLocationId: asset.locationID,
            MapRef: mapRef,
            MapId: asset.map == null ? null : asset.map.id,
            ShowOnMap: asset.showOnMap,
            ShowOnMapDebugOnly: asset.showOnMapDebugOnly,
            IconRef: iconRef,
            MapPosition: FromVector3(asset.mapPosition),
            AllowFastTravel: asset.allowFastTravel,
            FastTravelPosition: asset.allowFastTravel ? FromVector3(asset.fastTravelPosition) : null,
            DisplayOnEnterVolume: asset.displayOnEnterVolume,
            Volumes: asset.volumes.Select((volume, index) => new LocationVolumeSnapshot(index, FromVector3(volume.center), FromVector3(volume.size))).ToList());
    }

    private static LocationVector3Snapshot FromVector3(Vector3 value) => new(value.x, value.y, value.z);

    private static bool IsUnityNull(UnityObject? asset)
    {
        try { return asset == null; }
        catch (MissingReferenceException) { return true; }
    }

    private static string SafeName(UnityObject asset)
    {
        try { return asset.name ?? ""; }
        catch (MissingReferenceException) { return ""; }
    }

    private static string? LookupGuid(UnityObject asset)
    {
        var lookup = BuiltLookupTable.Instance;
        if (lookup == null) return null;
        var guid = lookup.GetGuid(asset);
        return string.IsNullOrWhiteSpace(guid) ? null : guid;
    }
}
```

- [ ] **Step 6: Add extractor implementation**

Create `mod/src/Entities/Location/LocationExtractor.cs`:

```csharp
using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Walker;

namespace ArdenfallCompendium.Entities.Location;

public sealed class LocationExtractor : WalkerBase<LocationSnapshotRow>
{
    private readonly ILocationAssetSource _source;

    public LocationExtractor()
        : this(new BuiltLookupTableLocationAssetSource())
    {
    }

    public LocationExtractor(ILocationAssetSource source)
    {
        _source = source;
    }

    public override IEnumerable<LocationSnapshotRow> Walk()
    {
        foreach (var asset in _source.EnumerateLocations())
        {
            if (string.IsNullOrWhiteSpace(asset.Guid))
            {
                Diagnostics.Add(new Diagnostic
                {
                    Severity = "fatal",
                    Code = "lookupAssetGuidMissing",
                    Field = "id",
                    Message = $"LocationAsset '{asset.AssetName}' has no GUID in BuiltLookupTable",
                });
                continue;
            }
            if (string.IsNullOrWhiteSpace(asset.GameLocationId))
            {
                Diagnostics.Add(new Diagnostic
                {
                    Severity = "fatal",
                    Code = "locationIdMissing",
                    Field = "gameLocationId",
                    Message = $"LocationAsset '{asset.Guid}' has no locationID",
                });
                continue;
            }

            var diagnostics = new List<Diagnostic>();
            if (asset.MapId == null)
            {
                diagnostics.Add(new Diagnostic
                {
                    Severity = "diagnostic",
                    Code = "locationMapMissing",
                    Field = "mapId",
                    Message = $"LocationAsset '{asset.Guid}' has no map",
                });
            }

            yield return new LocationSnapshotRow
            {
                Id = asset.Guid,
                Fields = new LocationSnapshot(
                    Id: asset.Guid,
                    GameLocationId: asset.GameLocationId,
                    Name: NullIfEmpty(asset.LocationName) ?? NullIfEmpty(asset.AssetName) ?? asset.Guid,
                    Enabled: asset.Enabled,
                    MapRef: asset.MapRef,
                    MapId: asset.MapId,
                    ShowOnMap: asset.ShowOnMap,
                    ShowOnMapDebugOnly: asset.ShowOnMapDebugOnly,
                    IconRef: asset.IconRef,
                    MapPosition: asset.MapPosition,
                    AllowFastTravel: asset.AllowFastTravel,
                    FastTravelPosition: asset.FastTravelPosition,
                    DisplayOnEnterVolume: asset.DisplayOnEnterVolume,
                    Volumes: asset.Volumes),
                Diagnostics = diagnostics,
            };
        }
    }

    private static string? NullIfEmpty(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;
}
```

- [ ] **Step 7: Add extraction cache**

Create `mod/src/Extraction/ILocationExtractionCache.cs`:

```csharp
using System.Collections.Generic;
using ArdenfallCompendium.Control;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.Location;

namespace ArdenfallCompendium.Extraction;

public interface ILocationExtractionCache
{
    IReadOnlyList<LocationSnapshotRow> GetOrExtract(CompendiumRun run);
    IReadOnlyList<Diagnostic> GetWalkerDiagnostics(CompendiumRun run);
}
```

Create `mod/src/Extraction/LocationExtractionService.cs`:

```csharp
using System.Collections.Generic;
using ArdenfallCompendium.Control;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.Location;

namespace ArdenfallCompendium.Extraction;

public sealed class LocationExtractionService : ILocationExtractionCache
{
    private readonly ILocationAssetSource _source;
    private readonly Dictionary<string, ExtractionState> _byRun = new();

    public LocationExtractionService(ILocationAssetSource source)
    {
        _source = source;
    }

    public IReadOnlyList<LocationSnapshotRow> GetOrExtract(CompendiumRun run) => GetState(run).Rows;

    public IReadOnlyList<Diagnostic> GetWalkerDiagnostics(CompendiumRun run) => GetState(run).WalkerDiagnostics;

    private ExtractionState GetState(CompendiumRun run)
    {
        if (_byRun.TryGetValue(run.RunId, out var state)) return state;

        var extractor = new LocationExtractor(_source);
        var rows = new List<LocationSnapshotRow>();
        foreach (var row in extractor.Walk()) rows.Add(row);

        state = new ExtractionState(rows, extractor.Diagnostics.AsReadOnly());
        _byRun[run.RunId] = state;
        return state;
    }

    private sealed record ExtractionState(
        IReadOnlyList<LocationSnapshotRow> Rows,
        IReadOnlyList<Diagnostic> WalkerDiagnostics);
}
```

- [ ] **Step 8: Wire finalize command**

In `mod/src/Control/Handlers/RunFinalizeCommand.cs`, add using:

```csharp
using ArdenfallCompendium.Entities.Location;
```

Add field:

```csharp
private readonly ILocationExtractionCache _locations;
```

Add constructor parameter after `IItemTagExtractionCache? itemTags = null`:

```csharp
ILocationExtractionCache? locations = null,
```

Assign it:

```csharp
_locations = locations ?? new LocationExtractionService(new BuiltLookupTableLocationAssetSource());
```

After item tag extraction in the `related.extract` phase, add:

```csharp
var locationRows = _locations.GetOrExtract(run);
```

In the metadata write phase after `item-tags.json`, add:

```csharp
var locationEnvelope = new LocationSnapshotEnvelope { Rows = locationRows.ToList() };
WriteJson(stagingDir, "locations.json", locationEnvelope, hashes);
```

In diagnostics collection, add:

```csharp
foreach (var diagnostic in _locations.GetWalkerDiagnostics(run))
{
    AddDiagnostic(diagnosticTotals, diagnostics, rowId: null, diagnostic);
}
```

In manifest counts, add:

```csharp
["location"] = locationRows.Count,
```

In run counts, add:

```csharp
run.Counts["location"] = locationRows.Count;
```

In artifact refs, add:

```csharp
["locations"] = CompendiumCommandResults.FileArtifact("locations", Path.Combine(publishedDir, "locations.json"), "application/json", hashes["locations.json"]),
```

- [ ] **Step 9: Wire command registry**

In `mod/src/Control/CompendiumCommandRegistry.cs`, add location service creation beside stat/category/tag services:

```csharp
var locations = new LocationExtractionService(new BuiltLookupTableLocationAssetSource());
```

Pass it to finalize:

```csharp
Register(new Handlers.RunFinalizeCommand(runs, items, statTypes: statTypes, itemCategories: itemCategories, itemTags: itemTags, locations: locations));
```

Add required `using ArdenfallCompendium.Entities.Location;` if the file does not already compile through namespace qualification.

- [ ] **Step 10: Update finalize tests**

In `mod-tests/RunFinalizeCommandTests.cs`, add fake cache:

```csharp
private sealed class FakeLocationExtractionCache : ILocationExtractionCache
{
    private readonly IReadOnlyList<LocationSnapshotRow> _rows;
    private readonly IReadOnlyList<Diagnostic> _diagnostics;

    public FakeLocationExtractionCache(IReadOnlyList<LocationSnapshotRow>? rows = null, IReadOnlyList<Diagnostic>? diagnostics = null)
    {
        _rows = rows ?? System.Array.Empty<LocationSnapshotRow>();
        _diagnostics = diagnostics ?? System.Array.Empty<Diagnostic>();
    }

    public IReadOnlyList<LocationSnapshotRow> GetOrExtract(CompendiumRun run) => _rows;

    public IReadOnlyList<Diagnostic> GetWalkerDiagnostics(CompendiumRun run) => _diagnostics;
}
```

Add static default near other empty caches:

```csharp
private static readonly FakeLocationExtractionCache EmptyLocations = new(System.Array.Empty<LocationSnapshotRow>());
```

Update `RunFinalizeCommand` construction helpers and direct calls to pass `locations: EmptyLocations` where they currently pass `EmptyStatTypes`, `EmptyItemCategories`, and `EmptyItemTags`.

Add a test:

```csharp
[Fact]
public async Task FinalizeWritesLocationsEnvelopeAndManifestCount()
{
    var runs = new CompendiumRunManager();
    var outputBaseDir = Directory.CreateTempSubdirectory("ardenfall-finalize-location-test-").FullName;
    var run = runs.Begin(outputBaseDir, "test-version");
    run.SetEntityPlan("item", total: 0, batchSize: 1);
    runs.Save(run);
    var locations = new FakeLocationExtractionCache(new[]
    {
        new LocationSnapshotRow
        {
            Id = "11111111.fixture-town",
            Fields = new LocationSnapshot(
                Id: "11111111.fixture-town",
                GameLocationId: "town",
                Name: "Harbor Town",
                Enabled: true,
                MapRef: null,
                MapId: "ardenfall",
                ShowOnMap: true,
                ShowOnMapDebugOnly: false,
                IconRef: null,
                MapPosition: new LocationVector3Snapshot(12f, 3f, -8f),
                AllowFastTravel: true,
                FastTravelPosition: new LocationVector3Snapshot(14f, 4f, -10f),
                DisplayOnEnterVolume: true,
                Volumes: new List<LocationVolumeSnapshot>())
        }
    });
    var command = new RunFinalizeCommand(
        runs,
        new FakeItemExtractionCache(System.Array.Empty<Diagnostic>()),
        FakeMasterTooltipSource.Default,
        EmptyStatTypes,
        EmptyItemCategories,
        EmptyItemTags,
        locations,
        preflight: PassingPreflight);

    var result = await command.ExecuteAsync(TestControlCommandContext.Create<RunFinalizeResult>(), new RunIdArgs { RunId = run.RunId }, CancellationToken.None);

    Assert.Empty(result.Diagnostics);
    var publishedDir = Path.GetDirectoryName(result.Output!.ManifestPath)!;
    Assert.True(File.Exists(Path.Combine(publishedDir, "locations.json")));
    var manifestJson = File.ReadAllText(result.Output.ManifestPath);
    Assert.Contains("\"location\":1", manifestJson.Replace(" ", string.Empty));
    Assert.Contains("locations", result.Artifacts.Keys);
}
```

- [ ] **Step 11: Run mod tests**

Run:

```bash
dotnet test mod-tests/ArdenfallCompendium.Tests.csproj --nologo -v q --filter "LocationExtractorTests|LocationSnapshotTests|RunFinalizeCommandTests|TypedCommandRegistryTests"
```

Expected: PASS.

- [ ] **Step 12: Commit mod extraction**

```bash
git add mod/src/Entities/Location mod/src/Extraction/ILocationExtractionCache.cs mod/src/Extraction/LocationExtractionService.cs mod/src/Control/CompendiumCommandRegistry.cs mod/src/Control/Handlers/RunFinalizeCommand.cs mod-tests/LocationExtractorTests.cs mod-tests/LocationSnapshotTests.cs mod-tests/RunFinalizeCommandTests.cs mod-tests/TypedCommandRegistryTests.cs
git commit -m "feat(mod): extract location snapshots"
```

---

## Task 6: Synthetic fixture and controller validation

**Files:**

- Create: `fixtures/synthetic/snapshot/locations.json`
- Modify: `fixtures/synthetic/snapshot/manifest.json`
- Modify: `fixtures/synthetic/manifest.json`
- Modify: `controller/src/validate-snapshot.ts`
- Modify: `controller/test/export-orchestrator.test.ts`
- Modify: `pipeline/test/end-to-end.test.ts`

- [ ] **Step 1: Add synthetic locations envelope**

Create `fixtures/synthetic/snapshot/locations.json`:

```json
{
  "entityId": "location",
  "schemaVersion": 1,
  "rows": [
    {
      "id": "11111111.fixture-town",
      "fields": {
        "id": "11111111.fixture-town",
        "gameLocationId": "town",
        "name": "Harbor Town",
        "enabled": true,
        "mapRef": {
          "kind": "lookupAsset",
          "guid": "aaaaaaaa.fixture-map",
          "unityType": "MapData",
          "name": "Ardenfall"
        },
        "mapId": "ardenfall",
        "showOnMap": true,
        "showOnMapDebugOnly": false,
        "iconRef": {
          "kind": "missing",
          "reason": "not-exported-in-slice-5",
          "source": "LocationAsset.icon"
        },
        "mapPosition": { "x": 12, "y": 3, "z": -8 },
        "allowFastTravel": true,
        "fastTravelPosition": { "x": 14, "y": 4, "z": -10 },
        "displayOnEnterVolume": true,
        "volumes": [
          {
            "index": 0,
            "center": { "x": 10, "y": 2, "z": -20 },
            "size": { "x": 6, "y": 4, "z": 8 }
          }
        ]
      }
    },
    {
      "id": "22222222.fixture-debug-cave",
      "fields": {
        "id": "22222222.fixture-debug-cave",
        "gameLocationId": "debug-cave",
        "name": "Debug Cave",
        "enabled": true,
        "mapRef": null,
        "mapId": "ardenfall",
        "showOnMap": true,
        "showOnMapDebugOnly": true,
        "iconRef": null,
        "mapPosition": { "x": -5, "y": 1, "z": 9 },
        "allowFastTravel": false,
        "fastTravelPosition": null,
        "displayOnEnterVolume": false,
        "volumes": []
      },
      "diagnostics": [
        {
          "severity": "diagnostic",
          "code": "locationMapMissing",
          "field": "mapId",
          "message": "Synthetic row exercises row diagnostics without fatality"
        }
      ]
    }
  ]
}
```

- [ ] **Step 2: Update snapshot manifest counts and hashes**

Run this command to compute the `locations.json` hash:

```bash
bun -e 'const data = await Bun.file("fixtures/synthetic/snapshot/locations.json").arrayBuffer(); console.log(new Bun.CryptoHasher("sha256").update(data).digest("hex"));'
```

Update `fixtures/synthetic/snapshot/manifest.json`:

```json
"counts": {
  "item": 5,
  "stat-type": 2,
  "item-category": 1,
  "item-tag": 2,
  "location": 2
}
```

Add `locations.json` to `hashes` and paste the exact hash printed by the command
as the value. The resulting entry shape is:

```json
"locations.json": "64 lowercase hex characters printed by the hash command"
```

- [ ] **Step 3: Update fixture pack manifest**

In `fixtures/synthetic/manifest.json`, add an intended assertion:

```json
"LocationAsset fixture rows for map points, debug-only filtering, and axis-aligned volumes"
```

Add selection:

```json
{
  "entity": "location",
  "ids": ["11111111.fixture-town", "22222222.fixture-debug-cave"],
  "rationale": "one public map point with an area volume and one debug-only marker excluded from default map point read models"
}
```

Run this command to print all fixture hashes that must be updated:

```bash
bun -e 'const { readdirSync, statSync } = await import("node:fs"); const { join } = await import("node:path"); function walk(dir,out=[]){ for (const e of readdirSync(dir)){ const p=join(dir,e); const s=statSync(p); if (s.isDirectory()) walk(p,out); else if (!p.endsWith("/manifest.json") && p !== "fixtures/synthetic/manifest.json") out.push(p); } return out;} for (const p of walk("fixtures/synthetic")){ const data=await Bun.file(p).arrayBuffer(); console.log(`${p.slice("fixtures/synthetic/".length)} ${new Bun.CryptoHasher("sha256").update(data).digest("hex")}`); }'
```

Add `snapshot/locations.json` to `hashes` and paste the exact hash printed for
that path as the value. The resulting entry shape is:

```json
"snapshot/locations.json": "64 lowercase hex characters printed by the hash command"
```

Then compute `snapshot/manifest.json` hash after the snapshot manifest edit and update the fixture pack hash for `snapshot/manifest.json`.

- [ ] **Step 4: Update controller required entity files**

In `controller/src/validate-snapshot.ts`, add location:

```ts
export const ENTITY_FILES: Record<string, string> = {
  item: "items.json",
  "stat-type": "stat-types.json",
  "item-category": "item-categories.json",
  "item-tag": "item-tags.json",
  location: "locations.json",
};
```

Update `controller/test/export-orchestrator.test.ts` helper fixture writers to include:

```ts
"locations.json": JSON.stringify({ rows: [{ id: "11111111.fixture-town" }] }, null, 2),
```

Add a validation test mirroring the existing missing-entity tests:

```ts
await writeSnapshot(root, { omitFiles: ["locations.json"] });
await expect(validateSnapshot(root)).rejects.toThrow(/locations\.json is missing/);
```

- [ ] **Step 5: Run fixture and pipeline gates**

Run:

```bash
bun run check:fixtures
bun test controller/test
bun test pipeline/test/location-canonicaliser.test.ts pipeline/test/read-models.test.ts pipeline/test/end-to-end.test.ts
bun run artifact:fixture synthetic fixtures/synthetic/snapshot
```

Expected: PASS. The artifact fixture run writes a fixture artifact under `pipeline/artifacts/fixtures/synthetic`; do not commit generated artifact outputs.

- [ ] **Step 6: Commit fixture and controller validation**

```bash
git add fixtures/synthetic/snapshot/locations.json fixtures/synthetic/snapshot/manifest.json fixtures/synthetic/manifest.json controller/src/validate-snapshot.ts controller/test/export-orchestrator.test.ts pipeline/test/end-to-end.test.ts
git commit -m "test: add location fixture coverage"
```

---

## Task 7: Final verification and plan closeout

**Files:**

- Modify: `docs/superpowers/roadmap.md`
- Modify: `docs/superpowers/plans/2026-06-02-slice5-location-data-substrate.md`

- [ ] **Step 1: Run full local gate**

Run:

```bash
bun run codegen:validators
bun run check:fixtures
dotnet test mod-tests/ArdenfallCompendium.Tests.csproj --nologo -v q
bun test pipeline/test tooling.test.ts controller/test
bun run typecheck
bun run --cwd site check
bun run artifact:fixture synthetic fixtures/synthetic/snapshot
bun run --cwd site build:fixture
bun run --cwd site smoke:prerender
bun run format:check
bun run lint
git diff --check
```

Expected: every command PASS. If a command fails, fix the source failure and re-run the failed command plus any directly affected gate before continuing.

- [ ] **Step 2: Verify no public map or location route shipped**

Run:

```bash
bun -e 'const { statSync } = await import("node:fs"); for (const p of ["site/src/routes/map", "site/src/routes/locations"]){ if (statSync(p, { throwIfNoEntry: false })) throw new Error(`${p} should not exist in Slice 5`); } console.log("no public map/location routes");'
```

Expected: `no public map/location routes`.

- [ ] **Step 3: Update roadmap Slice 5 status**

Update `docs/superpowers/roadmap.md` Slice 5 to `done` only after all gates pass. Keep it concise:

```markdown
### Slice 5 — Locations and map data substrate

**Status:** done
**Spec:** `docs/superpowers/specs/2026-06-02-slice5-location-data-substrate-design.md`
**Audit:** `docs/superpowers/specs/2026-06-02-location-source-audit.md`

**Delivered:** `LocationAsset` extraction from `MapLocationManager.GetLocations()`; canonical `locations` and `location_volumes`; source Unity `(x,y,z)` to compendium `(map_x,map_y,elevation)` transform; descriptor-owned `map_layers`; location map point/volume read models; synthetic fixture coverage. No public `/map` or `/locations` route ships in this slice.
```

Do not include command output or detailed history prose.

- [ ] **Step 4: Mark this plan completed or remove it according to roadmap protocol**

If the roadmap/specs fully capture the Slice 5 delivered state, remove `docs/superpowers/plans/2026-06-02-slice5-location-data-substrate.md`. If active execution notes are still needed for review, keep it until review finishes and record Slice 5 as `in-progress` rather than `done`.

- [ ] **Step 5: Commit closeout docs**

If Slice 5 is complete and the active plan is removed:

```bash
git add docs/superpowers/roadmap.md docs/superpowers/plans/2026-06-02-slice5-location-data-substrate.md
git commit -m "docs: close Slice 5 location substrate"
```

If Slice 5 remains in review and the plan stays active:

```bash
git add docs/superpowers/roadmap.md docs/superpowers/plans/2026-06-02-slice5-location-data-substrate.md
git commit -m "docs: update Slice 5 location status"
```
