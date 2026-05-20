[← Previous phase](14-item-rework.md) · [Next phase →](16-route-cutover.md) · [Coordinator](../2026-05-20-items-presentation-closure.md)

# Phase 15: Relationship graph rebuild

**Spec coverage:** §4.5.

**Why fifteenth:** every public entity now exists. The relationship graph must connect them with the predicate vocabulary from spec §4.5, exposing both forward sections ("variants of this item", "items in this category") and reverse sections ("items that apply this status effect", "recipes that produce this potion"). Phase 15 rewrites `pipeline/src/stages/build-graph.ts` (renamed from Slice 4's relationship-graph integration in `emit-read-models.ts`) to emit the full edge set with composite indexes and materialised section blocks for both source and target sides.

**Outcome:** every edge defined in spec §4.5 emits with deterministic `edge_id`; the `entity_edges` table has the `(source_type, source_id, predicate)` + `(target_type, target_id, predicate)` composite indexes (added in Phase 2); `entity_relationship_sections` materialises forward AND reverse sections from a single edge set without doubling rows; every detail page (items, status-effects, spells, enchantments, recipes, tags, stats, categories) renders the right outgoing AND incoming sections.

## Predicate vocabulary

Slice 4.5 final predicate list (from spec §4.5):

| Predicate                   | Source        | Target        | Source field / origin                                                                                                                                                     |
| --------------------------- | ------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `variant_of`                | item          | item-variant  | `item.variant` (existing Slice 4)                                                                                                                                         |
| `belongs_to_category`       | item          | item-category | `item.categoryRef`                                                                                                                                                        |
| `tagged_with`               | item          | item-tag      | `item.tags[]`                                                                                                                                                             |
| `requires_stat`             | item          | stat-type     | `equipment.statTypeRef` (when `minimumSkill > 0`)                                                                                                                         |
| `applies_status_effect`     | item          | status-effect | `consumable.statusEffects[]`, `throwingPotion.areaOfEffect[]`, `melee.bleedStatusEffect`, `bow.bleedStatusEffect`, `throwingItem.bleedStatusEffect`                       |
| `casts_spell`               | item          | spell         | `slateSpell.spellData` + `slateSpell.secondarySpellData`                                                                                                                  |
| `grants_enchantment`        | item          | enchantment   | `equipment.enchantments[]` + `equipment.builtInEnchantments[]`                                                                                                            |
| `teaches_recipe`            | item          | potion-recipe | `potionRecipeItem.recipe`                                                                                                                                                 |
| `references_term`           | item          | term          | description term-set match (existing Slice 4)                                                                                                                             |
| `modifies_status_effect`    | status-effect | status-effect | `statusEffect.modifyStatusEffects[]`                                                                                                                                      |
| `modifies_stat`             | status-effect | stat-type     | `ModStatEffect.stat` (read from `effect_instances.payload_json`)                                                                                                          |
| `applies_status_effect`     | status-effect | status-effect | `AddEffectOnWeatherEffect.statusEffect`, `RerouteStatusEffectToCompanionEffect.statusEffect` (effect_instances payload mining)                                            |
| `requires_stat`             | spell         | stat-type     | `spell.statTypeRef`                                                                                                                                                       |
| `inherits_from_spell`       | spell         | spell         | `spell.spellEffectReferenceRef`                                                                                                                                           |
| `applies_status_effect`     | spell         | status-effect | spell effects' `StatusEffectTooltipSpellEffect.statusEffects[]`, `SelfStatusEffectSpellEffect.statusEffect`, `AOESpellEffect.aoeEffect` (effect_instances payload mining) |
| `uses_status_effect_color`  | spell         | status-effect | `spell.useStatusEffectColorRef`                                                                                                                                           |
| `applies_status_effect`     | enchantment   | status-effect | `StatusEffectEnchantmentEffect.statusEffect`, `TriggerOnDamageEnchantmentEffect.applyStatusEffects[]`                                                                     |
| `cascades_to_enchantment`   | enchantment   | enchantment   | `TimedEnchantmentEffect.enchantmentToApply`                                                                                                                               |
| `blacklists_item`           | enchantment   | item          | `enchantment.baseItemDataFilterBlacklistRefs[]`                                                                                                                           |
| `whitelists_item`           | enchantment   | item          | `enchantment.baseItemDataFilterWhitelistRefs[]`                                                                                                                           |
| `target_override`           | enchantment   | item          | `enchantmentTooltip.variables[].targetVars[].itemRef`                                                                                                                     |
| `produces_drinkable_potion` | potion-recipe | item          | `potionRecipe.drinkablePotionRefs[]`                                                                                                                                      |
| `produces_throwing_potion`  | potion-recipe | item          | `potionRecipe.throwingPotionRefs[]`                                                                                                                                       |
| `requires_tag`              | potion-recipe | item-tag      | `potionRecipe.ingredients[].tagRef`                                                                                                                                       |

## Tasks

### Task 15.1: Move the graph emission into a dedicated pipeline stage

**Files:**

- Create: `pipeline/src/stages/build-graph.ts`
- Modify: `pipeline/src/stages/emit-read-models.ts` (remove the inline `entity_edges` / `entity_relationship_sections` emission introduced in Slice 4)
- Modify: `pipeline/src/cli.ts` (orchestrate the new stage after `emit-read-models` and before `emit-redirects`)

The new stage's signature:

```ts
export interface BuildGraphInput {
  sqlitePath: string;
}

export interface BuildGraphOutput {
  edgesEmitted: number;
  forwardSectionsEmitted: number;
  reverseSectionsEmitted: number;
  diagnostics: PipelineDiagnostic[];
}

export function buildGraph(input: BuildGraphInput): BuildGraphOutput;
```

Internally:

1. Open the SQLite DB in read-write mode.
2. For each predicate in the vocabulary, run a SQL query against the canonical tables that produces `(source_type, source_id, target_type, target_id, label, weight, evidence_json, anchor)` rows.
3. Insert each row into `entity_edges`. `edge_id = "<source_type>:<source_id>:<predicate>:<target_type>:<target_id>"`.
4. For each `(source_type, source_id, predicate)` group, materialise a `entity_relationship_sections` row with `direction='forward'` and the JSON-serialised edge list.
5. For each `(target_type, target_id, predicate)` group, materialise a `direction='reverse'` row.
6. Run `auditEntityGraph(db)` and emit any `relationshipMissingTarget` diagnostics as fatals.

`entity_relationship_sections` needs a new `direction` column:

```sql
ALTER TABLE entity_relationship_sections ADD COLUMN direction TEXT NOT NULL DEFAULT 'forward';
```

Or, since this is a clean-cutover project, drop and recreate the table with the column in its DDL. Pick one — the project convention is recreate (no online migration); update the DDL in `pipeline/src/relationships/relationship-graph.ts`.

- [ ] **Step 1: Update the DDL to add `direction`**

```ts
CREATE TABLE entity_relationship_sections (
  section_id      TEXT NOT NULL,
  source_type     TEXT NOT NULL,
  source_id       TEXT NOT NULL,
  direction       TEXT NOT NULL CHECK (direction IN ('forward', 'reverse')),
  title           TEXT NOT NULL,
  predicate       TEXT NOT NULL,
  edges_json      TEXT NOT NULL,
  sort_order      INTEGER NOT NULL,
  PRIMARY KEY (section_id, direction)
);
```

- [ ] **Step 2: Implement `build-graph.ts`**

The implementation is one query per predicate. Example:

```ts
function emitVariantOf(db: Database): number {
  const rows = db
    .query<
      { source_id: string; target_id: string },
      []
    >(`SELECT items.id AS source_id, items.variant AS target_id FROM items WHERE items.variant IS NOT NULL`)
    .all();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO entity_edges (edge_id, source_type, source_id, target_type, target_id, predicate, label, weight, evidence_json, anchor)
     VALUES (?, 'item', ?, 'item-variant', ?, 'variant_of', 'Variant of', 1.0, '{}', 'item-header')`,
  );
  for (const row of rows) {
    insert.run(
      `item:${row.source_id}:variant_of:item-variant:${row.target_id}`,
      row.source_id,
      row.target_id,
    );
  }
  return rows.length;
}

