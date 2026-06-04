# Slice 6 — Map System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an interactive, vector-first deck.gl map of locations at `/map`, driven entirely by the descriptor-owned `map_layers` metadata and Slice 5 read models, plus the relationship-graph backbone that links the map to and from compendium pages.

**Architecture:** The pipeline gains one addition — public `entity_nodes` for locations whose `route_path` is a map deep link. Everything else is site work: a build-time loader shapes a `MapView` payload from `map_layers` + location read models; pure modules (`url-state`, layer-spec factory) carry the testable logic; a CSR-only `/map` route lazy-loads deck.gl standalone (GPU device) and renders markers + volume polygons with a data-driven layer factory, legend/filters/search/details panel, and URL-addressable state.

**Tech Stack:** Bun, TypeScript, SvelteKit (Svelte 5 runes), `@deck.gl/core` + `@deck.gl/layers` 9.3.x (standalone, non-React, GPU), `bun:sqlite`/`better-sqlite3` (build-time read only), Cloudflare Workers Static Assets.

**Spec:** `docs/superpowers/specs/2026-06-04-slice6-map-system-design.md`

---

## File structure

Created:

- `pipeline/test/location-nodes.test.ts` — pipeline test for location relationship nodes.
- `site/src/lib/map/types.ts` — shared map view/layer/row types (browser-free).
- `site/src/lib/map/url-state.ts` — pure encode/decode of map UI state.
- `site/src/lib/map/layer-spec.ts` — pure, data-driven layer-spec factory + closed render-kind registry.
- `site/src/lib/map/map-store.svelte.ts` — reactive UI state (selection/filters/visibility/view).
- `site/src/lib/server/entities/location.ts` — build-time `getMapView()` read-model accessor.
- `site/src/lib/components/map/MapCanvas.svelte` — client-only deck.gl host (GPU, finalize).
- `site/src/lib/components/map/MapSidebar.svelte` — legend + layer toggles + filters.
- `site/src/lib/components/map/MapSearch.svelte` — search box + results.
- `site/src/lib/components/map/DetailsPanel.svelte` — selection details + relationship section.
- `site/src/routes/map/+page.ts` — page options (`prerender`, `ssr`, `csr=true`).
- `site/src/routes/map/+page.server.ts` — build-time loader returning `MapView`.
- `site/src/routes/map/+page.svelte` — static shell assembling the map components.
- `site/test/url-state.test.ts` — unit tests for url-state.
- `site/test/layer-spec.test.ts` — unit tests for the layer-spec factory.
- `site/test/map-read-models.test.ts` — unit tests for `getMapView()`.
- `site/scripts/smoke-map-route.mjs` — prerender smoke for `/map`.
- `site/scripts/smoke-map-browser.mjs` — Puppeteer-style browser E2E for `/map`.

Modified:

- `pipeline/src/entities/location/read-models.ts` — emit location `entity_nodes`.
- `pipeline/src/stages/emit-read-models.ts` — pass map route into `emitLocationReadModels`.
- `pipeline/test/read-models.test.ts` and/or `pipeline/test/end-to-end.test.ts` — update any `entity_nodes` count assertions.
- `site/src/lib/server/read-models.ts` — re-export `getMapView` + map types.
- `site/src/routes/+layout.server.ts` — expose `mapRoute`.
- `site/src/routes/+layout.svelte` — add "Map" nav link.
- `site/package.json` — add deck.gl deps + `smoke:map` / `smoke:map:browser` scripts.
- `docs/superpowers/roadmap.md` — Slice 6 status + open questions #6/#9.

---

## Conventions for this plan

- Pipeline TS imports use explicit `.ts` extensions (repo convention).
- Site server modules import via relative paths inside `src/lib/server`, and routes import via `$lib/...`.
- Site unit tests live in `site/test/*.test.ts` and run with `bun test site/test`. They build a temp SQLite under a temp `static/` dir and `process.chdir` before importing the read model (mirror `site/test/stat-read-models.test.ts`).
- Commits use the structured helper: `bun skill://commit/commit-helper.ts` with `COMMIT_ACTION`/`COMMIT_SUBJECT`/`COMMIT_BODY` env. Title-only commits are acceptable only for mechanical changes.
- Do not run project-wide gates between every micro-step; run the targeted test named in each task. The full gate runs once in Task 12.

---

## Phase 1 — Pipeline: location relationship nodes

### Task 1: Emit public location `entity_nodes` with a map deep-link route_path

**Files:**

- Modify: `pipeline/src/entities/location/read-models.ts`
- Modify: `pipeline/src/stages/emit-read-models.ts`
- Test: `pipeline/test/location-nodes.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
// pipeline/test/location-nodes.test.ts
import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { LOCATION_DDL } from "../src/sql/location-ddl.ts";
import { ENTITY_GRAPH_DDL } from "../src/relationships/relationship-graph.ts";
import { emitLocationReadModels } from "../src/entities/location/read-models.ts";

function seed(db: Database): void {
  db.exec(ENTITY_GRAPH_DDL);
  db.exec(LOCATION_DDL);
  db.exec(`
    INSERT INTO locations (
      id, game_location_id, name, enabled, map_ref, map_id,
      show_on_map, show_on_map_debug_only, icon_ref,
      map_x, map_y, elevation, allow_fast_travel,
      fast_travel_x, fast_travel_y, fast_travel_elevation, display_on_enter_volume
    ) VALUES
      ('11111111.fixture-town', 'town', 'Harbor Town', 1, NULL, 'ardenfall',
       1, 0, NULL, 12, 8, 3, 1, 12, 8, 3, 1),
      ('22222222.fixture-debug-cave', 'cave', 'Debug Cave', 1, NULL, NULL,
       1, 1, NULL, -4, -6, 1, 0, NULL, NULL, NULL, 1);
  `);
}

describe("location entity nodes", () => {
  it("emits a public node per enabled location with a map deep-link route_path", () => {
    const db = new Database(":memory:");
    seed(db);

    emitLocationReadModels(db, "/map");

    const nodes = db
      .query<{ entity_id: string; route_path: string; is_public: number; short_id: string }, []>(
        `SELECT entity_id, route_path, is_public, short_id
         FROM entity_nodes WHERE entity_type = 'location' ORDER BY entity_id`,
      )
      .all();

    expect(nodes).toHaveLength(2);
    const town = nodes.find((n) => n.entity_id === "11111111.fixture-town")!;
    expect(town.is_public).toBe(1);
    expect(town.route_path).toBe(`/map?map=ardenfall&sel=${town.short_id}`);

    const cave = nodes.find((n) => n.entity_id === "22222222.fixture-debug-cave")!;
    // No mapId -> deep link omits the map param.
    expect(cave.route_path).toBe(`/map?sel=${cave.short_id}`);
    expect(cave.is_public).toBe(1);
  });

  it("does not collide short_ids across locations", () => {
    const db = new Database(":memory:");
    seed(db);
    emitLocationReadModels(db, "/map");
    const count = db
      .query<{ cnt: number }, []>(
        `SELECT COUNT(*) AS cnt FROM (
           SELECT short_id FROM entity_nodes WHERE entity_type='location'
           GROUP BY short_id HAVING COUNT(*) > 1)`,
      )
      .get()!;
    expect(count.cnt).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test pipeline/test/location-nodes.test.ts`
Expected: FAIL — `emitLocationReadModels` takes only `(db)` and emits no nodes (arity/assertion error).

- [ ] **Step 3: Implement node emission**

