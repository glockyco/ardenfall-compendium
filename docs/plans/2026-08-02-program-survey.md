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

## How well the graph connects

Measured from rendered HTML, which is what a reader actually meets. A page counts as connected when another **detail** page links to it. Listing pages are excluded, because they link everything by design, and so are the nav and the footer.

| | pages |
| --- | ---: |
| detail pages | 2,228 |
| linked from another detail page | 1,921 |
| linked from no other detail page | 307 |

Unconnected by section: placed-character 121, status-effect 103, faction 25, location 20, character 15, item-tag 10, stat-type 8, portal 4, spell 1. **No item is unconnected**, because every one of the 1,273 is named by a category, a tag, a variant or a character that can drop it.

Placed characters and portals account for the rise, because both gained pages and 347 pages arrived at once. The trade was worth it. Locations fell from 48 unconnected to 20, since a location page now names the characters found there, and 193 of the 314 placed characters are reachable from the location that contains them. The 121 that are not sit inside no location at all. Portals reach each other through `leads_to`, so only 4 of 33 are unconnected.

**An earlier figure in this document counted something narrower and read worse.** It counted rows in `entity_edges` whose `target_id` matched, which misses three things: an inverse section such as a faction page listing its starting members, a link rendered from presentation data such as an item's Effects list, and the direction of an edge that is useful read backwards. That metric said 1,132 pages had no inbound edge. The rendered-link measurement above says 223, and it is the honest one.

The graph carries 5,912 edges: `can_drop` 2126, `variant_of` 1273, `categorised_as` 1268, `applies` 292, `casts` 286, `found_at` 245, `starts_in_faction` 235, `tagged` 76, `scales_with` 56, `leads_to` 30, `starts_opposed_to` 25.

Items now link to the status effects they apply, the spells they carry, their category, and their tags. Every one of the 552 item effect facts resolves and unresolved-target diagnostics are zero. Stat pages link the stats they affect.

**The field-shaped edges are exhausted, and the remaining orphans are concentrated in one place.**

| entity | orphaned | why |
| --- | ---: | --- |
| item | 728 | nothing in the game points at these except loot, recipes, merchants, and quests, none of which are modelled |
| npc | 314 | nothing authored points at a placed character, so only the location that contains it can reach one |
| character | 212 | a character is only ever the source of an edge, so nothing points back at it |
| status-effect | 103 | the remainder are reached from neither an item nor a spell |
| faction | 26 | placed content, no authored referent yet |
| location | 20 | contains no placed character |
| stat-type | 17 | only the four magic skills are referenced, by spells |
| item-tag | 10 | genuinely unused by any item |

Items are 44% of what is left. Character drops reached 545 of them, so the remaining 728 need loot lists, recipes, merchant stock or quest rewards, and none of those is modelled. The candidates are `ItemListAsset` with its counted and leveled wrappers, `PotionRecipe`, `CharacterData` merchant inventories, and quest rewards. `PotionRecipe` is already partly extracted, but live it is one recipe pointing at four potions, so it is not worth a slice by itself.

**People are now the second problem, and it is a different one.** 526 pages across characters and placed characters have no inbound link, and no field on either points back at them. A character is only ever the source of an edge. Nothing in the data we extract names a character, so no amount of field-shaped extraction will reach them. Quests, dialogue and merchant stock are the only authored things that do.

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
- ~~Stop swallowing Unity lookup failures~~ - **done.** 11 sites, not the ten first counted, now throw with the entity and field named. A live export still completes, so none of them fires in normal operation, which is the evidence that a destroyed object was never the common case.
- ~~Split the asset-source contracts from their Unity implementations~~ - **done.** No `I*AssetSource` interface names a Unity or game type, and one extractor test now builds a fake source with no engine type present. Icon capture keeps its Unity path through a separate `IIconAssetPlanSink`, so the contract carries plain data and the implementation carries the engine.
- ~~Validate JSON at the site boundary~~ - **done.** Every server parse of a generated column goes through one helper that names the entity, column and row on failure. Shapes consumed structurally are validated, pass-through blobs are container-checked only rather than given invented schemas.
- ~~Close the descriptor type vocabulary~~ - **done.** The set is closed in three layers that each catch a different mistake: a schema enum for the author, a TypeScript union for the compiler, and a throw for a dispatcher meeting an unknown token. `minimumSkill` was declared `int`, fell through to TEXT, and is now INTEGER, so a sort no longer places 40 before 5.

Building search exposed four reader-facing defects that browsing had hidden, all fixed:

- **Raw entity ids reached readers.** The character list appended the full id when a name repeated, and every nameless character showed one, so 118 strings like `named;character;preset_enemy_bone-charmer-melee` were on one page. Both now use `entity_nodes.short_id`, which relationship sections already show, rather than a second convention.
- **Result URLs carried `.html`.** Pagefind returns the prerendered filename. The site serves the same page without the extension, and that is the address a reader can share.
- **Nine detail routes hand-wrote the same back link.** It repeated in every search extract. One `BackLink` component now carries the text and the index exclusion, so a new detail page cannot forget either.
- **Every navigation link was 20 px tall.** WCAG 2.5.8 asks for 24 px. The header links and the back link now meet it.

One defect is recorded and not fixed. One item is named `Recipe of {0}`, which is the game's own format string with an argument the runtime substitutes. The pipeline does not extract that binding, so the correct name is not derivable from the snapshot today.

## Factions, the tenth entity

48 factions ship with pages. 46 carry an authored title such as `Black Moth` and `Mages Guild`, and the two without follow the same policy every other entity uses: a diagnostic and a null, with the short id appended for a reader.

