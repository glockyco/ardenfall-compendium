[← Previous phase](05-item-category.md) · [Next phase →](07-effect-serializer.md) · [Coordinator](../2026-05-20-items-presentation-closure.md)

# Phase 6: `item-tag` entity

**Spec coverage:** §3.2.

**Why sixth:** `ItemTag.description` is the in-game tag-row text shown beneath the item description on potions/consumables ("Incredibly valuable remedy", "Drink to gain strength", etc.) via `BaseItem.GetEffectsTooltip` (`.decompiled/.../Item/BaseItem.cs:139-153`). Currently only tag GUIDs are captured. Phase 6 promotes tags to a public entity so item presentation rows can resolve and render them. After Phase 6, the small-entity template has been exercised three times and is proven; Phases 7+ move on to harder territory.

**Outcome:** every `ItemTag` asset is exported with `tagName` + `description`; `/tags` + `/tags/[slug]` render; items reverse-link to their tags; the in-game tag-row text becomes available to the item presentation composer (used in Phase 14).

## Template instantiation

Phase 6 instantiates the **small-entity template** from [04-stat-type.md](04-stat-type.md):

| Template parameter          | Phase 6 value                                  |
| --------------------------- | ---------------------------------------------- |
| Entity id                   | `item-tag`                                     |
| Plural id                   | `item-tags`                                    |
| Asset C# type               | `Ardenfall.Item.ItemTag`                       |
| Mod namespace               | `ArdenfallCompendium.Entities.ItemTag`         |
| Adapter file                | `mod/src/Entities/ItemTag/ItemTagExtractor.cs` |
| Snapshot DTO file           | `mod/src/Entities/ItemTag/ItemTagSnapshot.cs`  |
| Snapshot envelope           | `fixtures/synthetic/snapshot/item-tags.json`   |
| Pipeline canonical table    | `item_tags`                                    |
| Pipeline overview table     | `item_tag_overview_rows`                       |
| Pipeline presentation table | `item_tag_presentation_rows`                   |
| Render context              | `item-tag-presentation-v1`                     |
| Site overview route         | `/tags`                                        |
| Site detail route           | `/tags/[slug]`                                 |
| Plural breadcrumb           | `Tags`                                         |
| Singular breadcrumb         | `Tag`                                          |
| Slug source                 | `tagName`                                      |
| Grouping rule               | None (single flat list)                        |

## Phase-6 deviations from the small-entity template

- The DTO has only two interesting fields (`tagName`, `description`). The minimal small-entity template applies cleanly.
- **Items currently capture `tags: SnapshotRef[]`** (Slice 1, `mod/src/Entities/Item/Adapters/ExtractItem.cs:97-110`). The item canonicaliser already inserts into `item_tags` (the canonical-table-name collision is intentional — the existing `item_tags` table is a **join table** between items and tag GUIDs). Phase 6 introduces a NEW `item_tags` table that holds the _tag content_. Rename the existing join table to `item_tag_refs` before adding the new content table.

### Resolving the table-name collision

- [ ] **Step A: Audit the existing `item_tags` table**

Search `pipeline/src/` for `item_tags`. Confirm it is the items↔tag join table; read its DDL.

- [ ] **Step B: Rename to `item_tag_refs`**

In the DDL (`pipeline/src/sql/ddl.ts` or the per-entity canonicaliser), rename `item_tags` to `item_tag_refs`. Update every `INSERT INTO item_tags` and `SELECT ... FROM item_tags` in `pipeline/src/`, the existing tests, and `site/src/lib/server/read-models.ts`.

- [ ] **Step C: Commit the rename in isolation**

```sh
git add pipeline/src/ pipeline/test/ site/src/
git commit -m "refactor(pipeline): rename item_tags join table to item_tag_refs"
```

Once the rename lands, the small-entity template proceeds as written, using `item_tags` (now free) for the content table.

## Tasks

### Task 6.1: Mod DTO + extractor

Apply Tasks 4.1 + 4.2 with:

**`ItemTagSnapshot.cs`:**

```cs
public sealed record ItemTagSnapshot(
    [property: JsonProperty("id")] string Id,
    [property: JsonProperty("tagName")] string TagName,
    [property: JsonProperty("description")] string Description);
```

**`ItemTagExtractor.cs`:** walks `BuiltLookupTable.GetAssetsOfType<ItemTag>()`; emits one row per asset with `tagName ?? asset.name ?? guid` and `description ?? ""`.

