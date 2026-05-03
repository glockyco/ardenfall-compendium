# Ardenfall Archives — Implementation Roadmap

Living tracker for implementation of:

- Baseline spec: `docs/superpowers/specs/2026-04-28-ardenfall-archives-design.md`
- Slice 1 amendment: `docs/superpowers/specs/2026-04-29-ardenfall-archives-implementation-decisions.md`
- Slice 1 tooling decisions: `docs/superpowers/specs/2026-05-03-slice1-tooling-decisions.md`

The amendment is authoritative where it differs from the baseline spec.

## How this is organised

The project spans three layered subsystems (BepInEx mod, TS/Bun pipeline, SvelteKit site) plus shared descriptor/schema infrastructure. Rather than one mega-plan, work is split into **slices**. Each slice gets its own plan under `docs/superpowers/plans/` and must produce working, testable software on its own.

Slice ordering after Slice 1 is provisional; it changes when real extracted data proves a better sequence.

## Status legend

- **planned** — described here, no plan written yet
- **brainstorming** — design decisions still being closed
- **drafting** — plan being written
- **ready** — plan written and committed, awaiting execution
- **in-progress** — plan execution underway
- **done** — plan executed and merged
- **deferred** — explicitly parked until a stated trigger fires

## Slices

### Slice 1 — Item walking skeleton

**Status:** in-progress
**Plan:** `docs/superpowers/plans/2026-05-03-item-walking-skeleton.md`
**Worktree branch:** `slice/1-item-walking-skeleton` (at `.worktrees/slice-1-item-walking-skeleton/`)
**Spec coverage:** baseline §4, §6–§9, §11, §14, §15; all implementation decisions in `2026-04-29-ardenfall-archives-implementation-decisions.md`; tooling decisions in `2026-05-03-slice1-tooling-decisions.md`.

**Delivers:**

- Bun workspace repo foundation for `pipeline/` and `site/`, with `mod/` as C# sibling.
- Descriptor-only entity root: `entities/item/entity.json`.
- Item variant descriptor mechanism under `entities/item/variants/`.
- BepInEx extraction path for `ItemData` assets using `BuiltLookupTable.GetAssetsOfType<ItemData>()`.
- Stable asset IDs via `BuiltLookupTable.GetGuid(Object)`.
- Explicit snapshot DTOs; no raw Unity/Odin/game object JSON.
- `Parameter<T>.Get()` and `SmartListParameter<T>.Get()` resolution for item fields.
- Extraction preflight for lookup table, `ArdenfallGame.instance`, `worldData`, and `masterRecordTable` readiness.
- Lean extraction lifecycle: commands register immediately; advisory readiness monitor logs when ready; `extract` reruns preflight before writing.
- Atomic extraction output: publish only complete successful snapshots; pipeline ignores staging, failed, or incomplete attempts.
- Snapshot manifest with game/build/extractor metadata, preflight result, counts, diagnostics.
- Fixture strategy: synthetic contract fixtures plus curated real-derived boundary capsules; full exports and generated artifacts stay ignored or external.
- Fixture hygiene guardrails: manifests, size budgets, curation tooling, and CI checks against accidental exported-data commits.
- Local boundary validation against an ignored real BepInEx snapshot remains required for extractor changes.
- Snapshot-level lightweight provenance for each extracted item `Parameter<T>` / `SmartListParameter<T>` field (`isSet`, inherited flag, optional parent ref).
- Canonical SQLite tables for `items`, `item_tags`, and the first meaningful item variant/layer tables.
- Pipeline-emitted site metadata; site does not read raw descriptors.
- Generic `/items` and `/items/[id]` routes driven by emitted metadata/read models.
- Basic item overview/detail UI using structured `fieldList` sections and a registered `custom` escape hatch if needed.

**Slice 1 item layers:**

- `items` (`ItemData`)
- `item_tags` (`ItemData.tags`)
- `item_equipment` (`EquipItemData`)
- `item_hand_items` (`HandItemData`)
- `item_primary_hand_items` (`PrimaryHandItemData`)
- `item_melee_weapons` (`MeleeItemData`)
- `item_armor` (`ArmorItemData`)

This set is defined for Slice 1. It proves the item variant model with one deep inheritance branch (`MeleeItemData`) and one sibling equipment branch (`ArmorItemData`). Slice 2 fills the remaining item subtype breadth using the same mechanism.

**Excludes:**

- Remaining item subtype coverage listed in Slice 2.
- Spells, quests, locations, map rendering, tile capture, FTS5 search, override mechanism, full design system depth.
- Canonical capability tables. Capability/facet/read models may be generated later from canonical item layer tables.

**Fixture/exported-data policy:**

- Commit synthetic fixtures, curated real-derived micro-capsules, compact digests, manifests, curation scripts, and hygiene checks.
- Do not commit full snapshots, generated SQLite/read-model databases, generated assets/media/tiles, staging/failed attempts, local logs, or ad hoc dumps.
- Real-derived capsules are permitted but must be mechanically curated from successful ignored snapshots and kept tiny/reviewable.
- Deferred: fixture size budget, exact fixture paths, selected real item ids after first extraction, private/full-regression CI, external archive backend, artifact retention/access policy, and public site content publication policy.

