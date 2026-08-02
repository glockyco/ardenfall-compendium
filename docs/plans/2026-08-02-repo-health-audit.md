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

### M10. Four hand-maintained entity-id lists contradict "filesystem is the registry"

`pipeline/src/entities/registry.ts:3-22` maintains `canonicalizerSupport`, `readModelSupport`, and `mapReadModelSupport` as literal maps of entity ids, while `pipeline/src/stages/load-descriptors.ts:14-48` already discovers descriptors dynamically from disk. Entity-specific dispatch is hardcoded in three further places: `pipeline/src/stages/emit-read-models.ts:49-57`, `pipeline/src/map/read-models.ts` (the `MAP_PROJECTIONS` record), and `pipeline/src/stages/emit-site-metadata.ts:116-155`.

This is a genuine tension rather than a clear defect. The maps double as a compile-time coverage assertion via `validateDescriptorCoverage`, which has real value — it is what makes a descriptor without an emitter fail loudly. The problem is that there are four separate hand-edited lists, so adding an entity means finding all of them, and missing one fails at a different layer each time.

Worth resolving before the next entity slice adds a fifth reason to edit them. Keep the coverage assertion; key the emitters off one descriptor-driven registry. Deliberately deferred to the slice that adds characters and the vendor role: that slice introduces the first entity of a genuinely third shape, and designing the abstraction against two placed entities would be guessing. `validateDescriptorCoverage` fails loudly in the meantime, so the cost of waiting is a clear error rather than silent breakage.

---

## Minor

### N5. Remaining test gaps

Diagnostic severity aggregation and slug collision behaviour are now covered. These remain, in order of consequence:

1. **Rich-text parsing.** `pipeline/test/rich-text-v1.test.ts` covers well-formed input only. No nested or unterminated tags, no HTML escaping, no parser recovery. The contract can regress while the suite stays green.
2. **Artifact manifest tampering.** Hash and count mismatch paths are untested.

Fixture realism improved with the portal record ids but the synthetic snapshot is still small and clean — 5 items against a real 1273 — so most end-to-end tests exercise happy paths only.

Weak assertions worth tightening: `pipeline/test/item-subtypes.test.ts:27-33` asserts a table exists without checking its schema.

Several pipeline and site tests use `process.chdir` with `Date.now()`-named temp directories (`site/test/map-read-models.test.ts:8,66`), which is racy under parallel execution.

---

## Constraints discovered, worth not rediscovering

- **TypeScript 7 is not adoptable yet.** It went GA on 2026-07-08, but `svelte-check` caps its `typescript` peer at `^5 || ^6` and `typescript-eslint` caps below `6.1.0`. Adopting 7 means running the type checker and linter against a version neither supports. Recheck when both publish support. This is recorded in `AGENTS.md` so it is not retried blind.
- **The site build runs under Node, not Bun.** `vite build` spawns Node, so SvelteKit's prerender loads server chunks there. The `better-sqlite3` branch in `site/src/lib/server/db.ts` is therefore load-bearing despite the repo being Bun-first, and removing it breaks the build. Verify against the prerender, not against `bun test`, before touching that adapter.
- **One mod branch is untestable outside Unity.** In `ItemExtractor`, the path where a lookup returns null for a non-null asset cannot be reached in tests: an uninitialized `ItemData` is already null under Unity's overloaded operator, so the extractor takes the missing-asset branch first, and giving doubles distinct instance ids throws `SecurityException`. Noted in the test file.
