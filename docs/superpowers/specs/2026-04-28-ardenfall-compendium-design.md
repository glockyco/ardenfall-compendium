# Ardenfall Compendium — Design Spec

Date: 2026-04-28
Status: Approved baseline; amended by `2026-04-29-ardenfall-compendium-implementation-decisions.md`

> **Implementation note:** Later ILSpy inspection and implementation-level brainstorming refined several details in this baseline spec. For Slice 1 planning and implementation, `2026-04-29-ardenfall-compendium-implementation-decisions.md` is authoritative where it differs from this document. In particular, it supersedes the original Spell-first walking skeleton, `entities/<id>/operations.ts`, side-effect TS registries, site-side descriptor reading, one-table-per-entity storage, and `name + type` stable-id fallback as primary identity.

## 1. Goal

Ship a static wiki-like website plus interactive map for the game **Ardenfall** (Spellcast Studios; Unity Mono). The data source is a runtime BepInEx mod that walks live game objects and emits a JSON snapshot. A TypeScript pipeline (run on Bun) validates, denormalises, and canonicalises that snapshot into a single SQLite blob shipped to the client beside a SvelteKit static build.

The site is the user-facing artefact. The mod and pipeline are the means.

## 2. Non-goals

- Not an in-game UI mod, content mod, or gameplay alteration. The mod's only job is data and asset extraction.
- Not a MediaWiki-backed wiki. The "auto-generated vs. hand-edited" merge problem is design debt we refuse to take on.
- Not a static-decompilation extractor. AssetRipper-style flows (used in the Erenshor sister project) are slow to re-run on every game update and brittle against asset format changes. Ardenfall's runtime extraction surface is friendly enough — `Ardenfall.ArdenfallMasterData` singleton plus a flotilla of `*Manager.Instance` registries — that runtime extraction is the cheaper path.
- Not a multi-language pipeline. Two languages live in this repo: C# in the mod and TypeScript everywhere else. Python is intentionally absent.
- Not a live-watching extractor. Extraction is on-demand via hotkey or console command; no on-load auto-run.

## 3. Lessons applied

This is the third project in a family; the prior two have known scars.

- **Ancient Kingdoms** (`~/Projects/ancient-kingdoms-mods`, IL2CPP / MelonLoader / Python pipeline / SvelteKit + deck.gl): adding a new map entity type required shotgun surgery across 4 hand-maintained styling tables in `website/src/lib/map/config.ts` (`LAYER_COLORS` 16 entries, `LAYER_RADII` 10 entries, `ICON_SIZES` 18 entries, `ENTITY_BORDER_COLORS` 17 entries). The tables have already drifted: `LAYER_RADII` carries a flat `gathering` key while `LAYER_COLORS` shards it into `gathering_plant/_mineral/_spark/_other`; `LAYER_COLORS.gathering_mineral` is `gray-500` while `ENTITY_BORDER_COLORS.gathering_mineral` is `stone-500`; `ICON_SIZES` carries `cooking_oven` keys absent everywhere else. Layer construction in `lib/map/layers.ts` is ~18 hand-written `createEntityLayer<T>({...})` calls with copy-paste of `pickable`, `onHover`, `updateTriggers`, etc. The schema also has three sources of truth: `schema.sql`, Pydantic `models.py`, TypeScript `lib/types/`.
- **Erenshor** (`~/Projects/Erenshor`, Mono / BepInEx / AssetRipper / Python pipeline / SvelteKit + deck.gl + MediaWiki): a dual raw→clean pipeline doubles every schema change; per-zone NorthBearing rotation logic accretes; large golden captures live in git and balloon the repo.

The architectural correction is not "different libraries". The deck.gl, SQLite, and SvelteKit choices are correct in both predecessors. The correction is **descriptor-driven uniformity**: one declaration per entity type, in one folder, drives extraction, validation, denormalisation, store schema, overview UI, detail UI, and map layers. Adding a new entity type is one new folder, not a sweep through 9 files.

## 4. Architectural shape

Three stages, each producing an immutable artefact consumed by the next:

```
Game runtime (Mono Unity, Ardenfall demo)
        │
        │  BepInEx 5 plugin: typed DTOs + generic walker
        ▼
Snapshot artefact            (raw JSON per entity kind + asset blobs + manifest)
        │
        │  TS / Bun pipeline: validate → denormalise → canonicalise
        ▼
Canonical artefact           (SQLite blob with FTS5 + WebP assets + tile pyramid)
        │
        │  SvelteKit static build
        ▼
ardenfall-compendium.<deploy>  (entity pages + deck.gl OrthographicView map)
```

