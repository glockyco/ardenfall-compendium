---
title: "Entity Placement Foundation Implementation Plan"
type: plan
status: active
created: 2026-06-05
parent:
superseded_by:
archived:
---

# Entity Placement Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generalize Ardenfall Compendium's entity/placement/map substrate and prove it with locations plus the first record-backed instance entity, portals.

**Architecture:** Keep descriptors as the cross-subsystem source of truth, but make `kind`, `extraction.source`, and placement explicit. The mod still emits explicit DTO snapshots from the live runtime; the pipeline owns canonical coordinate conversion and materializes generalized `placements`, `map_points`, and `map_volumes`; the site consumes only generated SQLite read models.

**Tech Stack:** C# BepInEx/HotRepl mod DTO extraction; TypeScript/Bun pipeline and SvelteKit site; SQLite canonical/read-model tables; descriptor JSON schema validators.

---

### Task 1: Descriptor kind/source/placement contract

**Files:**

- Modify: `schemas/entity.schema.json`
- Modify: `entities/location/entity.json`
- Create: `entities/portal/entity.json`
- Modify: `pipeline/src/types.ts`
- Modify tests: `pipeline/test/load-descriptors.test.ts`, `tooling.test.ts` if schema/codegen expectations require it

- [ ] Add descriptor schema fields: `kind: "definition" | "instance" | "role"`; `extraction.source: "lookupAsset" | "record" | "scene"`; `placement.kind` and `placement.from`; instance-only `definition.entity`/`definition.via`; role-only `facetOf`/`predicate`/`placementVia`.
- [ ] Mark existing lookup-asset entities as definitions in their descriptors.
- [ ] Add `entities/portal/entity.json` as `kind: "instance"`, `extraction.source: "record"`, `root: "Ardenfall.RecordSystem.PortalRecord"`, `options.subtable: "portals"`, and `placement: { "kind": "point", "from": "transform" }`.
- [ ] Update generated/handwritten TypeScript types so descriptor loading and map metadata code can inspect the new fields.
- [ ] Tests: descriptor loader accepts the new fields; portal is in descriptor coverage; invalid/missing `kind` or `extraction.source` fails through existing schema validation.

### Task 2: Mod portal snapshot and record extraction

**Files:**

- Create: `mod/src/Entities/Portal/PortalSnapshot.cs`
- Create: `mod/src/Entities/Portal/IPortalRecordSource.cs`
- Create: `mod/src/Entities/Portal/PortalExtractor.cs`
- Create: `mod/src/Extraction/PortalExtractionService.cs`
- Modify: `mod/src/Control/CompendiumCommandRegistry.cs`
- Modify: `mod/src/Control/Handlers/CompendiumInfoCommand.cs`
- Modify: `mod/src/Control/Handlers/RunFinalizeCommand.cs`
- Tests: create `mod-tests/PortalExtractorTests.cs`; extend `mod-tests/RunFinalizeCommandTests.cs`

- [ ] Add explicit portal DTOs: row id from `RecordID.ToString()`, record ref via `SnapshotRef.Record(table, subtable, id)`, `friendlyName`, `isAccessible`, raw transform position `(x,y,z)`, map id, and connected portal record ref when present.
- [ ] Source records from `ArdenfallGame.instance.worldData.masterRecordTable.GetRecords<PortalRecord>()` through an injectable source seam, matching the location extractor pattern.
- [ ] Diagnostics: fatal if record id is null/invalid or transform missing; diagnostic if map id missing; diagnostic if connected portal reference is missing/unresolved.
- [ ] Cache portal rows per run like the location/stat/tag caches.
- [ ] Finalize writes `portals.json`, adds `counts.portal`, artifact `portals`, and portal diagnostics to `diagnostics.json`.
- [ ] Tests: extractor maps transform fields without coordinate conversion; finalize writes/hashes/counts `portals.json`; diagnostics aggregate into the manifest without fatal regressions.