function emitTaggedWith(db: Database): number {
  const rows = db
    .query<{ source_id: string; target_id: string }, []>(
      `SELECT i.id AS source_id, r.tag_id AS target_id
       FROM items i JOIN item_tag_refs r ON r.item_id = i.id`,
    )
    .all();
  // ... insert ...
  return rows.length;
}
```

Repeat for every predicate. Effect-derived predicates (`modifies_stat`, `applies_status_effect` from effects, etc.) mine `effect_instances.payload_json` via SQLite JSON functions:

```ts
function emitStatusEffectModifiesStat(db: Database): number {
  const rows = db
    .query<{ source_id: string; target_id: string }, []>(
      `SELECT owner_id AS source_id, json_extract(payload_json, '$.stat.guid') AS target_id
       FROM effect_instances
       WHERE owner_type = 'status-effect' AND effect_kind = 'ModStatEffect'
         AND json_extract(payload_json, '$.stat.kind') = 'lookupAsset'`,
    )
    .all();
  // ... insert ...
}
```

After all edges are inserted, materialise sections:

```ts
function materialiseSections(db: Database): { forward: number; reverse: number } {
  // forward sections: group by (source_type, source_id, predicate)
  const forwardRows = db
    .query<{ source_type: string; source_id: string; predicate: string; edges: string }, []>(
      `SELECT source_type, source_id, predicate,
              json_group_array(json_object(
                'targetType', target_type,
                'targetId', target_id,
                'label', label,
                'weight', weight,
                'evidence', json(evidence_json),
                'anchor', anchor)) AS edges
       FROM entity_edges
       GROUP BY source_type, source_id, predicate`,
    )
    .all();
  const insertForward = db.prepare(
    `INSERT OR REPLACE INTO entity_relationship_sections (section_id, source_type, source_id, direction, title, predicate, edges_json, sort_order)
     VALUES (?, ?, ?, 'forward', ?, ?, ?, ?)`,
  );
  for (const row of forwardRows) {
    insertForward.run(
      `${row.source_type}:${row.source_id}:${row.predicate}:forward`,
      row.source_type,
      row.source_id,
      titleFor(row.predicate, "forward"),
      row.predicate,
      row.edges,
      sortOrderFor(row.predicate, "forward"),
    );
  }
  // reverse sections: same query keyed by target.
  const reverseRows = db
    .query<{ target_type: string; target_id: string; predicate: string; edges: string }, []>(
      `SELECT target_type, target_id, predicate,
              json_group_array(json_object(
                'sourceType', source_type,
                'sourceId', source_id,
                'label', label,
                'weight', weight,
                'evidence', json(evidence_json),
                'anchor', anchor)) AS edges
       FROM entity_edges
       GROUP BY target_type, target_id, predicate`,
    )
    .all();
  const insertReverse = db.prepare(/* same shape, direction='reverse' */);
  // ... insert ...
  return { forward: forwardRows.length, reverse: reverseRows.length };
}
```

`titleFor(predicate, direction)` is a small mapping:

```ts
const TITLES: Record<string, { forward: string; reverse: string }> = {
  variant_of: { forward: "Variant", reverse: "Items in this variant" },
  belongs_to_category: { forward: "Category", reverse: "Items in this category" },
  tagged_with: { forward: "Tags", reverse: "Items with this tag" },
  applies_status_effect: { forward: "Applies", reverse: "Applied by" },
  casts_spell: { forward: "Casts", reverse: "Items that cast this spell" },
  grants_enchantment: { forward: "Enchantments", reverse: "Items with this enchantment" },
  teaches_recipe: { forward: "Recipe", reverse: "Items that teach this recipe" },
  produces_drinkable_potion: {
    forward: "Drinkable potions",
    reverse: "Recipes that produce this potion",
  },
  produces_throwing_potion: {
    forward: "Throwing potions",
    reverse: "Recipes that produce this potion",
  },
  requires_tag: { forward: "Ingredients", reverse: "Recipes that require this tag" },
  modifies_status_effect: { forward: "Modifies", reverse: "Modified by" },
  modifies_stat: { forward: "Modifies stat", reverse: "Status effects modifying this stat" },
  requires_stat: { forward: "Requires stat", reverse: "Requires this stat" },
  inherits_from_spell: { forward: "Inherits from", reverse: "Inherited by" },
  uses_status_effect_color: { forward: "Uses color from", reverse: "Spells using this color" },
  cascades_to_enchantment: { forward: "Cascades into", reverse: "Cascaded into by" },
  blacklists_item: { forward: "Blacklisted items", reverse: "Blacklisted by enchantments" },
  whitelists_item: { forward: "Whitelisted items", reverse: "Whitelisted by enchantments" },
  target_override: {
    forward: "Item-specific overrides",
    reverse: "Per-item enchantment overrides",
  },
  references_term: { forward: "Referenced terms", reverse: "Referenced by" },
};
```

`sortOrderFor` returns an integer that controls section ordering on each page (e.g. `variant_of` first at 10, `belongs_to_category` at 20, etc.).

- [ ] **Step 3: Tests**

```ts
// pipeline/test/build-graph.test.ts
describe("buildGraph", () => {
  it("emits item.tagged_with edges from item_tag_refs", () => {
    // ...
  });

  it("emits status-effect.modifies_stat from effect_instances ModStatEffect payloads", () => {
    // ...
  });

  it("materialises both forward and reverse sections without doubling edge rows", () => {
    // Run buildGraph; assert: COUNT(*) FROM entity_edges == N; sections has 2 * N grouped rows.
  });

  it("fails fast on relationshipMissingTarget", () => {
    // ...
  });
});
```

- [ ] **Step 4: Commit**

```sh
git add pipeline/src/stages/build-graph.ts pipeline/src/relationships/relationship-graph.ts pipeline/src/stages/emit-read-models.ts pipeline/src/cli.ts pipeline/test/build-graph.test.ts
git commit -m "feat(pipeline): rebuild relationship graph with full predicate vocabulary"
```

### Task 15.2: Site read-model accessors for reverse sections

**Files:**

- Modify: `site/src/lib/server/read-models.ts` to add `listRelationshipSections(entityType, entityId)` returning BOTH directions in one call, sorted by `direction` ascending (forward first) then `sort_order`.

```ts
export interface RelationshipSection {
  id: string;
  direction: "forward" | "reverse";
  title: string;
  predicate: string;
  edges: RelationshipEdge[];
}

