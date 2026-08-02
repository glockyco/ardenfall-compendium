---
title: "Ardenfall Compendium — Data Architecture (Entities, Placement, Extraction)"
type: spec
status: active
created: 2026-06-04
parent: 2026-04-29-ardenfall-compendium-roadmap
superseded_by:
archived:
---

# Ardenfall Compendium — Data Architecture (Entities, Placement, Extraction)

Date: 2026-06-04
Status: Approved for implementation planning

Extends: `docs/plans/archive/2026-04-29-ardenfall-compendium-implementation-decisions.md`.
Supersedes: the location-specific placement encoding shipped in Slice 5/6 (map columns on `locations`, `location_map_points`, `location_map_volumes`) where it conflicts with the general placement model defined here.

## Purpose

The compendium data model distinguishes asset-backed definitions from record-backed instances and generalized placements. Descriptors remain the single cross-subsystem source of truth; the pipeline emits canonical typed SQLite and generated read models from the live runtime snapshot. This document defines the durable model for entity, placement, relationship, and extraction work, including the scene-extraction slice that is reserved but not yet built.

The decision is deliberate and bounded: **keep the sound foundations; clean-cut the entity/placement/identity/extraction model.** A from-scratch rewrite was considered and rejected — the foundations are modern and correct, and replacing them would trade verified infrastructure for risk with no gain.

## Decision maturity levels

Reuses the vocabulary of the 2026-04-29 addendum: Locked invariant, Accepted, Provisional, Deferred, Superseded.

## 1. What is kept vs replaced

### Kept (Locked invariants — verified sound)

- Descriptor JSON (`entities/<id>/entity.json`) as the single cross-subsystem source of truth; filesystem-as-registry. (Decisions 1, 2.)
- Subsystem-owned executable code discovered by convention via typed registries merged per process; no side-effect globals. (Decision 3.)
- Strict one-way flow: descriptors → pipeline → canonical typed SQLite + generated/validated read models → site reads only emitted read models/metadata. (Decisions 4, 6, 16.)
- Canonical **typed** SQLite preserving domain shape (root + inheritance-layer + child tables; type-tagged JSON only without query pressure). No EAV. (Decisions 7, 10.)
- Identity domains as first-class types (`lookupAsset`, `namedAsset`, `record`, `runtimeObject`, `missing`) with fatal/diagnostic/optional-empty policy. (Decision 13.)
- `BuiltLookupTable` is not a universal root; record-backed extraction is separate; fail-fast preflight; atomic snapshots. (Decision 14.)
- Generated relationship graph (`entity_nodes`/`entity_edges`/sections) with the fail-fast `relationshipMissingTarget` audit; site renders edges generically. (Slice 4.)
- Descriptor-owned map-layer contract → data-driven deck.gl layers. (Decision 17 / Slice 6.)
- Fixture hygiene, digests, generated artifacts out of git, real-boundary validation. (Decision 19.)

### Replaced / added (the clean cut)

- **Entity-kind taxonomy** (definition / instance) made first-class in the descriptor, replacing the implicit "every entity is an asset-backed definition." (§3)
- **Identity generalized** to concrete extraction domains, with an optional instance→definition reference when an instance has a separate definition asset. (§4)
- **General placement model** (`placements` + generalized `map_points`/`map_volumes`) replacing the location-specific columns and read models. (§5)
- **Single runtime extraction source with lookup-asset, named-asset, and record mechanisms** behind one uniform snapshot contract. Scene extraction is reserved for a future slice and is not yet built. (§6)
- **Relationship graph generalized** for the shipped `variant_of` and `leads_to` edges, with future spatial edges. (§7)

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

Every descriptor declares a `kind`. Two kinds cover the current model.

### 3.1 Definition (`kind: "definition"`)

Flyweight/intrinsic data, sourced from `BuiltLookupTable` or named-asset discovery. The "what it is." Most definitions get public pages.

Examples: `item`, `spell`, `status-effect`, `faction`, `character` (`CharacterData`), `location` (a definition that _also_ carries intrinsic placement), `stat-type`, `item-category`.

Identity: row id uses the identity mechanism for the source. `BuiltLookupTable` definitions use their GUID, while named-asset definitions use `named;<entityId>;<assetName>`.

### 3.2 Instance (`kind: "instance"`)

Instances are extrinsic placement records sourced from `MasterRecordTable` records or, in a future unbuilt scene-extraction slice, scene components. An instance may reference a separate definition asset; record-backed portals are instances without a separate definition asset. The "where/which." Instances usually have **no standalone page** — they surface on the map and on their definition's page.

Examples: `npc` (`NPCRecord` → `character`), `portal` (`PortalRecord`), scene placements (`plant`, `container`, `creature-spawner`).

Identity: row id from the `record` domain (record id) or, in the future scene mechanism, the `scene` domain (`GuidComponent` GUID). A definition reference applies only when the instance has a separate definition asset; such a reference carries the definition's GUID for the N:1 link. Portals are record-backed instances with no definition reference. All instances carry placement.

### 3.3 Descriptor additions (concrete)

