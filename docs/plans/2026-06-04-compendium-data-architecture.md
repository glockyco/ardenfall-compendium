---
title: "Ardenfall Compendium — Data Architecture (Entities, Placement, Extraction)"
type: spec
status: active
created: 2026-06-04
parent:
superseded_by:
archived:
---

# Ardenfall Compendium — Data Architecture (Entities, Placement, Extraction)

Date: 2026-06-04
Status: Approved for implementation planning

Extends: `docs/superpowers/specs/2026-04-29-ardenfall-compendium-implementation-decisions.md`.
Supersedes: the location-specific placement encoding shipped in Slice 5/6 (map columns on `locations`, `location_map_points`, `location_map_volumes`) where it conflicts with the general placement model defined here.

## Purpose

The compendium's realized data model treats every entity as a single asset-backed **definition** with a 1:1 `BuiltLookupTable` GUID, and bolts map placement onto the `locations` table as ad-hoc columns. A source-level investigation of the game shows this is too narrow for the content the compendium must eventually cover. This document defines the clean, durable model for all future entity, placement, relationship, and extraction work.

The decision is deliberate and bounded: **keep the sound foundations; clean-cut the entity/placement/identity/extraction model.** A from-scratch rewrite was considered and rejected — the foundations are modern and correct, and replacing them would trade verified infrastructure for risk with no gain.

## Decision maturity levels

Reuses the vocabulary of the 2026-04-29 addendum: Locked invariant, Accepted, Provisional, Deferred, Superseded.

## 1. What is kept vs replaced

### Kept (Locked invariants — verified sound)

- Descriptor JSON (`entities/<id>/entity.json`) as the single cross-subsystem source of truth; filesystem-as-registry. (Decisions 1, 2.)
- Subsystem-owned executable code discovered by convention via typed registries merged per process; no side-effect globals. (Decision 3.)
- Strict one-way flow: descriptors → pipeline → canonical typed SQLite + generated/validated read models → site reads only emitted read models/metadata. (Decisions 4, 6, 16.)
- Canonical **typed** SQLite preserving domain shape (root + inheritance-layer + child tables; type-tagged JSON only without query pressure). No EAV. (Decisions 7, 10.)
- Dual+ identity domains as first-class types (`lookupAsset`, `record`, `runtimeObject`, `missing`) with fatal/diagnostic/optional-empty policy. (Decision 13.)
- `BuiltLookupTable` is not a universal root; record-backed extraction is separate; fail-fast preflight; atomic snapshots. (Decision 14.)
- Generated relationship graph (`entity_nodes`/`entity_edges`/sections) with the fail-fast `relationshipMissingTarget` audit; site renders edges generically. (Slice 4.)
- Descriptor-owned map-layer contract → data-driven deck.gl layers. (Decision 17 / Slice 6.)
- Fixture hygiene, digests, generated artifacts out of git, real-boundary validation. (Decision 19.)

### Replaced / added (the clean cut)

- **Entity-kind taxonomy** (definition / instance / role) made first-class in the descriptor, replacing the implicit "every entity is an asset-backed definition." (§3)
- **Identity generalized** to three concrete extraction domains including scene `GuidComponent`, and an explicit instance→definition (N:1) reference. (§4)
- **General placement model** (`placements` + generalized `map_points`/`map_volumes`) replacing the location-specific columns and read models. (§5)
- **Single runtime extraction source with three mechanisms** (`lookupAsset`, `record`, `scene`) behind one uniform snapshot contract. (§6)
- **Relationship graph generalized** for N:1 instance↔definition and bounded transitive spatial edges. (§7)

## 2. External grounding

