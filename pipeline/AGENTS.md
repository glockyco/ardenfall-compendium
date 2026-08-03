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
- Nothing is hidden. This is a compendium, so a thing that exists in the game is listed. `entity_nodes.has_page` answers one question only: does this row have its own detail page. It is never a publication gate. It briefly also meant "do not publish", and that conflation let a page-less row vanish from every section it belonged to. A consumer that wants a stable identity, such as a map marker's short id, must not test it.
- A missing name is stated, never hidden and never replaced by an identifier. The wording is `Unnamed <thing>`, matching `resolveItemDisplayLabel` and the character, portal, faction, spell and status-effect read models. Treat a blank or whitespace-only name as missing. Report the gap once, at the layer that detects it, which is extraction, so do not emit a second pipeline diagnostic for a condition the mod already names.
- A display name is never `fatal`. A nameless row is listed as unnamed, because refusing to build the artifact over a missing label withholds every other fact about that row.
- An authored name is the game's own word, so it is published even when it looks like an internal id. 29 of the 32 named portals read like `sc_tutcave_ext`. Publish them and emit a diagnostic that counts the gap, rather than inventing a nicer name or dropping the row.
- A diagnostic code is `<entity><Condition>` in camelCase and says what is absent, never how we looked for it. `fatal` is only for a condition that makes the artifact invalid, and everything else is `diagnostic`. One code never covers two conditions, because a single number then hides both, which is how two separately broken effect targets stayed invisible.
- A canonical row's order comes from identity, never from arrival. The game stores records in dictionaries, so it can yield one collection in a different order between runs. Sort by the identity of what a reference points at, through `snapshotRefKey`, before serialising an array or assigning an ordinal. Sorting by a display name is wrong, because names repeat.
- A record id is a guid the game writes in two forms. 292 of 314 NPC records use the bare 32 characters and 22 use hyphens, so `deriveShortId` strips hyphens and one guid gives one short id either way.
- A game field decides our behaviour only after its use is read in the decompiled source. A field's name and its use can disagree: `showOnMap` gates the player's in-game map marker and once wrongly gated whether a location got a page, which withheld 14 real places. A name that needs prose to explain what it does not mean is a defect, so rename it. Findings and the checked-and-correct list live in `docs/plans/2026-08-03-game-field-assumptions.md`.
- Entity dispatch is centralized in `src/entities/registry.ts`. Adding an entity is one registry entry carrying its pipeline and site capabilities, not a new hand-maintained dispatch list. `validateDescriptorCoverage` fails loudly when a descriptor declares a route or map layer without the corresponding implementation.
- `src/stages/` — load, validate, canonicalize, emit assets/read models/artifacts.
- `src/entities/<id>/` — entity-specific canonicalizers/operations owned by the pipeline toolchain.
- `src/sql/` — canonical and site-metadata DDL.
- `test/` — pipeline unit, invariant, and end-to-end fixture tests.

The hard rules above are the durable contract. Check `src/entities/registry.ts` for dispatch wiring, `src/entities/<id>/` for entity-specific operations, and `src/sql/` for emitted SQL shapes. Check the roadmap for which entities and read models are currently in scope.
