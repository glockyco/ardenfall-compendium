---
title: "Slice 3 Item Icon Asset Design"
type: spec
status: implemented
created: 2026-05-14
parent:
superseded_by:
archived: 2026-06-25
---

# Slice 3 Item Icon Asset Design

**Date:** 2026-05-14  
**Status:** Approved design direction; awaiting written-spec review before implementation planning  
**Game version:** Ardenfall Demo `0.0.10.91`  
**Companion audit:** `docs/superpowers/specs/2026-05-14-item-icon-tooltip-audit.md`

## Purpose

Slice 3 makes item icons real, behavior-derived, and automatically deployable end to end. It replaces the current raw-asset-reference dead end with a first-class asset export and pipeline contract:

1. the mod exports cropped sprite pixels and a slot manifest;
2. the pipeline converts those assets into a generated deploy bundle;
3. SQLite records stable asset references and item read models expose display-ready icon data;
4. the site renders item icons on `/items` and `/items/[id]` without manual asset copying.

Rich tooltip rendering remains Slice 4. Slice 3 may preserve data needed by future tooltip or inventory parity, but it does not add hover cards, tooltip markup, item stat comparison UI, or secondary icon overlays.

## Live baseline

Slice 2 live extraction against `snapshots/snapshots/0.0.10.91-20260514-1621097145580` established this baseline:

| Fact                                       |  Value |
| ------------------------------------------ | -----: |
| Item count                                 | `1273` |
| `lookupAssetGuidMissing:iconRef`           | `1271` |
| `nullAsset:iconRef`                        |    `2` |
| `lookupAssetGuidMissing:quickslotIconRef`  |  `127` |
| `lookupAssetGuidMissing:projectileIconRef` |   `15` |
| `lookupAssetGuidMissing:categoryRef`       | `1268` |
| `lookupAssetGuidMissing:spellRef`          |  `286` |

The old plan of repairing display icons by lookup GUID is not viable as the primary path. Almost every raw item icon reference is unresolved through the lookup table. Slice 3 must export the sprite pixels the game behavior selects at runtime and identify them by content hash.

## Reviewed concerns

The design was audited in four domains before this spec was written:

- game/mod icon behavior;
- pipeline asset and read-model contract;
- site icon rendering UX;
- CI/deploy automation.

The audits agreed on the main direction but required four hardening changes before implementation planning:

1. asset handoff must be a first-class generated bundle, not another manual copy path;
2. image conversion must be pinned and deterministic, not dependent on ambient host tools;
3. icon slots and colors must match exact game behavior, including secondary icon slots;
4. the site must render icons through typed store fields and a minimal table extension, not by smuggling hash fields into ordinary sortable columns.

## Mod export contract

### Source of truth

The mod owns behavior-derived icon selection because it is the only layer already walking live Ardenfall runtime objects. The pipeline must not reconstruct display icon precedence from raw refs.

For each extracted item, the mod emits behavior-selected asset slots:

| Slot            | Required in Slice 3                            | Rendered by site in Slice 3 | Meaning                                                                                                                   |
| --------------- | ---------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `displayIcon`   | Yes                                            | Yes                         | Primary icon shown by item overview/detail pages.                                                                         |
| `secondaryIcon` | Yes for `ISecondaryIconItem`; absent otherwise | No                          | Inventory secondary icon used by slate spells and throwing potions. Stored now so future inventory parity is recoverable. |

Bow and throwing-item count/ammunition icons are not rendered or required in Slice 3. The manifest remains slot-based so those can be added later without changing the model.

### Primary icon behavior

The mod computes `displayIcon` from live behavior:

| Item behavior      | `displayIcon` source order                                             |
| ------------------ | ---------------------------------------------------------------------- |
| Base item behavior | `itemData.icon.Get()`, then `itemData.category.Get()?.defaultItemIcon` |
| Slate spell item   | spell icon, then `itemData.icon.Get()`, then category default icon     |
| Throwing potion    | first status-effect icon, then base item fallback                      |