Each arrow is a one-way artefact handoff. The pipeline cannot reach back into the mod; the site cannot reach back into the pipeline. Each stage is independently re-runnable from its input.

This is shape **β** in the prior research synthesis (RePoE / PyPoE is the cleanest open-source exemplar). It was preferred over:

- **α** (mod writes SQLite directly): no precedent in BepInEx Mono mods, and `Mono.Data.Sqlite` carries p/invoke trust constraints that we don't want in the extraction path.
- **γ** (collapse extraction and canonicalisation into one stage): conflates "what the game told us" with "what we decided it should mean", making provenance invisible and re-runs impossible without re-launching the game.

## 5. Components

| ID  | Component            | Owner stage           | Notes                                                                                                                         |
| --- | -------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| C1  | Runtime hook         | Mod                   | BepInEx plugin lifecycle; hotkey + console-command triggers; never on-load                                                    |
| C2  | Extractor            | Mod                   | Typed DTOs over `Assembly-CSharp.dll`; generic walker base for cycle detection, ScriptableObject ID resolution, JSON emission |
| C3  | Wire format          | Mod → Pipeline        | One JSON file per entity kind plus `manifest.json` carrying game version, build profile, extraction timestamp, content hashes |
| C4  | Schema authority     | Repo (committed)      | `entities/<id>/entity.json` descriptors; one source of truth, validated by JSON Schema                                        |
| C5  | Transformer pipeline | Pipeline              | Declarative DAG of named operations; topo-sorted, never hand-ordered `run_all()`                                              |
| C6  | Canonical store      | Pipeline → Site       | SQLite blob (~10–20 MB target), FTS5 search, shipped to the client                                                            |
| C7  | Site UI primitives   | Site                  | Generic overview + detail components, configured per entity by descriptor                                                     |
| C8  | Map system           | Site                  | deck.gl `OrthographicView`; descriptor-driven layer construction; one declarative loop                                        |
| C9  | Asset pipeline       | Mod → Pipeline → Site | Content-addressed (sha256 truncated) PNG → WebP via `sharp`                                                                   |
| C10 | Build orchestrator   | Pipeline              | Bun-driven topo-sorted task graph                                                                                             |
| C11 | Versioning + diff    | Repo                  | Schema, named operations, property invariants, summary digests in git; bulk artefacts external                                |
| C12 | Deployment           | Site                  | Static hosting; specific target deferred (see open questions)                                                                 |
| C13 | Future mod surface   | Repo                  | Where non-extraction mods would live; deferred (see open questions)                                                           |

## 6. Repository layout

```
ardenfall-compendium/
  AGENTS.md                          # repo-level orientation; CLAUDE.md is a pointer to it
  package.json                       # Bun workspace root: pipeline, site
  bun.lock
  README.md

  docs/
    superpowers/specs/               # this file
    adr/                             # local ADRs near the concept they govern (later)

  schemas/
    entity.schema.json               # JSON Schema for entity descriptors (authority for C4)
    snapshot.schema.json             # JSON Schema for mod output (authority for C3)
    digest.schema.json               # JSON Schema for committed digests (authority for C11)

  entities/                          # filesystem-as-registry
    <entity-id>/
      entity.json                    # the descriptor; validated against entity.schema.json
      operations.ts                  # entity-specific named operations, registered globally on import
      overrides/                     # later-phase: provenance-aware authored corrections
      assets/                        # static authored assets (rare; almost everything is extracted)

  mod/                               # BepInEx 5 plugin (C#)
    AGENTS.md
    src/
      Plugin.cs                      # entry point, trigger registration
      Walker/                        # generic walker base + helpers
      Dtos/                          # typed shapes mirroring Assembly-CSharp
      Triggers/                      # hotkey, console command
      Emit/                          # JSON + asset writers
    ArdenfallCompendium.csproj
    libs/                            # game DLLs (gitignored; copied locally for build)

  pipeline/                          # TypeScript on Bun
    AGENTS.md
    src/
      stages/
        validate.ts                  # schema + invariant checks
        denormalise.ts               # link-back, ref expansion
        canonicalise.ts              # write SQLite, WebP, tiles
      operations/                    # built-in named operations
      registry.ts                    # named-operations registry + descriptor loader
      cli.ts                         # `bun pipeline run`, `bun pipeline diff`, …
    test/                            # property + golden tests

  site/                              # SvelteKit static
    AGENTS.md
    src/
      lib/
        ui/                          # design-system primitives
        entity/                      # generic overview + detail components
        map/                         # deck.gl integration; descriptor-driven
        store/                       # SQLite-in-browser glue
      routes/
        +layout.svelte
        +page.svelte                 # landing
        [entity]/+page.svelte        # generic overview route
        [entity]/[id]/+page.svelte   # generic detail route
        map/+page.svelte
    static/
      tiles/{z}/{x}/{y}.webp         # generated; gitignored
      assets/<hash>.webp             # generated; gitignored
      data.sqlite                    # generated; gitignored

  snapshots/                         # gitignored; archived externally
    <gameVersion>-<timestamp>/
      manifest.json
      <entity-kind>.json
      assets/<kind>/<hash>.png

  digests/                           # committed
    <gameVersion>.summary.json       # compact diff-ready digest per game version
```