Edit `pipeline/src/entities/location/read-models.ts`. Add imports at the top:

```ts
import { ENTITY_GRAPH_DDL } from "../../relationships/relationship-graph.ts";
import { deriveEntityNodeSlug, prepareEntityNodeWriter } from "../item/read-models.ts";
```

Change the signature and body of `emitLocationReadModels` to accept the map route and emit nodes after the read-model inserts:

```ts
export function emitLocationReadModels(db: Database, mapRoute = "/map"): void {
  db.exec(LOCATION_READ_MODEL_DDL);
  db.exec(ENTITY_GRAPH_DDL);

  // ... existing INSERT INTO location_map_points / location_map_volumes ...

  const writeNode = prepareEntityNodeWriter(db);
  const nodeRows = db
    .query<
      { id: string; name: string; map_id: string | null },
      []
    >(`SELECT id, name, map_id FROM locations WHERE enabled = 1 ORDER BY name`)
    .all();
  const tx = db.transaction(() => {
    for (const row of nodeRows) {
      const slug = deriveEntityNodeSlug(row.name, row.id);
      const query = row.map_id
        ? `map=${encodeURIComponent(row.map_id)}&sel=${slug.shortId}`
        : `sel=${slug.shortId}`;
      writeNode({
        entityType: "location",
        entityId: row.id,
        label: row.name,
        routePath: `${mapRoute}?${query}`,
        canonicalSlug: slug.canonicalSlug,
        shortId: slug.shortId,
      });
    }
  });
  tx();
}
```

Note: keep the existing read-model INSERTs unchanged; only add the `ENTITY_GRAPH_DDL` exec and the node-emission block.

Edit `pipeline/src/stages/emit-read-models.ts` so the location call passes the map route (a site constant):

```ts
if (snapshot.envelopes.location) {
  emitLocationReadModels(db, "/map");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test pipeline/test/location-nodes.test.ts`
Expected: PASS (both tests).

- [ ] **Step 5: Reconcile dependent pipeline tests**

Run: `bun test pipeline/test`
If a test asserts an exact `entity_nodes` count or the manifest `entityNodes` total (e.g. in `pipeline/test/read-models.test.ts` or `pipeline/test/end-to-end.test.ts`), update the expected count to include the synthetic fixture's location nodes (2). Do not loosen assertions to "greater than"; set the exact new number.
Expected: all pipeline tests PASS.

- [ ] **Step 6: Commit**

```bash
git add pipeline/src/entities/location/read-models.ts pipeline/src/stages/emit-read-models.ts pipeline/test/location-nodes.test.ts pipeline/test/read-models.test.ts pipeline/test/end-to-end.test.ts
bun skill://commit/commit-helper.ts
# COMMIT_ACTION=commit
# COMMIT_SUBJECT="feat(pipeline): emit public location relationship nodes"
# COMMIT_BODY explains: locations become public graph nodes whose route_path is
#   the map deep link, so cross-entity links to places resolve and are validated
#   by the existing relationship audit; the map is the location's detail surface.
```

---

## Phase 2 — Site data and pure logic

### Task 2: Map types and URL-state codec

**Files:**

- Create: `site/src/lib/map/types.ts`
- Create: `site/src/lib/map/url-state.ts`
- Test: `site/test/url-state.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// site/test/url-state.test.ts
import { describe, expect, it } from "bun:test";
import { decodeMapState, encodeMapState, type MapUiState } from "../src/lib/map/url-state";

const full: MapUiState = {
  mapId: "ardenfall",
  center: [12.5, -8.25],
  zoom: 3,
  selected: "abc12345",
  hiddenLayers: ["locations"],
  showDebug: true,
  fastTravelOnly: false,
};

describe("map url-state", () => {
  it("round-trips full state through query params", () => {
    const qs = encodeMapState(full);
    const decoded = decodeMapState(new URLSearchParams(qs));
    expect(decoded).toEqual(full);
  });

  it("returns defaults for an empty query", () => {
    expect(decodeMapState(new URLSearchParams(""))).toEqual({
      mapId: null,
      center: null,
      zoom: null,
      selected: null,
      hiddenLayers: [],
      showDebug: false,
      fastTravelOnly: false,
    });
  });

  it("omits absent keys from the encoded string", () => {
    const qs = encodeMapState({
      mapId: null,
      center: null,
      zoom: null,
      selected: "abc12345",
      hiddenLayers: [],
      showDebug: false,
      fastTravelOnly: false,
    });
    const params = new URLSearchParams(qs);
    expect(params.get("sel")).toBe("abc12345");
    expect(params.has("map")).toBe(false);
    expect(params.has("c")).toBe(false);
    expect(params.has("debug")).toBe(false);
  });

  it("ignores malformed center/zoom without throwing", () => {
    const decoded = decodeMapState(new URLSearchParams("c=bad&z=NaN"));
    expect(decoded.center).toBeNull();
    expect(decoded.zoom).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test site/test/url-state.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement types and codec**

```ts
// site/src/lib/map/types.ts
export type RenderKind = "point-or-polygon" | "point" | "polygon";

export interface MapLayerConfig {
  layerId: string;
  entityType: string;
  renderKind: RenderKind;
  sourceTables: string[];
  fillColor: [number, number, number, number];
  radius: number | null;
  icon: string | null;
  tooltipFields: string[];
  filters: string[];
  legendLabel: string;
  zOrder: number;
}

export interface MapPointRow {
  id: string;
  layerId: string;
  mapId: string | null;
  position: [number, number, number];
  name: string;
  tooltip: string;
  debugOnly: boolean;
  fastTravel: boolean;
  nodeShortId: string | null;
}

export interface MapVolumeRow {
  id: string;
  layerId: string;
  locationId: string;
  mapId: string | null;
  ring: [number, number][];
  elevationMin: number | null;
  elevationMax: number | null;
  name: string;
}

export interface MapBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface MapSummary {
  mapId: string | null;
  label: string;
  bounds: MapBounds | null;
}

export interface MapView {
  maps: MapSummary[];
  layers: MapLayerConfig[];
  points: MapPointRow[];
  volumes: MapVolumeRow[];
}
```

```ts
// site/src/lib/map/url-state.ts
export interface MapUiState {
  mapId: string | null;
  center: [number, number] | null;
  zoom: number | null;
  selected: string | null;
  hiddenLayers: string[];
  showDebug: boolean;
  fastTravelOnly: boolean;
}