The mod preserves raw/provenance refs separately: `iconRef`, `quickslotIconRef`, `projectileIconRef`, `categoryRef`, spell/status-effect structured data, and diagnostics remain distinct from behavior-derived asset slots.

### Spell and status-effect dependency boundary

Slice 3 does not require full spell or status-effect entity export before item icons. That would invert the current roadmap: items are the active depth track, while full spells are Slice 11 and graph-heavy effect systems remain deferred until a consumer needs their semantics.

Spells and status effects are different Ardenfall domains. `SpellData` owns spell names, spell icons, spell colors, sub-spells, spell-effect graphs, and spell tooltip behavior. `StatusEffectData` owns status-effect icons, colors, levels, lifetimes, stack behavior, and status-effect tooltip behavior used by consumables, throwing potions, item tags, and other systems. They interact through gameplay/effect graphs, but neither is a drop-in representation for the other.

For Slice 3, the long-term-safe boundary is an asset bridge, not a semantic export. The mod is already holding the live `SlateSpellItemData` and `ThrowingPotionData` objects and can ask the same reachable `SpellData` or first `StatusEffectData` object for only the sprite/color values used by item UI. It then stores those pixels as item asset slots plus raw provenance refs/compact DTOs. Later spell or status-effect entity slices can reuse the same asset pipeline and replace the compact semantic DTOs with canonical entities without rewriting the item icon contract.

A full spell/status-effect export should happen before Slice 3 only if implementation proves that icon/color extraction cannot be done without canonicalizing those domains. The current decompiled behavior and Slice 2 item DTOs do not indicate that dependency.

### Color behavior

The mod emits color metadata independently of whether an icon asset exists. Slice 3 stores this metadata but the site does not tint icons.

The exact color rules are:

| Item behavior      | `displayIconColor` rule               |
| ------------------ | ------------------------------------- |
| Base item behavior | category color, else white            |
| Slate spell item   | spell color, else white               |
| Throwing potion    | first status-effect color, else white |

Slate spell and throwing potion colors do not fall back to category color when their override color is absent. That distinction is part of the Slice 3 contract because future presentation work must not infer the wrong game semantics.

For `ISecondaryIconItem` variants, the mod also emits `secondaryIconColor` from the behavior used by the inventory UI, including `quickslotSecondaryColor.Get()` for slate spells and throwing potions.

### Asset files and manifest

The mod writes cropped sprite PNGs into the snapshot asset tree and writes a sidecar manifest that maps item rows and slots to source PNG hashes.

The manifest is first-class snapshot output. It is not encoded only as incidental JSON fields in item rows. The pipeline uses it to populate `asset_refs` and to validate missing/available asset files.

Each asset entry records at least:

| Field        | Meaning                                             |
| ------------ | --------------------------------------------------- |
| `entityId`   | `item` for Slice 3 item icon assets.                |
| `rowId`      | The stable item row id used by canonical item data. |
| `slot`       | `displayIcon` or `secondaryIcon`.                   |
| `kind`       | `image`.                                            |
| `pngHash`    | Content hash of the cropped PNG.                    |
| `sourcePath` | Snapshot-relative path to the PNG.                  |

The implementation plan may choose exact JSON shape, but it must preserve these semantics and be validated by tests.

### Sprite cropping and hashing

The mod hashes and encodes the logical sprite crop, not the whole backing texture. Atlas sprites must be cropped by sprite rect/texture rect before hashing or encoding. Two different sprites on one atlas must not collapse to the same asset because they share a `Texture2D`, and identical cropped pixels should deduplicate to the same content hash.

## Pipeline contract

### Generated deploy bundle

`pipeline:run <snapshot> <outDir>` produces a complete generated deploy bundle under `outDir`:

```text
<outDir>/
  data.sqlite
  assets/
    <asset-hash>.webp
```

For the standard local and CI path, `<outDir>` is `pipeline/dist`.