- **Definition vs instance (flyweight) separation** is the canonical, modern model for game content: shared intrinsic "what it is" vs per-placement extrinsic "where/which." Ardenfall is itself built this way (`CharacterData` definition + `NPCRecord` instance), so the compendium mirrors the game. Source: Game Programming Patterns — Flyweight (https://gameprogrammingpatterns.com/flyweight.html).
- **EAV is the anti-pattern to avoid**; keep typed tables with JSON only for kind-owned, non-queried payloads. Source: "EAV design — don't do it" (https://www.cybertec-postgresql.com/en/entity-attribute-value-eav-design-in-postgresql-dont-do-it/).
- **Ardenfall is pervasively Odin/Sirenix serialized** (`SerializedScriptableObject`, `[OdinSerialize] Parameter<T>/SmartListParameter<T>`), and `Parameter<T>.Get()` is runtime-computed (resolves inheritance/override chains). Offline asset extractors cannot read this: Odin stores a proprietary forward-only binary blob (`SerializationData.SerializedBytes`) with external Unity refs shunted into a side list. Sources: Odin Serializer README (https://github.com/TeamSirenix/odin-serializer/blob/master/README.md); AssetRipper docs (https://github.com/AssetRipper/AssetRipper).
- **Therefore the live runtime is the only viable structured-data source.** AssetRipper/offline extractors are not used for data; a lightweight asset extractor may be used for binary media (icons/maps) if/when needed — orthogonal to the data pipeline.

References:

- https://gameprogrammingpatterns.com/flyweight.html
- https://www.cybertec-postgresql.com/en/entity-attribute-value-eav-design-in-postgresql-dont-do-it/
- https://github.com/TeamSirenix/odin-serializer/blob/master/README.md
- https://github.com/AssetRipper/AssetRipper

## 3. Entity-kind taxonomy

Every descriptor declares a `kind`. Three kinds cover the model; a fourth (pure relationship) is reserved.

### 3.1 Definition (`kind: "definition"`)

Flyweight/intrinsic data, sourced from `BuiltLookupTable`, GUID-keyed. The "what it is." Most definitions get public pages.

Examples: `item`, `spell`, `status-effect`, `faction`, `character` (`CharacterData`), `location` (a definition that _also_ carries intrinsic placement), creature-def.

Identity: row id = `BuiltLookupTable.GetGuid(asset)`.

### 3.2 Instance (`kind: "instance"`)

Extrinsic placement data, sourced from `MasterRecordTable` records or `scene` components, each referencing a definition and carrying placement. The "where/which." Instances usually have **no standalone page** — they surface on the map and on their definition's page.

Examples: `npc` (`NPCRecord` → `character`), `portal` (`PortalRecord`), scene placements (`plant`, `container`, `creature-spawner`).

Identity: row id from the `record` domain (record id) or `scene` domain (`GuidComponent` GUID). Carries `definition_ref` (the definition's GUID) for the N:1 link. Carries placement.

### 3.3 Role (`kind: "role"`)

A **facet view** over a definition (and/or its instances) selected by a declared trait predicate. A role is NOT a new extraction or canonical table — it is a generated read model plus relationship edges (and optionally a derived map layer). It never duplicates canonical data.

Example: `vendor` = `character` where the merchant predicate holds (`CharacterData.merchantCategories`/`merchantItemLists` non-empty). The vendor map layer derives from the placements of `npc` instances whose definition matches the predicate.

### 3.4 Descriptor additions (concrete)

```jsonc
{
  "id": "npc",
  "kind": "instance",
  "label": { "singular": "NPC", "plural": "NPCs" },
  "extraction": {
    "source": "record", // "lookupAsset" | "record" | "scene"
    "root": "Ardenfall.RecordSystem.NPCRecord",
    "options": { "subtable": "characters" },
  },
  "definition": { "entity": "character", "via": "characterData" },
  "placement": { "kind": "point", "from": "transform" },
  "fields": [
    /* ... extrinsic fields only ... */
  ],
  "map": {
    /* siteMap layer styling, as today */
  },
}
```

```jsonc
{
  "id": "vendor",
  "kind": "role",
  "label": { "singular": "Vendor", "plural": "Vendors" },
  "facetOf": "character",
  "predicate": "character.isMerchant", // registered predicate op
  "placementVia": "npc", // instances that carry positions
  "site": { "route": "/vendors" /* ... */ },
  "map": {
    /* derived layer styling */
  },
}
```

```jsonc
{
  "id": "location",
  "kind": "definition",
  "extraction": { "source": "lookupAsset", "root": "Ardenfall.LocationAsset" },
  "placement": { "kind": "point+volume", "from": "fields" }, // intrinsic placement
  "fields": [
    /* ... */
  ],
  "map": {
    /* layer styling, as today */
  },
}
```

`kind`, `extraction.source`, and (for instances) `definition` are **Locked invariants** of the model. `placement`, `facetOf`/`predicate`/`placementVia` are **Accepted; extensible** as real entities land.

## 4. Identity model

**Locked invariant.** Identity domains are never collapsed.

- **Definitions:** `lookupAsset` GUID (existing). Stable across game versions; primary row id.
- **Record instances:** `record` domain `(table, subtable, id)`; the canonical row id is the record's stable `id` (namespaced by entity where needed). Carries `definition_ref` = the referenced definition's GUID. Many instances → one definition (N:1); never deduplicated into the definition.
- **Scene instances:** `scene` domain = the serialized `GuidComponent` GUID (a stable, design-time `byte[16]`). A first-class identity domain alongside `lookupAsset`/`record`. (`runtimeObject { stable:false }` remains for genuinely ephemeral refs only.)

Relationship-graph nodes and `route_path`:

- Definition entities with a `site.route` → node `route_path` = their page.
- Instance entities with no standalone page → node `route_path` is a **map deep link** (`/map?map=<mapId>&sel=<shortId>`, the Slice 6 pattern) or a deep link to their definition's page with an anchor, per descriptor. The N:1 link is expressed as edges: definition `placed-as` instance; instance `located-at` placement.

Missing/criticality policy (fatal/diagnostic/optional-empty) is unchanged (Decision 13). A definition reference that fails to resolve for an instance is `fatal` (an instance without its definition is meaningless).

## 5. General placement model

**Locked invariant for all positioned entities.** Replaces the location-specific encoding.

Any positioned entity — definition with intrinsic placement (location) or instance (npc, portal, scene objects) — contributes rows to one canonical placement table. The Unity→compendium coordinate transform happens **once**, here, in canonicalisation:

```sql
create table placements (
  entity_id   text not null,     -- 'location' | 'npc' | 'portal' | 'plant' | ...
  instance_id text not null,     -- definition GUID (intrinsic-placement defs) or instance id
  map_id      text,              -- game map id (nullable)
  map_x       real not null,     -- = source.x
  map_y       real not null,     -- = -source.z
  elevation   real not null,     -- = source.y
  geometry_json text,            -- optional volume/polygon ring (axis-aligned box, etc.)
  source_ref_json text not null, -- provenance: lookupAsset | record | scene
  primary key (entity_id, instance_id)
);
```

- The mod emits raw Unity `(x, y, z)` (or volume center/size, or `transform.position`) per the source; the pipeline applies the single canonical transform `(map_x, map_y, elevation) = (x, -z, y)`. The site never re-transforms. (Consistent with Slice 5.)
- **Generalized map read models** replace the location-specific ones (clean cut): `map_points` and `map_volumes`, keyed by `entity_id` + `layer_id`, generated from `placements` joined to the per-entity canonical/read-model rows (name, tooltip, flags). `map_layers` (Decision 17 / Slice 6) is unchanged and continues to drive the data-driven deck.gl factory; its `source_tables_json` now references the generalized tables.
- The relationship graph derives `located-at` edges from `placements` (instance → containing-volume location / map), and **bounded transitive** edges (see §7).

## 6. Extraction architecture — single runtime source, three mechanisms

**Locked invariant.** The live runtime (BepInEx mod) is the only structured-data source. Offline asset extraction (AssetRipper et al.) is not used for data; only the runtime can resolve Odin/`Parameter<T>` semantics (§2).

A uniform extraction-source contract yields pure DTOs with a `SnapshotRef` identity, fed into one snapshot (one manifest, one preflight, one diagnostics model — Decisions 14, 15). Three mechanisms:

1. **`lookupAsset`** — `BuiltLookupTable.GetAssetsOfType<T>()`. Definitions. (Existing; item/location.)
2. **`record`** — `worldData.masterRecordTable` traversal (`maps → cells → CellRecordTableAsset` subtables; `GetRecords<T>()`). Instances (npc, portal, volume). Reading record ScriptableObjects is cheap and side-effect-free; the game itself enumerates all `PortalRecord`s at `MapLocationManager.Init`. New, but anticipated by Decision 14.
3. **`scene`** — controlled cell-scene loading to read static scene components. New; its own slice (§9).

The mod-side seam mirrors the location adapter pattern already in place (a pure DTO core + a thin Unity adapter boundary), so unit tests never touch Unity singletons.

### Scene mechanism (verified feasible)

- Enumerate all cells via `worldData.maps[i].cells` (= `GeneratedAssetReferences.buildCellList`, from `Resources`). Cells are plain build-index Unity scenes `cell_{id}` (no Addressables/bundles).
- Set `WorldStreamer.ForceDisableStreaming = true`.
- Load each scene with `SceneManager.LoadSceneAsync(..., Additive)` and **never instantiate `LoadCellTask`** — the spawner/record side effects (`NPCRandomSpawner → masterRecordTable.AddRecord`, `Spawner.Spawn()`, `CellRecordTableAsset.OnCellLoadScene`) are dispatched only from `LoadCellTask.completed → LoadCellStateAsync → StaticSaveComponent.Create()`, which is bypassed.
- Read in the `SceneManager.sceneLoaded` callback (fires before `AsyncOperation.completed`): iterate `SceneSaver.staticSaveComponents`, capture `GuidComponent.GuidString` + `transform.position` + `cell.map.id`, type-dispatch (`PickablePlant`, `StaticContainer`, `CreatureSpawner`, `ItemSpawner`, crafting stations).
- `SceneManager.UnloadSceneAsync` directly (skip `UnloadCellTask`, which would write save-state).
- Determinism: GUIDs are serialized `byte[16]` (no runtime regen); positions are design-time scene data → reproducible.

This keeps a single runtime source for everything; no second toolchain.

## 7. Relationship graph generalization

- **N:1 instance↔definition** edges: definition `placed-as` instance; instance `instance-of` definition.
- **Placement edges** from §5: instance/definition `located-at` map/location.
- **Bounded transitive spatial edges** (the Slice 6 reserved model, generalized): generate `item --obtainable-at--> location` (and similar) by joining real edges through **one hop of a placed entity**: `item --sold-by--> character(merchant) --placed-as--> npc --located-at--> placement`. Carry the intermediary in `entity_edges.evidence_json` (`{ via:[{type,id,predicate}], hops }`) and a human `label`. Bounded depth (one placed-entity hop) and aggregation by target location prevent link explosion. Deeper chains are followed by the user via links, not materialized.
- The fail-fast `relationshipMissingTarget` audit now also guarantees instance→definition and placement targets resolve, or the build fails.

## 8. Canonical SQLite & read models (generalization)

- Definitions keep typed root + inheritance-layer + child tables (Decisions 7, 10). Unchanged.
- Instances get typed root tables per instance entity (e.g. `npcs`, `portals`) holding extrinsic fields + `definition_ref`; placement lives in `placements`, not per-entity columns.
- Roles get **generated read models only** (e.g. `vendor_overview_rows`) filtered from their definition by predicate; no canonical role table.
- No EAV; type-tagged JSON only for kind-owned, non-queried payloads (existing rule).
- All read models remain generated, validated, digested (Decision 16). The site consumes only read models/metadata via `site/src/lib/store/` (or the established server read-model facade); it never joins canonical tables.

## 9. Scene-only data — committed, sequenced as its own slice

Scene-placed, player-interactable content (resource nodes, containers, crafting stations, wildlife spawners) is **in scope and committed**, extracted at runtime via §6's scene mechanism. It is its own slice — not a different toolchain, but the most intricate extraction path (controlled-load loop, side-effect bypass, per-cell iteration). It lands **after** the shared instance/placement/identity model is proven on baked records, and requires live real-boundary validation of: the `sceneLoaded`-before-`completed` window, `ForceDisableStreaming`, the `LoadCellTask` bypass having no hidden side effects, and `LocalNPCSpawner` proximity being neutralized during the pass. Confidence is high (~90%) pending that validation.

## 10. Media / binary assets

Icons, map imagery/tiles, meshes are binary native Unity assets, orthogonal to the structured-data pipeline. Extract via runtime texture/asset export or a lightweight offline asset extractor if/when needed. **Not** AssetRipper (heavyweight), and never a second structured-data source.

## 11. Pitfalls explicitly avoided

- No EAV; typed tables remain authoritative.
- No premature "role" canonical tables — roles are generated read models + edges.
- No polymorphic JSON sprawl — type-tagged JSON only without query pressure.
- No identity collapse — asset/record/scene domains stay distinct; instances never folded into definitions.
- No coordinate re-transform outside pipeline canonicalisation.
- No offline structured extraction (Odin makes it unreadable).
- No "everything is a graph node" over-generalization — typed canonical tables + a focused `placements` table + the relationship graph, each with a clear job.

## 12. Migration / clean cutover (location)

Location shipped (Slice 5/6) with placement on the `locations` table and `location_map_points`/`location_map_volumes` read models. Clean cut:

1. Add `kind`/`extraction.source`/`placement` to `entities/location/entity.json` (definition with intrinsic placement).
2. Move location placement into `placements`; drop `map_x/map_y/elevation` from the `locations` canonical table.
3. Regenerate the generalized `map_points`/`map_volumes` from `placements`; remove `location_map_points`/`location_map_volumes` and repoint `map_layers.source_tables_json`.
4. Re-verify the Slice 6 `/map` route on the new substrate (loader + smokes + browser E2E).

No public fallback is retained (clean cutover invariant).

## 13. Sequencing

1. **Foundation slice:** entity-kind model + `placements` + generalized map read models + identity for records + the `record` extraction mechanism; migrate location (§12). Re-verify the map.
2. **Portals** (`record` instance; simplest record; connection edges).
3. **Characters** (definition) + **NPCs** (`record` instance) + **vendor** (role) — unlocks item↔vendor↔location transitive edges.
4. **Scene placements** (`scene` mechanism; §9) — resource nodes, containers, stations, creature spawners.
5. Further definitions (spells, status effects, factions, quests) as their slices come.

## 14. Open questions / uncertainties

- Exact predicate-op contract for roles (registered op vs declarative field condition) — settle when `vendor` lands.
- Whether some instance entities (e.g. portals) warrant a thin standalone page vs map-only — decide per entity by detail-page value.
- Scene mechanism's residual ~10% risk pending live validation (§9).
- `placements` primary key when one definition has multiple intrinsic placements (e.g. a location with multiple volumes) — volumes likely remain a child table keyed to the placement; confirm when generalizing location volumes.

## 15. Acceptance criteria (architecture realized)

- A descriptor can declare `kind: definition | instance | role` with `extraction.source: lookupAsset | record | scene`, and the pipeline canonicalises/validates each kind.
- An instance entity resolves its definition (N:1) and contributes to `placements`; the relationship audit fails on an unresolved definition/placement target.
- `map_layers` + generalized `map_points`/`map_volumes` render any positioned entity on `/map` with no per-entity renderer code; the coordinate transform exists only in pipeline canonicalisation.
- The mod extracts via three mechanisms into one snapshot (one preflight/manifest/diagnostics); record extraction is side-effect-free; scene extraction is deterministic and bypasses `LoadCellTask`.
- Location is migrated to the general placement model with the old location-specific tables removed; the `/map` route passes its smokes + browser E2E on the new substrate.
- Roles produce generated read models + edges with no canonical role table.
- No raw Unity/Odin JSON; no offline structured extraction; generated artifacts out of git; fixtures + digests prove behavior.