The `entities/` folder is the registry. There is no manifest, no manual `index.ts`, no enum, no discriminated union to keep in sync. Adding `entities/spell/` and committing a valid `entity.json` is the entire registration ceremony.

## 7. Entity descriptor format (C4)

One JSON file per entity type. Schema-validated. Holds pure data; no inline code. Dynamic logic lives in `operations.ts` next to the descriptor and registers itself by name.

### 7.1 Shape

```json
{
  "$schema": "../../schemas/entity.schema.json",
  "id": "spell",
  "label": { "singular": "Spell", "plural": "Spells" },

  "extraction": {
    "source": "MasterSpellListAsset.allSpells",
    "walker": "ScriptableObjectListWalker",
    "options": { "followRefs": true, "maxDepth": 6 }
  },

  "fields": [
    { "name": "id", "type": "id", "from": "_id" },
    { "name": "name", "type": "string", "from": "displayName" },
    { "name": "school", "type": "ref:school", "from": "school" },
    { "name": "manaCost", "type": "int", "from": "cost.mana" },
    {
      "name": "description",
      "type": "richtext",
      "from": "tooltip",
      "operation": "spell.formatTooltip"
    }
  ],

  "denormalise": [{ "op": "linkBack", "from": "school", "as": "spells" }],

  "site": {
    "overview": {
      "columns": ["name", "school", "manaCost"],
      "search": ["name"],
      "filters": [
        { "field": "school", "kind": "categorical" },
        { "field": "manaCost", "kind": "range" }
      ]
    },
    "detail": {
      "sections": ["summary", "effects", "obtainedFrom"]
    }
  },

  "map": null
}
```

For entities that appear on the world map:

```json
"map": {
  "layer":  "creatureSpawn",
  "icon":   "creature-spawn",
  "color":  [255, 100, 50],
  "radius": 6,
  "filters": [
    { "field": "faction", "kind": "categorical" },
    { "field": "level",   "kind": "range" }
  ],
  "tooltip": ["name", "faction", "level"]
}
```

### 7.2 Invariants enforced by the schema

- **No inline code.** `entity.json` is JSON; functions cannot syntactically appear. Anything dynamic is a string referencing an operation registered in `operations.ts` (e.g. `"operation": "spell.formatTooltip"`). The schema's `additionalProperties: false` and `enum`-based field types make stowaway code impossible.
- **One id per file.** The folder name `entities/<id>/` and `descriptor.id` must match. The pipeline asserts this on load.
- **Refs are first-class.** `"type": "ref:school"` is a typed reference, resolved by the canonicaliser into a foreign-key column. Dangling refs become validation errors with provenance.
- **Map config is opt-in.** `map: null` means the entity does not appear on the world map; the site's map loop skips it. There is no separate "is this entity mapped?" registry.

### 7.3 Named-operations registry

`entities/<id>/operations.ts` registers operations by globally-unique name:

```ts
import { registerOperation } from "$pipeline/registry";

registerOperation("spell.formatTooltip", (raw, ctx) => {
  return ctx.markup.parse(raw).withGlossaryLinks();
});

registerOperation("spell.computeManaTier", (spell) => {
  if (spell.manaCost <= 25) return "low";
  if (spell.manaCost <= 75) return "medium";
  return "high";
});
```

Naming convention: `<entity-id>.<verb>` for entity-specific operations; `core.<verb>` for built-ins shipped by the pipeline. Collisions are a pipeline error.