```jsonc
{
  "id": "npc",
  "kind": "instance",
  "label": { "singular": "NPC", "plural": "NPCs" },
  "extraction": {
    "source": "record", // "lookupAsset" | "namedAsset" | "record" | "scene"
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
  "id": "location",
  "kind": "definition",
  "label": { "singular": "Location", "plural": "Locations" },
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

A role vocabulary will be designed against a real case if and when one arrives.

`kind`, `extraction.source`, and (for instances with a separate definition asset) `definition` are **Locked invariants** of the model. `placement` is **Accepted; extensible** as real entities land.

## 4. Identity model

**Locked invariant.** Identity domains are never collapsed.

- **Definition assets:** `lookupAsset` GUID for assets registered in `BuiltLookupTable`; `namedAsset` for definition assets that `BuiltLookupTable` does not register, identified by asset name. The named-asset row id is `named;<entityId>;<assetName>`, used by `stat-type` and `item-category`.
- **Record instances:** `record` domain `(table, subtable, id)`; the canonical row id is the record's stable `id` (namespaced by entity where needed). An instance with a separate definition asset carries `definition_ref` equal to that definition's GUID, and many such instances may reference one definition. Portals are record-backed instances without a separate definition asset and therefore have no `definition_ref`.
- **Runtime and missing references:** `runtimeObject` references are explicitly unstable (`stable: false`) and `missing` references carry the reason and source when no supported identity can be emitted.
- **Scene instances:** `scene` identity is reserved for a future scene-extraction slice and is not yet built. The planned domain is the serialized `GuidComponent` GUID (a stable, design-time `byte[16]`), alongside `lookupAsset` and `record`. (`runtimeObject { stable:false }` remains for genuinely ephemeral refs only.)

Relationship-graph nodes and `route_path`:

- Definition entities with a `site.route` → node `route_path` = their page.
- Instance entities with no standalone page → node `route_path` is a **map deep link** (`/map?map=<mapId>&sel=<shortId>`, the Slice 6 pattern) or a deep link to their definition's page with an anchor, per descriptor. A definition link is emitted only for instances that have a separate definition asset.

Missing/criticality policy (fatal/diagnostic/optional-empty) is unchanged (Decision 13). When an instance has a definition reference, failure to resolve it is `fatal`; portals do not require a definition reference.

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
  source_ref_json text not null, -- provenance: lookupAsset | namedAsset | record | scene
  primary key (entity_id, instance_id)
);
```

- The mod emits raw Unity `(x, y, z)` (or volume center/size, or `transform.position`) per the source; the pipeline applies the single canonical transform `(map_x, map_y, elevation) = (x, -z, y)`. The site never re-transforms. (Consistent with Slice 5.)
- **Generalized map read models** replace the location-specific ones: `map_points` and `map_volumes` are keyed by `entity_id` + `instance_id`, generated from `placements` joined to the per-entity canonical/read-model rows (name, tooltip, flags). `map_layers` (Decision 17 / Slice 6) remains separately keyed by `layer_id` and continues to drive the data-driven deck.gl factory; its `source_tables_json` references the generalized tables.
- Placement rows are available to relationship work, but the current graph does not derive `located-at` or bounded transitive edges; see §7.

## 6. Extraction architecture — single runtime source, current mechanisms

**Locked invariant.** The live runtime (BepInEx mod) is the only structured-data source. Offline asset extraction (AssetRipper et al.) is not used for data; only the runtime can resolve Odin/`Parameter<T>` semantics (§2).

The current extraction mechanisms yield pure DTOs into one snapshot (one manifest, one preflight, one diagnostics model — Decisions 14, 15):

1. **`lookupAsset`** — `BuiltLookupTable.GetAssetsOfType<T>()`. Definitions such as items and locations.
2. **`namedAsset`** — definition assets that `BuiltLookupTable` does not register, identified by asset name. The canonical id is `named;<entityId>;<assetName>`; `stat-type` and `item-category` use this mechanism.
3. **`record`** — `worldData.masterRecordTable` traversal (`maps → cells → CellRecordTableAsset` subtables; `GetRecords<T>()`). Record-backed instances such as portals. Reading record ScriptableObjects is side-effect-free; the game itself enumerates all `PortalRecord`s at `MapLocationManager.Init`.

### Scene mechanism (not yet built; future slice)

Scene extraction is reserved for a future scene-extraction slice and is not present in the current mod. In particular, no `LoadSceneAsync`, `GuidComponent`, or `StaticSaveComponent` extraction path exists yet. That slice must define and live-validate the controlled cell-scene loading, side-effect bypass, per-cell iteration, and deterministic identity contract before scene entities can ship.

The intended design is:

- Enumerate all cells via `worldData.maps[i].cells` and load each cell additively with streaming disabled.
- Read serialized static scene components in the scene-loaded window, capture their stable GUIDs and transforms, dispatch supported component types, and unload scenes directly without save-state writes.
- Keep scene extraction behind the same snapshot contract as `lookupAsset`, `namedAsset`, and `record`; it must not become a second structured-data toolchain.

