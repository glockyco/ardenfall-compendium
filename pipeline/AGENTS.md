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
- Generated SQLite databases/assets are build outputs. Do not commit them or copy files into `site/static` by hand.

## Layout

- `src/stages/` — load, validate, canonicalize, emit assets/read models/artifacts.
- `src/entities/<id>/` — entity-specific canonicalizers/operations owned by the pipeline toolchain.
- `src/sql/` — canonical and site-metadata DDL.
- `test/` — pipeline unit, invariant, and end-to-end fixture tests.

Read `docs/superpowers/specs/2026-04-29-ardenfall-compendium-implementation-decisions.md` §4, §6, §7, §16 and the active slice spec before changing emitted contracts.