**Open decisions:** closed in `docs/superpowers/specs/2026-05-03-slice1-tooling-decisions.md`. JSON Schema validator (Ajv 8 + standalone codegen), property-test framework (fast-check 4 plain), UI primitives (shadcn-svelte 1.2.7 + Bits UI 2.18.1 + Tailwind v4.2.4), repo strategy (public GitHub, MIT), CI tooling (GitHub Actions, four path-filtered jobs), lint/format (Prettier + ESLint 9, Biome deferred), pre-commit (lefthook 2.1.6), TypeScript compiler (`@typescript/native-preview` beta migrating to `typescript@^7.0.x` on stable release), SQLite (`bun:sqlite` built-in), image processing (sharp with Bun spike).

### Slice 2 — Item subtype enrichment

**Status:** planned
**Spec coverage:** implementation addendum §9–§11, §16.

**Delivers:** fills out the remaining item inheritance/leaf layers observed in ILSpy, likely including:

- `item_bows`
- `item_consumables`
- `item_throwing_items`
- `item_throwing_potions`
- `item_slate_spells`
- `item_notes`
- `item_potion_recipes`
- `item_repair_kits`
- `item_arrows`
- any additional `ItemData` subclasses found during full enumeration

**Trigger for breakdown:** if a subtype touches spells, notes/books, potion/status effects, or other domains deeply, it becomes its own plan.

### Slice 3 — Asset pipeline

**Status:** planned
**Spec coverage:** baseline §8.4, §9 (`emit-assets`), §12; amendment §13, §16.

**Delivers:** content-addressed PNG emission from the mod, WebP optimisation via `sharp`, `asset_refs` population, item icon rendering, generated asset manifest, asset diagnostics.

**Note:** Slice 1 may include minimal icon references. Actual image extraction/rendering can move here unless needed to make item pages honest.

### Slice 4 — Spells

**Status:** planned
**Spec coverage:** amendment §18.

**Delivers:** `SpellData` extraction and canonicalization: typed `spells` root table; generated tooltips if feasible; references to `StatType`; type-tagged validated JSON for `SpellEffect` / `SubSpellData.effects`; link from `SlateSpellItemData` to spells once both sides exist.

### Slice 5 — Locations and first map-oriented data

**Status:** planned
**Spec coverage:** baseline §10; amendment §17–§18.

**Delivers:** `LocationAsset` extraction; `locations` and `location_volumes` tables; map-readiness for point/polygon data; coordinate canonicalization. This slice prepares map data without requiring tile capture or deck.gl UI yet.

### Slice 6 — Map system

**Status:** planned
**Spec coverage:** baseline §10; amendment §17.

**Delivers:** deck.gl `OrthographicView` map; emitted `map_layers` metadata/read models; generic layer factory; no AK-style split styling tables; first tile pyramid if capture tooling is ready.

**Open questions to close:** orthographic camera setup, zoom levels, projection bounds, capture stitching strategy.

### Slice 7 — Design system depth + search/facets

**Status:** planned
**Spec coverage:** baseline §11, §14, §15 P5; amendment §16.

**Delivers:** design tokens, lint rules, stable primitive set, FTS5 search, item/entity facets, generated read models for search/filter performance.

### Slice 8 — Quests and graph-heavy data

**Status:** planned
**Spec coverage:** amendment §18.

**Delivers:** typed `quests` root table; child tables for stable phases/objectives/events/rewards where practical; validated type-tagged JSON for FlowCanvas/Odin graph internals until queries prove typed tables are warranted.

### Slice 9 — Versioning, diff, and snapshot archive

**Status:** planned
**Spec coverage:** baseline §13, §16.9; amendment §15.

**Delivers:** committed summary digests; cross-version diff CLI; raw snapshot/canonical SQLite archive workflow; PR-body digest template; external archive backend selected.

### Slice 10 — Override mechanism

**Status:** deferred
**Trigger:** first authored correction that the extracted data cannot carry, or first need to distinguish resolved value from authored default/override in public output.
**Spec coverage:** baseline §6, §16.8; amendment §12.

### Slice 11 — AGENTS.md / CLAUDE.md per subsystem with worked examples

**Status:** planned
**Spec coverage:** baseline §15 P8.

**Delivers:** repo-level and per-subsystem agent guidance with explicit good/bad examples. Earlier slices may land minimal stubs; this slice fills them in once architecture has stopped moving.

## Open questions tracker

| # | Question | Status | Closes in slice |
|---|---|---|---|
| 1 | Deployment target | open | First slice that publishes a built site |
| 2 | Repo strategy + CI tooling | **closed** | Slice 1 (`2026-05-03-slice1-tooling-decisions.md` §1, §8) |
| 3 | Component library / primitive strategy | **closed (initial)** | Slice 1 (`2026-05-03-slice1-tooling-decisions.md` §5); design system depth in Slice 7 |
| 4 | JSON Schema validator | **closed** | Slice 1 (`2026-05-03-slice1-tooling-decisions.md` §3) |
| 5 | Property-test framework | **closed** | Slice 1 (`2026-05-03-slice1-tooling-decisions.md` §4) |
| 6 | Tile capture specifics | open | Slice 6 |
| 7 | External archive backend | open | Slice 9 |
| 8 | Future gameplay-mod surface | deferred | indefinitely |

## Update protocol

When a slice transitions:

- **Brainstorming → drafting:** all decisions that materially affect the slice are closed or marked provisional with revisit triggers.
- **Drafting → ready:** plan link and commit hash recorded.
- **Ready → in-progress:** worktree branch noted.
- **In-progress → done:** completion date recorded; any spec deviations noted under the slice with rationale.
- **Slice re-shaped:** old slice marked `superseded by Slice N`, new slice added.
