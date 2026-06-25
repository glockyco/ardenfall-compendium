---
title: "Ardenfall Compendium — Implementation Decisions Addendum"
type: spec
status: active
created: 2026-04-29
parent:
superseded_by:
archived:
---

# Ardenfall Compendium — Implementation Decisions Addendum

Date: 2026-04-29
Status: Accepted for Slice 1 planning
Supersedes: implementation-level details in `2026-04-28-ardenfall-compendium-design.md` where they conflict with this document.

## Purpose

The original design spec established the project shape. Subsequent ILSpy inspection and implementation-level brainstorming refined several details that materially affect Slice 1. This addendum records those decisions before the implementation plan is written.

The high-level architecture remains unchanged:

```text
Ardenfall runtime -> BepInEx extractor -> JSON snapshot -> TS/Bun pipeline -> SQLite + static SvelteKit site
```

## Decision maturity levels

- **Locked invariant:** changing this reopens the architecture.
- **Accepted for Slice 1:** implement this now; revisit only if a listed trigger fires.
- **Provisional beyond Slice 1:** acceptable initial encoding; expected to evolve as real data pressure appears.
- **Deferred:** explicitly out of scope until a named slice or trigger.
- **Superseded:** retained for history; no longer active.

## 1. Repository and workspace shape

**Status:** Locked invariant.

Use a Bun workspace monorepo for TypeScript:

```text
ardenfall-compendium/
  package.json          # Bun workspace root
  entities/             # descriptor-only public entity declarations
  schemas/
  pipeline/             # TS/Bun pipeline workspace
  site/                 # SvelteKit workspace
  mod/                  # C# BepInEx project
```

`pipeline/` and `site/` are workspaces under one root `bun.lock`. `mod/` is a sibling C# project and is not part of the Bun workspace.

## 2. Descriptor ownership boundary

**Status:** Locked invariant.

`entities/<id>/entity.json` is the cross-subsystem public entity declaration. It is pure JSON and contains no executable code.

Executable per-entity code lives in the subsystem that compiles/runs it:

```text
pipeline/src/entities/<id>/...       # pipeline operations/canonicalizers
site/src/lib/entities/<id>/...       # site renderers/section hooks
mod/src/Entities/<Entity>/...        # C# extractors/adapters/DTOs
```

This supersedes the original spec's `entities/<id>/operations.ts` placement.

### Rationale

Full entity capsules would put TS, Svelte, and C# files under `entities/<id>/`, forcing Bun, Vite, and dotnet to compile source outside their normal project roots. That optimizes locality at the cost of brittle tooling. Subsystem-owned executable code keeps toolchains boring while preserving convention-driven discovery.

## 3. TypeScript registries

**Status:** Locked invariant for Slice 1; likely long-term.

TS registries use exported typed maps merged into a fresh registry per process/test. They do not use side-effect global registration.

Pipeline example:

```ts
export const operations = {
  "item.computeSubtypeLabel": computeSubtypeLabel,
} satisfies OperationMap;
```

Site example:

```ts
export const sections = {
  "item.meleeStats": MeleeStatsSection,
} satisfies SectionMap;
```

Bootstrap imports matching modules by convention, reads their exported maps, merges into a new registry, and fails on duplicate or missing names.

## 4. Site metadata boundary

**Status:** Locked invariant.

The site does not interpret raw `entities/*/entity.json` descriptors. The pipeline validates descriptors, resolves defaults, and emits site-facing metadata into SQLite/static artifacts. SvelteKit reads that emitted contract.

Minimum metadata surfaces may include:

```text
site_entities
site_overview_columns
site_filters
site_detail_sections
item_variants
map_layers
```

The exact physical encoding can be hybrid columns + typed JSON, but the invariant is one-way interpretation:

```text
descriptors -> pipeline -> emitted site metadata -> site
```

There is no parallel site descriptor reader.

## 5. Detail section contract

**Status:** Accepted for Slice 1; extensible.

Detail pages use structured section config. Slice 1 defines two section kinds:

```ts
type DetailSection =
  | {
      id: string;
      kind: "fieldList";
      title: string;
      fields: string[];
    }
  | {
      id: string;
      kind: "custom";
      title: string;
      renderer: string;
    };
```

Built-in generic kinds render through site primitives. `custom` is the explicit escape hatch and must name a registered site renderer. Additional kinds are added only when real entities prove the need.

## 6. Site metadata storage

**Status:** Accepted for Slice 1; disciplined hybrid.

The site metadata model is a relational spine with typed JSON leaves. Stable/cross-cutting metadata is relational. JSON is allowed only for kind-owned renderer/config payloads that are not independently queried.

Slice 1 metadata tables:

```sql
create table site_entities (
  entity_id text primary key,
  singular_label text not null,
  plural_label text not null,
  route_path text not null,
  canonical_table text not null
);

create table site_entity_fields (
  entity_id text not null,
  field_id text not null,
  source_table text not null,
  source_column text not null,
  label text not null,
  value_kind text not null,
  formatter text,
  null_policy text not null,
  link_target text,
  primary key (entity_id, field_id)
);

create table site_overview_columns (
  entity_id text not null,
  column_id text not null,
  field_id text not null,
  position integer not null,
  primary key (entity_id, column_id)
);

create table site_detail_sections (
  entity_id text not null,
  section_id text not null,
  kind text not null,
  title text not null,
  position integer not null,
  renderer_key text,
  payload_schema_version integer not null default 1,
  payload_json text,
  primary key (entity_id, section_id)
);

create table site_detail_section_fields (
  entity_id text not null,
  section_id text not null,
  field_id text not null,
  position integer not null,
  primary key (entity_id, section_id, field_id)
);

create table item_variants (
  variant_id text primary key,
  label text not null,
  unity_type text not null,
  canonical_table text not null,
  parent_variant_id text,
  position integer not null,
  is_public_route integer not null default 0
);

create table site_read_models (
  read_model_id text primary key,
  physical_name text not null,
  entity_id text not null,
  purpose text not null
);
```

**Invariant:** site-facing metadata is emitted by the pipeline. The site does not parse source descriptors.

**JSON rules:** `payload_json` is allowed only when selected by a registered `surface + kind + schema_version`; validated by the pipeline; parsed only inside `site/src/lib/store/`; and free of canonical entity data, SQL snippets, arbitrary JS expressions, unregistered renderer names, and ad hoc styling.

**Promotion triggers:** move payload fields to relational metadata when they are queried, sorted, filtered, searched, joined, reused by two or more section/layer kinds, or repeatedly parsed outside one store accessor.

## 7. Canonical SQLite storage

**Status:** Locked invariant, with per-domain encodings.

Canonical storage preserves domain distinctions in typed tables. It is not a generic `entity_records(data_json)` table.

The refined rule is:

> Public entities own typed root tables. Repeated first-class substructures use child tables. Inheritance/variant families use variant/layer tables. Polymorphic or behavior-heavy payloads may use explicit type-tagged JSON subdocuments with schemas and revisit triggers.

This supersedes the original spec's simple “one table per entity with columns from fields” language.

## 8. Item as Slice 1 walking skeleton

**Status:** Locked for Slice 1.

Slice 1 targets `item`, not `spell`.

Items are user-important and exercise central Ardenfall data mechanics:

- `BuiltLookupTable.GetAssetsOfType<ItemData>()`
- stable asset GUIDs
- `Parameter<T>.Get()` resolution
- `SmartListParameter<T>.Get()` resolution
- inheritance/variants
- tags and categories
- icon asset refs
- generic overview/detail UI

Spells remain an early follow-up because they exercise Odin-polymorphic effect graphs and generated tooltips.

## 9. Item public model and variants

**Status:** Locked invariant.

`item` is one public entity. Weapon, armor, potion, note, and spell-item types do not become separate public entities/routes.

Use descriptor-declared private variants under:

```text
entities/item/variants/<variant>.json
```

