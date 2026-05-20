[← Previous phase](04-stat-type.md) · [Next phase →](06-item-tag.md) · [Coordinator](../2026-05-20-items-presentation-closure.md)

# Phase 5: `item-category` entity

**Spec coverage:** §3.2, §6.5 (icon tint).

**Why fifth:** `ItemCategory` is the source of `categoryColor` (the icon tint that the site currently drops) AND of `defaultItemIcon` (icon fallback for items without their own icon). Once it's a public entity, items can resolve their category-derived tint deterministically — which is the dependency Phase 14's item re-extraction needs. The category page also exposes the `columns: CategoryColumn[]` shape that informs Phase 5's overview table layout.

**Outcome:** every `ItemCategory` asset is exported with name, icon, `categoryColor`, `defaultItemIcon`, columns, and `showInAllCategory`; public `/categories` + `/categories/[slug]` pages list items per category; `item_categories` canonical table drives the existing items' `displayIconColor` capture path (already in place since Slice 3) plus the new `defaultItemIcon` fallback.

## Template instantiation

Phase 5 instantiates the **small-entity template** defined in [04-stat-type.md](04-stat-type.md) with the following inputs:

| Template parameter          | Phase 5 value                                            |
| --------------------------- | -------------------------------------------------------- |
| Entity id                   | `item-category`                                          |
| Plural id                   | `item-categories`                                        |
| Asset C# type               | `Ardenfall.ItemCategory`                                 |
| Mod namespace               | `ArdenfallCompendium.Entities.ItemCategory`              |
| Adapter file                | `mod/src/Entities/ItemCategory/ItemCategoryExtractor.cs` |
| Snapshot DTO file           | `mod/src/Entities/ItemCategory/ItemCategorySnapshot.cs`  |
| Snapshot envelope           | `fixtures/synthetic/snapshot/item-categories.json`       |
| Pipeline canonical table    | `item_categories`                                        |
| Pipeline overview table     | `item_category_overview_rows`                            |
| Pipeline presentation table | `item_category_presentation_rows`                        |
| Render context              | `item-category-presentation-v1`                          |
| Site overview route         | `/categories`                                            |
| Site detail route           | `/categories/[slug]`                                     |
| Plural breadcrumb           | `Categories`                                             |
| Singular breadcrumb         | `Category`                                               |
| Slug source                 | `categoryName`                                           |
| Grouping rule               | None (single flat list, sorted by `categoryName`)        |

## Phase-5-specific deviations from the Phase 4 template

The base template covers most of the work. Phase 5 adds these specifics:

- **DTO carries `columns: List<ItemCategoryColumnSnapshot>`**. Each column is a structured record. Phase 5 does not yet _render_ the columns (they're metadata for future category-specific tables — Slice 10 will use them); Phase 5 just captures them so we don't re-extract later.
- **Category color JSON** is `iconColor`'s analogue, stored as `category_color_json` to avoid colliding with `iconColor` semantics. The site passes this raw color JSON into `ItemIcon` for deterministic tinting.
- **`default_item_icon_hash`** is a separate column in `item_categories` and the read-model; the site overview surfaces this fallback for categories that have a default icon defined but no entry-specific icon.
- **Cross-link**: each item's `categoryRef` (already captured in Slice 1) becomes an `entity_nodes` lookup hit. Phase 15 emits the `item.belongs_to_category` edges; Phase 5 only stores the link target.

## Tasks

### Task 5.1: Mod DTO — `ItemCategorySnapshot`

**Files:**

- Create: `mod/src/Entities/ItemCategory/ItemCategorySnapshot.cs`
- Create: `mod/src/Entities/ItemCategory/ItemCategoryColumnSnapshot.cs`
- Test: `mod-tests/ItemCategorySnapshotTests.cs`

- [ ] **Step 1: Write the failing test**

```cs
// mod-tests/ItemCategorySnapshotTests.cs
using System.Collections.Generic;
using ArdenfallCompendium.Entities.ItemCategory;
using ArdenfallCompendium.Dtos;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class ItemCategorySnapshotTests
{
    [Fact]
    public void RecordCarriesIconColorAndColumns()
    {
        var snapshot = new ItemCategorySnapshot(
            Id: "category-weapons",
            CategoryName: "Weapons",
            IconRef: null,
            DefaultItemIconRef: null,
            CategoryColor: new AssetColorSnapshot { R = 0.9f, G = 0.2f, B = 0.2f, A = 1f },
            ShowInAllCategory: true,
            Columns: new List<ItemCategoryColumnSnapshot>
            {
                new(
                    Label: "Name",
                    IconRef: null,
                    PreferedWidth: 1.5f,
                    FlexibleWidth: 2.0f,
                    IsItemName: true,
                    IsItemIconAndCategory: true,
                    IsItemValue: false,
                    IsAffectedBySkillRequirement: false,
                    IsAffectedByBrokenDurability: false,
                    AffectingRedColor: true,
                    AffectingIconsAfter: false,
                    HideIfNegativeOne: false,
                    Alignment: "MiddleLeft",
                    ItemDataField: null,
                    ItemFunctionField: null),
            });

        Assert.Equal("category-weapons", snapshot.Id);
        Assert.Single(snapshot.Columns);
        Assert.Equal("Name", snapshot.Columns[0].Label);
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `dotnet test mod-tests/ArdenfallCompendium.Tests.csproj --filter ItemCategorySnapshotTests`
Expected: FAIL.

- [ ] **Step 3: Implement the column DTO**

```cs
// mod/src/Entities/ItemCategory/ItemCategoryColumnSnapshot.cs
using ArdenfallCompendium.Dtos;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Entities.ItemCategory;

public sealed record ItemCategoryColumnSnapshot(
    [property: JsonProperty("label")] string? Label,
    [property: JsonProperty("iconRef")] SnapshotRef? IconRef,
    [property: JsonProperty("preferedWidth")] float PreferedWidth,
    [property: JsonProperty("flexibleWidth")] float FlexibleWidth,
    [property: JsonProperty("itemName")] bool IsItemName,
    [property: JsonProperty("isItemIconAndCategory")] bool IsItemIconAndCategory,
    [property: JsonProperty("itemValue")] bool IsItemValue,
    [property: JsonProperty("isAffectedBySkillRequirement")] bool IsAffectedBySkillRequirement,
    [property: JsonProperty("isAffectedByBrokenDurability")] bool IsAffectedByBrokenDurability,
    [property: JsonProperty("affectingRedColor")] bool AffectingRedColor,
    [property: JsonProperty("affectingIconsAfter")] bool AffectingIconsAfter,
    [property: JsonProperty("hideIfNegativeOne")] bool HideIfNegativeOne,
    [property: JsonProperty("alignment")] string Alignment,
    [property: JsonProperty("itemDataField")] string? ItemDataField,
    [property: JsonProperty("itemFunctionField")] string? ItemFunctionField);
```

- [ ] **Step 4: Implement the category DTO**

```cs
// mod/src/Entities/ItemCategory/ItemCategorySnapshot.cs
using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Entities.ItemCategory;

public sealed record ItemCategorySnapshot(
    [property: JsonProperty("id")] string Id,
    [property: JsonProperty("categoryName")] string CategoryName,
    [property: JsonProperty("iconRef")] object? IconRef,
    [property: JsonProperty("defaultItemIconRef")] object? DefaultItemIconRef,
    [property: JsonProperty("categoryColor")] AssetColorSnapshot CategoryColor,
    [property: JsonProperty("showInAllCategory")] bool ShowInAllCategory,
    [property: JsonProperty("columns")] List<ItemCategoryColumnSnapshot> Columns);
```

- [ ] **Step 5: Run to verify it passes**

Run: `dotnet test mod-tests/ArdenfallCompendium.Tests.csproj --filter ItemCategorySnapshotTests`
Expected: PASS.

- [ ] **Step 6: Commit**

```sh
git add mod/src/Entities/ItemCategory/ mod-tests/ItemCategorySnapshotTests.cs
git commit -m "feat(mod): add item-category snapshot DTOs"
```

### Task 5.2: Mod extractor — `ItemCategoryExtractor`

Apply Task 4.2's pattern with these inputs:

- Walks `BuiltLookupTable.GetAssetsOfType<ItemCategory>()`.
- For each asset, reads `categoryName`, `icon`, `defaultItemIcon`, `categoryColor`, `showInAllCategory`, `columns`.
- Maps `columns` via the field list above; the `alignment` field is the `TextAlignmentOptions` enum stringified.

The extractor file is `mod/src/Entities/ItemCategory/ItemCategoryExtractor.cs`; the asset-source abstraction is `IItemCategoryAssetSource` with concrete `BuiltLookupTableItemCategoryAssetSource`.

Tests (`mod-tests/ItemCategoryExtractorTests.cs`) mirror Task 4.2's tests with category fixtures.

Commit: `feat(mod): extract item-category snapshots`.

### Task 5.3: Mod walker registration

Register the walker so the snapshot envelope's `entityId` remains `item-category` while the artifact filename lands as `item-categories.json`.

Commit: `feat(mod): emit item-category artifact alongside items`.

### Task 5.4: Pipeline descriptor

Create `entities/item-category/entity.json`:

```json
{
  "$schema": "../../schemas/entity.schema.json",
  "id": "item-category",
  "label": { "singular": "Category", "plural": "Categories" },
  "extraction": {
    "root": "BuiltLookupTable.GetAssetsOfType<ItemCategory>",
    "walker": "ItemCategoryExtractor"
  },
  "presentationContext": { "renderContext": "item-category-presentation-v1" },
  "fields": [
    { "name": "id", "type": "id", "from": "id", "missingPolicy": "fatal" },
    { "name": "categoryName", "type": "string", "from": "categoryName", "missingPolicy": "fatal" },
    {
      "name": "iconRef",
      "type": "ref:asset",
      "from": "iconRef",
      "missingPolicy": "optional-empty"
    },
    {
      "name": "defaultItemIconRef",
      "type": "ref:asset",
      "from": "defaultItemIconRef",
      "missingPolicy": "optional-empty"
    },
    { "name": "categoryColor", "type": "json", "from": "categoryColor", "missingPolicy": "fatal" },
    {
      "name": "showInAllCategory",
      "type": "boolean",
      "from": "showInAllCategory",
      "missingPolicy": "fatal"
    },
    { "name": "columns", "type": "json", "from": "columns", "missingPolicy": "optional-empty" }
  ],
  "map": null
}
```

Commit: `feat(pipeline): add item-category entity descriptor`.

### Task 5.5: Pipeline canonicaliser

Create `pipeline/src/sql/item-category-ddl.ts`:

```ts
export const ITEM_CATEGORY_DDL = `
CREATE TABLE item_categories (
  id                         TEXT PRIMARY KEY,
  category_name              TEXT NOT NULL,
  icon_ref_json              TEXT,
  default_item_icon_ref_json TEXT,
  category_color_json        TEXT NOT NULL,
  show_in_all_category       INTEGER NOT NULL,
  columns_json               TEXT NOT NULL DEFAULT '[]'
);
`;
```

Create `pipeline/src/entities/item-category/canonicaliser.ts` mirroring Task 4.5 with the column set above.

Wire into `emit-sqlite.ts` after the stat-types canonicaliser.

Tests in `pipeline/test/item-category-canonicaliser.test.ts` mirror Task 4.5's tests with a category fixture row.

Commit: `feat(pipeline): canonicalise item-category snapshots`.

### Task 5.6: Pipeline read-model + `entity_nodes` population

Apply Task 4.6's pattern with these column lists:

```ts
CREATE TABLE item_category_overview_rows (
  id                       TEXT PRIMARY KEY,
  name                     TEXT NOT NULL,
  icon_hash                TEXT,
  default_item_icon_hash   TEXT,
  category_color_json      TEXT NOT NULL,
  item_count               INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE item_category_presentation_rows (
  id                       TEXT PRIMARY KEY,
  name                     TEXT NOT NULL,
  render_context           TEXT NOT NULL,
  icon_hash                TEXT,
  default_item_icon_hash   TEXT,
  category_color_json      TEXT NOT NULL,
  show_in_all_category     INTEGER NOT NULL,
  columns_json             TEXT NOT NULL,
  item_count               INTEGER NOT NULL DEFAULT 0
);
```

`item_count` is populated via:

```sql
UPDATE item_category_overview_rows SET item_count = (
  SELECT COUNT(*)
  FROM items
  WHERE json_extract(items."categoryRef", '$.guid') = item_category_overview_rows.id
);
```

The existing `items` table stores `categoryRef` as the source lookup-ref JSON, so the read-model joins/extracts `$.guid` rather than inventing a `category_ref_id` column.

`entity_nodes` insertion uses `deriveSlug({displayName: categoryName, assetId: id})`.

Tests in `pipeline/test/read-models.test.ts` extend the existing test or add a new one with a category fixture row + assertion on the populated `item_count`.

Commit: `feat(pipeline): emit item-category read models`.

### Task 5.7: Fixture rows

Create `fixtures/synthetic/snapshot/item-categories.json`:

```json
{
  "entityId": "item-category",
  "schemaVersion": 1,
  "rows": [
    {
      "id": "fixture-weapons",
      "categoryName": "Weapons",
      "iconRef": null,
      "defaultItemIconRef": null,
      "categoryColor": { "r": 0.92, "g": 0.42, "b": 0.42, "a": 1 },
      "showInAllCategory": true,
      "columns": [
        {
          "label": "Name",
          "iconRef": null,
          "preferedWidth": 1.5,
          "flexibleWidth": 2,
          "itemName": true,
          "isItemIconAndCategory": true,
          "itemValue": false,
          "isAffectedBySkillRequirement": false,
          "isAffectedByBrokenDurability": false,
          "affectingRedColor": false,
          "affectingIconsAfter": false,
          "hideIfNegativeOne": false,
          "alignment": "MiddleLeft",
          "itemDataField": null,
          "itemFunctionField": null
        }
      ]
    }
  ],
  "diagnostics": []
}
```

Refresh fixture hashes (same script as Task 4.7).

Commit: `test(pipeline): add item-category fixture rows`.

### Task 5.8: Site overview + detail routes + icon tint hook

**Files:**

- Create: `site/src/routes/categories/+page.server.ts`, `+page.svelte`
- Create: `site/src/routes/categories/[slug]/+page.server.ts`, `+page.svelte`
- Create: `site/src/lib/components/categories/ItemCategoryOverview.svelte`, `ItemCategoryDetail.svelte`
- Modify: `site/src/lib/server/read-models.ts` (add `listItemCategories`, `getItemCategoryPresentation`)
- Modify: `site/src/lib/components/items/ItemIcon.svelte` to apply the `displayIconColor` tint (this is the local-defect fix from spec §4.8 that has been waiting since Slice 4)

The overview, detail, and read-model accessors follow Task 4.8's pattern with categories instead of stats.

#### Sub-task 5.8.1: Apply `displayIconColor` tint to `ItemIcon`

This is the local site fix the user explicitly called out. The data is already on every item row; only the renderer change is missing.

- [ ] **Step 1: Write the failing site test**

```ts
// site/src/lib/components/items/ItemIcon.test.ts
import { describe, expect, it } from "bun:test";
import { render } from "svelte/server";
import ItemIcon from "$lib/components/items/ItemIcon.svelte";

describe("ItemIcon tinting", () => {
  it("applies displayIconColor via background-color + mix-blend-mode", () => {
    const html = render(ItemIcon, {
      props: {
        src: "/assets/abc.webp",
        alt: "",
        size: "md",
        displayIconColor: JSON.stringify({ r: 0.5, g: 0.8, b: 0.2, a: 1 }),
      },
    }).body;
    expect(html).toContain("background-color");
    expect(html).toContain("mix-blend-mode: multiply");
  });

  it("does not apply tint when displayIconColor is null", () => {
    const html = render(ItemIcon, {
      props: { src: "/assets/abc.webp", alt: "", size: "md", displayIconColor: null },
    }).body;
    expect(html).not.toContain("mix-blend-mode: multiply");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun --cwd site test src/lib/components/items/ItemIcon.test.ts`
Expected: FAIL.

- [ ] **Step 3: Update `ItemIcon.svelte`**

```svelte
<script lang="ts">
  let {
    src,
    alt = "",
    size = "md",
    displayIconColor = null,
  }: {
    src: string | null;
    alt?: string;
    size?: "sm" | "md" | "lg";
    displayIconColor?: string | null;
  } = $props();

  const shell = { sm: "size-8", md: "size-12", lg: "size-16" };
  const image = { sm: "size-6", md: "size-10", lg: "size-14" };

  function tint(jsonColor: string | null): string | null {
    if (!jsonColor) return null;
    try {
      const c = JSON.parse(jsonColor) as { r: number; g: number; b: number; a: number };
      const toHex = (n: number) =>
        Math.round(Math.max(0, Math.min(1, n)) * 255)
          .toString(16)
          .padStart(2, "0");
      return `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`;
    } catch {
      return null;
    }
  }

  const tintHex = tint(displayIconColor);
  const isWhite = tintHex === "#ffffff";
</script>

<span
  class={`item-icon bg-muted border-border flex shrink-0 items-center justify-center rounded border ${shell[size]}`}
  aria-hidden={alt.length === 0}
>
  {#if src}
    {#if tintHex && !isWhite}
      <span
        class={`relative ${image[size]}`}
        style:background-color={tintHex}
        style:mask-image={`url(${src})`}
        style:-webkit-mask-image={`url(${src})`}
        style:mask-size="contain"
        style:-webkit-mask-size="contain"
        style:mask-repeat="no-repeat"
        style:-webkit-mask-repeat="no-repeat"
        style:mask-position="center"
        style:-webkit-mask-position="center"
        aria-hidden="true"
      ></span>
    {:else}
      <img class={`object-contain ${image[size]}`} {src} {alt} loading="lazy" decoding="async" />
    {/if}
  {/if}
</span>
```

The mask-image approach is the documented modern primitive ([MDN: `mask-image`](https://developer.mozilla.org/en-US/docs/Web/CSS/mask-image)); for already-coloured sprites, the equivalent fallback is `mix-blend-mode: multiply` over the bitmap, which the older Slice-4 code path retains for `tintHex === "#ffffff"` — kept as the `<img>` branch above.

- [ ] **Step 4: Run the test**

Run: `bun --cwd site test src/lib/components/items/ItemIcon.test.ts`
Expected: PASS.

- [ ] **Step 5: Audit callers**

Search the site for `<ItemIcon` and confirm every callsite that has `displayIconColor` available passes it. Item overview rows + tooltip cards + detail-page headers already carry `displayIconColor` in their data (Slice 4) — add the prop.

- [ ] **Step 6: Commit**

```sh
git add site/src/lib/components/items/ItemIcon.svelte site/src/lib/components/items/ItemIcon.test.ts
git commit -m "fix(site): tint item icons by displayIconColor"
```

#### Sub-task 5.8.2: Category overview + detail pages

Apply Task 4.8's template with these slugs:

- `/categories` lists every row of `item_category_overview_rows` sorted by `name`, showing the category icon (tinted by `category_color_json`) + name + `item_count`.
- `/categories/[slug]` renders the presentation row + lists every item in the category (`listItemsByCategory(categoryId)` — a new read-model accessor that joins `item_overview_rows` to `items` and filters `json_extract(items."categoryRef", '$.guid') = ?`).

Code blocks follow Task 4.8's shape with categories. The detail page links each item via `/items/<id>` until the item route cutover happens in Phase 16.

Commit: `feat(site): render item-category pages`.

### Task 5.9: Phase 5 verification gate

- [ ] Run the full phase gate.
- [ ] Visit `/categories` and `/categories/weapons--<id8>` in the fixture build; confirm content.
- [ ] Confirm the existing `/items` overview now shows tinted icons (regression check against your earlier screenshots).
- [ ] Update coordinator phase index row 5 status to ✅.

---

[← Previous phase](04-stat-type.md) · [Next phase →](06-item-tag.md) · [Coordinator](../2026-05-20-items-presentation-closure.md)
