---
title: Program Survey
type: audit
status: active
created: 2026-08-02
parent: 2026-04-29-ardenfall-compendium-roadmap
superseded_by:
archived:
---

# Program Survey, 2026-08-02

Five parallel surveys of the whole project: code health, site quality, content coverage, release operations, and external prior art. This records what is true now, so ordering decisions rest on measurement rather than the order things were built in.

**The finding that organises the rest: the architecture is strong and the last mile is broken.** Extraction, canonicalisation, and the descriptor registry all hold up under audit. Almost every serious defect is between the read model and the reader.

## The graph barely connects

| entity | public pages | with an inbound edge |
| --- | ---: | ---: |
| item | 1273 | 0 |
| status-effect | 172 | 0 |
| spell | 56 | 0 |
| location | 34 | 0 |
| item-tag | 28 | 0 |
| portal | 33 | 29 |
| stat-type | 21 | 4 |

1,591 of 1,640 public pages have no inbound edge. All 1,359 edges point outward: `variant_of` 1273, `scales_with` 56, `leads_to` 30. A reader can look up a thing they can already name and cannot ask a single relational question.

Three connective slices are cheap because the data is already extracted:

- **Items to status effects.** 231 references across 212 items, every one carrying `targetId: null`. `ItemPresentationBuilder.cs:178-198` builds the fact from a label string while `ItemAdapterHelpers.cs:117-126` resolves the real `SnapshotRef` two functions away. `ConsumableItemData.statusEffects` and `MeleeItemData.bleedStatusEffect` are the authored sources.
- **Stat types to stat types.** 16 of 28 `affects` labels on stat pages exactly match an existing stat page name, and none of them are links. The labels are already rendered, the targets already exist.
- **Status effects to status effects.** `StatusEffectData.modifyStatusEffects` is a direct authored reference.

## Currently shipping, reader-visible

Verified against the real 1,581-page build with live browser measurement, not the fixture.

| # | defect | evidence |
| --- | --- | --- |
| 1 | `bg-card` emits no CSS, so every card on the site is transparent | `--color-card` absent from `app.css:6-25`, 0 occurrences of `.bg-card` in the built stylesheet, 11 call sites |
| 2 | Map panels draw near-white borders | bare `border` resolves to `currentColor`, computed `oklch(0.95 0.01 260)`, six call sites |
| 3 | Selecting a map marker produces no visible change | `layer-spec.ts:31-70` never reads selection, panel below the fold on mobile with no scroll or focus move |
| 4 | 967 of 1,273 item pages render an empty Description card | `ItemPresentationPanel.svelte:13-18`, 101 pages render nothing else at all |
| 5 | Omission and diagnostic data is emitted and rendered nowhere | 833 rows carry `omissions_json`, 496 carry `diagnostics_json`, zero template usage |
| 6 | Every non-item 404 says an item was not found | `+error.svelte:6-20` string-matches one message across seven routes |
| 7 | `/items` builds 13,823 DOM nodes and 80,065 px of scroll | all 1,273 rows in one document, the only hydrating content route |
| 8 | The 6.86 MB build database is published as a public asset | `db.ts:5` reads it from `static/`, which Cloudflare serves |
| 9 | No sitemap, robots, canonical, or meta description on 1,581 pages | and no site search, so crawlers are the only discovery path |
| 10 | Release provenance is deployed but displayed nowhere | `_release.json` carries game version and snapshot id, no footer exists |

Item 5 is the sharpest. The project's stated principle is to ship gaps honestly, the data to do it exists end to end, and it stops at the template. A silent gap is the opposite of an honest one.

## Release path

**Proven this session.** A release artifact cuts from a live snapshot in 2.9 seconds, and the site prerenders 1,581 pages in 4.5 seconds into 3,304 files and 30 MB. Cloudflare Pages allows 20,000 files and 25 MiB per file, so there is an order of magnitude of headroom. Real-scale prerender had never been exercised before and is no longer a risk.