export interface RelationshipEdge {
  targetType?: string;
  targetId?: string;
  sourceType?: string;
  sourceId?: string;
  targetRoute?: string;
  sourceRoute?: string;
  label: string;
}

export const listRelationshipSections = (
  entityType: string,
  entityId: string,
): RelationshipSection[] => {
  // Forward: source = (entityType, entityId)
  const forward = all<{ section_id: string; title: string; predicate: string; edges_json: string }>(
    `SELECT section_id, title, predicate, edges_json
     FROM entity_relationship_sections
     WHERE source_type = ? AND source_id = ? AND direction = 'forward'
     ORDER BY sort_order, title`,
    [entityType, entityId],
  );
  // Reverse: source = (entityType, entityId)  (note: target-side sections store their target as source_type/id with direction='reverse').
  // Adjust the query to match how Task 15.1 stored reverse sections.
  // ...
};
```

The reverse-section storage shape from Task 15.1 stores `source_type = target_type / source_id = target_id` so the query above selects on the target's identity directly.

- [ ] Commit: `feat(site): query forward and reverse relationship sections`.

### Task 15.3: Site detail pages render reverse sections

Every detail-page Svelte file (items, status-effects, spells, enchantments, categories, tags, stats, recipes) now consumes `listRelationshipSections(entityType, entityId)`. The existing `RelationshipSection.svelte` component renders both directions; for reverse sections it uses each edge's `sourceRoute` / `sourceType` instead of `targetRoute` / `targetType`.

- [ ] Modify the existing `RelationshipSection.svelte` to handle both shapes.
- [ ] Verify on a representative status-effect page: forward sections show "Modifies stat", reverse sections show "Applied by" / "Applied by spells" / etc.

Commit: `feat(site): render reverse relationship sections`.

### Task 15.4: Phase 15 verification gate

- [ ] Run the standard phase gate.
- [ ] Confirm `auditEntityGraph` emits zero `relationshipMissingTarget` diagnostics.
- [ ] Visit `/status-effects/<slug>--<id8>` and confirm "Applied by" sections list items, spells, enchantments.
- [ ] Visit `/items/<consumable>` and confirm "Applies status effect" forward section + items targeted by this consumable's effects link correctly.
- [ ] Confirm `EXPLAIN QUERY PLAN` for the top reverse-edge query uses `idx_edges_target` (you can sanity-check by running `sqlite3` against the built artifact).
- [ ] Update coordinator phase index row 15 status to ✅.

---

[← Previous phase](14-item-rework.md) · [Next phase →](16-route-cutover.md) · [Coordinator](../2026-05-20-items-presentation-closure.md)
