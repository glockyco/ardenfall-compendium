# Pipeline Agent Orientation

The pipeline validates snapshots/descriptors and emits the canonical SQLite/artifact contract consumed by the static site. It is the only stage that interprets descriptors into site metadata and read models.

## Commands

- Pipeline tests: `bun test pipeline/test`
- Pipeline typecheck: `bun run --cwd pipeline typecheck`
- Synthetic pipeline run: `bun run pipeline:run fixtures/synthetic/snapshot pipeline/dist`
- Fixture artifact: `bun run artifact:fixture synthetic fixtures/synthetic/snapshot`

## Hard rules

- Read models are deterministic outputs of snapshot data, descriptors, and pipeline code. They never feed back into canonicalization and are never hand-maintained second sources of truth.
- Public site contracts are generated SQLite/read-model tables with manifest coverage. When a new public read model replaces an old one, remove the old public fallback/plumbing in the same slice; use private `_debug_*` views or diagnostics for temporary inspection.
- Rich text and links are pipeline contracts. Translate raw game/TMP strings into typed rich-text JSON and materialize canonical entity nodes, aliases, redirects, disambiguations, and edges before the site sees them.
- Fixture and release artifacts stay separate. Fixture artifacts under `pipeline/artifacts/fixtures/*` are for tests only; production deploys consume only `pipeline/artifacts/releases/*` with `artifact-manifest.json`.
- Entity dispatch is centralized in `src/entities/registry.ts`. Adding an entity is one registry entry carrying its pipeline and site capabilities, not a new hand-maintained dispatch list. `validateDescriptorCoverage` fails loudly when a descriptor declares a public route or map layer without the corresponding implementation.
- `src/stages/` — load, validate, canonicalize, emit assets/read models/artifacts.
- `src/entities/<id>/` — entity-specific canonicalizers/operations owned by the pipeline toolchain.
- `src/sql/` — canonical and site-metadata DDL.
- `test/` — pipeline unit, invariant, and end-to-end fixture tests.

The hard rules above are the durable contract. Check `src/entities/registry.ts` for dispatch wiring, `src/entities/<id>/` for entity-specific operations, and `src/sql/` for emitted SQL shapes. Check the roadmap for which entities and read models are currently in scope.