The pipeline must not write generated artifacts directly into `site/static`. The site build syncs from `pipeline/dist` so local deploy, CI, and production deploy exercise the same path.

### Asset stage

Slice 3 adds an explicit pipeline asset-emission stage. Its responsibilities are:

1. read the snapshot asset manifest and PNG files;
2. verify every referenced PNG exists and is non-empty;
3. convert each unique PNG to WebP;
4. write converted assets under `<outDir>/assets/<hash>.webp`;
5. provide asset-reference rows for SQLite emission.

The pipeline computes the deploy `asset_hash` from the emitted WebP bytes. The mod manifest's `pngHash` is source provenance and deduplication input, but SQLite `asset_refs` and site read models point to the final WebP hash because that is the file the browser loads.

Conversion belongs in the pipeline, not in the SvelteKit build. Site build must copy generated artifacts only; it must not decode, transform, hash, or discover source PNGs.

### Converter decision

Use `sharp` as the single direct, pinned dependency of the pipeline workspace for PNG-to-WebP conversion. Before wiring the full asset stage, implementation must include the existing Slice 1 spike: run `sharp(testPng).webp().toBuffer()` under Bun and assert the output is a valid WebP.

If that spike fails, Slice 3 stops at the planning gate and the converter decision is reopened in a new design revision. The implementation must not include a maintained `cwebp` fallback path, silently use transitive dependencies, or inspect host-installed tools. One canonical converter path is cheaper to test, deploy, and maintain.

### SQLite asset links

Keep `asset_refs` narrow. Its current identity columns are sufficient for Slice 3:

```sql
CREATE TABLE asset_refs (
  entity_id        TEXT NOT NULL,
  entity_row_id    TEXT NOT NULL,
  slot             TEXT NOT NULL,
  asset_kind       TEXT NOT NULL,
  asset_hash       TEXT NOT NULL,
  PRIMARY KEY (entity_id, entity_row_id, slot)
);
```

Do not add URLs, image dimensions, or colors to `asset_refs`. Those are separate concerns:

- URLs are derivable by the site from an asset hash;
- dimensions are not required by Slice 3 rendering;
- colors belong in item display/read-model metadata.

### Item read models

Item read models expose display-ready icon fields, not raw refs and not hard-coded URLs.

The overview/detail read models should include at least:

| Column               | Meaning                                               |
| -------------------- | ----------------------------------------------------- |
| `display_icon_hash`  | Nullable WebP asset hash for `displayIcon`.           |
| `display_icon_color` | Nullable or defaulted serialized RGBA color metadata. |

The site store converts `display_icon_hash` into a browser path such as `/assets/<hash>.webp`. Svelte page components must not reconstruct asset paths from raw SQLite tables themselves.

Secondary icon hashes may be present in `asset_refs` without appearing in Slice 3 page read models. They are preserved for future UI parity but are not rendered yet.

### Descriptor and metadata surface

The icon surface must be explicit in descriptor-derived site metadata. The implementation may use either:

1. a renderer/media-capable shape in `site.overview.columns`; or
2. an equivalent emitted site-metadata structure declaring the overview/detail icon surface.

It must not rely on undocumented extra columns in `item_overview_rows` that only the Svelte pages know about. The descriptor remains the cross-subsystem source of truth for entity presentation shape.

Behavior-derived display icon data should not be added as ordinary canonical gameplay fields unless the project first adds a real computed-field/denormalization mechanism. For Slice 3, prefer generated read-model projection plus `asset_refs`.

## Site rendering contract

### Store boundary

`site/src/lib/store/items.ts` exposes typed nullable icon fields, for example:

```ts
interface ItemOverviewRow {
  id: string;
  name: string;
  weight: number | null;
  value: number | null;
  variant: string;
  displayIconSrc: string | null;
}
```

Exact TypeScript names can differ, but the boundary is fixed: page components consume typed store fields. They do not parse `fields_json`, inspect `asset_refs`, or construct paths from hash columns directly.

### Overview table

