[← Previous phase](02-slug-routing.md) · [Next phase →](04-stat-type.md) · [Coordinator](../2026-05-20-items-presentation-closure.md)

# Phase 3: New-entity scaffolding (shared infrastructure)

**Spec coverage:** §4.1.

**Why third:** the seven new entities share descriptor, snapshot, validation, fixture, and read-model surface area. Building that shared surface once — and proving it works on a single throw-away entity (`stat-type` fixture) — keeps Phases 4–13 cheap. After this phase, adding a new entity is mostly mechanical.

**Outcome:** generic `EntitySnapshotEnvelope<T>` pattern + descriptor schema + `entities/<entity>/entity.json` template documented + pipeline `validate.ts` extension that accepts the new envelope shape + per-entity-type `entity_nodes` insertion helper. The throw-away fixture confirms the pipeline accepts a new entity without items breaking.

### Task 3.1: Entity descriptor template + schema

Today's `schemas/entity.schema.json` already validates the item descriptor (`entities/item/entity.json`). Confirm it covers the new entities; extend it only if a new field is required.

- [ ] **Step 1: Audit the existing descriptor schema**

Read `schemas/entity.schema.json` and `entities/item/entity.json`. Confirm the schema is generic enough for the new entities (it accepts `id`, `singularLabel`, `pluralLabel`, `routePath`, `canonicalTable`, optional `variants`, `fields[]`).

Identify any new properties needed for a non-variant entity: `slugStrategy`, `presentationContext`, etc. For Phase 3 we only add `presentationContext: { renderContext: string }` if absent — every new entity declares its `render_context` constant in the descriptor.

- [ ] **Step 2: Extend the schema if needed**

If the audit identifies a missing field, extend `schemas/entity.schema.json` with `presentationContext` (object with `renderContext: string`) optional. Regenerate validators.

- [ ] **Step 3: Write a fixture descriptor for a throw-away entity**

Create `entities/__fixture_entity/entity.json`:

```json
{
  "$schema": "../../schemas/entity.schema.json",
  "id": "__fixture_entity",
  "singularLabel": "Fixture entity",
  "pluralLabel": "Fixture entities",
  "routePath": "/__fixture_entities",
  "canonicalTable": "__fixture_entities",
  "presentationContext": { "renderContext": "fixture-presentation-v1" },
  "fields": [
    { "name": "id", "type": "string", "from": "id", "missingPolicy": "fatal" },
    { "name": "name", "type": "string", "from": "name", "missingPolicy": "fatal" }
  ]
}
```

The descriptor folder name starts with `__` so the loader skips it during normal entity walking (Slice 1 convention; verify in `pipeline/src/stages/load-descriptors.ts`).

- [ ] **Step 4: Run the descriptor validator**

Run: `bun test pipeline/test/load-descriptors.test.ts`
Expected: PASS (the new descriptor folder is ignored).

- [ ] **Step 5: Remove the fixture entity**

```sh
rm -r entities/__fixture_entity
```

This was a one-shot audit — keeping the throw-away directory in the repo creates clutter. The descriptor template moves into the canonical entity slices.

- [ ] **Step 6: Commit (only if the schema was extended)**

```sh
git add schemas/entity.schema.json pipeline/dist/validate-entity.mjs pipeline/dist/validate-entity.d.mts
git commit -m "feat(pipeline): allow presentation render context on descriptors"
```

If the existing schema was sufficient, skip this commit.

### Task 3.2: Snapshot envelope schema covers new entity ids

The existing `schemas/snapshot.schema.json` validates `entityId: "item"` via a `const` or `enum`. Audit and extend to cover the seven new entity ids.

- [ ] **Step 1: Audit the snapshot schema**

Read `schemas/snapshot.schema.json`. Note the current `entityId` validation. If it is `const: "item"`, change to `enum: ["item", "status-effect", "spell", "enchantment", "stat-type", "item-category", "item-tag", "potion-recipe"]`. If it is open (`type: "string"`), leave it. Document the choice in the schema with a comment.

- [ ] **Step 2: Regenerate validators**

Run: `bun run codegen:validators`

- [ ] **Step 3: Run pipeline tests**

Run: `bun test pipeline/test`
Expected: PASS.

- [ ] **Step 4: Commit**

```sh
git add schemas/snapshot.schema.json pipeline/dist/validate-snapshot.mjs pipeline/dist/validate-snapshot.d.mts
git commit -m "feat(pipeline): allow new entity ids in snapshot envelopes"
```

### Task 3.3: Pipeline diagnostics taxonomy extension

Slice 4 introduced `pipeline_diagnostics` with sources like `rich-text` and `relationship-graph`. New sources land in this slice: `master-tooltip`, `composer`, `entity-extraction`, `slug-collision`, `effect-binding`. Document the taxonomy.

- [ ] **Step 1: Document the diagnostic source list**

Update `pipeline/src/relationships/relationship-graph.ts` header comment (or add `pipeline/src/diagnostics-vocabulary.md` if preferred) listing every `source` value the slice will emit, with one-line meanings. This is a documentation step — no code change.

- [ ] **Step 2: Commit**

```sh
git add pipeline/src/relationships/relationship-graph.ts
git commit -m "docs(pipeline): record diagnostic source taxonomy"
```

### Task 3.4: Phase 3 verification gate

- [ ] Run the standard phase gate.
- [ ] No new entity descriptor or canonical table is committed yet — this phase only confirms infrastructure.

---

---

[← Previous phase](02-slug-routing.md) · [Next phase →](04-stat-type.md) · [Coordinator](../2026-05-20-items-presentation-closure.md)
