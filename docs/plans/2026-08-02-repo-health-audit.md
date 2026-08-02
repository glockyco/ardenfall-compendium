---
title: "Repository Health Audit — Open Findings"
type: audit
status: active
created: 2026-08-02
parent: 2026-04-29-ardenfall-compendium-roadmap
superseded_by:
archived:
---

# Repository Health Audit — Open Findings

A repo-wide audit on 2026-08-02 covered planning coherence, all four subsystems, schemas, tooling, CI, tests, and dependency currency. Most findings are remediated; what follows is what remains open, verified against the tree.

Severity: **major** — real defect or invariant violation with a plausible failure path; **minor** — worth fixing, no current failure path.

---

## Major

### M7. The explicit-DTO invariant is honoured by convention, not by types

No violation ships today. Every snapshot write is `JsonConvert.SerializeObject` over an explicit envelope (`mod/src/Emit/SnapshotWriter.cs:28`, `mod/src/Control/Handlers/EntityExportBatchCommand.cs:71`), and there is no reflection dump or Odin `SerializationUtility` call anywhere in `mod/src`.

The type system permits one. `mod/src/Entities/Item/ItemSnapshot.cs:17` declares `Fields` as `Dictionary<string, object?>`, and the ref slots in `mod/src/Entities/Adapters/ItemAdapterHelpers.cs:22-48,89` are `object?` / `List<object?>`. Any future adapter that puts a Unity or Odin object into those slots is serialised without complaint.

"No raw Unity / Odin / game-object JSON in snapshots" is the loudest invariant in `AGENTS.md`, and it is currently enforced by nobody noticing. A closed union of permitted field value types would make the compiler enforce it.

### M10. Four hand-maintained entity-id lists contradict "filesystem is the registry"

`pipeline/src/entities/registry.ts:3-22` maintains `canonicalizerSupport`, `readModelSupport`, and `mapReadModelSupport` as literal maps of entity ids, while `pipeline/src/stages/load-descriptors.ts:14-48` already discovers descriptors dynamically from disk. Entity-specific dispatch is hardcoded in three further places: `pipeline/src/stages/emit-read-models.ts:49-57`, `pipeline/src/map/read-models.ts` (the `MAP_PROJECTIONS` record), and `pipeline/src/stages/emit-site-metadata.ts:116-155`.

This is a genuine tension rather than a clear defect. The maps double as a compile-time coverage assertion via `validateDescriptorCoverage`, which has real value — it is what makes a descriptor without an emitter fail loudly. The problem is that there are four separate hand-edited lists, so adding an entity means finding all of them, and missing one fails at a different layer each time.

Worth resolving before the next entity slice adds a fifth reason to edit them. Keep the coverage assertion; key the emitters off one descriptor-driven registry.

---

## Minor

### N5. Test gaps that matter

Ranked by consequence. Slug and short-id collision coverage was added with the record-id contract; these remain:

1. **Diagnostic severity aggregation.** `pipeline/test/snapshot.test.ts:220-230` asserts only `fatal === 0`. Nothing covers severity mapping, or that manifest counts agree with the diagnostics actually recorded. Fatal diagnostics now gate artifact production, so the classification is load-bearing and untested.
2. **Rich-text parsing.** `pipeline/test/rich-text-v1.test.ts` covers well-formed input only. No nested or unterminated tags, no HTML escaping, no parser recovery. The contract can regress while the suite stays green.
3. **Artifact manifest tampering.** Hash and count mismatch paths are untested.

Fixture realism improved with the portal record ids but the synthetic snapshot is still small and clean — 5 items against a real 1273 — so most end-to-end tests exercise happy paths only.

Weak assertions worth tightening: `pipeline/test/snapshot.test.ts:54` asserts only that a value is defined; `:130-132` runs `every` over an array that is vacuously true when empty; `pipeline/test/item-subtypes.test.ts:27-33` asserts a table exists without checking its schema.

Several pipeline and site tests use `process.chdir` with `Date.now()`-named temp directories (`site/test/map-read-models.test.ts:8,66`), which is racy under parallel execution.

---

## Constraints discovered, worth not rediscovering

- **TypeScript 7 is not adoptable yet.** It went GA on 2026-07-08, but `svelte-check` caps its `typescript` peer at `^5 || ^6` and `typescript-eslint` caps below `6.1.0`. Adopting 7 means running the type checker and linter against a version neither supports. Recheck when both publish support. This is recorded in `AGENTS.md` so it is not retried blind.
- **The site build runs under Node, not Bun.** `vite build` spawns Node, so SvelteKit's prerender loads server chunks there. The `better-sqlite3` branch in `site/src/lib/server/db.ts` is therefore load-bearing despite the repo being Bun-first, and removing it breaks the build. Verify against the prerender, not against `bun test`, before touching that adapter.
- **One mod branch is untestable outside Unity.** In `ItemExtractor`, the path where a lookup returns null for a non-null asset cannot be reached in tests: an uninitialized `ItemData` is already null under Unity's overloaded operator, so the extractor takes the missing-asset branch first, and giving doubles distinct instance ids throws `SecurityException`. Noted in the test file.