const num = (value: string | null): number | null => {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function decodeMapState(params: URLSearchParams): MapUiState {
  const center = params.get("c");
  let parsedCenter: [number, number] | null = null;
  if (center) {
    const [x, y] = center.split(",").map((v) => Number(v));
    if (Number.isFinite(x) && Number.isFinite(y)) parsedCenter = [x, y];
  }
  const hidden = params.get("hide");
  return {
    mapId: params.get("map"),
    center: parsedCenter,
    zoom: num(params.get("z")),
    selected: params.get("sel"),
    hiddenLayers: hidden ? hidden.split(",").filter(Boolean) : [],
    showDebug: params.get("debug") === "1",
    fastTravelOnly: params.get("ft") === "1",
  };
}

export function encodeMapState(state: MapUiState): string {
  const params = new URLSearchParams();
  if (state.mapId) params.set("map", state.mapId);
  if (state.center) params.set("c", `${state.center[0]},${state.center[1]}`);
  if (state.zoom !== null) params.set("z", String(state.zoom));
  if (state.selected) params.set("sel", state.selected);
  if (state.hiddenLayers.length > 0) params.set("hide", state.hiddenLayers.join(","));
  if (state.showDebug) params.set("debug", "1");
  if (state.fastTravelOnly) params.set("ft", "1");
  return params.toString();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test site/test/url-state.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add site/src/lib/map/types.ts site/src/lib/map/url-state.ts site/test/url-state.test.ts
bun skill://commit/commit-helper.ts
# COMMIT_SUBJECT="feat(site): add map view types and url-state codec"
```

### Task 3: Data-driven layer-spec factory

**Files:**

- Create: `site/src/lib/map/layer-spec.ts`
- Test: `site/test/layer-spec.test.ts`

The factory is pure: it maps a `MapLayerConfig` + rows + UI filters to plain
`LayerSpec` descriptors. It does not import deck.gl, so it is unit-testable; the
client component maps `LayerSpec` to deck.gl layer instances (Task 7).

- [ ] **Step 1: Write the failing test**

```ts
// site/test/layer-spec.test.ts
import { describe, expect, it } from "bun:test";
import { buildEntityLayerSpecs } from "../src/lib/map/layer-spec";
import type { MapLayerConfig, MapPointRow, MapVolumeRow } from "../src/lib/map/types";

const layer: MapLayerConfig = {
  layerId: "locations",
  entityType: "location",
  renderKind: "point-or-polygon",
  sourceTables: ["location_map_points", "location_map_volumes"],
  fillColor: [120, 170, 255, 255],
  radius: 6,
  icon: "location",
  tooltipFields: ["name"],
  filters: [],
  legendLabel: "Locations",
  zOrder: 0,
};

const point = (id: string, over: Partial<MapPointRow> = {}): MapPointRow => ({
  id,
  layerId: "locations",
  mapId: "ardenfall",
  position: [1, 2, 0],
  name: id,
  tooltip: id,
  debugOnly: false,
  fastTravel: false,
  nodeShortId: id,
  ...over,
});

const volume: MapVolumeRow = {
  id: "v1",
  layerId: "locations",
  locationId: "town",
  mapId: "ardenfall",
  ring: [
    [0, 0],
    [4, 0],
    [4, 4],
    [0, 4],
    [0, 0],
  ],
  elevationMin: 0,
  elevationMax: 2,
  name: "town",
};

const baseUi = { hiddenLayers: [] as string[], showDebug: false, fastTravelOnly: false };

describe("buildEntityLayerSpecs", () => {
  it("expands point-or-polygon into a polygon spec and a scatterplot spec", () => {
    const specs = buildEntityLayerSpecs(layer, [point("a")], [volume], baseUi);
    expect(specs.map((s) => s.kind)).toEqual(["polygon", "scatterplot"]);
    expect(specs.find((s) => s.kind === "scatterplot")!.fillColor).toEqual([120, 170, 255, 255]);
    expect(specs.find((s) => s.kind === "scatterplot")!.radius).toBe(6);
  });

  it("hides debug-only points unless showDebug is set", () => {
    const rows = [point("a"), point("b", { debugOnly: true })];
    const hidden = buildEntityLayerSpecs(layer, rows, [], baseUi);
    expect(
      (hidden.find((s) => s.kind === "scatterplot")!.data as MapPointRow[]).map((r) => r.id),
    ).toEqual(["a"]);
    const shown = buildEntityLayerSpecs(layer, rows, [], { ...baseUi, showDebug: true });
    expect(
      (shown.find((s) => s.kind === "scatterplot")!.data as MapPointRow[]).map((r) => r.id),
    ).toEqual(["a", "b"]);
  });

  it("keeps only fast-travel points when fastTravelOnly is set", () => {
    const rows = [point("a", { fastTravel: true }), point("b", { fastTravel: false })];
    const specs = buildEntityLayerSpecs(layer, rows, [], { ...baseUi, fastTravelOnly: true });
    expect(
      (specs.find((s) => s.kind === "scatterplot")!.data as MapPointRow[]).map((r) => r.id),
    ).toEqual(["a"]);
  });

  it("sets visible=false when the layer is hidden, without dropping data", () => {
    const specs = buildEntityLayerSpecs(layer, [point("a")], [volume], {
      ...baseUi,
      hiddenLayers: ["locations"],
    });
    expect(specs.every((s) => s.visible === false)).toBe(true);
    expect((specs.find((s) => s.kind === "scatterplot")!.data as MapPointRow[]).length).toBe(1);
  });

  it("throws on an unknown render kind", () => {
    expect(() =>
      buildEntityLayerSpecs(
        { ...layer, renderKind: "hologram" as never },
        [point("a")],
        [],
        baseUi,
      ),
    ).toThrow(/unknown render kind/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test site/test/layer-spec.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the factory**

```ts
// site/src/lib/map/layer-spec.ts
import type { MapLayerConfig, MapPointRow, MapVolumeRow, RenderKind } from "./types";

export interface MapUiFilters {
  hiddenLayers: string[];
  showDebug: boolean;
  fastTravelOnly: boolean;
}

export type LayerSpecKind = "scatterplot" | "polygon";

export interface LayerSpec {
  id: string;
  layerId: string;
  kind: LayerSpecKind;
  data: MapPointRow[] | MapVolumeRow[];
  visible: boolean;
  fillColor: [number, number, number, number];
  radius?: number;
  pickable: boolean;
}

const KIND_PARTS: Record<RenderKind, LayerSpecKind[]> = {
  "point-or-polygon": ["polygon", "scatterplot"],
  point: ["scatterplot"],
  polygon: ["polygon"],
};

function filterPoints(rows: MapPointRow[], ui: MapUiFilters): MapPointRow[] {
  return rows.filter((r) => (ui.showDebug || !r.debugOnly) && (!ui.fastTravelOnly || r.fastTravel));
}

export function buildEntityLayerSpecs(
  layer: MapLayerConfig,
  points: MapPointRow[],
  volumes: MapVolumeRow[],
  ui: MapUiFilters,
): LayerSpec[] {
  const parts = KIND_PARTS[layer.renderKind];
  if (!parts) {
    throw new Error(`unknown render kind '${layer.renderKind}' for layer '${layer.layerId}'`);
  }
  const visible = !ui.hiddenLayers.includes(layer.layerId);
  const layerPoints = points.filter((p) => p.layerId === layer.layerId);
  const layerVolumes = volumes.filter((v) => v.layerId === layer.layerId);

  const specs: LayerSpec[] = [];
  for (const kind of parts) {
    if (kind === "polygon") {
      specs.push({
        id: `${layer.layerId}::polygon`,
        layerId: layer.layerId,
        kind,
        data: layerVolumes,
        visible,
        fillColor: layer.fillColor,
        pickable: true,
      });
    } else {
      specs.push({
        id: `${layer.layerId}::point`,
        layerId: layer.layerId,
        kind,
        data: filterPoints(layerPoints, ui),
        visible,
        fillColor: layer.fillColor,
        radius: layer.radius ?? 6,
        pickable: true,
      });
    }
  }
  return specs;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test site/test/layer-spec.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add site/src/lib/map/layer-spec.ts site/test/layer-spec.test.ts
bun skill://commit/commit-helper.ts
# COMMIT_SUBJECT="feat(site): add data-driven map layer-spec factory"
```

### Task 4: Build-time `getMapView()` read-model accessor

**Files:**

- Create: `site/src/lib/server/entities/location.ts`
- Modify: `site/src/lib/server/read-models.ts`
- Test: `site/test/map-read-models.test.ts`

`getMapView()` reads `map_layers` for styling/identity, classifies each
`source_table` by suffix (`*_map_points` / `*_map_volumes`), reads rows from the
validated tables, joins points to `entity_nodes` for `nodeShortId`, computes
per-map bounds, and returns the `MapView`. Unknown render kinds, missing source
tables, or source tables not matching the suffix contract fail fast.

- [ ] **Step 1: Write the failing test**

```ts
// site/test/map-read-models.test.ts
import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function withDb(seed: (db: Database) => void) {
  const root = join(tmpdir(), `ardenfall-map-models-${process.pid}-${Date.now()}-${Math.random()}`);
  mkdirSync(join(root, "static"), { recursive: true });
  const db = new Database(join(root, "static", "data.sqlite"));
  seed(db);
  db.close();
  return root;
}

const baseSchema = `
  CREATE TABLE map_layers (
    layer_id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, source_table TEXT NOT NULL,
    source_tables_json TEXT NOT NULL, render_kind TEXT NOT NULL, icon TEXT,
    color_json TEXT NOT NULL, radius REAL, tooltip_fields_json TEXT NOT NULL,
    filters_json TEXT NOT NULL, legend_label TEXT NOT NULL, z_order INTEGER NOT NULL
  );
  CREATE TABLE location_map_points (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, map_id TEXT, map_x REAL NOT NULL,
    map_y REAL NOT NULL, elevation REAL NOT NULL, show_on_map INTEGER NOT NULL,
    show_on_map_debug_only INTEGER NOT NULL, allow_fast_travel INTEGER NOT NULL
  );
  CREATE TABLE location_map_volumes (
    id TEXT PRIMARY KEY, location_id TEXT NOT NULL, name TEXT NOT NULL, map_id TEXT,
    geometry_json TEXT NOT NULL, elevation_min REAL, elevation_max REAL
  );
  CREATE TABLE entity_nodes (
    entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, label TEXT NOT NULL,
    route_path TEXT NOT NULL, canonical_slug TEXT NOT NULL, short_id TEXT NOT NULL,
    is_public INTEGER NOT NULL, PRIMARY KEY (entity_type, entity_id)
  );
`;

describe("getMapView", () => {
  it("shapes layers, points (with node short ids), volumes, and per-map bounds", async () => {
    const root = withDb((db) => {
      db.exec(baseSchema);
      db.exec(`
        INSERT INTO map_layers VALUES
          ('locations', 'location', 'location_map_points',
           '["location_map_points","location_map_volumes"]', 'point-or-polygon', 'location',
           '[120,170,255]', 6, '["name"]', '[]', 'Locations', 0);
        INSERT INTO location_map_points VALUES
          ('11111111.fixture-town', 'Harbor Town', 'ardenfall', 12, 8, 3, 1, 0, 1);
        INSERT INTO location_map_volumes VALUES
          ('vol-1', '11111111.fixture-town', 'Harbor Town', 'ardenfall',
           '{"ring":[[10,6],[14,6],[14,10],[10,10],[10,6]]}', 0, 2);
        INSERT INTO entity_nodes VALUES
          ('location', '11111111.fixture-town', 'Harbor Town',
           '/map?map=ardenfall&sel=abc12345', 'harbor-town--abc12345', 'abc12345', 1);
      `);
    });
    try {
      process.chdir(root);
      const { getMapView } = await import("../src/lib/server/read-models");
      const view = getMapView();

      expect(view.layers).toEqual([
        {
          layerId: "locations",
          entityType: "location",
          renderKind: "point-or-polygon",
          sourceTables: ["location_map_points", "location_map_volumes"],
          fillColor: [120, 170, 255, 255],
          radius: 6,
          icon: "location",
          tooltipFields: ["name"],
          filters: [],
          legendLabel: "Locations",
          zOrder: 0,
        },
      ]);
      expect(view.points).toEqual([
        {
          id: "11111111.fixture-town",
          layerId: "locations",
          mapId: "ardenfall",
          position: [12, 8, 3],
          name: "Harbor Town",
          tooltip: "Harbor Town",
          debugOnly: false,
          fastTravel: true,
          nodeShortId: "abc12345",
        },
      ]);
      expect(view.volumes[0].ring).toEqual([
        [10, 6],
        [14, 6],
        [14, 10],
        [10, 10],
        [10, 6],
      ]);
      expect(view.maps).toEqual([
        {
          mapId: "ardenfall",
          label: "ardenfall",
          bounds: { minX: 10, minY: 6, maxX: 14, maxY: 10 },
        },
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails fast on a source table that violates the suffix contract", async () => {
    const root = withDb((db) => {
      db.exec(baseSchema);
      db.exec(`
        INSERT INTO map_layers VALUES
          ('bad', 'location', 'locations',
           '["locations"]', 'point', NULL, '[1,2,3]', NULL, '[]', '[]', 'Bad', 0);
      `);
    });
    try {
      process.chdir(root);
      const { getMapView } = await import("../src/lib/server/read-models");
      expect(() => getMapView()).toThrow(/source table/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

> Note: importing `read-models` is process-cached. Because two tests import it
> after different `chdir`s, give each test its own temp root and `chdir` before
> import (the db handle re-opens when the resolved path changes; see `db.ts`).

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test site/test/map-read-models.test.ts`
Expected: FAIL — `getMapView` not exported.

- [ ] **Step 3: Implement the loader**

```ts
// site/src/lib/server/entities/location.ts
import { all } from "../db";
import type {
  MapBounds,
  MapLayerConfig,
  MapPointRow,
  MapSummary,
  MapView,
  MapVolumeRow,
  RenderKind,
} from "../../map/types";

const KNOWN_KINDS: RenderKind[] = ["point-or-polygon", "point", "polygon"];
const POINT_SUFFIX = "_map_points";
const VOLUME_SUFFIX = "_map_volumes";

interface MapLayerRecord {
  layer_id: string;
  entity_id: string;
  render_kind: string;
  source_tables_json: string;
  color_json: string;
  radius: number | null;
  icon: string | null;
  tooltip_fields_json: string;
  filters_json: string;
  legend_label: string;
  z_order: number;
}

function toFillColor(json: string): [number, number, number, number] {
  const parsed = JSON.parse(json) as number[];
  if (!Array.isArray(parsed) || parsed.length < 3 || parsed.some((n) => !Number.isFinite(n))) {
    throw new Error(`invalid map layer color JSON: ${json}`);
  }
  return [parsed[0], parsed[1], parsed[2], parsed[3] ?? 255];
}

function tableExists(name: string): boolean {
  return (
    all<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name = ?", [name])
      .length > 0
  );
}

function readLayers(): MapLayerConfig[] {
  return all<MapLayerRecord>(`SELECT * FROM map_layers ORDER BY z_order, layer_id`).map((row) => {
    if (!KNOWN_KINDS.includes(row.render_kind as RenderKind)) {
      throw new Error(`unknown render kind '${row.render_kind}' for layer '${row.layer_id}'`);
    }
    const sourceTables = JSON.parse(row.source_tables_json) as string[];
    for (const table of sourceTables) {
      if (!table.endsWith(POINT_SUFFIX) && !table.endsWith(VOLUME_SUFFIX)) {
        throw new Error(
          `source table '${table}' for layer '${row.layer_id}' must end in ${POINT_SUFFIX} or ${VOLUME_SUFFIX}`,
        );
      }
      if (!tableExists(table)) {
        throw new Error(`map layer '${row.layer_id}' references missing source table '${table}'`);
      }
    }
    return {
      layerId: row.layer_id,
      entityType: row.entity_id,
      renderKind: row.render_kind as RenderKind,
      sourceTables,
      fillColor: toFillColor(row.color_json),
      radius: row.radius,
      icon: row.icon,
      tooltipFields: JSON.parse(row.tooltip_fields_json) as string[],
      filters: JSON.parse(row.filters_json) as string[],
      legendLabel: row.legend_label,
      zOrder: row.z_order,
    };
  });
}

function readPoints(layer: MapLayerConfig): MapPointRow[] {
  const rows: MapPointRow[] = [];
  for (const table of layer.sourceTables.filter((t) => t.endsWith(POINT_SUFFIX))) {
    const records = all<{
      id: string;
      name: string;
      map_id: string | null;
      map_x: number;
      map_y: number;
      elevation: number;
      show_on_map_debug_only: number;
      allow_fast_travel: number;
      short_id: string | null;
    }>(
      `SELECT p.id, p.name, p.map_id, p.map_x, p.map_y, p.elevation,
              p.show_on_map_debug_only, p.allow_fast_travel, n.short_id
       FROM ${table} p
       LEFT JOIN entity_nodes n
         ON n.entity_type = ? AND n.entity_id = p.id AND n.is_public = 1
       ORDER BY p.name`,
      [layer.entityType],
    );
    for (const r of records) {
      rows.push({
        id: r.id,
        layerId: layer.layerId,
        mapId: r.map_id,
        position: [r.map_x, r.map_y, r.elevation],
        name: r.name,
        tooltip: r.name,
        debugOnly: r.show_on_map_debug_only === 1,
        fastTravel: r.allow_fast_travel === 1,
        nodeShortId: r.short_id,
      });
    }
  }
  return rows;
}

function readVolumes(layer: MapLayerConfig): MapVolumeRow[] {
  const rows: MapVolumeRow[] = [];
  for (const table of layer.sourceTables.filter((t) => t.endsWith(VOLUME_SUFFIX))) {
    const records = all<{
      id: string;
      location_id: string;
      name: string;
      map_id: string | null;
      geometry_json: string;
      elevation_min: number | null;
      elevation_max: number | null;
    }>(
      `SELECT id, location_id, name, map_id, geometry_json, elevation_min, elevation_max FROM ${table} ORDER BY name`,
    );
    for (const r of records) {
      const ring = (JSON.parse(r.geometry_json) as { ring: [number, number][] }).ring;
      rows.push({
        id: r.id,
        layerId: layer.layerId,
        locationId: r.location_id,
        mapId: r.map_id,
        ring,
        elevationMin: r.elevation_min,
        elevationMax: r.elevation_max,
        name: r.name,
      });
    }
  }
  return rows;
}

function computeMaps(points: MapPointRow[], volumes: MapVolumeRow[]): MapSummary[] {
  const byMap = new Map<string | null, MapBounds | null>();
  const extend = (mapId: string | null, x: number, y: number) => {
    const prev = byMap.get(mapId) ?? null;
    const next: MapBounds = prev
      ? {
          minX: Math.min(prev.minX, x),
          minY: Math.min(prev.minY, y),
          maxX: Math.max(prev.maxX, x),
          maxY: Math.max(prev.maxY, y),
        }
      : { minX: x, minY: y, maxX: x, maxY: y };
    byMap.set(mapId, next);
  };
  for (const p of points) extend(p.mapId, p.position[0], p.position[1]);
  for (const v of volumes) for (const [x, y] of v.ring) extend(v.mapId, x, y);
  return [...byMap.entries()]
    .sort((a, b) => (a[0] ?? "").localeCompare(b[0] ?? ""))
    .map(([mapId, bounds]) => ({ mapId, label: mapId ?? "Unknown", bounds }));
}

export function getMapView(): MapView {
  const layers = readLayers();
  const points = layers.flatMap(readPoints);
  const volumes = layers.flatMap(readVolumes);
  return { maps: computeMaps(points, volumes), layers, points, volumes };
}
```

Edit `site/src/lib/server/read-models.ts` to re-export:

```ts
export type {
  MapBounds,
  MapLayerConfig,
  MapPointRow,
  MapSummary,
  MapView,
  MapVolumeRow,
  RenderKind,
} from "./map-view-types";
export { getMapView } from "./entities/location";
```

> The `MapView` types live in `site/src/lib/map/types.ts` (browser-free, shared
> with client modules). For server re-export convenience, import the types from
> `../../map/types` inside `entities/location.ts` (as written above) and re-export
> them in `read-models.ts` directly from `"../map/types"` rather than a separate
> file — adjust the export path to `from "../map/types"`. Use one source for the
> types; do not duplicate them.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test site/test/map-read-models.test.ts`
Expected: PASS (both cases).

- [ ] **Step 5: Commit**

```bash
git add site/src/lib/server/entities/location.ts site/src/lib/server/read-models.ts site/test/map-read-models.test.ts
bun skill://commit/commit-helper.ts
# COMMIT_SUBJECT="feat(site): add build-time map view read model"
```

---

## Phase 3 — Site route and deck.gl UI

### Task 5: Add deck.gl dependencies

**Files:**

- Modify: `site/package.json`

- [ ] **Step 1: Install**

Run:

```bash
cd site && bun add @deck.gl/core@^9.3 @deck.gl/layers@^9.3 && cd ..
```

Expected: `site/package.json` lists both under dependencies (or devDependencies, matching the existing convention where site libs are devDependencies — match the file); `bun.lock` updates.

- [ ] **Step 2: Verify resolution**

Run: `bun pm ls --cwd site | grep deck.gl` (or `read site/package.json`).
Expected: `@deck.gl/core` and `@deck.gl/layers` at 9.3.x.

- [ ] **Step 3: Commit**

```bash
git add site/package.json bun.lock
bun skill://commit/commit-helper.ts
# COMMIT_ACTION=commit, title-only acceptable:
# COMMIT_SUBJECT="build(site): add deck.gl core and layers"
```

### Task 6: Map store, page options, server loader, and page shell

**Files:**

- Create: `site/src/lib/map/map-store.svelte.ts`
- Create: `site/src/routes/map/+page.ts`
- Create: `site/src/routes/map/+page.server.ts`
- Create: `site/src/routes/map/+page.svelte`

- [ ] **Step 1: Page options (CSR exception)**

```ts
// site/src/routes/map/+page.ts
export const prerender = true;
export const ssr = true;
export const csr = true;
```

- [ ] **Step 2: Server loader**

```ts
// site/src/routes/map/+page.server.ts
import { getMapView } from "$lib/server/read-models";
import type { PageServerLoad } from "./$types";

export const prerender = true;

export const load: PageServerLoad = () => ({ mapView: getMapView() });
```

- [ ] **Step 3: Reactive store**

```ts
// site/src/lib/map/map-store.svelte.ts
import type { MapPointRow, MapView } from "./types";
import type { MapUiState } from "./url-state";

export class MapStore {
  view: MapView;
  ui = $state<MapUiState>({
    mapId: null,
    center: null,
    zoom: null,
    selected: null,
    hiddenLayers: [],
    showDebug: false,
    fastTravelOnly: false,
  });

  constructor(view: MapView, initial: Partial<MapUiState>) {
    this.view = view;
    this.ui = { ...this.ui, ...initial };
    if (this.ui.mapId === null) this.ui.mapId = view.maps[0]?.mapId ?? null;
  }

  get activeMapId(): string | null {
    return this.ui.mapId;
  }

  get selectedPoint(): MapPointRow | null {
    if (!this.ui.selected) return null;
    return this.view.points.find((p) => p.nodeShortId === this.ui.selected) ?? null;
  }

  toggleLayer(layerId: string): void {
    this.ui.hiddenLayers = this.ui.hiddenLayers.includes(layerId)
      ? this.ui.hiddenLayers.filter((id) => id !== layerId)
      : [...this.ui.hiddenLayers, layerId];
  }

  select(shortId: string | null): void {
    this.ui.selected = shortId;
  }
}
```

- [ ] **Step 4: Page shell**

```svelte
<!-- site/src/routes/map/+page.svelte -->
<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { replaceState, pushState } from "$app/navigation";
  import { MapStore } from "$lib/map/map-store.svelte";
  import { decodeMapState, encodeMapState } from "$lib/map/url-state";
  import MapSidebar from "$lib/components/map/MapSidebar.svelte";
  import MapSearch from "$lib/components/map/MapSearch.svelte";
  import DetailsPanel from "$lib/components/map/DetailsPanel.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const store = new MapStore(data.mapView, decodeMapState(page.url.searchParams));

  let MapCanvas = $state<typeof import("$lib/components/map/MapCanvas.svelte").default | null>(
    null,
  );
  onMount(() => {
    let alive = true;
    void import("$lib/components/map/MapCanvas.svelte").then((m) => {
      if (alive) MapCanvas = m.default;
    });
    return () => {
      alive = false;
    };
  });

  // Reflect UI state into the URL (replaceState; selection uses pushState).
  $effect(() => {
    const qs = encodeMapState(store.ui);
    const next = qs ? `?${qs}` : page.url.pathname;
    if (next !== page.url.search) replaceState(next, {});
  });
</script>

<svelte:head><title>Map · Ardenfall Compendium</title></svelte:head>

<div class="grid gap-4 lg:grid-cols-[260px_1fr]">
  <aside class="space-y-4">
    <MapSearch {store} />
    <MapSidebar {store} />
  </aside>
  <section class="relative h-[70vh] min-h-[480px] overflow-hidden rounded-lg border">
    {#if MapCanvas}
      <MapCanvas {store} />
    {:else}
      <p class="text-muted-foreground p-4">Loading map…</p>
    {/if}
    <noscript>
      <p class="p-4">
        The interactive map requires JavaScript. Browse locations from the item pages.
      </p>
    </noscript>
  </section>
</div>
<DetailsPanel {store} />
```

- [ ] **Step 5: Type/sanity check**

Run: `bun run --cwd site check`
Expected: this task references `MapCanvas`, `MapSidebar`, `MapSearch`, `DetailsPanel` which are created in Tasks 7-8. Implement Tasks 7-8 before running `check`; alternatively create empty stub components first. To honor the no-stub rule, implement Tasks 7-8 in the same working session and run `check` after Task 8.

- [ ] **Step 6: Commit** (after Task 8 so `check` passes)

Defer the commit for Tasks 6-8 into one commit at the end of Task 8.

### Task 7: `MapCanvas` — client-only deck.gl host (GPU)

**Files:**

- Create: `site/src/lib/components/map/MapCanvas.svelte`

This is the only client-only module. It dynamically imports deck.gl in `onMount`,
creates a GPU `Deck`, maps `LayerSpec`s to deck layers, wires picking/tooltip,
and calls `deck.finalize()` on destroy. It re-applies layers/view via
`deck.setProps` when store state changes (no re-instantiation).

- [ ] **Step 1: Implement**

```svelte
<!-- site/src/lib/components/map/MapCanvas.svelte -->
<script lang="ts">
  import { onMount } from "svelte";
  import { buildEntityLayerSpecs, type LayerSpec } from "$lib/map/layer-spec";
  import type { MapStore } from "$lib/map/map-store.svelte";
  import type { MapBounds } from "$lib/map/types";

  let { store }: { store: MapStore } = $props();
  let container: HTMLDivElement;

  // deck.gl handles are created in onMount and kept in closure scope (never module scope).
  type DeckHandle = {
    setProps: (p: Record<string, unknown>) => void;
    finalize: () => void;
    device?: { type?: string };
  };
  let deck: DeckHandle | null = null;
  let makeLayers: ((specs: LayerSpec[]) => unknown[]) | null = null;

  function activeBounds(): MapBounds | null {
    return store.view.maps.find((m) => m.mapId === store.activeMapId)?.bounds ?? null;
  }

  function initialViewState() {
    const b = activeBounds();
    if (!b) return { target: [0, 0, 0], zoom: 0 };
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 480;
    const pad = 40;
    const spanX = b.maxX - b.minX || 1;
    const spanY = b.maxY - b.minY || 1;
    const zoom = Math.min(Math.log2((w - 2 * pad) / spanX), Math.log2((h - 2 * pad) / spanY));
    return {
      target: [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, 0],
      zoom: Number.isFinite(zoom) ? zoom : 0,
      minZoom: -10,
      maxZoom: 10,
    };
  }

  function currentSpecs(): LayerSpec[] {
    const ui = {
      hiddenLayers: store.ui.hiddenLayers,
      showDebug: store.ui.showDebug,
      fastTravelOnly: store.ui.fastTravelOnly,
    };
    const mapId = store.activeMapId;
    const points = store.view.points.filter((p) => p.mapId === mapId);
    const volumes = store.view.volumes.filter((v) => v.mapId === mapId);
    return store.view.layers.flatMap((layer) => buildEntityLayerSpecs(layer, points, volumes, ui));
  }

  onMount(() => {
    let alive = true;
    let resizeObserver: ResizeObserver | undefined;

    void (async () => {
      const [{ Deck, OrthographicView }, { ScatterplotLayer, PolygonLayer }] = await Promise.all([
        import("@deck.gl/core"),
        import("@deck.gl/layers"),
      ]);
      if (!alive) return;

      makeLayers = (specs) =>
        specs.map((spec) =>
          spec.kind === "scatterplot"
            ? new ScatterplotLayer({
                id: spec.id,
                data: spec.data,
                visible: spec.visible,
                pickable: spec.pickable,
                coordinateSystem: 1, // COORDINATE_SYSTEM.CARTESIAN
                getPosition: (d: { position: number[] }) => d.position,
                getRadius: spec.radius ?? 6,
                radiusUnits: "pixels",
                getFillColor: spec.fillColor,
                autoHighlight: true,
                updateTriggers: { getRadius: spec.radius, getFillColor: spec.fillColor },
              })
            : new PolygonLayer({
                id: spec.id,
                data: spec.data,
                visible: spec.visible,
                pickable: spec.pickable,
                coordinateSystem: 1,
                positionFormat: "XY",
                getPolygon: (d: { ring: number[][] }) => d.ring,
                filled: true,
                stroked: true,
                getFillColor: [spec.fillColor[0], spec.fillColor[1], spec.fillColor[2], 60],
                getLineColor: spec.fillColor,
                lineWidthUnits: "pixels",
                lineWidthMinPixels: 1,
              }),
        );

      deck = new Deck({
        parent: container,
        deviceProps: { type: "webgl" }, // GPU; powerPreference defaults to 'high-performance' in deck.gl 9
        views: new OrthographicView({ id: "map", flipY: false, controller: true }),
        initialViewState: initialViewState(),
        layers: makeLayers(currentSpecs()),
        getTooltip: (info: { object?: { tooltip?: string; name?: string } }) =>
          info.object ? { text: info.object.tooltip ?? info.object.name ?? "" } : null,
        onClick: (info: { object?: { nodeShortId?: string | null } }) => {
          store.select(info.object?.nodeShortId ?? null);
        },
      }) as unknown as DeckHandle;
    })();

    return () => {
      alive = false;
      resizeObserver?.disconnect();
      deck?.finalize();
      deck = null;
      makeLayers = null;
    };
  });

  // Re-apply layers when filter/visibility/map state changes.
  $effect(() => {
    // touch reactive deps
    void [store.ui.hiddenLayers, store.ui.showDebug, store.ui.fastTravelOnly, store.ui.mapId];
    if (deck && makeLayers) deck.setProps({ layers: makeLayers(currentSpecs()) });
  });
</script>

<div bind:this={container} class="absolute inset-0"></div>
```

> Implementation notes:
>
> - Use `COORDINATE_SYSTEM.CARTESIAN` from `@deck.gl/core` rather than the literal
>   `1` if the import is convenient; the literal is the documented Cartesian value
>   and avoids an extra import. Prefer the named import during implementation and
>   keep whichever typechecks cleanly.
> - Do not store `Deck` at module scope. Keep `flipY` consistent with the
>   pipeline's emitted coordinates (Slice 5 already negated Z into `map_y`); do not
>   re-negate here.
> - If `device.type` is needed by the browser smoke, expose it via a `data-`
>   attribute on the container after init (e.g. `container.dataset.deckDevice`).

- [ ] **Step 2: Defer check/commit to Task 8.**

### Task 8: Sidebar, search, details panel, and nav link

**Files:**

- Create: `site/src/lib/components/map/MapSidebar.svelte`
- Create: `site/src/lib/components/map/MapSearch.svelte`
- Create: `site/src/lib/components/map/DetailsPanel.svelte`
- Modify: `site/src/routes/+layout.server.ts`
- Modify: `site/src/routes/+layout.svelte`

- [ ] **Step 1: Sidebar (legend + toggles + filters)**

```svelte
<!-- site/src/lib/components/map/MapSidebar.svelte -->
<script lang="ts">
  import type { MapStore } from "$lib/map/map-store.svelte";
  let { store }: { store: MapStore } = $props();
  const rgb = (c: number[]) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
</script>

<div class="space-y-4 rounded-lg border p-4">
  <div>
    <h2 class="mb-2 font-semibold">Layers</h2>
    <ul class="space-y-1">
      {#each store.view.layers as layer (layer.layerId)}
        <li>
          <label class="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!store.ui.hiddenLayers.includes(layer.layerId)}
              onchange={() => store.toggleLayer(layer.layerId)}
            />
            <span
              class="inline-block h-3 w-3 rounded-full"
              style:background-color={rgb(layer.fillColor)}
            ></span>
            {layer.legendLabel}
          </label>
        </li>
      {/each}
    </ul>
  </div>
  <div>
    <h2 class="mb-2 font-semibold">Filters</h2>
    <label class="flex items-center gap-2">
      <input type="checkbox" bind:checked={store.ui.showDebug} /> Show debug-only
    </label>
    <label class="flex items-center gap-2">
      <input type="checkbox" bind:checked={store.ui.fastTravelOnly} /> Fast-travel only
    </label>
  </div>
  {#if store.view.maps.length > 1}
    <div>
      <h2 class="mb-2 font-semibold">Map</h2>
      <select bind:value={store.ui.mapId}>
        {#each store.view.maps as m (m.mapId)}
          <option value={m.mapId}>{m.label}</option>
        {/each}
      </select>
    </div>
  {/if}
</div>
```

- [ ] **Step 2: Search (name → select/center)**

```svelte
<!-- site/src/lib/components/map/MapSearch.svelte -->
<script lang="ts">
  import type { MapStore } from "$lib/map/map-store.svelte";
  let { store }: { store: MapStore } = $props();
  let query = $state("");
  const results = $derived(
    query.trim().length === 0
      ? []
      : store.view.points
          .filter(
            (p) =>
              p.mapId === store.activeMapId && p.name.toLowerCase().includes(query.toLowerCase()),
          )
          .slice(0, 12),
  );
</script>

<div class="rounded-lg border p-4">
  <label class="block">
    <span class="sr-only">Search locations</span>
    <input
      class="w-full rounded border px-2 py-1"
      placeholder="Search locations…"
      bind:value={query}
    />
  </label>
  {#if results.length > 0}
    <ul class="mt-2 space-y-1">
      {#each results as r (r.id)}
        <li>
          <button
            class="hover:text-foreground w-full text-left"
            onclick={() => store.select(r.nodeShortId)}
          >
            {r.name}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
```

- [ ] **Step 3: Details panel (+ relationship section)**

`DetailsPanel` shows the selected location's facts. For relationship rendering it
reuses the existing `RelationshipSection` component; relationship data for a
location is empty until future slices add edges, but wire the surface now so it
is populated automatically. v1 passes no edges (none exist), so render only the
fact list and the "Copy link" affordance; do not query relationships in route
code beyond what `getMapView`/a future loader provides.

```svelte
<!-- site/src/lib/components/map/DetailsPanel.svelte -->
<script lang="ts">
  import type { MapStore } from "$lib/map/map-store.svelte";
  let { store }: { store: MapStore } = $props();
  const point = $derived(store.selectedPoint);
</script>

{#if point}
  <aside class="mt-4 rounded-lg border p-4">
    <div class="flex items-center justify-between">
      <h2 class="font-semibold">{point.name}</h2>
      <button aria-label="Close" onclick={() => store.select(null)}>×</button>
    </div>
    <dl class="text-muted-foreground mt-2 grid grid-cols-2 gap-1 text-sm">
      <dt>Map</dt>
      <dd>{point.mapId ?? "—"}</dd>
      <dt>Position</dt>
      <dd>{point.position[0]}, {point.position[1]}</dd>
      <dt>Elevation</dt>
      <dd>{point.position[2]}</dd>
      <dt>Fast travel</dt>
      <dd>{point.fastTravel ? "Yes" : "No"}</dd>
    </dl>
  </aside>
{/if}
```

- [ ] **Step 4: Nav link**

Edit `site/src/routes/+layout.server.ts` — add to the returned object:

```ts
  mapRoute: "/map",
```

Edit `site/src/routes/+layout.svelte` — add inside `<nav>` after the Items link:

```svelte
<a href={data.mapRoute} class="hover:text-foreground">Map</a>
```

- [ ] **Step 5: Type-check the route + components**

Run: `bun run --cwd site check`
Expected: 0 errors, 0 warnings. Fix any type issues (deck.gl prop typings, `$app/state` usage).

- [ ] **Step 6: Commit Tasks 6-8 together**

```bash
git add site/src/lib/map/map-store.svelte.ts site/src/routes/map site/src/lib/components/map site/src/routes/+layout.server.ts site/src/routes/+layout.svelte
bun skill://commit/commit-helper.ts
# COMMIT_SUBJECT="feat(site): add interactive deck.gl map route"
# COMMIT_BODY explains: CSR-exception /map route, lazy GPU deck.gl host with
#   finalize-on-destroy, data-driven layers, legend/filters/search/details, and
#   URL-addressable state; data is loaded at build time and embedded for hydration.
```

---

## Phase 4 — Verification, docs, closeout

### Task 9: Prerender smoke for `/map`

**Files:**

- Create: `site/scripts/smoke-map-route.mjs`
- Modify: `site/package.json` (add `"smoke:map"`)

- [ ] **Step 1: Write the smoke script**

Mirror `site/scripts/smoke-prerender-output.mjs`. Assert against the built output under `site/.svelte-kit/cloudflare`:

- `map.html` exists.
- The HTML contains the "Map" nav text and the "Loading map…" shell text.
- The HTML embeds the `MapView` data (e.g. contains a fixture location name such as `Harbor Town`).
- The HTML does NOT contain a deck.gl bundle marker inline (deck.gl is a lazily-imported client chunk, not inlined in the prerendered HTML).

```js
// site/scripts/smoke-map-route.mjs
import { readFileSync } from "node:fs";
import { join } from "node:path";

const out = join(process.cwd(), ".svelte-kit", "cloudflare", "map.html");
const html = readFileSync(out, "utf8");
const must = ["Harbor Town", "Loading map", ">Map<"];
for (const needle of must) {
  if (!html.includes(needle)) throw new Error(`map.html missing: ${needle}`);
}
if (/@deck\.gl\/core/.test(html)) throw new Error("deck.gl appears inlined in prerendered HTML");
console.log("map route smoke ok");
```

Add to `site/package.json` scripts: `"smoke:map": "bun run scripts/smoke-map-route.mjs"`.

- [ ] **Step 2: Build + run**

Run:

```bash
bun run artifact:fixture synthetic fixtures/synthetic/snapshot
bun run --cwd site build:fixture
bun run --cwd site smoke:map
```

Expected: `map route smoke ok`. If `map.html` is absent, confirm `+page.ts` has `prerender = true` and the route built; if the fixture has no `Harbor Town`, use whatever location name exists in `fixtures/synthetic/snapshot/locations.json`.

- [ ] **Step 3: Commit**

```bash
git add site/scripts/smoke-map-route.mjs site/package.json
bun skill://commit/commit-helper.ts
# COMMIT_SUBJECT="test(site): add map route prerender smoke"
```

### Task 10: Browser E2E for `/map`

**Files:**

- Create: `site/scripts/smoke-map-browser.mjs`
- Modify: `site/package.json` (add `"smoke:map:browser"`)

This is the real verification that deck.gl mounts on a GPU device and renders.
Use the project's browser tooling to load the built fixture site (via
`vite preview` or a static file server over `.svelte-kit/cloudflare`) and assert:

- the Deck initialises on a WebGL/WebGPU device (read the `data-deck-device`
  attribute exposed by `MapCanvas`, or evaluate `deck.device.type` if exposed);
- at least one marker is pickable (simulate a click at a known marker pixel or
  call the layer's picking and assert an object is returned);
- clicking a marker sets `?sel=` in the URL and opens the details panel
  (assert panel text contains the location name);
- toggling the debug filter changes the rendered point count;
- typing in search and selecting a result updates `?sel=` and centers.

- [ ] **Step 1: Implement the browser smoke**

Implement against the harness browser tool / Puppeteer. Start `bun run --cwd site preview` (after `build:fixture`), open `/map`, wait for the canvas, and run the assertions above. Fail with a non-zero exit on any failed assertion. Print `map browser smoke ok` on success.

> The executing agent should use the `browser` tool to script this interactively
> first (open the previewed URL, `tab.observe()`, click markers, read the URL and
> panel), then encode the passing flow into `smoke-map-browser.mjs` so it is
> repeatable. The browser E2E is required evidence per the spec; do not mark the
> slice done on prerender smoke alone.

Add to `site/package.json` scripts: `"smoke:map:browser": "bun run scripts/smoke-map-browser.mjs"`.

- [ ] **Step 2: Run**

Run:

```bash
bun run --cwd site build:fixture
bun run --cwd site preview &   # or the script starts/stops preview itself
bun run --cwd site smoke:map:browser
```

Expected: `map browser smoke ok`; the Deck device type is a real GPU device (not `null`/software).

- [ ] **Step 3: Commit**

```bash
git add site/scripts/smoke-map-browser.mjs site/package.json
bun skill://commit/commit-helper.ts
# COMMIT_SUBJECT="test(site): add map browser e2e smoke"
```

### Task 11: Roadmap and open-question updates

**Files:**

- Modify: `docs/superpowers/roadmap.md`

- [ ] **Step 1: Update Slice 6**

Set Slice 6 status to `done` with delivered bullets: interactive deck.gl
`OrthographicView` location map at `/map`; data-driven layer factory off
`map_layers`; URL-addressable view/selection/filters; public location relationship
nodes whose `route_path` is the map deep link; SVG-embed/tile/transitive-edge/live
seams reserved per the spec. Record local verification evidence (gates, smokes).
Do not add changelog prose or time estimates.

- [ ] **Step 2: Update open questions**

- #6 Tile capture: note vector-first shipped; capture/stitch strategy remains open
  for the tile slice.
- #9 Map-supporting entity ordering: record the proposed order — vendors,
  monsters, NPCs/quests, portals/connections, resource nodes, POIs (ordered by
  map-marker volume and detail-page value) — as the non-provisional next-horizon
  ordering, or adjust per audit findings during execution.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/roadmap.md
bun skill://commit/commit-helper.ts
# COMMIT_SUBJECT="docs: close Slice 6 map system"
```

### Task 12: Full verification gate

- [ ] **Step 1: Run the full gate**

Run:

```bash
bun run codegen:validators \
 && bun run check:fixtures \
 && dotnet test mod-tests/ArdenfallCompendium.Tests.csproj --nologo -v q \
 && bun test pipeline/test tooling.test.ts controller/test \
 && bun test site/test \
 && bun run typecheck \
 && bun run --cwd site check \
 && bun run artifact:fixture synthetic fixtures/synthetic/snapshot \
 && bun run --cwd site build:fixture \
 && bun run --cwd site smoke:prerender \
 && bun run --cwd site smoke:map \
 && bun run --cwd site smoke:map:browser \
 && bun run format:check \
 && bun run lint \
 && git diff --check
```

Expected: every command exits 0; mod tests, pipeline/tooling/controller tests, and site tests all pass; both map smokes pass.

- [ ] **Step 2: Final review**

Re-read the spec acceptance criteria and confirm each is met. Confirm no public
location `/locations` route exists; confirm deck.gl is absent from non-map route
bundles (spot-check `.svelte-kit/cloudflare/_app/immutable` chunks). Confirm the
working tree is clean.

---

## Self-review notes

- Spec coverage: route + loader + page options (Tasks 5-6, spec §Route/Data flow); layer factory + render-kind registry (Task 3, spec §Layer factory); UX features + lifecycle + a11y (Tasks 6-8, spec §UI/UX); URL state (Task 2, spec §URL state); multi-map (Task 8 sidebar, spec §Multi-map); cross-linking backbone via location nodes (Task 1, spec §Cross-linking); GPU acceleration (Task 7, spec §GPU); verification incl. browser E2E (Tasks 9-10, spec §Verification); roadmap/open-questions (Task 11, spec §Open questions). Transitive edges, SVG embeds, and the live seam are explicitly deferred per spec and have no task here.
- Type consistency: `MapView`/`MapLayerConfig`/`MapPointRow`/`MapVolumeRow` are defined once in `site/src/lib/map/types.ts` and reused by the loader, store, factory, and components. `MapUiState` is defined once in `url-state.ts` and consumed by the store. `buildEntityLayerSpecs` and `LayerSpec` names match between Task 3 and Task 7.
- No placeholders: every code step contains the actual code; UI markup is complete and presentational, with load-bearing lifecycle/GPU/loader logic given in full.