Variants are private subtype declarations owned by `item`, not routable public entities.

## 10. Item canonical storage

**Status:** Locked invariant for the item domain.

Use one base table plus one canonical table per meaningful C# inheritance layer/leaf. Each table owns only fields introduced at that layer.

Examples:

```text
items                         # ItemData fields
item_tags                     # ItemData.tags child table
item_equipment                # EquipItemData fields
item_hand_items               # HandItemData fields
item_primary_hand_items       # PrimaryHandItemData fields
item_melee_weapons            # MeleeItemData fields
item_bows                     # BowItemData fields
item_armor                    # ArmorItemData fields
item_consumables              # ConsumableItemData fields
item_throwing_items           # ThrowingItemData fields
item_throwing_potions         # ThrowingPotionData fields
item_slate_spells             # SlateSpellItemData fields
item_notes                    # NoteItemData fields
item_potion_recipes           # PotionRecipeItemData fields
item_repair_kits              # RepairKitItemData fields
```

Slice 1 implements this subset:

```text
items                         # ItemData fields
item_tags                     # ItemData.tags child table
item_equipment                # EquipItemData fields
item_hand_items               # HandItemData fields
item_primary_hand_items       # PrimaryHandItemData fields
item_melee_weapons            # MeleeItemData fields
item_armor                    # ArmorItemData fields
```

The following item layer tables are known missing after Slice 1 and remain tracked for Slice 2:

```text
item_bows
item_consumables
item_throwing_items
item_throwing_potions
item_slate_spells
item_notes
item_potion_recipes
item_repair_kits
item_arrows
additional ItemData subclasses found during full enumeration
```

Slice 1 deliberately proves one deep branch (`MeleeItemData`) and one sibling equipment branch (`ArmorItemData`); it does not defer the variant architecture itself.

For `MeleeItemData`, canonical rows include:

```text
items
item_equipment
item_hand_items
item_primary_hand_items
item_melee_weapons
```

For `ArmorItemData`:

```text
items
item_equipment
item_armor
```

### Invariants

- Every item has exactly one `items` row.
- Every variant row has a matching `items` row.
- Variant rows obey ancestry: no `item_melee_weapons` row without `item_primary_hand_items`, `item_hand_items`, and `item_equipment`.
- Inherited fields are represented once, at the layer that introduces them.
- Capability-style tables are not canonical. `item_durability_view`, `item_combat_stats`, or similar are generated read models only.

## 11. Item extraction model

**Status:** Locked invariant.

Item extraction uses explicit typed layer extractors/adapters. Each layer extractor reads only fields declared by its corresponding game class.

Example mapping:

```text
ExtractItem(ItemData)                 -> ItemSnapshot
ExtractEquipment(EquipItemData)       -> ItemEquipmentSnapshot
ExtractHandItem(HandItemData)         -> ItemHandSnapshot
ExtractPrimaryHand(PrimaryHandItemData) -> ItemPrimaryHandSnapshot
ExtractMelee(MeleeItemData)           -> ItemMeleeSnapshot
```

Extraction matching uses assignability for inherited layers and exact type for leaf-specific layers. Reflection may be used for type checks, but not for raw field serialization.

## 12. Parameter and SmartList resolution

**Status:** Accepted for Slice 1.

Canonical values are resolved in the mod through the game's runtime semantics:

```csharp
item.itemName.Get()
item.weight.Get()
item.tags.Get()
```

The mod emits resolved values in explicit snapshot DTOs. It does not serialize `Parameter<T>`, `SmartListParameter<T>`, `ParameterizedObject`, Odin containers, Unity objects, records, or record references directly.

For Slice 1, emit lightweight provenance for every extracted item `Parameter<T>` and `SmartListParameter<T>` field:

```json
{
  "name": "Iron Sword",
  "weight": 3.5,
  "tags": ["tag-guid"],
  "provenance": {
    "name": {
      "kind": "parameter",
      "source": "itemName.Get()",
      "isSet": true,
      "inherited": false
    },
    "weight": {
      "kind": "parameter",
      "source": "weight.Get()",
      "isSet": false,
      "inherited": true,
      "parent": {
        "kind": "lookupAsset",
        "guid": "parent-guid",
        "unityType": "Ardenfall.Item.ItemData"
      }
    },
    "tags": {
      "kind": "smartListParameter",
      "source": "tags.Get()",
      "isSet": true,
      "inherited": false
    }
  }
}
```

This provenance is raw-snapshot data. Canonical SQLite stores resolved values; provenance may be retained in diagnostics/provenance artifacts but is not public site contract in Slice 1.

Full raw authored parameter state is deferred until overrides/diff tooling proves a need.

## 13. Stable identity and reference domains

**Status:** Locked invariant.

Ardenfall has multiple identity domains. They must not be collapsed into one string type.

```ts
type SnapshotRef =
  | { kind: "lookupAsset"; guid: string; unityType?: string; name?: string }
  | { kind: "record"; table: string; subtable: string; id: string; recordType?: string }
  | { kind: "runtimeObject"; extractionId: string; unityType?: string; stable: false }
  | { kind: "missing"; reason: string; source: string };
```

Rules:

- Asset-backed entities use `BuiltLookupTable.Instance.GetGuid(asset)` as primary stable id.
- Deterministic `type + name` hashes are fallback only, and must be surfaced as unstable/provisional.
- Record-backed refs preserve `(table, subtable, id)`.
- Missing refs use a field-level criticality policy: `fatal`, `diagnostic`, or `optional-empty`.
- `fatal`: required identity/domain refs fail the current entity and increment fatal diagnostics. The pipeline rejects snapshots with fatal diagnostics. Examples: root item id, required variant discriminator, required foreign-key relation.
- `diagnostic`: optional but notable refs emit an explicit `{ kind: "missing" }` ref plus a diagnostic. Extraction continues. Examples: item `iconRef` unexpectedly missing from `BuiltLookupTable`, tag/category ref not resolvable, optional equipment stat ref missing.
- `optional-empty`: absence is normal and emits the normal empty value without a diagnostic. Examples: empty description, empty sounds list, absent pickup mesh, absent optional quickslot icon.

Missing refs are never silent nulls. A null-like value is only valid when the field declares `optional-empty`.

Diagnostic example:

```json
{
  "field": "iconRef",
  "value": {
    "kind": "missing",
    "reason": "lookupAssetGuidMissing",
    "source": "ItemData.icon"
  },
  "diagnostic": {
    "severity": "diagnostic",
    "code": "lookupAssetGuidMissing",
    "entity": "item:<guid>",
    "field": "iconRef"
  }
}
```

## 14. Extraction roots and readiness

**Status:** Locked invariant; lifecycle accepted for Slice 1.

Primary asset-backed extraction root:

```csharp
BuiltLookupTable.GetAssetsOfType<T>()
```

Record-backed extraction uses `MasterRecordTable` / `RecordID` semantics separately. `BuiltLookupTable` is not a universal root.

Before writing any snapshot, the mod performs a fail-fast preflight:

```text
BuiltLookupTable.Instance exists
BuiltLookupTable assets are non-empty
ArdenfallGame.instance exists
ArdenfallGame.instance.worldData exists
worldData.masterRecordTable exists
masterRecordTable.GetTables() is non-empty
```

Failed preflight writes no partial snapshot and reports a structured error.

### Lifecycle UX

Extraction lifecycle uses a lean hybrid readiness model.

Plugin initialization registers config, logging, HotRepl command handlers, the fallback hotkey, and lifecycle-hint observers. Plugin initialization must not assume Ardenfall runtime roots are ready and must not extract.

The authoritative extraction gate is the preflight executed immediately before snapshot creation. Readiness monitor state is advisory UX only. Lifecycle events, scene/load hints, and bounded polling may trigger readiness rechecks and a single ready transition log, but no single event proves readiness.