Tests: snapshot creation + extractor enumeration + GUID-missing diagnostic, mirroring Phase 4's pattern.

Commit pair:

- `feat(mod): add item-tag snapshot DTO`
- `feat(mod): extract item-tag snapshots`

### Task 6.2: Mod walker registration

Apply Task 4.3 with `entityId = "item-tags"`.

Commit: `feat(mod): emit item-tag artifact alongside items`.

### Task 6.3: Pipeline descriptor + canonicaliser + read-model

Descriptor at `entities/item-tag/entity.json`:

```json
{
  "$schema": "../../schemas/entity.schema.json",
  "id": "item-tag",
  "singularLabel": "Tag",
  "pluralLabel": "Tags",
  "routePath": "/tags",
  "canonicalTable": "item_tags",
  "presentationContext": { "renderContext": "item-tag-presentation-v1" },
  "fields": [
    { "name": "id", "type": "string", "from": "id", "missingPolicy": "fatal" },
    { "name": "tagName", "type": "string", "from": "tagName", "missingPolicy": "fatal" },
    {
      "name": "description",
      "type": "string",
      "from": "description",
      "missingPolicy": "optional-empty"
    }
  ]
}
```

Canonical table DDL:

```sql
CREATE TABLE item_tags (
  id          TEXT PRIMARY KEY,
  tag_name    TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);
```

Read-model tables:

```sql
CREATE TABLE item_tag_overview_rows (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  item_count  INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE item_tag_presentation_rows (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  render_context  TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  item_count      INTEGER NOT NULL DEFAULT 0
);
```

`item_count` is computed by `UPDATE item_tag_overview_rows SET item_count = (SELECT COUNT(*) FROM item_tag_refs WHERE tag_id = item_tag_overview_rows.id)`.

`entity_nodes` insertion follows the small-entity template.

Commits:

- `feat(pipeline): add item-tag entity descriptor`
- `feat(pipeline): canonicalise item-tag snapshots`
- `feat(pipeline): emit item-tag read models`

### Task 6.4: Fixture rows

`fixtures/synthetic/snapshot/item-tags.json`:

```json
{
  "entityId": "item-tag",
  "schemaVersion": 1,
  "rows": [
    {
      "id": "fixture-tag-valuable-remedy",
      "tagName": "Valuable remedy",
      "description": "Incredibly valuable remedy"
    },
    { "id": "fixture-tag-rare", "tagName": "Rare", "description": "Difficult to find." }
  ],
  "diagnostics": []
}
```

Update items in the existing fixture to reference these new tag ids where appropriate (e.g. `fixture-stamina-draught` already has tag refs; ensure they match these new tag ids).

Refresh fixture hashes.

Commit: `test(pipeline): add item-tag fixture rows`.

### Task 6.5: Site overview + detail routes

Apply Task 4.8's pattern:

- `/tags` lists every tag with the description (truncated to one line on the overview).
- `/tags/[slug]` shows the full description + a `listItemsByTag(tagId)` query result (a new accessor that joins `item_tag_refs` and `item_overview_rows`).

Commit: `feat(site): render item-tag pages`.

### Task 6.6: Phase 6 verification gate

- [ ] Run the full phase gate.
- [ ] Visit `/tags` and `/tags/valuable-remedy--<id8>`; confirm content.
- [ ] Visit the existing `/items` detail page for a tagged item (e.g. the fixture stamina draught) and confirm tag rows now resolve to clickable links (links are still `/tags/<slug>` — items themselves don't link to tags yet; Phase 15 wires items → tag edges in the graph).
- [ ] Update coordinator phase index row 6 status to ✅.

---

## Checkpoint 2: end of "small entities" group

After Phase 6, **stop and review** before opening Phase 7.

You have now:

- The slug + redirect machinery (Phase 2).
- Three public entities live (stat-type, item-category, item-tag).
- Icon tinting fixed (Phase 5.8.1).
- The small-entity template proven against three entities, so Phase 13 (potion-recipe) will copy the same template cheaply.

Push the commits if appropriate. Confirm the live release of these foundations matches expectations (item icons now tinted; new `/stats`, `/categories`, `/tags` pages indexed and crawlable).

The remaining phases (7–17) build the composer port and the three big tooltip-driving entities (status-effect, spell, enchantment) on top.

---

[← Previous phase](05-item-category.md) · [Next phase →](07-effect-serializer.md) · [Coordinator](../2026-05-20-items-presentation-closure.md)