What is actually wrong is narrower. None of the three previously committed release artifacts is deployable: the newest holds only `assets`, and the two older ones fail staging on `missing required count statTypeOverviewRows` because the count contract moved after they were cut. That is fail-fast working correctly, but it means the only deployable artifact is a fresh one, and nothing published since 2026-06-05.

CI never builds a real release, never deploys, and never runs the production smoke. It gates the synthetic fixture only.

## Content coverage

Unmodelled authored content, all confirmed as ScriptableObject types in the decompiled source. Counts require a live probe, since the cache holds type definitions and not asset instances.

`CharacterData` (NPCs, the largest body of placed content), `QuestData` and `JournalEntryAsset`, `Faction`, `PerkAsset`, `TraitType`, `PotionRecipe`, `ItemListAsset` and its counted and leveled wrappers, `EnchantmentData`, `MerchantCategory`, `FastTravelSetAsset`, `CharClass`.

Partially modelled entities dropping authored payload: `item-tag` drops `FactionItemTag.modifiers`, `stat-type` drops `affects` and `skillAffects` structure, `location` drops `fastTravelPosition` and `volumes`, and the item variants drop most of their combat and equipment fields (`MeleeItemData` damage and crit and bleed, `EquipItemData` enchantments and slots, `SlateSpellItemData` spell references).

Ruled out for now: quest graph edges and dialogue live in Odin-serialised `flowGraph` structures, NPC identity is record-backed through `RecordReference` rather than direct asset references, and `LocationQuestObject` stores raw coordinates rather than a `LocationAsset`.

## Code health

Worth doing now:

- **Delete the dead detail-section subsystem.** `emit-site-metadata.ts:122-142` populates `site_detail_sections` from descriptors, the site builds a `sectionRegistry`, and no route consumes any of it. About 86 lines across five site files plus shipped SQLite rows read by nobody. It looks like the supported extension point for detail pages and is not.
- **Delete `pipeline/src/registry.ts`.** Zero production consumers, kept green by its own test, and a near-duplicate of `site/src/lib/registry-merge.ts`. Two files named `registry.ts` in one package, one of them the real dispatch.
- **`controller/src/validate-snapshot.ts:19-29` hardcodes `ENTITY_FILES`.** A hand-maintained entity list is exactly what the filesystem-registry invariant exists to prevent, and it has to be edited by hand for every new entity.
- **Extract the extractor lifecycle in the mod.** Eight extractors repeat 25 to 40 lines each of enumeration, null-row diagnostics, id validation, and resolver draining. They have already diverged: `ItemTagExtractor` never drains the resolver, and missing display names are fatal in two extractors, a diagnostic in two more, and a silent fallback in three.
- **Stop swallowing Unity lookup failures.** Roughly a dozen sites catch and return `""` or `null` with no diagnostic, which makes a destroyed object indistinguishable from genuinely absent data.
- **Validate JSON at the site boundary.** 23 `JSON.parse` sites, nearly all followed by an unchecked `as` cast.

Leave alone: `RunFinalizeCommand` is genuinely multi-phase orchestration, the per-entity read model modules are small and readable, `EntityTable` is a real generic component, and every detail route already fails cleanly with a 404.

## What the prior art says

Two sibling projects were audited for their map and marker systems, and the numbers are recorded in the tile capture spec. The external research adds three things.

Mature game wikis converge on **generated inverse relationship blocks**: "used by", "obtained from", "drops", "sources". OSRS, Warframe, PoEDB, and Stardew all do this, with authored prose reserved for interpretation. High-recall edges are generated from facts already in the read model, and the reverse index is built once.

**Pagefind** is the strongest fit for search here. It runs after prerendering, chunks its index so a browser fetches a subset, and its own documentation reports a 2,496-page site indexing in 2.4 seconds. SQLite FTS5 in WASM is the architecturally purer option and costs materially more to implement.

Warframe's database guide contains the warning most relevant to an extractor: **adding data is easier than removing it**, because existing pages depend on what was there before. An entity that disappears from a capture should be marked removed rather than silently vanishing.

The research also argues, independently of our own conclusion, that basemap work should follow graph and search work rather than precede it. It does not solve the discoverability failure.