Slice 1 exposes extraction through typed HotRepl control commands plus the fallback F8 hotkey. `compendium.preflight` reports current readiness and blocking reasons. The export flow (`run.begin` → `entity.plan` → `entity.exportBatch` → `run.finalize`) reruns full preflight before writing and either publishes one complete snapshot or writes no consumable snapshot.

A game-console `/extract` command is not planned. BepInEx 5 has no built-in console-command surface, and the HotRepl control plane is the supported automation boundary.

Extraction output is atomic: after successful preflight, write to a staging/attempt path; complete entity files, diagnostics, manifest, counts, and hashes; then publish/rename to the final snapshot path. The pipeline ignores staging, failed, or incomplete attempts.

Cached readiness is never an authorization token. Every extraction path must rerun preflight immediately before writing.

## 15. Snapshot manifest and diagnostics

**Status:** Accepted for Slice 1.

Every snapshot includes a manifest with at least:

```text
game version / build identifier if available
extractor version
extraction timestamp
preflight result with checked fields, pass/fail reasons, and timestamp
counts per root type
required diagnostic count
optional diagnostic count
content hashes
```

The pipeline rejects snapshots with failed preflight or fatal diagnostics.

The pipeline also rejects snapshots missing a successful preflight object, expected files, required root counts, or declared content hashes.

## 16. Site read models and database access

**Status:** Accepted for Slice 1; extensible.

Canonical SQLite tables remain authoritative. The public site/runtime contract is generated materialized read-model tables registered in `site_read_models`. SQLite views may exist only as pipeline-local derivation, validation, or debugging aids unless explicitly promoted by a later decision.

Slice 1 public read models:

```text
item_overview_rows
item_detail_rows
```

Future generated read models:

```text
item_filter_facets
item_search / FTS virtual tables
map_points
map_layers
```

Read models are generated from canonical tables and descriptor/emitted metadata. They are not hand-maintained second sources of truth, never feed back into canonicalization, and are rebuilt deterministically from the snapshot + descriptors + pipeline code.

Every public read model records or is covered by manifest metadata:

```text
schema version
source snapshot digest
descriptor digest
pipeline version
row count
content checksum
```

Pipeline validation must check primary-key coverage, orphan refs, required refs, item variant ancestry, projected-field checksums, and declared missing-ref policy. Count equality alone is insufficient.

Internal derivation/debug views use private names such as `_derive_*` or `_validate_*` and are not part of the site API.

All site database access goes through `site/src/lib/store/`. Store accessors may query `site_*` metadata tables, registered read-model tables, and FTS/facet read models. Public pages/components must not join canonical inheritance-layer tables directly and must not parse metadata JSON themselves.

The pipeline reports per-table/index size so read-model bloat is visible before publishing. If DB size becomes a problem, optimize/prune read models behind the store contract rather than pushing joins into components.

## 17. Map rendering contract

**Status:** Locked for future map slice.

Map construction is not “one entity equals one rendered layer.” A canonical entity may produce multiple rendered layers or overlays.

The pipeline emits `map_layers` metadata and layer read models. Each rendered layer owns:

```text
layer id
source entity/read model
render kind (point, arc, polygon, radius, relation overlay, custom)
color/icon/radius/size
filter config
tooltip fields
legend label
z-order / grouping
```

Colors, icon sizes, radii, tooltip border classes, filters, and legend labels live in the emitted layer contract, not separate site styling tables.

Site-global map config is limited to true globals: bounds, tile URL pattern, highlight/interaction colors, and deck.gl view defaults.

## 18. Other entity families

**Status:** Guidance; defer exact schemas until their slices.

- **Spells:** typed `spells` root table plus type-tagged validated JSON for `SpellEffect` / `SubSpellData.effects` initially. Promote effect fields to typed tables only when queried/rendered in multiple places.
- **Quests:** typed `quests` root table; child tables for stable phases/objectives/events/rewards where practical; type-tagged JSON for FlowCanvas/Odin graph internals until queries prove typed tables are warranted.
- **Locations:** typed `locations` root table plus `location_volumes`; map metadata emitted as SQLite read models.