The `/items` page renders a primary icon beside the item name while preserving existing table behavior:

- item name remains the linked accessible text;
- sorting for the name column still sorts by item name;
- an icon-only cell, if used, is unsortable;
- the icon is decorative because the item name is already visible.

`EntityTable` needs a minimal cell-render extension or equivalent small extension point. Replacing the item overview with a bespoke table is unnecessary, and adding `displayIcon` as an ordinary first sortable column is wrong because it would make the icon the linked first column and sort by hash/path data.

### Detail header

The `/items/[id]` page renders the primary icon in a small fixed-size media block in the header near the item name and variant. The icon is not modeled as a `fieldList`, `custom` section, or tooltip renderer.

### Missing icons and accessibility

Missing icons render as a fixed-size neutral placeholder in the same box used by real icons. The placeholder prevents layout shift and avoids broken-image browser chrome.

Real icons and placeholders are decorative in Slice 3:

- use empty `alt` text or `aria-hidden="true"`;
- do not announce fallback tier, GUIDs, hashes, or asset state;
- do not add `title` attributes.

### No tooltip creep

Slice 3 adds no hover cards, popovers, rich text rendering, tooltip shells, secondary icon overlays, ammo/count overlays, or icon-driven custom sections. Those belong to Slice 4 or later presentation slices.

## Site/deploy automation

### Generated artifact sync

Replace or generalize the current SQLite-only sync into one site prebuild sync that mirrors generated deploy artifacts from `pipeline/dist` into `site/static`:

```text
pipeline/dist/data.sqlite      -> site/static/data.sqlite
pipeline/dist/assets/<hash>.webp -> site/static/assets/<hash>.webp
```

The sync should reconcile the managed generated subtree, including pruning stale generated assets under `site/static/assets` so local and CI builds do not hide stale-file bugs. It must reject missing or empty required sources.

`site/package.json` keeps the production deploy shape: `cf-deploy` delegates to `build`, and `build` runs the generated-artifact sync before `vite build`.

### CI contract

CI must exercise the same path as production deploy:

1. generate synthetic snapshot output into `pipeline/dist`;
2. run the site build, which syncs generated artifacts from `pipeline/dist` into `site/static`;
3. execute tooling contract tests that assert this path does not drift.

CI path filters must include site and deploy-tooling changes so site-only sync/build changes cannot skip the site job. The existing `tooling.test.ts` contract coverage must run in CI.

## Testing requirements

Implementation planning must use TDD. Tests should be introduced before the implementation they lock.

### Mod/export tests

- Base item fixture with null `itemData.icon`, present category default icon and category color, asserting `displayIcon` and base color fallback.
- Base item fixture with no icon and no category default, asserting no asset row and deterministic color fallback.
- Slate spell fixture with spell icon/color, raw item icon, category default, and quickslot secondary color, asserting primary slot, secondary slot, and white fallback when spell color is absent.
- Throwing potion fixture with first status-effect icon/color and with empty/null area-of-effect data, asserting primary icon fallback, white color fallback, and secondary slot emission.
- Atlas sprite fixture with two sprite rects on one texture and duplicate cropped pixels, asserting crop-by-rect hashing and deduplication by cropped pixels.

### Pipeline tests

- Asset stage fixture with referenced PNGs, duplicate content, missing optional slots, and one invalid reference, asserting deterministic WebP emission and no dangling `asset_refs`.
- `asset_refs` contract test for base icon, category fallback icon, slate spell override, throwing-potion override, secondary icon, and missing icon.
- Read-model test asserting overview/detail rows expose display icon hash and color but not URLs or image dimensions.
- Site-metadata test asserting the icon-bearing overview/detail presentation surface is declared explicitly.
- End-to-end test asserting `pipeline:run` emits `data.sqlite` plus `assets/` under the requested output directory and never writes to `site/static`.

### Site tests/checks