The pipeline imports every `entities/*/operations.ts` once during startup; registration is a side effect of import. The filesystem is the registry.

## 8. Mod architecture (C1, C2, C3, C9)

### 8.1 Stack

- **BepInEx 5** for the Mono Unity loader. Community standard for non-IL2CPP Unity, matches Erenshor, Thunderstore-compatible, supports ScriptEngine for hot-reload during development.
- **Newtonsoft.Json** for serialisation. Standard JSON library in the BepInEx Mono ecosystem; broad type and reflection support; well-understood failure modes on Unity types. We do not deserialise on-disk serialised assets ourselves (see §8.2), so the Sirenix Odin compatibility concerns covered in research artefact `agent://0-BepInExExtractionPatterns` are sidestepped — they apply to static asset interpretation, not to the runtime-walking path we take.
- **Typed DTOs** compiled against the actual `Assembly-CSharp.dll` shipped with the game (`<game>/Ardenfall_Data/Managed/Assembly-CSharp.dll`, 3 MB, 3171 typedefs). Field renames in a future game version cause compile errors, not silent data loss.

### 8.2 Walker

The walker is the only loadbearing piece of generic code in the mod. It:

1. Starts from a named root (e.g. `Ardenfall.ArdenfallMasterData.Instance.allSpells` or `MasterSpellListAsset.Instance.spells`), resolved by the descriptor's `extraction.source`.
2. Walks live runtime objects, **not** on-disk serialised asset bytes. Reaching the deserialised state via the loaded object graph works regardless of which Unity serialiser (built-in, Odin, or other) populated it. We never interpret asset binaries ourselves, which sidesteps every static-asset format concern.
3. Tracks visited objects by managed reference identity to break cycles.
4. Resolves `ScriptableObject` references to stable IDs. The runtime equivalent of editor `AssetDatabase` GUIDs is not available in built games; we use a deterministic hash of `name + GetType().FullName` as the stable id, documented as such.
5. Emits one JSON file per entity kind plus an `assets/` tree of PNGs, all under `snapshots/<gameVersion>-<timestamp>/`.

The walker is generic; per-entity logic lives in the descriptor's `extraction.options` and `fields[].from` paths plus any per-field `operation`. We expect well under one full walker implementation per entity kind.

### 8.3 Triggers

- **F8 hotkey** (configurable) for in-game one-shot extraction.
- **`/extract` console command** with optional entity-kind filter (`/extract spells`).
- No `Awake` / `Start` auto-run. Extraction is expensive and the player decides when.

### 8.4 Asset emission

`Texture2D.EncodeToPNG()` writes to `snapshots/<…>/assets/<kind>/<sha256-truncated>.png`. The truncated content hash is the filename, eliminating duplicates at the source. The mod records `(entity_kind, entity_id, slot) → hash` triples in the per-kind JSON.

## 9. Pipeline architecture (C5, C10)

### 9.1 Stack

- **TypeScript on Bun.** Bun ships a built-in test runner, SQLite driver, JSON loader, and TypeScript execution; one tool replaces what was Python + uv + pytest + a JSON library + a SQLite driver in the predecessors. Site shares the language for free type sharing.
- **Newtonsoft-compatible JSON.** Bun's built-in JSON parser handles the wire format.
- **`sharp`** for image processing (PNG → WebP). Ubiquitous, native, fast.
- **JSON Schema validator** for `entity.json` and `snapshot.json`. _Recommendation pending validation:_ `Ajv` is the dominant choice, but the specific validator should be pinned in the first implementation slice with a brief comparison.

### 9.2 Stages

The pipeline is a topo-sorted DAG of named stages. There is no hand-ordered `run_all()`.

```
load-descriptors        ←  entities/*/entity.json + operations.ts
load-snapshot           ←  snapshots/<latest>/
validate                ←  load-descriptors, load-snapshot
denormalise             ←  validate
canonicalise            ←  denormalise
emit-sqlite             ←  canonicalise
emit-assets             ←  load-snapshot
emit-tiles              ←  load-snapshot
emit-digest             ←  canonicalise
```

Each stage declares its inputs; the orchestrator sorts. Adding a new stage is a new file declaring its inputs; ordering is the orchestrator's job.

### 9.3 Operations

`registerOperation(name, fn)` populates a global registry. The pipeline rejects:

- Operations referenced from descriptors that are not registered.
- Operations registered twice with the same name.
- Descriptors that reference operations of mismatched arity or kind (per-field operations vs. denormalisation operations are typed differently).

Built-in operations ship with the pipeline under `pipeline/src/operations/`. Examples: `core.linkBack`, `core.expandRef`, `core.parseRichText`.

## 10. Map architecture (C8)

### 10.1 Library

**deck.gl standalone with `OrthographicView`.** Same library as both predecessors. The architectural problem in AK is not the library; it is descriptor-less layer construction. Evidence in `~/Projects/ancient-kingdoms-mods/website/src/lib/map/layers.ts`: ~18 imperative `createEntityLayer<T>({...})` invocations, each duplicating `pickable`, `onHover`, `onClick`, `updateTriggers`. The deck.gl primitives in use (`OrthographicView`, `TileLayer` + `BitmapLayer.renderSubLayers`, `IconLayer` with sprite atlas, `DataFilterExtension` with `filterSize: 1` and `filterSize: 2`, `pickable`/`onHover`/`onClick`) are textbook and stay.

`DataFilterExtension` enables GPU-side filtering across thousands of markers — a deck.gl-specific capability with no MapLibre equivalent. AK's `createNpcVisibilityBitmask` (21 NPC role flags packed into one int for `filterSize: 1`) is the idiomatic way to use this and is retained.

### 10.2 Construction

One declarative loop replaces AK's wall of imperative calls:

```ts
const layers: Layer[] = [];
for (const descriptor of entityDescriptors) {
  if (!descriptor.map) continue;
  layers.push(createEntityLayer(descriptor, data[descriptor.id], filters[descriptor.id]));
}
```

`createEntityLayer(descriptor, data, filters)` is one function. Color, radius, icon, border colour, filter spec, and tooltip fields are read from `descriptor.map`. AK's four drift-prone styling tables collapse into the per-entity descriptor.

### 10.3 Coordinates

Coordinates are stored as **game world coordinates** in descriptors and snapshot JSON. The Y-negation that AK threads through its query and rendering layers (`deck.gl Y = -game Z`) is performed **once at canonicalisation time** and frozen in the SQLite store. The site never re-derives view coordinates; it reads them.

### 10.4 Tile pyramid

The mod captures orthographic frames of the world via a dedicated capture trigger (separate from data extraction). The pipeline slices captures into `static/tiles/{z}/{x}/{y}.webp` for `TileLayer` consumption. Specific orthographic camera setup, zoom levels, and projection bounds are deferred to the implementation plan; the surface here is "the mod produces world frames; the pipeline produces a tile pyramid".

## 11. Canonical store (C6)

A single SQLite blob shipped to the client, ~10–20 MB target, with FTS5 search. This is the AK pattern and works.

Schema is **derived from descriptors**. One table per entity (`spells`, `items`, …) with columns from `fields`. Foreign keys for `ref:*` types. One `asset_refs` table mapping `(entity_kind, entity_id, slot) → hash`. FTS5 virtual tables for fields marked searchable.

If the SQLite size becomes a complaint, the next step is `sql.js-httpvfs` for range-fetched access. We do not pre-optimise for it.

## 12. Asset pipeline (C9)

- Mod calls `Texture2D.EncodeToPNG()` and writes `snapshots/<…>/assets/<kind>/<sha256-truncated>.png`. Filename is the truncated content hash; duplicates at the source disappear by definition.
- Pipeline `emit-assets` stage reads each PNG, converts via `sharp` to WebP (quality knob in pipeline config), writes `site/static/assets/<hash>.webp`.
- The canonical SQLite store carries an `asset_refs` table mapping `(entity_kind, entity_id, slot) → hash`. The site looks up `<hash>.webp` directly; no per-entity asset path computation.
- New game version with new icons: hash-by-content means unchanged assets are not re-emitted. Renamed icon with same pixels keeps its hash; renamed icon with new pixels gets a new hash and the old one becomes orphan, gc'd by a pipeline `prune-assets` task.

## 13. Versioning and diff (C11)