## 19. Fixture and exported-data strategy

**Status:** Accepted for Slice 1.

The repository is source and test contract, not an export archive. Full extracted game data may be useful locally and later as release/update artifacts, but it must not become ordinary git history.

Committed fixture classes:

```text
synthetic contract fixtures
curated real-derived boundary capsules
compact expected digests / boundary certificates
fixture manifests
fixture curation and hygiene-check scripts
```

Synthetic fixtures use invented data and cover schema, pipeline, and rejection behavior. They are valid for ordinary CI assertions but are not evidence that the BepInEx runtime boundary works.

Curated real-derived boundary capsules are allowed because redistribution/copyright is not treated as a blocker for this project, but they remain intentionally tiny, reviewable, and mechanically produced from a successful BepInEx extraction. They exist to prove runtime DTO shape and boundary behavior, not to archive Ardenfall data.

A curated real-derived capsule must be produced by a checked-in deterministic curation tool from an ignored full snapshot. It preserves snapshot DTO shape, manifest/preflight shape, reference kinds, provenance fields, diagnostics shape, and selected real runtime values needed for boundary validation. It must not be hand-trimmed from a full export.

Minimum Slice 1 real-boundary evidence:

```text
successful preflight/manifest/hashes from the real mod
GetAssetsOfType<ItemData>() produced item rows
BuiltLookupTable.GetGuid success for an item/root asset
at least one base ItemData row
at least one deep subclass branch such as MeleeItemData
at least one sibling equipment branch such as ArmorItemData
resolved Parameter<T> set case
resolved Parameter<T> inherited case if present in the selected data
resolved SmartListParameter<ItemTag> set/inherited/empty coverage where present
lookupAsset refs
optional-empty field representation
diagnostic missing-ref shape when naturally available or covered synthetically
```

Full local/runtime artifacts are ignored or external:

```text
full raw snapshots
staging / failed / incomplete extraction attempts
generated SQLite databases
generated read-model databases
generated site assets
icons, screenshots, map tiles, and bulk media
local extraction logs and ad hoc dumps
```

Generated SQLite/read-model outputs are rebuilt into temporary test directories. Tests compare invariants, selected normalized rows, and compact digests; generated databases/assets are not golden files in git.

Every committed fixture pack requires a manifest declaring:

```text
fixture kind: synthetic | real-derived-curated | digest | boundary-certificate
schema version
extractor version when applicable
game/build identifier when applicable
source and curation tool version
intended assertions
selected ids/types and selection rationale
normalization/scrubbing/minimization notes
content hashes
```

CI must enforce fixture hygiene: size budgets, required manifests, deterministic formatting, no machine-local paths, no raw Unity/Odin/game-object JSON, no raw `Parameter<T>` / `SmartListParameter<T>` state, and no tracked files under generated-artifact or extraction-output paths.

Local boundary validation remains first-class. Extractor changes must be validated against a real ignored snapshot by running the BepInEx mod, confirming `status` / `extract` behavior, atomically publishing a snapshot, and running pipeline boundary validation against that explicit snapshot path.

Deferred/pending decisions:

```text
exact committed fixture size budget
exact fixture directory names
exact curated item ids/types after first successful extraction
whether private/full-regression CI is worth adding
external archive backend for full snapshots and generated release artifacts
retention/access policy for external artifacts
public static-site content publication policy
```

These deferred decisions do not reopen the repository hygiene invariant: full exports and generated artifacts stay out of git.

## 20. Refusals

- No raw Unity/Odin/game object JSON.
- No side-effect global registries.
- No site descriptor reader parallel to the pipeline.
- No sparse item mega-table.
- No separate public routes for item subtypes by default.
- No canonical capability tables invented before query pressure proves the abstraction.
- No map styling tables split by color/radius/icon/border; one emitted layer contract.

## 21. Remaining decisions before Slice 1 plan

1. Concrete tooling choices still open from the original spec: validator, property testing, component primitives, repo/CI.
