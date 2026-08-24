# Pipeline Agent Orientation

- Use the pipeline as the only stage that interprets descriptors into site metadata and read models.
- Keep repository-wide contracts in the root guide because this harness loads every ancestor `AGENTS.md`: https://github.com/can1357/oh-my-pi/blob/main/docs/context-files.md.

## Commands

- Run pipeline tests with `bun test pipeline/test`.
- Run the pipeline typecheck with `bun run --cwd pipeline typecheck`.
- Run a synthetic pipeline with `bun run pipeline:run fixtures/synthetic/snapshot pipeline/dist`.
- Build a fixture artifact with `bun run artifact:fixture synthetic fixtures/synthetic/snapshot`.

## Hard rules

- Derive read models only from snapshot data, descriptors, and pipeline code. Never hand-maintain a second source of truth.
- Generate public site contracts as SQLite/read-model tables with manifest coverage. Use private `_debug_*` views or diagnostics for temporary inspection.
- List every game entity. Use `entity_nodes.has_page` only to answer whether a row has its own detail page. Never use it as a publication gate or identity check.
- Represent missing names as `Unnamed <thing>`. Treat blank and whitespace-only names as missing. Report the gap once during extraction, and do not emit a second pipeline diagnostic.
- Never make a missing display name fatal. List the row as unnamed so the artifact retains its other facts.
- Publish authored names even when they look like internal ids. Emit a diagnostic for the naming gap instead of changing or dropping the row.
- Name diagnostics as `<entity><Condition>` in camelCase. State what is absent, not how the pipeline searched. Use `fatal` only when the artifact is invalid. Give each condition its own code.
- Sort canonical arrays and ordinals by `snapshotRefKey` identity before serialisation. Never sort by display name.
- Normalize both guid spellings to one short id. `deriveShortId` strips hyphens from record ids.
- Read decompiled game source before deciding how a field controls behaviour. Rename fields whose names conflict with their use. State the mechanism in the spec requirement that depends on it, and record the probe in the change that used it.
- Add entities through the central registry in `src/entities/registry.ts`. Keep each entity's pipeline and site capabilities in its registry entry. Let `validateDescriptorCoverage` fail when a descriptor lacks an implementation.

## Decision examples

### Read-model cutover pair

**Wrong:** Add a new table and accessor, but keep the obsolete public table and its loader as a second supported path.

**Right:** Register the replacement in `pipeline/src/entities/registry.ts`, update its consumer in `site/src/lib/server/read-models.ts`, and delete the obsolete public path in the same change. The artifact then exposes one current contract.

### Relationship-link pair

**Wrong:** Give the site a source name and route parameters, then make the route compose link text and guess whether the target has a page.

**Right:** Resolve the target label, route, and page status in `pipeline/src/relationships/relationship-graph.ts`. Give the result to `site/src/lib/components/relationships/EntityLink.svelte`, which renders the resolved link or plain text.

## Layout

- Find stage orchestration in `src/stages/`, entity operations in `src/entities/<id>/`, SQL in `src/sql/`, and tests in `test/`.
- Check `src/entities/registry.ts` for dispatch wiring, `src/entities/<id>/` for entity operations, and `src/sql/` for emitted SQL shapes.