- Store contract test asserting present icon hashes become stable browser-ready `displayIconSrc` values and missing icons become `null`.
- Overview rendering test or smoke check asserting the item name remains the linked accessible text and sorting does not use asset hash/path values.
- Detail rendering smoke check asserting the icon container and placeholder branch render without tooltip/popover/title behavior.
- Accessibility check asserting decorative icons use empty-alt/hidden semantics and placeholders do not add duplicate announcements.
- `bun run --cwd site check` after the Svelte changes are wired.

### Automation tests

- Sync-helper tests for copying `data.sqlite` plus nested assets, rejecting missing/empty sources, and pruning stale managed assets.
- Converter spike/test proving the selected pinned converter produces a valid WebP and fails loudly when unavailable.
- Tooling contract tests asserting:
  - `build` runs generated-artifact sync before `vite build`;
  - `cf-deploy` delegates to `build`;
  - CI generates into `pipeline/dist`, not `site/static`;
  - CI executes the tooling contract tests;
  - site and deploy-tooling changes trigger the site build.

## Non-goals

Slice 3 does not deliver:

- rich item tooltip reconstruction;
- Unity/TMP rich-text sanitization;
- hover cards, popovers, or `title` tooltips;
- spell entity extraction beyond direct slate-spell icon behavior required for item display;
- full status-effect entity extraction beyond direct throwing-potion icon/color behavior required for item display;
- category entity pages or broad category asset presentation;
- raw GUID lookup repair as the primary icon strategy;
- site-side image conversion;
- manual deploy steps;
- rendered secondary icons, ammo/count icons, or inventory parity UI.

## Rejected alternatives

### Repair raw lookup refs first

Rejected because Slice 2 live diagnostics show `1271` missing raw icon lookups out of `1273` items. Even if some lookup repair is useful later for provenance, it is the wrong primary path for visible item icons. The game already selects live sprite objects; exporting their pixels is more direct and more behavior-exact.

### Placeholder-only site icons

Rejected because it would create the site rendering surface without proving the asset pipeline, deploy contract, crop/hash behavior, or SQLite links. That would defer the hard work and risk another manual deployment gap.

### Site-side conversion or discovery

Rejected because deploys must stay automated and deterministic. The site build should consume a generated bundle, not discover source snapshot PNGs or run image processing. Keeping conversion in the pipeline also makes CI exercise the same deploy artifact shape used in production.

### Widen `asset_refs` for URLs and colors

Rejected because `asset_refs` should remain a normalized link table. URLs are derivable, colors are item display metadata, and dimensions are not needed for Slice 3. Mixing those concerns would make future asset slots harder to reason about.

### Full spell/status-effect export first

Rejected because it expands Slice 3 from item icon assets into graph-heavy content systems before the item asset pipeline exists. The item UI only needs specific reachable sprite/color behavior for slate spells and throwing potions. Exporting those values as item asset slots is not a throwaway hack: it is the same behavior boundary the future spell/status-effect entities will use for their own assets. Full semantic spell extraction remains Slice 11; status-effect extraction should become its own slice when item presentation, spells, or another user-facing feature needs queryable status-effect semantics.

## Acceptance criteria

Slice 3 is complete only when all of the following are true:

1. A live or synthetic extraction can produce item icon PNG assets plus a slot manifest without manual post-processing.
2. `pipeline:run fixtures/synthetic/snapshot pipeline/dist` emits `data.sqlite` and an `assets/` bundle.
3. SQLite contains correct `asset_refs` rows for item `displayIcon` and stored `secondaryIcon` slots.
4. Item overview/detail read models expose nullable primary display icon hash/color data.
5. The site store exposes typed nullable icon sources.
6. `/items` and `/items/[id]` render primary icons or fixed placeholders without tooltip behavior.
7. `bun run --cwd site build` syncs generated SQLite and assets from `pipeline/dist` into `site/static` automatically.
8. CI exercises the same generated-artifact path as deploy.
9. Tests cover mod slot behavior, crop/hash asset emission, pipeline links/read models, site rendering/fallbacks, and automation drift.
10. No raw decompiled bodies are committed.