Two predicates came with them. `starts_in_faction` carries 235 edges from `CharacterData.startingFactions`, so 194 of 212 characters name their factions and 18 faction pages list their starting members. `starts_opposed_to` carries 25 edges from `interFactionRelationships`, which the game seeds as a **starting** stance that play then modifies.

Every one of those 25 is negative: 23 flagged as enemies, and 2 carrying a negative standing without the flag, `Garkai → Player = -100` and `Butchers → Animal = -600`. None is positive, so the name holds today. The emitter fails rather than mislabels if a positive one ever appears, because the predicate could not describe it.

`autoAddFactions` is empty in every faction in this build, so nothing models it. Building against data that cannot be verified is how an unverifiable contract enters the pipeline.

## The Worker that could only fail

Every dynamic route answered 500 in production for an address matching no page. A crawler on a stale link, or anyone guessing a slug, met a server error rather than a 404.

Each content route prerenders, and the build database is deliberately never deployed, so an unmatched path fell through to a Worker that cannot render anything. Worse, the Worker's bundle contained the server modules that open that database, so it failed on load and returned 500 even for a path matching no route at all.

The site is now files only: `adapter-static` emits no Worker, `wrangler.toml` carries no `main`, and Cloudflare serves a prerendered `/404` page for a miss. Verified in production, where `/items/does-not-exist`, `/factions/does-not-exist--00000000` and `/no-such-section` all answer 404 with the compendium's own page.

**A test asserted the wrong layer for months.** `smoke:error-route` read `+error.svelte` and checked it contained certain strings. That component renders only when a Worker runs, and an unmatched address never reached it, so the test passed while production was broken. It now checks the 404 asset exists, carries the real page rather than the adapter's placeholder, and that the setting which makes Cloudflare serve it is present. The production smoke fetches three missing addresses and requires 404 with that content.

## Where the next slice starts

**Spell effects.** A spell page names its governing skill and its mana cost, then prints a prose tooltip. It never says what the spell does, because seven fields reach the `spells` table and the effect graph is not among them.

Measured in the running game: `SpellData.spells` holds **81 effect objects across 56 spells, in 17 classes**. `SelfStatusEffectSpellEffect` accounts for 20 and `SoundsSpellEffect` for 18, so the spread is wide but the head is short. There are also 5 sub-spells.

The value is content on spell pages first and connectivity second. 27 references reach 25 distinct status effects, and **13 pages gain a first one**, taking status effects with no inbound link from 116 to 103. The larger prize is 56 pages that could not say what their spell does.

The work is bounded and needs no world traversal, since spells already resolve as named assets. Roughly half the effects are reader-facing mechanics. `SoundsSpellEffect` at 18, `TargetAIValueSpellEffect` at 4 and `SubTooltipSpellEffect` at 1 are presentation or AI tuning and describe nothing a reader wants.

One other candidate ranks below it. The 728 items with no named source need the 683-cell container walk, which is the largest remaining piece of extraction work.

`NPCRecord` has since shipped, and it needed no scene-placement mechanism after all, because the records carry their own spawn points. It also disproved its own premise. An NPC does not reference an authored character, it embeds a serialised copy with no id and no stored name, so the link it was meant to give characters does not exist. What it does give is 186 authored names and the location each one stands in.

## Not covered by any plan

Three concerns no planning doc mentions. Each is measured, and none blocks a deploy.

~~No attribution or status statement anywhere~~ - **done.** The footer states on every page that this is an unofficial reference for a game by Spellcast Studios, that Spellcast Studios does not make or endorse it, and that the game's names and text belong to their owner. The README separates the MIT licence, which covers our code, from the game data, which it does not.

**The item index ships 488 KB of hydration payload.** `items.html` is 620 KB, of which 78 percent is the inline row data that drives client-side filtering, and 72 KB over the wire after gzip. It is the heaviest page by a factor of two, and the cost falls on the reader least able to pay it. Server-side filtering or pagination would remove it, at the cost of the instant filter interaction. Measure the interaction people actually use before choosing.

~~Accessibility has no standard recorded and a partial gate~~ - **done.** `site/AGENTS.md` names WCAG 2.2 Level AA, and `smoke:accessibility` runs in the gate and in CI over the built HTML. It checks duplicate link text within a nav or a section, target size against 24 px, and a status message on a page carrying a form, and it records that static HTML cannot see focus behaviour or final browser layout. It earned its place at once by failing on two defects that had already shipped: two spells both labelled `Firebolt` linked from one item's Effects list, and two locations both labelled `Coral Forest Back` on the locations index.

Leave alone: `RunFinalizeCommand` is genuinely multi-phase orchestration, the per-entity read model modules are small and readable, `EntityTable` is a real generic component, and every detail route already fails cleanly with a 404.

## What the prior art says

Two sibling projects were audited for their map and marker systems, and the numbers are recorded in the tile capture spec. The external research adds three things.

Mature game wikis converge on **generated inverse relationship blocks**: "used by", "obtained from", "drops", "sources". OSRS, Warframe, PoEDB, and Stardew all do this, with authored prose reserved for interpretation. High-recall edges are generated from facts already in the read model, and the reverse index is built once.

**Pagefind** is the strongest fit for search here, and it now ships. It runs after prerendering, chunks its index so a browser fetches a subset, and its own documentation reports a 2,496-page site indexing in 2.4 seconds. SQLite FTS5 in WASM is the architecturally purer option and costs materially more to implement.

Warframe's guidance on retaining removed content does not transfer. It exists because a hand-authored wiki cannot be rebuilt, so an editor's prose depends on data rows that must not vanish underneath it. Every page here is regenerated from one snapshot with no authored layer, so an entity leaving the game correctly leaves the site.

The research also argues, independently of our own conclusion, that basemap work should follow graph and search work rather than precede it. It does not solve the discoverability failure.
