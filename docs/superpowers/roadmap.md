# Ardenfall Archives — Implementation Roadmap

Living tracker for the implementation of the spec at `docs/superpowers/specs/2026-04-28-ardenfall-archives-design.md`. Updated when slices are planned, started, completed, or re-shaped.

## How this is organised

The spec covers three layered subsystems (mod, pipeline, site) plus shared infrastructure. Rather than one mega-plan, the work is split into **slices**. Each slice gets its own plan under `docs/superpowers/plans/` and produces working, testable software on its own. Slices are sequenced so the architecture is exercised end-to-end as early as possible (Slice 1 is a walking skeleton through every layer).

Slice ordering after Slice 1 is provisional; it will shift as we learn from execution.

## Status legend

- **planned** — described here, no plan written yet
- **drafting** — plan being written
- **ready** — plan written and committed, awaiting execution
- **in-progress** — plan execution underway
- **done** — plan executed and merged
- **deferred** — explicitly parked; won't be picked up until a stated trigger fires

## Slices

### Slice 1 — Walking skeleton (Spell, end-to-end)

**Status:** drafting
**Plan:** `docs/superpowers/plans/2026-04-28-walking-skeleton.md` (in flight)
**Spec coverage:** §4 (architectural shape, all three stages — minimal cuts), §6 (repo layout, Spell-only), §7 (descriptor format), §8 (mod, walker base, hotkey trigger, Spell DTO), §9 (pipeline, validate + denormalise + canonicalise + emit-sqlite stages), §11 (canonical store, no FTS5 yet), §14 (site, generic overview + detail for Spell), §15 (P1–P4, P6, P7, P9 — design system depth in Slice 5)
**Delivers:** running mod that extracts spells from the Ardenfall demo, pipeline that turns the snapshot into a SQLite blob, static SvelteKit site rendering `/spells` and `/spells/<id>`. End-to-end TDD coverage on the architectural seams.
**Excludes:** map, asset pipeline, tile pyramid, FTS5 search, override mechanism, more than one entity type, full design system.
**Open questions to close in this slice:**
- JSON Schema validator pinned (§16.5)
- Property-test framework pinned (§16.6)
- Initial component-library decision for design-system primitives (§16.4)
- Repo strategy + CI tooling (§16.2) — at least decide private/public and a single CI runner

### Slice 2 — Asset pipeline

**Status:** planned
**Spec coverage:** §8.4, §9 (`emit-assets` stage), §12, §14 (image rendering on detail pages)
**Delivers:** content-addressed PNG emission from the mod, WebP optimisation via `sharp`, `asset_refs` table populated, detail pages render entity images.
**Open questions to close:** none specific to this slice.

### Slice 3 — Map system

**Status:** planned
**Spec coverage:** §10 (full), §8 (tile capture trigger added to mod), §9 (`emit-tiles` stage)
**Delivers:** deck.gl `OrthographicView` map; descriptor-driven `createEntityLayer` loop; `DataFilterExtension` filtering wired for at least one mappable entity; tile pyramid generation from in-game capture.
**Open questions to close:** tile capture mod specifics — orthographic camera setup, zoom levels, projection bounds (§16.7).

### Slice 4 — Entity expansion (Item, NPC, Region, …)

**Status:** planned
**Spec coverage:** §6, §7, §14
**Delivers:** descriptors for additional entity types; validation that the generic UI primitives accommodate diverse shapes without forking. Likely decomposes into one sub-plan per entity if the work is non-trivial; mechanical adds get batched.
**Trigger for breakdown:** if any single entity type requires changes to `entity.schema.json` or to a UI primitive, that's its own plan; otherwise batched.

### Slice 5 — Design system depth + search

**Status:** planned
**Spec coverage:** §11 (FTS5), §14 (full design system: tokens, lint rules, primitives), §15 P5
**Delivers:** FTS5 virtual tables in the canonical store; search UI on the site; design-system tokens, lint rules, full component primitive set replacing whatever the walking skeleton scaffolded.
**Open questions to close:** none beyond what Slice 1 deferred.

### Slice 6 — Versioning, diff, and snapshot archive

**Status:** planned
**Spec coverage:** §11 (`emit-digest`), §13, §16.9
**Delivers:** `digests/<gameVersion>.summary.json` emitted by the pipeline; CLI command for cross-version diff; documented workflow for archiving raw snapshots and SQLite blobs externally; PR-body template carrying the digest.
**Open questions to close:** external archive backend (§16.9).

### Slice 7 — Override mechanism

**Status:** deferred
**Trigger:** first time an entity needs an authored correction that the extracted data can't carry (e.g. a name fix, a manual classification, a curated description). Not before.
**Spec coverage:** §6 (`overrides/`), §16.8

### Slice 8 — AGENTS.md / CLAUDE.md per subsystem with worked examples

**Status:** planned
**Spec coverage:** §15 P8
**Delivers:** repo-level + per-subsystem AGENTS.md (with CLAUDE.md pointers) carrying explicit good/bad code examples per the cited evidence.
**Note:** earlier slices land minimal AGENTS.md stubs; this slice fills them in once the architecture has stopped moving.

## Open questions tracker (mirror of spec §16)

| # | Question | Closes in slice |
|---|---|---|
| 1 | Deployment target | Slice 1 (or first slice that publishes a built site) |
| 2 | Repo strategy + CI tooling | Slice 1 |
| 3 | Future mod surface | deferred indefinitely |
| 4 | Component library specifics | Slice 1 (initial), Slice 5 (full) |
| 5 | JSON Schema validator pin | Slice 1 |
| 6 | Property-test framework pin | Slice 1 |
| 7 | Tile capture mod specifics | Slice 3 |
| 8 | Override mechanism details | Slice 7 |
| 9 | External archive backend | Slice 6 |

## Update protocol

When a slice transitions:
- **Drafting → ready:** plan link + commit hash recorded, status updated.
- **Ready → in-progress:** worktree branch noted.
- **In-progress → done:** completion date recorded, any spec deviations noted under the slice with rationale.
- **Slice re-shaped:** old slice marked `superseded by Slice N`, new slice added.