- **In git:** schema files (`schemas/*.json`), entity descriptors (`entities/*/entity.json` + `operations.ts`), property invariants (`pipeline/test/`), built-in operations (`pipeline/src/operations/`), compact summary digests (`digests/<gameVersion>.summary.json`).
- **Not in git:** raw snapshots (`snapshots/`), canonical SQLite (`site/static/data.sqlite`), generated tiles (`site/static/tiles/`), generated assets (`site/static/assets/`). Bulk artefacts are archived externally per game version. The Erenshor pattern of golden captures in git is explicitly rejected.
- **Cross-version diff:** the `emit-digest` stage emits `digests/<gameVersion>.summary.json` — counts per entity kind, list of new/removed/renamed ids, schema-shape changes. PR bodies for "update to game version X" carry the digest; the actual artefacts live in the external archive. The digest schema is in `schemas/digest.schema.json`.

## 14. Site UI (C7)

Two generic routes drive every entity type:

- `/[entity]` — overview. Reads `descriptor.site.overview`. Columns, search, filters all declared. One Svelte component, configured.
- `/[entity]/[id]` — detail. Reads `descriptor.site.detail.sections`. Sections are themselves named operations on the entity record (e.g. `core.summary`, `spell.effectsTable`). Renderers live in `site/src/lib/entity/sections/`.

A few entities will need bespoke detail views (e.g. the world map page itself). These get their own routes and are exempt from the generic flow; the descriptor's `site` field is optional.

The design system (component primitives, tokens, lint rules) is established **on day one** before any entity UI is written. Specific component library is _recommendation pending validation_: shadcn-svelte plus design tokens is the leading candidate per the handoff but not yet committed; the implementation plan will pin it after a brief comparison.

## 15. Principles

These are the contract this design owes to itself.

- **P1.** One entity declaration per type, in one folder.
- **P2.** One schema source of truth: the JSON descriptor, validated by JSON Schema. No parallel TS/SQL/Python schema definitions.
- **P3.** Convention-driven registries. The filesystem is the registry. No manual unions, no re-export indices, no enum that has to learn a new variant.
- **P4.** Generic UI primitives plus per-entity declarative config. Bespoke views are exceptions, not the rule.
- **P5.** Strict design system from day one. Tokens before components; lint rules before pages.
- **P6.** Declarative pipeline. Stages declare inputs; orchestrator sorts. No hand-ordered `run_all()`.
- **P7.** Typed C# DTOs against real game DLLs, plus a shared generic walker base. Not pure reflection (loses type safety on field renames); not hand-coded extractors per entity (loses generic walker reuse).
- **P8.** Per-subsystem AGENTS.md / CLAUDE.md with explicit good/bad code examples. Cited evidence: the Anthropic study of agentic coding showed ~29% runtime reduction and ~17% token reduction with this discipline.
- **P9.** Semantic density. Full English words over abbreviations. Brace-language (TS, C#, JSON) over indentation-significant syntax for the data layer.

## 16. Open questions deferred to implementation plan

These are intentionally not decided here; they are decisions the implementation plan must close.

1. **Deployment target.** Cloudflare Pages, Vercel, GitHub Pages, self-hosted? Affects build target, asset CDN strategy, and tile-pyramid serving.
2. **Repo strategy.** Public from day one, or private until first usable build? CI tooling.
3. **Future mod surface.** Where does a (hypothetical) gameplay mod live? Same repo with `mods/<name>/`? Separate repo entirely? The current repo's name (`ardenfall-compendium`) accommodates either.
4. **Component library.** shadcn-svelte + tokens is the leading candidate; a one-page comparison against alternatives is owed in the first implementation slice.
5. **JSON Schema validator.** Ajv is the dominant choice; pin specifically in the first slice.
6. **Property-invariant test framework.** Bun's built-in test runner plus `fast-check` is the leading candidate; pin in first slice.
7. **Tile capture mod specifics.** Orthographic camera setup, zoom levels, projection bounds, capture stitching strategy. Owed by the map slice of the implementation plan.
8. **Override mechanism details.** `entities/<id>/overrides/` is reserved as a later-phase concern; its provenance and merge rules are not designed here.
9. **External archive location for snapshots and SQLite blobs.** Storage backend (S3-compatible bucket, GitHub Releases, etc.) is not chosen.

## 17. What this design refuses

- Any "convenience" import that re-exports descriptors so consumers can avoid touching the registry. The filesystem **is** the registry.
- Any styling table that lists entity kinds and must be edited when one is added. Per-entity styling lives on the descriptor.
- Any extractor that walks Odin-serialised on-disk assets directly. We walk the loaded runtime graph.
- Any pipeline stage ordered by hand. Dependencies declare order.
- Any committed binary that re-extracting from a snapshot would regenerate.
- Any second source of truth. If a fact about an entity exists, it exists once.
