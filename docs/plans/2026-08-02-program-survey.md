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
| item | 1273 | 545 |
| character | 212 | 0 |
| status-effect | 172 | 56 |
| spell | 56 | 55 |
| location | 48 | 0 |
| item-tag | 28 | 18 |
| stat-type | 21 | 4 |
| item-variant | 16 | 16 |
| item-category | 7 | 7 |

Portals are absent because they have no page. They hold 33 identities and a map route, and their names are authoring identifiers, so publishing them would put `sc_tutcave_ext` in front of a reader.

1,132 of 1,833 public nodes have no inbound edge, down from 1,591 of 1,640. Every public node now has a page, so the two counts finally agree: the build produces 1,833 entity pages plus eleven listing pages. The graph carries 5,381 edges: `drops` 2126, `variant_of` 1273, `categorised_as` 1268, `casts` 286, `applies` 266, `tagged` 76, `scales_with` 56, `leads_to` 30.

The orphan figure rose by ten because locations gained pages that nothing links to, which is the honest trade. A page nothing links to is findable by search, and an entity with no page was findable by nothing.

Items now link to the status effects they apply, the spells they carry, their category, and their tags. Every one of the 552 item effect facts resolves and unresolved-target diagnostics are zero. Stat pages link the stats they affect.

**The field-shaped edges are exhausted, and the remaining orphans are concentrated in one place.**

| entity | orphaned | why |
| --- | ---: | --- |
| item | 1273 | nothing in the game points at an item except loot, recipes, merchants, and quests, none of which are modelled |
| status-effect | 116 | referenced from the Odin-serialised effect graph on `SpellData` |
| location | 34 | placed content, no authored referent yet |
| stat-type | 17 | only the four magic skills are referenced, by spells |
| item-tag | 10 | genuinely unused by any item |

Items are 87% of what is left, and no cheap reference reaches them. The candidates that do are all new entities: `ItemListAsset` and its counted and leveled wrappers, `PotionRecipe`, `CharacterData` merchant inventories, and quest rewards. `PotionRecipe` is already partly extracted, but live it is one recipe pointing at four potions, so it is not worth a slice by itself.

That reorders what comes next. **Loot provenance stops being the largest modelling job on the list and becomes the only remaining way to make the largest page type reachable at all.**

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

**Nothing is published, and that is now the single largest gap.** Every count in this document describes a site that only a local build shows. A release artifact cuts cleanly, the prerender and both smokes pass at real scale, and the deploy command is one line, so the blocker is operator authentication rather than engineering. Wrangler is a `site` dev dependency and not a global command, so a bare `wrangler login` fails with `command not found`. Run `bunx wrangler login` from inside `site/`, then `bun run --cwd site deploy:production ../pipeline/artifacts/releases/<snapshot-id>`.

## Content coverage

Unmodelled authored content, all confirmed as ScriptableObject types in the decompiled source. Counts require a live probe, since the cache holds type definitions and not asset instances.

`CharacterData` (NPCs, the largest body of placed content), `QuestData` and `JournalEntryAsset`, `Faction`, `PerkAsset`, `TraitType`, `PotionRecipe`, `ItemListAsset` and its counted and leveled wrappers, `EnchantmentData`, `MerchantCategory`, `FastTravelSetAsset`, `CharClass`.

Partially modelled entities dropping authored payload: `item-tag` drops `FactionItemTag.modifiers`, `stat-type` drops `affects` and `skillAffects` structure, `location` drops `fastTravelPosition` and `volumes`, and the item variants drop most of their combat and equipment fields (`MeleeItemData` damage and crit and bleed, `EquipItemData` enchantments and slots, `SlateSpellItemData` spell references).

Ruled out for now: quest graph edges and dialogue live in Odin-serialised `flowGraph` structures, NPC identity is record-backed through `RecordReference` rather than direct asset references, and `LocationQuestObject` stores raw coordinates rather than a `LocationAsset`.

## Code health

Worth doing now:

- ~~Delete the dead detail-section subsystem~~ - **done.** Pipeline emitters, DDL, site registry, renderers and the descriptor block all removed. Zero references remain.
- ~~Delete `pipeline/src/registry.ts`~~ - **done.** Removed with its test. The package no longer has two files called `registry.ts`, one of which was the real dispatch.
- ~~`controller/src/validate-snapshot.ts` hardcodes `ENTITY_FILES`~~ - **done.** Deleted. The controller identifies envelopes by the id inside each file, as the pipeline always has, and cross-checks the discovered set against the manifest counts, which also catches an unexpected file. A tenth entity needs no controller change.
- ~~Extract the extractor lifecycle in the mod~~ - **done.** One lifecycle across all nine extractors, 630 lines removed. The display-name policy is uniform: a diagnostic and a nullable column, never a fallback to the asset name, which had been putting internal identifiers like `itemcat_weapons` in front of readers. Measured first and confirmed after: no row in any affected entity is missing a name, and a live export produces byte-identical diagnostics.
- ~~Add search~~ - **done.** Pagefind indexes all 1,843 prerendered pages in the build, so every page is findable by name even when nothing links to it. Detail pages rank first for real names, which was measured before deciding whether listing pages needed exclusion. They did not. Search reaches an entity only through a page, which is what made the 67 page-less locations and portals measurable and led to the location work.
- ~~Give locations and portals a page~~ - **done for locations, and deliberately not for portals.** All 48 locations have a page, up from 34, because the publicity gate had been reading a flag that controls the player's in-game map marker. Portals keep an identity and a map route without a page, since 29 of their 32 names are authoring identifiers.
- ~~Fix the sitemap in the same pass~~ - **done.** The URL set equals the built page set exactly, 1,844 each, and a test reads the route tree so a new static page cannot be added without updating the list.
- ~~Add the two missing meta descriptions~~ - **done.** Every detail route ships one.
- **Stop swallowing Unity lookup failures.** Ten sites under `mod/src/Entities/*/I*Source.cs` catch and return `""`, `null` or `false` with no diagnostic, which makes a destroyed object indistinguishable from genuinely absent data.
- **Split the asset-source contracts from their Unity implementations.** All nine `I*AssetSource` interface files name `UnityEngine` or `Ardenfall` types, so the seam that exists to make extraction testable cannot be exercised without the engine. This is why every extractor test fakes at the extractor level instead of the source level.
- ~~Validate JSON at the site boundary~~ - **done.** Every server parse of a generated column goes through one helper that names the entity, column and row on failure. Shapes consumed structurally are validated, pass-through blobs are container-checked only rather than given invented schemas.
- ~~Close the descriptor type vocabulary~~ - **done.** The set is closed in three layers that each catch a different mistake: a schema enum for the author, a TypeScript union for the compiler, and a throw for a dispatcher meeting an unknown token. `minimumSkill` was declared `int`, fell through to TEXT, and is now INTEGER, so a sort no longer places 40 before 5.

Building search exposed four reader-facing defects that browsing had hidden, all fixed:

- **Raw entity ids reached readers.** The character list appended the full id when a name repeated, and every nameless character showed one, so 118 strings like `named;character;preset_enemy_bone-charmer-melee` were on one page. Both now use `entity_nodes.short_id`, which relationship sections already show, rather than a second convention.
- **Result URLs carried `.html`.** Pagefind returns the prerendered filename. The site serves the same page without the extension, and that is the address a reader can share.
- **Nine detail routes hand-wrote the same back link.** It repeated in every search extract. One `BackLink` component now carries the text and the index exclusion, so a new detail page cannot forget either.
- **Every navigation link was 20 px tall.** WCAG 2.5.8 asks for 24 px. The header links and the back link now meet it.

One defect is recorded and not fixed. One item is named `Recipe of {0}`, which is the game's own format string with an argument the runtime substitutes. The pipeline does not extract that binding, so the correct name is not derivable from the snapshot today.

## Not covered by any plan

Three concerns no planning doc mentions. Each is measured, and none blocks a deploy.

**No attribution or status statement anywhere.** The repository is MIT licensed, which covers our code. The pages publish another party's game content, and neither the site nor the README says the project is unofficial or names the game's owner. Every comparable fan reference carries such a statement. This is the cheapest item here and the only one with a non-engineering risk.

**The item index ships 488 KB of hydration payload.** `items.html` is 620 KB, of which 78 percent is the inline row data that drives client-side filtering, and 72 KB over the wire after gzip. It is the heaviest page by a factor of two, and the cost falls on the reader least able to pay it. Server-side filtering or pagination would remove it, at the cost of the instant filter interaction. Measure the interaction people actually use before choosing.

**Accessibility has no standard recorded and a partial gate.** Svelte's compiler checks markup-level a11y and reports clean, but the criteria this project keeps breaking are not markup-level: duplicate link text under WCAG 2.4.4 was fixed twice, in relationship sections and again in three listings, and target size under 2.5.8 was fixed once across every navigation link. Nothing prevents a fourth instance. Naming the target level and adding one automated check would turn a recurring reactive fix into a gate.

Leave alone: `RunFinalizeCommand` is genuinely multi-phase orchestration, the per-entity read model modules are small and readable, `EntityTable` is a real generic component, and every detail route already fails cleanly with a 404.

## What the prior art says

Two sibling projects were audited for their map and marker systems, and the numbers are recorded in the tile capture spec. The external research adds three things.

Mature game wikis converge on **generated inverse relationship blocks**: "used by", "obtained from", "drops", "sources". OSRS, Warframe, PoEDB, and Stardew all do this, with authored prose reserved for interpretation. High-recall edges are generated from facts already in the read model, and the reverse index is built once.

**Pagefind** is the strongest fit for search here, and it now ships. It runs after prerendering, chunks its index so a browser fetches a subset, and its own documentation reports a 2,496-page site indexing in 2.4 seconds. SQLite FTS5 in WASM is the architecturally purer option and costs materially more to implement.

Warframe's guidance on retaining removed content does not transfer. It exists because a hand-authored wiki cannot be rebuilt, so an editor's prose depends on data rows that must not vanish underneath it. Every page here is regenerated from one snapshot with no authored layer, so an entity leaving the game correctly leaves the site.

The research also argues, independently of our own conclusion, that basemap work should follow graph and search work rather than precede it. It does not solve the discoverability failure.