The mod-side seam mirrors the location adapter pattern already in place (a pure DTO core + a thin Unity adapter boundary), so unit tests never touch Unity singletons.

## 7. Relationship graph generalization

The shipped relationship graph contains `variant_of` rows and portal `leads_to` rows. Portal connectivity is projected from canonical `connected_portal_ref_json` into graph edges. The relation is directed deliberately because the world contains one-way doors and chains; a reciprocal connection is stored as two edges. Placement rows do not currently generate `located-at`, instance↔definition, or bounded transitive spatial edges.

The entity-graph audit runs once, after all read-model emitters, so it covers the complete emitted graph.

A future relationship slice may add:

- instance↔definition edges for instances with a separate definition asset;
- placement edges derived from `placements`; and
- bounded transitive spatial edges such as `item --obtainable-at--> location`, with intermediary evidence and bounded depth.

Any such slice must retain the fail-fast `relationshipMissingTarget` audit and prevent link explosion through explicit hop bounds and aggregation.

## 8. Canonical SQLite & read models (generalization)

- Definitions keep typed root + inheritance-layer + child tables (Decisions 7, 10). Unchanged.
- Instances get typed root tables per instance entity (e.g. `npcs`, `portals`) holding extrinsic fields; `definition_ref` is present only for instances with a separate definition asset. Portal placement lives in `placements`, and portal connectivity is emitted as `leads_to` graph edges from `connected_portal_ref_json`.
- No EAV; type-tagged JSON only for kind-owned, non-queried payloads (existing rule).
- All read models remain generated, validated, digested (Decision 16). The site consumes only read models/metadata via `site/src/lib/store/` (or the established server read-model facade); it never joins canonical tables.

## 9. Scene-only data — unbuilt future slice

Scene-placed, player-interactable content (resource nodes, containers, crafting stations, wildlife spawners) is not currently extracted. It remains reserved for a future scene-extraction slice using the unbuilt mechanism in §6. That slice must establish controlled loading, side-effect bypass, per-cell iteration, stable scene identity, and live real-boundary validation before these entities are added to the snapshot.

## 10. Media / binary assets

Icons, map imagery/tiles, meshes are binary native Unity assets, orthogonal to the structured-data pipeline. Extract via runtime texture/asset export or a lightweight offline asset extractor if/when needed. **Not** AssetRipper (heavyweight), and never a second structured-data source.

## 11. Pitfalls explicitly avoided

- No EAV; typed tables remain authoritative.
- No polymorphic JSON sprawl — type-tagged JSON only without query pressure.
- No identity collapse — asset, named-asset, and record domains stay distinct; the scene domain is reserved for the unbuilt future scene-extraction slice; instances never folded into definitions.
- No coordinate re-transform outside pipeline canonicalisation.
- No offline structured extraction (Odin makes it unreadable).
- No "everything is a graph node" over-generalization — typed canonical tables + a focused `placements` table + the relationship graph, each with a clear job.

## 12. Location placement and map read models

Location uses the general placement model: its canonical placement is stored in `placements`, and generalized `map_points`/`map_volumes` are emitted from placements. The old `location_map_points` and `location_map_volumes` tables are not part of the shipped database. The `/map` route consumes the generalized read models; no public fallback is retained.

## 13. Sequencing

The entity-kind and generalized placement foundation, including record-backed portal extraction, is shipped in Slice 7. Portal extraction, placement, map markers, and projection of `connected_portal_ref_json` into directed `leads_to` relationship edges are current behavior.

1. **Characters** (definition) + **NPCs** (`record` instance) — future entity slices.
2. **Scene placements** (`scene` mechanism; §9) — resource nodes, containers, stations, creature spawners, after the future scene-extraction slice is built and validated.
3. Further definitions (spells, status effects, factions, quests) as their slices come.

## 14. Open questions / uncertainties

- Scene mechanism remains unbuilt and awaits live validation in the future scene-extraction slice (§9).
- Whether some instance entities (e.g. portals) warrant a thin standalone page vs map-only — decide per entity by detail-page value.
- Whether a future placement extension needs a child volume table when one definition has multiple intrinsic placements.

## 15. Acceptance criteria (architecture realized)

- A descriptor can declare `kind: definition | instance` with `extraction.source: lookupAsset | namedAsset | record | scene`; the pipeline canonicalises/validates the shipped kinds, while scene remains reserved for the unbuilt future slice.
- An instance with a separate definition asset resolves that definition (N:1) and contributes to `placements`; instances without such an asset, including portals, do not require `definition_ref`.
- `map_layers` + generalized `map_points`/`map_volumes` render positioned entities on `/map` with no per-entity renderer code; the coordinate transform exists only in pipeline canonicalisation.
- The mod currently extracts through `lookupAsset`, `namedAsset`, and `record` into one snapshot; scene extraction is not built and awaits the future slice in §9.
- Location uses the general placement model with the old location-specific tables removed; the `/map` route consumes the generalized substrate.
- No raw Unity/Odin JSON; no offline structured extraction; generated artifacts out of git; fixtures + digests prove behavior.