### Task 3: Generalized placements and map read models

**Files:**

- Modify: `pipeline/src/sql/location-ddl.ts` or split new `pipeline/src/sql/placement-ddl.ts`
- Modify: `pipeline/src/entities/location/canonicaliser.ts`
- Create: `pipeline/src/entities/portal/canonicaliser.ts`
- Modify/Create: `pipeline/src/entities/location/read-models.ts` into generalized map read-model emitter
- Modify: `pipeline/src/stages/emit-sqlite.ts`
- Modify: `pipeline/src/stages/emit-read-models.ts`
- Modify: `pipeline/src/entities/registry.ts`
- Tests: `pipeline/test/location-canonicaliser.test.ts`, `pipeline/test/read-models.test.ts`, `pipeline/test/location-nodes.test.ts`, `pipeline/test/end-to-end.test.ts`

- [ ] Add canonical `placements(entity_id, instance_id, map_id, map_x, map_y, elevation, geometry_json, source_ref_json)` and keep coordinate conversion only in pipeline canonicalisation.
- [ ] Remove public dependence on location-specific `map_x/map_y/elevation` in `locations`; location rows insert intrinsic placement rows instead.
- [ ] Add canonical `portals` table with extrinsic record fields and insert portal placement rows from raw transform position.
- [ ] Replace `location_map_points`/`location_map_volumes` with generalized `map_points`/`map_volumes`, preserving the site-facing row shape (`name`, `tooltip`, `map_id`, `map_x`, `map_y`, `elevation`, `debug_only`, `fast_travel`, `node_short_id`) and adding `entity_id`/`instance_id`.
- [ ] Entity nodes for map-only instances use `/map?map=<mapId>&sel=<shortId>` deep links.
- [ ] Tests prove locations still render from generalized tables and portals contribute point rows.

### Task 4: Site map consumer clean cutover

**Files:**

- Modify/rename: `site/src/lib/server/entities/location.ts`
- Modify: `site/src/lib/server/read-models.ts`
- Modify: `site/src/lib/map/types.ts`
- Modify: `site/src/lib/components/map/MapSearch.svelte`, `DetailsPanel.svelte`, route copy as needed
- Tests: `site/test/map-read-models.test.ts`, `site/test/layer-spec.test.ts`

- [ ] Query generalized `map_points`/`map_volumes` from `map_layers.source_tables_json` instead of deriving per-entity table names.
- [ ] Keep the client `MapView` shape compatible except replace `locationId` with `entityId` + `instanceId`; retain `nodeShortId` for URL state.
- [ ] Remove location-specific table-suffix validation and location-centric UI copy where generalized wording is clearer.
- [ ] Tests prove `/map` read model includes location and portal-compatible rows without route-local descriptor parsing.

### Task 5: Fixtures, live export, and gates

**Files:**

- Modify: `fixtures/synthetic/snapshot/manifest.json` and related fixture JSONs
- Modify tests as required by fixture expectations

- [ ] Extend synthetic fixture with a portal row and generalized placement/map outputs.
- [ ] Run red/green unit tests per touched subsystem: `dotnet test mod-tests/ArdenfallCompendium.Tests.csproj --nologo -v q`, `bun test pipeline/test`, `bun test site/test`, `bun test controller/test`.
- [ ] Run integrated gates: `bun run codegen:validators`, `bun run check:fixtures`, `bun run typecheck`, `bun run --cwd site check`, `bun run artifact:fixture synthetic fixtures/synthetic/snapshot`, `bun run --cwd site build:fixture`, `bun run --cwd site smoke:prerender`, `bun run --cwd site smoke:map`, `bun run format:check`, `bun run lint`.
- [ ] Redeploy the mod with `bun run hotrepl:setup`; run `bun run hotrepl:export`; verify live export emits `counts.location`, `counts.portal`, `locations.json`, `portals.json`, generalized `placements`, and pipeline completes.
- [ ] Commit the clean cutover with no generated build artifacts.
