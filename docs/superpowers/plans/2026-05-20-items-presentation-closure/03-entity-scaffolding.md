[← Previous phase](02-slug-routing.md) · [Next phase →](04-stat-type.md) · [Coordinator](../2026-05-20-items-presentation-closure.md)

# Phase 3: New-entity scaffolding (shared infrastructure)

**Spec coverage:** §4.1.

**Why third:** the seven new entities share descriptor, snapshot, validation, fixture, and read-model surface area. Building that shared surface once — and proving it works on a single throw-away entity (`stat-type` fixture) — keeps Phases 4–13 cheap. After this phase, adding a new entity is mostly mechanical.

**Outcome:** generic `EntitySnapshotEnvelope<T>` pattern + descriptor schema + `entities/<entity>/entity.json` template documented + pipeline `validate.ts` extension that accepts the new envelope shape + per-entity-type `entity_nodes` insertion helper. The throw-away fixture confirms the pipeline accepts a new entity without items breaking.

### Task 3.1: Entity descriptor template + schema

Today's `schemas/entity.schema.json` already validates the item descriptor (`entities/item/entity.json`). Confirm it covers the new entities; extend it only if a new field is required.

- [ ] **Step 1: Audit the existing descriptor schema**

Read `schemas/entity.schema.json` and `entities/item/entity.json`. Confirm the schema is generic enough for the new entities: the current descriptor shape is `id`, `label.{singular,plural}`, `extraction.{root,walker,options}`, `fields[]`, and optional `variants`, `site`, and `map`. Entity descriptors do **not** currently carry `routePath` or `canonicalTable`; those live in variant descriptors or generated read models.

Identify any new properties needed for a non-variant entity. Phase 3 adds `presentationContext: { renderContext: string }` because each new entity needs a descriptor-owned read-model `render_context` constant.

- [ ] **Step 2: Extend the schema if needed**

If the audit identifies a missing field, extend `schemas/entity.schema.json` with `presentationContext` (object with `renderContext: string`) optional. Regenerate validators.

- [ ] **Step 3: Write a failing loader test for a throw-away entity descriptor**

Add a temp-workspace fixture inside `pipeline/test/load-descriptors.test.ts`; do not commit a real `entities/__fixture_entity` folder. The test descriptor should use the actual descriptor shape:

```json
{
  "$schema": "../../schemas/entity.schema.json",
  "id": "stat-type",
  "label": { "singular": "Stat type", "plural": "Stat types" },
  "extraction": {
    "root": "BuiltLookupTable.GetAssetsOfType<StatType>",
    "walker": "StatTypeWalker"
  },
  "presentationContext": { "renderContext": "stat-type-presentation-v1" },
  "fields": [
    { "name": "id", "type": "id", "from": "guid", "missingPolicy": "fatal" },
    { "name": "name", "type": "string", "from": "statName", "missingPolicy": "fatal" }
  ],
  "map": null
}
```

Expected: FAIL before the schema/type change because `presentationContext` is rejected as an additional property.

- [ ] **Step 4: Run the descriptor validator**

Run: `bun test pipeline/test/load-descriptors.test.ts`
Expected after implementation: PASS.

- [ ] **Step 5: Do not commit a throw-away entity folder**

The fixture is a temp directory owned by the test. Keeping a real throw-away descriptor in the repo creates clutter.

- [ ] **Step 6: Commit (only if the schema was extended)**

```sh
git add schemas/entity.schema.json pipeline/dist/validate-entity.mjs pipeline/dist/validate-entity.d.mts
git commit -m "feat(pipeline): allow presentation render context on descriptors"
```

If the existing schema was sufficient, skip this commit.

### Task 3.2: Snapshot envelope schema covers new entity ids

The existing `schemas/snapshot.schema.json` validates `entityId: "item"` via a `const` or `enum`. Audit and extend to cover the seven new entity ids.

- [ ] **Step 1: Audit the snapshot schema**

Read `schemas/snapshot.schema.json`. The current `entityId` validation is open (`type: "string"` with the normal entity-id pattern), which already covers `status-effect`, `spell`, `enchantment`, `stat-type`, `item-category`, `item-tag`, and `potion-recipe`. Leave it open; do not add JSON comments to the schema because the schema files are consumed as strict JSON artifacts.

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
