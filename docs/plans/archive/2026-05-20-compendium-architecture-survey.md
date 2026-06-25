---
title: "Compendium Architecture Survey"
type: audit
status: implemented
created: 2026-05-20
parent:
superseded_by:
archived: 2026-06-25
---

# Compendium Architecture Survey

**Status:** survey
**Date:** 2026-05-20
**Survey version:** survey-2026-05-20
**Referenced by:** `docs/superpowers/specs/2026-05-20-items-presentation-closure-design.md`
**Companion documents:**

- `docs/superpowers/specs/2026-05-20-item-asset-graph-audit.md`
- `docs/superpowers/specs/2026-05-20-items-presentation-closure-architecture-review.md`

---

# Compendium Architecture Survey for Ardenfall Compendium

Survey conducted 2026-05-20 to validate the planned entity/composer/edge-table/slug architecture against established game-compendium projects. Open-source repos are inspected directly; closed sites (Wowhead, NWDB) are observed via their public URLs only. Where a claim is not source-grounded, it is marked **[unverified]**.

---

## 1. Survey of Projects

| #   | Project                                                                         | Game                               | Stack                                                    | Schema model                                                                                                                                   | Item / status-effect / spell representation                                                                                       | Edge model                                                                     | Composer-style logic                                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **tarkov.dev** (the-hideout/tarkov-api, the-hideout/tarkov-dev)                 | Escape from Tarkov                 | GraphQL on Cloudflare Workers, React frontend            | Document/graph (GraphQL) — `Item`, `Task`, `TaskObjective` interface with concrete subtypes (`TaskObjectiveItem`, `TaskObjectiveQuestItem`, …) | `Item` with `types[]` discriminator; tasks reference items via interface objectives                                               | GraphQL field references + interface unions (no edge table)                    | None mirrored from game; data ingested from raw dumps                                                                                                                                                |
| 2   | **Path of Building Community** (PathOfBuildingCommunity/PathOfBuilding)         | Path of Exile                      | Lua application, generated data tables                   | Document — Lua tables under `src/Data/Skills/*.lua`, items, mods                                                                               | Skills are typed records with `skillTypes` flags; mods are parsed into structured modifier objects by `src/Modules/ModParser.lua` | None — flat references by name/id                                              | **YES — full composer.** `ModParser.lua` parses game stat strings into structured modifiers; `Calcs/` re-composes tooltips and damage. This is the closest analogue to the Ardenfall composer pivot. |
| 3   | **OSRS Wiki / RuneScape Wiki** (MediaWiki + Cargo + Lua)                        | Old School RuneScape / RuneScape 3 | MediaWiki, Extension:Cargo, Scribunto/Lua                | Relational — one Cargo table per template (`#cargo_declare`) with auto columns `_pageName`, `_pageID`, `_pageNamespace`                        | One Cargo row per item infobox; status/effect pages link by wikilink                                                              | Implicit via wikilinks + Cargo joins; “What links here” is the reverse-edge UI | Wiki templates compose tooltips/infoboxes in Lua (Scribunto)                                                                                                                                         |
| 4   | **osrsbox-db** (osrsbox/osrsbox-db + osrsbox/schemas)                           | OSRS                               | Python, Cerberus schemas, static JSON API                | Document — one JSON per item validated by `schema-items.json`                                                                                  | `ItemProperties` with `id, name, examine, store_cost, highalch, lowalch, quest_item`; monsters/prayers separate schemas           | None — flat IDs                                                                | None; raw extracted strings only                                                                                                                                                                     |
| 5   | **Guild Wars 2 official API v2** (Arenanet)                                     | Guild Wars 2                       | REST, ISO-8601 schema versions, `v=<schema>` query param | Document — type-discriminated by `details.type`                                                                                                | `Item.type ∈ {Armor, Weapon, Consumable, …}`, `details` varies; `infix_upgrade` resolves to `/v2/itemstats`                       | Cross-ID reference (`stat_choices[]`, infix → itemstats)                       | Game-composed strings captured (descriptions are server-provided)                                                                                                                                    |
| 6   | **Squad Wiki pipeline** (Squad-Wiki/squad-wiki-pipeline-map-data)               | Squad                              | UE SDK export → JSON → MediaWiki Cargo + Lua             | Relational (Cargo) downstream of JSON                                                                                                          | Game data exported as JSON, uploaded to wiki Data pages, surfaced via Cargo + Scribunto                                           | Cargo joins                                                                    | Lua/Scribunto re-renders structured data into wiki pages                                                                                                                                             |
| 7   | **Sinytra WikiDataExporter** (Sinytra/WikiDataExporter)                         | Minecraft (mod authors)            | Java mod, runs at game launch, emits JSON + textures     | Document (JSON)                                                                                                                                | Configurable modules (`metadata`, `render`); namespaced item exports                                                              | None                                                                           | None — pure extraction                                                                                                                                                                               |
| 8   | **Wowhead** (closed)                                                            | World of Warcraft                  | Closed                                                   | n/a                                                                                                                                            | n/a                                                                                                                               | n/a                                                                            | URL slug observable: `wowhead.com/item=<id>/<kebab-name>` — id-primary, slug optional cosmetic suffix                                                                                                |
| 9   | **nwdb.info** (closed)                                                          | New World                          | Closed                                                   | n/a                                                                                                                                            | n/a                                                                                                                               | n/a                                                                            | URL pattern: `nwdb.info/db/items/<category>/page/<n>` (list) and per-entity numeric IDs; supports `?added_in_patch=` for patch diffs                                                                 |
| 10  | **PoEDB family** (multiple forks; eps1lon/poe-db, OmegaK2/poedb, beerett/poedb) | Path of Exile                      | Node + relational DB (eps1lon/poe-db)                    | Relational                                                                                                                                     | Items, bases, gems, mods as separate tables                                                                                       | FK joins                                                                       | Limited — most are extraction dumps                                                                                                                                                                  |

**Open-source count:** 7 of 10 (tarkov-dev/tarkov-api, PoB, OSRS/RS wikis, osrsbox-db, GW2 API spec, Squad Wiki pipeline, WikiDataExporter, PoEDB forks). Wowhead + NWDB inspected via URLs only.

Citations: tarkov-api repo & static schema [the-hideout/tarkov-api](https://github.com/the-hideout/tarkov-api/blob/main/schema-static.mjs); PoB skills data [`src/Data/Skills/act_int.lua`](https://github.com/PathOfBuildingCommunity/PathOfBuilding) and [`src/Modules/ModParser.lua`](https://github.com/PathOfBuildingCommunity/PathOfBuilding/blob/dev/src/Modules/ModParser.lua); Cargo [Extension:Cargo](https://www.mediawiki.org/wiki/Extension:Cargo); osrsbox schema [`schemas/schema-items.json`](https://github.com/osrsbox/schemas/blob/master/schema-items.json); GW2 [API:2/items](https://wiki.guildwars2.com/wiki/API:2/items); Squad pipeline [Squad-Wiki/squad-wiki-pipeline-map-data](https://github.com/Squad-Wiki/squad-wiki-pipeline-map-data); WikiDataExporter [Sinytra/WikiDataExporter](https://github.com/Sinytra/WikiDataExporter).

---

## 2. Composer Architectures Observed

**(a) Mirroring game string composition in code (high fidelity, high maintenance).** Only one surveyed project does this end-to-end:

- **Path of Building Community.** `src/Modules/ModParser.lua` parses raw stat strings (`'+# to Life'`, etc.) into structured modifiers; `Calcs/` recomposes tooltips with current build state. CONTRIBUTING.md notes: holding Alt in dev mode "adds additional debugging information to tooltips: Items and passives show all internal modifiers... stats that aren't parsed correctly will show any unrecognised parts of the stat description" — i.e. the composer is treated as a first-class invariant. Generated `src/Data/` is rebuilt from `src/Export/Scripts/` on each PoE patch. ([CONTRIBUTING.md](https://github.com/PathOfBuildingCommunity/PathOfBuilding/blob/dev/CONTRIBUTING.md), [ModParser.lua](https://github.com/PathOfBuildingCommunity/PathOfBuilding/blob/dev/src/Modules/ModParser.lua))
  - **Maintenance:** highest — every patch requires re-export + parser updates. PoB does this with ~2,317 commits to keep parity.
  - **i18n:** poor; English-only by construction.
  - **Accuracy across patches:** highest when parser keeps up.

**(b) Capturing game-composed strings (low maintenance, low flexibility).**

- **Guild Wars 2 API** — server returns localized, fully composed text per item; clients display verbatim. ([GW2 API:2/items](https://wiki.guildwars2.com/wiki/API:2/items))
- **osrsbox-db** — captures `examine` text from game. ([osrsbox schema](https://github.com/osrsbox/schemas/blob/master/schema-items.json))
- **WikiDataExporter, Squad-Wiki pipeline** — extract strings + assets, do not recompose.
  - **Maintenance:** lowest. **i18n:** automatic if game provides it. **Accuracy:** perfect for static strings, but cannot show conditional/derived stats (e.g. "with this rune slotted").

**(c) Structured atoms only.**

- **tarkov-api** — exposes structured fields (`avg24hPrice`, `sellFor.source`, attachment graphs); the UI assembles the human description in React. ([graphql-examples.md](https://github.com/the-hideout/tarkov-api/blob/main/docs/graphql-examples.md))
- **OSRS/RS wikis** — Cargo stores atoms; Scribunto/Lua templates compose tooltips at render time. ([Extension:Cargo](https://www.mediawiki.org/wiki/Extension:Cargo))
  - **Maintenance:** medium (templates evolve). **i18n:** per-wiki (each language is its own wiki). **Accuracy:** good for stable atoms; loses fidelity when game introduces new stat shapes.

**Score for Ardenfall’s pivot (pipeline-side TS composer port):** matches archetype (a). The only validated open-source precedent at the scale we plan is PoB. Expect the same maintenance burden: every Ardenfall patch will require re-running the exporter + verifying composer parity. PoB’s mitigation — keeping the exporter scripts in-repo (`src/Export/Scripts/`) and regenerating `src/Data/` automatically — is the model to copy.

---

## 3. Cross-entity Reference Modelling (forward + reverse)

| Project                                      | Pattern                                                                         | Reverse-edge mechanism                                                                                                                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MediaWiki / OSRS Wiki / RS Wiki / Squad Wiki | Implicit via wikilinks + Cargo joins                                            | `Special:WhatLinksHere` (built-in reverse index over the `pagelinks` table); Cargo joins on declared FK-ish columns ([Extension:Cargo](https://www.mediawiki.org/wiki/Extension:Cargo))         |
| tarkov-api                                   | GraphQL schema with interface unions (`TaskObjective`); no canonical edge table | Reverse lookups are explicit resolver methods (`Item.usedInTasks` etc.) backed by precomputed maps ([schema-static.mjs](https://github.com/the-hideout/tarkov-api/blob/main/schema-static.mjs)) |
| Path of Building                             | Flat reference by name/id in Lua tables; no edge table                          | Reverse views built ad hoc by iterating data at load time                                                                                                                                       |
| osrsbox-db                                   | Flat IDs in document JSON                                                       | None — consumers index client-side                                                                                                                                                              |
| GW2 API                                      | Cross-ID references; no edge endpoint                                           | None; clients precompute                                                                                                                                                                        |

None of the surveyed open-source compendia ship a **single canonical polymorphic edge table** with composite indexes powering both directions. The pattern (`from_id, to_id, rel_type` with double-sided index `(from_id, rel_type, to_id)` and `(to_id, rel_type, from_id)`) is well documented as a generic SQL pattern ([DoltHub: Polymorphic Data](https://www.dolthub.com/blog/2024-06-25-polymorphic-associations/), [Polymorphic Associations — Patrick Karsh, Medium](https://patrickkarsh.medium.com/polymorphic-associations-database-design-basics-17faf2eb313)) and as a graph-on-SQLite approach ([dev.to: SQLite as a Graph Database](https://dev.to/rohansx/sqlite-as-a-graph-database-recursive-ctes-semantic-search-and-why-we-ditched-neo4j-1ai)) but not as a _compendium_ practice in the surveyed set.

**Pagination/dedupe in observed projects:** MediaWiki paginates `WhatLinksHere` server-side; Cargo supports `LIMIT`/`OFFSET` in `#cargo_query`. Dedupe is implicit (one row per (from,to,rel) primary key — exactly what our composite PK gives).

**Materialized views:** Wowhead"s relationship pages (e.g. `/item=X#dropped-by`, `/item=X#sold-by`) are tabs at well-known fragment anchors **[unverified — observed in URL pattern, internal storage closed]**.

**Verdict:** the canonical `entity_edges(from_kind,from_id,rel_type,to_kind,to_id, order, payload_json)` table with two indexes is a sound generic design (DoltHub, Karsh); the lack of a _compendium_ exemplar is a signal but not a blocker — the closest analogue is MediaWiki’s `pagelinks` (single backlink table over heterogeneous content) which has served at Wikipedia scale for >20 years.

---

## 4. Slug / URL Strategy

| Project                                            | URL pattern                                                                                                                                                                                                                                           | Disambiguation                                                                                                          | Patch stability                                                                                             | Redirects from id-only                     |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **Wowhead**                                        | `wowhead.com/item=<numeric-id>/<kebab-name>` ([example](https://www.wowhead.com/item=52714/dwarven-slug))                                                                                                                                             | id is primary; slug is cosmetic and optional. `item=<id>` alone resolves.                                               | Name change ⇒ slug changes but id-only URL still works.                                                     | n/a — id is canonical                      |
| **OSRS / RS Wiki**                                 | `oldschool.runescape.wiki/w/<Name>` and `<Name> (<context>)` for collisions, e.g. `Air rune (The Slug Menace)`, `Golem (Desert Treasure II)`. ([Style guide/Disambiguation](https://oldschool.runescape.wiki/w/RuneScape:Style_guide/Disambiguation)) | Parenthetical context (quest, drop source, dyed variant); `{{Parentitle override}}` for items containing native parens. | Page rename creates a MediaWiki redirect automatically.                                                     | Yes — MediaWiki redirects from old titles. |
| **nwdb.info**                                      | `nwdb.info/db/items/<category>/page/<n>` for lists; per-entity uses numeric IDs **[unverified — exact per-entity slug shape not confirmed from search snippets]**                                                                                     | n/a                                                                                                                     | PTR variant at `ptr.nwdb.info` with `?added_in_patch=` ([search result](https://nwdb.info/db/items/page/1)) | **[unverified]**                           |
| **tarkov.dev**                                     | `tarkov.dev/item/<normalized-name>` (normalizedName field is in the API schema — `name` + `normalizedName` queryable) ([graphql-examples](https://github.com/the-hideout/tarkov-api/blob/main/docs/graphql-examples.md))                              | normalizedName is canonical kebab form; uniqueness enforced upstream.                                                   | Name change ⇒ normalizedName change; **[unverified]** whether old URLs redirect                             |
| **Dev.to (non-game; canonical pattern reference)** | `dev.to/<user>/<slug>-<short-id>` where short-id is a hashed disambiguator. ([Daniel Roy Greenfeld](https://daniel.feldroy.com/posts/django-slug-and-id-url-design))                                                                                  | The trailing short-id is the disambiguator — same shape we propose.                                                     | Title edits change slug but short-id stays; routing uses short-id.                                          | Yes                                        |

**Specific support for `<slug>--<id8>` shape:** the dev.to pattern (`<slug>-<short-id>`, with id at the end as the disambiguator while the slug is decorative) is the canonical web precedent, called out explicitly in [vercel/next.js#66932](https://github.com/vercel/next.js/discussions/66932) ("you could also maybe do t-shirt---id or something like that, and then split on --- to collect the id"). Wowhead uses a structurally equivalent variant (`item=<id>/<slug>`). MediaWiki/OSRS Wiki use parenthetical disambiguation, which collides badly with URL encoding and lacks a stable short-id, so it’s not a good model for a JS/TS prerender pipeline.

**SEO concerns:** Google"s structured-data guidance is silent on slug length but [General Structured Data Guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies) require the structured-data URL to be the canonical page URL, which the `--<id8>` design supports (canonical = `<slug>--<id8>`, id-only is a 301 alias).

---

## 5. Effect / Skill Leaf Representation

| Project                | Pattern                                                                                                                                                                                                                                                                            | Notes                                                             |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| GW2 API                | **Single type-tagged record with `details` polymorphic blob.** `Item.type` discriminator; `details` shape varies per type (armor / weapon / consumable / container / upgrade-component). ([API:2/items](https://wiki.guildwars2.com/wiki/API:2/items))                             | Pragmatic; clients dispatch on `type`.                            |
| tarkov-api             | **GraphQL interface with concrete subtypes.** `interface TaskObjective` ⇒ `TaskObjectiveItem`, `TaskObjectiveQuestItem`, `TaskObjectiveShoot`, etc., resolved via inline fragments. ([schema-static.mjs](https://github.com/the-hideout/tarkov-api/blob/main/schema-static.mjs))   | Strong types per leaf; ~dozens of subtypes.                       |
| Path of Building       | **Lua tables with `skillTypes` flag bitmask** (Attack, Spell, Projectile, …) selecting calc branches in `Calcs/`. ([Skills System DeepWiki](https://deepwiki.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/4.1-skills-system) — derived from `src/Data/Skills/act_int.lua` etc.) | Flag set, not subclass; the calc engine dispatches on flags.      |
| osrsbox-db             | **Separate top-level schemas per kind** (items, monsters, prayers) — no polymorphic leaves; each is a distinct document type. ([osrsbox/schemas](https://github.com/osrsbox/schemas))                                                                                              | Works because there are 3 kinds, not 60.                          |
| OSRS / RS Wiki (Cargo) | **One Cargo table per template** — one table per leaf subclass. ([Extension:Cargo](https://www.mediawiki.org/wiki/Extension:Cargo))                                                                                                                                                | Closest to per-subclass table model. Scales by author convention. |

**Trade-off summary for ~60 concrete subclasses (Ardenfall):**

- **Per-subclass tables (RS Wiki):** best query performance, painful schema migration, exporter complexity scales linearly with subclass count.
- **Single type-tagged table + JSON payload (GW2, DoltHub recommended pattern for sparse polymorphism):** one table, leaf fields in a JSON column. Sound for sparse columns; loses column-level indexing. ([DoltHub: Polymorphic Data](https://www.dolthub.com/blog/2024-06-25-polymorphic-associations/))
- **GraphQL union / TS discriminated union (tarkov-api):** great DX in the website layer; the storage underneath is still one of the two above.
- **Flag bitmask (PoB):** only works when leaves share most fields.

For 60 subclasses with heterogeneous payloads, **type-tagged table with a JSON `payload` column** is the documented sweet spot (DoltHub, GW2 in production). Per-subclass tables would explode exporter/loader code.

---

## 6. Static Prerender + Read-model Patterns

- **SvelteKit + better-sqlite3 build-time read model:** documented working approach — `+page.server.ts` with `export const prerender = true` queries SQLite at build, output is static HTML. ([alxndr.blog: SvelteKit + SQLite static](https://alxndr.blog/2024/07/18/sveltekit-and-sqlite-on-gitlab-pages.html), [hartenfeller.dev](https://hartenfeller.dev/blog/sveltekit-with-sqlite), [SvelteKit prerender tutorial](https://svelte.dev/tutorial/kit/prerender)). DB file MUST live under `src/lib/server` so it cannot be imported from client code ([hartenfeller.dev](https://hartenfeller.dev/blog/sveltekit-with-sqlite)).
- **Memory at scale:** SvelteKit holds all prerendered pages in memory until the entire build finishes, then writes to disk; at ~300 data-heavy pages users have hit the default 2 GB Node heap and required `--max-old-space-size`. ([sveltejs/kit#5233](https://github.com/sveltejs/kit/issues/5233)) — At 3,000+ pages, plan to run with `--max-old-space-size=8192` or larger and consider sharding the build.
- **Cloudflare Workers Static Assets:** SvelteKit"s `adapter-cloudflare` is the supported path (`adapter-cloudflare-workers` is deprecated). Use `_routes.json` `exclude` with **wildcard patterns** (`/items/*`), not per-page entries — there is a **hard cap of 100 include+exclude rules combined**. ([SvelteKit adapter-cloudflare](https://svelte.dev/docs/kit/adapter-cloudflare), [sveltejs/kit#7298](https://github.com/sveltejs/kit/issues/7298)) — At 3,000 pages this means we MUST express prerendered routes as a small number of wildcards; per-id excludes will not fit.
- **Incremental rebuild patterns:** none of the surveyed open-source compendia ship incremental SvelteKit rebuilds; the SvelteKit-recommended path for very large sites is `adapter-vercel` ISR ([Project types](https://svelte.dev/docs/kit/project-types)). On Cloudflare Workers Static Assets there is no ISR equivalent — full rebuild per release is the documented model.
- **Fixture vs release artifact separation:** PoB does this explicitly — `src/Data/` is generated, `src/Export/Scripts/` is the source ([CONTRIBUTING.md](https://github.com/PathOfBuildingCommunity/PathOfBuilding/blob/dev/CONTRIBUTING.md)); osrsbox separates schemas (`osrsbox/schemas` submodule) from data ([osrsbox-db](https://github.com/osrsbox/osrsbox-db)). The Squad-Wiki pipeline separates SDK→JSON (step 1) from JSON→wiki upload (step 2) ([squad-wiki-pipeline-map-data](https://github.com/Squad-Wiki/squad-wiki-pipeline-map-data)).

---

## 7. Structured Data / schema.org for Compendia

**Of the surveyed open-source projects:** **[unverified]** — none of the inspected repos (tarkov-dev, PoB, osrsbox-db, Squad-Wiki, WikiDataExporter, GW2 API, PoEDB) advertise JSON-LD emission in code I could reach. MediaWiki has [Extension:GoogleRichCards (beta)](https://www.mediawiki.org/wiki/JSON) for JSON-LD but its production deployment on OSRS/RS wiki is not confirmed. Gap to close: clone tarkov-dev and search for `application/ld+json`.

**Google guidance applicable to a game compendium:**

- Google recommends **JSON-LD** as the preferred structured-data format. ([Intro to Structured Data](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data))
- For _games themselves_ there is `VideoGame` ([schema.org/VideoGame](https://schema.org/VideoGame)) with `playMode`, `gamePlatform`, `genre`, `gameItem`. The `gameItem` property is typed as `Thing` ([schema.org/gameItem](https://schema.org/gameItem)) — schema.org does **not** define a distinct type for in-game items.
- Google"s [Play Game Actions](https://developers.google.com/actions/media/play-game-actions) distinguishes Work (abstract game) vs Edition (concrete platform release).
- General policy: "Put the structured data on the page that it describes... Use the most specific applicable type." ([SD Policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies))

**Practical recommendation for Ardenfall:** emit `@type: "Thing"` (or `"Product"` if items are framed as catalog entries) per entity page with `name`, `description`, `url`, `image`, and a `isPartOf` reference to a single `VideoGame` node for Ardenfall itself. There is **no Google rich-result type for in-game items** as of current docs; do not expect carousel-style rich results — JSON-LD here is for general crawl quality and knowledge-panel signals only.

---

## 8. Critical Mismatches with Planned Architecture

| #   | Plan                                                                                | Observed pattern                                                                                                                        | Justified?                                                                                                                                                                                                                                                                                                                          |
| --- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Pipeline-side TypeScript composer port** mirroring game tooltip composition       | Only PoB does this; majority capture or atomize                                                                                         | **Justified** — Ardenfall items have build-state-independent tooltips per game version, and capturing strings loses derived values. Adopt PoB"s discipline of generated-data + exporter scripts in-repo.                                                                                                                            |
| 2   | **Single canonical `entity_edges` table** powering forward + reverse                | No compendium does this; closest analogue is MediaWiki `pagelinks`                                                                      | **Justified, with caveat.** The pattern is sound (DoltHub, Karsh, MediaWiki pagelinks); the lack of compendium precedent means we should validate read-side query plans with `EXPLAIN QUERY PLAN` before locking the indexes. Add covering indexes `(from_kind, from_id, rel_type, order)` AND `(to_kind, to_id, rel_type, order)`. |
| 3   | **`/<plural>/<kebab-slug>--<id8>` route shape**                                     | Wowhead (`item=<id>/<slug>`, id-first) and dev.to (`<slug>-<short-id>`, id-last) — both work; OSRS uses parenthetical disambiguation    | **Justified** — dev.to pattern is the canonical web precedent. `--` (double hyphen) is safer than `---` (triple) for URL readability and matches the pattern suggested in [vercel/next.js#66932](https://github.com/vercel/next.js/discussions/66932).                                                                              |
| 4   | **~60 polymorphic effect leaves stored per-subclass** **[need to confirm vs plan]** | GW2 + DoltHub recommend single type-tagged + JSON payload; only Wiki/Cargo does per-subclass tables (and authors maintain them by hand) | **Reconsider.** Per-subclass tables at 60 leaves multiplies exporter/loader/test code by 60 and makes schema migrations brittle. **Recommend** single `effects` table with `kind` discriminator + `payload_json` validated by a TS Zod schema per kind.                                                                             |
| 5   | **Prerender 3,000+ pages on Cloudflare Workers Static Assets**                      | Within stated SvelteKit limits if `_routes.json` uses wildcards (cap of 100 include+exclude combined)                                   | **Justified** but **adopt wildcard rule discipline**: one `exclude` per plural (`/items/*`, `/spells/*`, …) — never per-id. Plan for `--max-old-space-size=8192` in CI.                                                                                                                                                             |
| 6   | **JSON-LD on entity pages**                                                         | **[unverified]** — no surveyed compendium confirmed                                                                                     | **Low risk, low reward.** Emit minimal `@type: Thing`. Do not expect rich-result carousel; this is a hygiene item.                                                                                                                                                                                                                  |
| 7   | **TS port of game composer**                                                        | PoB does it in Lua, the _same_ language as the rendering layer; we are porting C# → TS, language-different                              | **Caveat, not a block.** PoB benefits from one-language symmetry; we will need exhaustive composer parity tests (golden-file: every entity"s composed string compared against in-game capture for one anchor patch).                                                                                                                |

---

## 9. Recommendations (ranked by impact)

1. **Adopt PoB"s exporter-in-repo discipline.** Keep the C# exporter, the TS composer port, and the generated SQLite read-model artifact under three distinct paths with a CI step that fails when generated artifacts are stale. (PoB: `src/Export/Scripts/` → `src/Data/`.) — Source: [PoB CONTRIBUTING.md](https://github.com/PathOfBuildingCommunity/PathOfBuilding/blob/dev/CONTRIBUTING.md).
2. **Add golden-file parity tests for the composer.** For each effect/spell/status kind, snapshot the in-game composed string for one anchor patch; the TS composer MUST reproduce it byte-exactly. PoB"s Alt-tooltip dev mode is the same idea, surfaced at runtime. — Source: PoB CONTRIBUTING.
3. **Reconsider effect-leaf storage: prefer single `effects` table with `kind` discriminator + JSON payload, validated by per-kind Zod schemas, over 60 per-subclass tables.** Mirrors GW2 `details` pattern at API scale and DoltHub"s recommended polymorphic-data design. — Sources: [GW2 API:2/items](https://wiki.guildwars2.com/wiki/API:2/items), [DoltHub Polymorphic Data](https://www.dolthub.com/blog/2024-06-25-polymorphic-associations/).
4. **Keep the canonical `entity_edges` table** with composite PK `(from_kind, from_id, rel_type, to_kind, to_id)` and two covering indexes — but validate query plans with `EXPLAIN QUERY PLAN` for the top 10 reverse-edge queries before locking. Treat MediaWiki `pagelinks` as the precedent. — Source: [Extension:Cargo](https://www.mediawiki.org/wiki/Extension:Cargo), [DoltHub](https://www.dolthub.com/blog/2024-06-25-polymorphic-associations/).
5. **Adopt `<slug>--<id8>` with `id8` as the routing authority and the slug as cosmetic.** Old slug ⇒ 301 to current. Implement `id8`-only resolution as a 301 to the current `<slug>--<id8>`. Source pattern: dev.to / Daniel Roy Greenfeld + Wowhead"s id-primary precedent. — Sources: [Daniel Roy Greenfeld](https://daniel.feldroy.com/posts/django-slug-and-id-url-design), [Wowhead example URL](https://www.wowhead.com/item=52714/dwarven-slug).
6. **In `_routes.json`, express prerendered exclusions as plural-wildcards only** (`/items/*`, `/spells/*`, …). Never enumerate per-id. The 100-rule cap is hard. — Source: [SvelteKit adapter-cloudflare](https://svelte.dev/docs/kit/adapter-cloudflare), [sveltejs/kit#7298](https://github.com/sveltejs/kit/issues/7298).
7. **Plan for 8 GB Node heap in CI prerender** and add memory headroom monitoring. SvelteKit prerender retains all pages in RAM until disk-flush; the failure mode at 300 data-heavy pages is documented. — Source: [sveltejs/kit#5233](https://github.com/sveltejs/kit/issues/5233).
8. **Separate fixture data from release artifact.** Mirror osrsbox"s `osrsbox/schemas` submodule split: TS Zod schemas in one location, generated SQLite + JSON in another, fixtures (small hand-curated subsets for tests) in a third. — Source: [osrsbox/osrsbox-db](https://github.com/osrsbox/osrsbox-db).
9. **Emit minimal JSON-LD `Thing`/`VideoGame` linkage** per entity page; do not invest in rich-result tuning — no Google rich-result type exists for in-game items. Hygiene only. — Source: [schema.org/gameItem](https://schema.org/gameItem), [SD Policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies).
10. **Treat OSRS Wiki"s parenthetical-disambiguation as a NEGATIVE example** for our slug scheme. It works inside MediaWiki only because MediaWiki auto-redirects on rename; in a static-prerendered Worker we would have to ship a manual redirect map. Stick with `--<id8>`. — Source: [OSRS Style guide/Disambiguation](https://oldschool.runescape.wiki/w/RuneScape:Style_guide/Disambiguation).

## Sources

```json
[
  {
    "repo": "PathOfBuildingCommunity/PathOfBuilding",
    "path": "src/Modules/ModParser.lua",
    "line_start": 1,
    "line_end": 40,
    "excerpt": "-- Path of Building\\n-- Module: Mod Parser for 3.0\\n-- Parser function for modifier names"
  },
  {
    "repo": "PathOfBuildingCommunity/PathOfBuilding",
    "path": "CONTRIBUTING.md",
    "line_start": 1,
    "line_end": 80,
    "excerpt": "The ./src/Data folder contains generated files which are created using the scripts in the ./src/Export/Scripts folder based on Path of Exile game data. ... Holding Alt adds additional debugging information to tooltips: Items and passives show all internal modifiers that they are granting. Stats that aren't parsed correctly will show any unrecognised parts of the stat description."
  },
  {
    "repo": "the-hideout/tarkov-api",
    "path": "schema-static.mjs",
    "line_start": 1,
    "line_end": 40,
    "excerpt": "ItemTranslation has been replaced with the lang argument on all queries; Quest has been replaced with Task; QuestObjective has been replaced with TaskObjective; QuestRequirement has been replaced with TaskRequirement."
  },
  {
    "repo": "the-hideout/tarkov-api",
    "path": "docs/graphql-examples.md",
    "line_start": 1,
    "line_end": 80,
    "excerpt": "itemsByName(name: \"colt m4a1\") { name types avg24hPrice basePrice width height changeLast48hPercent iconLink link sellFor { price source } }"
  },
  {
    "repo": "osrsbox/schemas",
    "path": "schema-items.json",
    "line_start": 1,
    "line_end": 40,
    "excerpt": "This file defines the item schema, the defined properties, the property types, and some additional specifications including regex validation."
  },
  {
    "repo": "osrsbox/osrsbox-db",
    "path": "README.md",
    "line_start": 1,
    "line_end": 60,
    "excerpt": "An ItemProperties object type includes basic item metadata such as id, name, examine text, store cost, highalch and lowalch values and quest_item association."
  },
  {
    "repo": "mediawiki/Extension:Cargo",
    "path": "docs",
    "line_start": 1,
    "line_end": 60,
    "excerpt": "Cargo stores all its data in database tables ... For the most part, each stored template gets its data stored in a single DB table, with a column for each relevant template parameter. ... _pageName, _pageTitle, _pageNamespace, _pageID."
  },
  {
    "repo": "Squad-Wiki/squad-wiki-pipeline-map-data",
    "path": "README.md",
    "line_start": 1,
    "line_end": 60,
    "excerpt": "Step 1 exports the data from the Squad SDK into a JSON format. ... Cargo tables allow the automatic re-use of its data on many wiki pages."
  },
  {
    "repo": "Sinytra/WikiDataExporter",
    "path": "README.md",
    "line_start": 1,
    "line_end": 50,
    "excerpt": "Output base path, relative to the \"run\" directory ... enabled modules (metadata, render); namespaces; resolution for texture exports. The exporter will run automatically when the game launches and will close it once all exports are complete."
  },
  {
    "repo": "ArenaNet/GW2-Wiki",
    "path": "API:2/items",
    "line_start": 1,
    "line_end": 60,
    "excerpt": "For each requested item id, an object with vendor_value, flags, default_skin, game_types. For consumables: apply_count, name, icon. For containers: type \u2208 {Immediate, OpenUI}. For weapons: attribute_adjustment + optional infix_upgrade. Schema versions are ISO 8601 datetimes."
  },
  {
    "repo": "oldschool.runescape.wiki",
    "path": "RuneScape:Style guide/Disambiguation",
    "line_start": 1,
    "line_end": 40,
    "excerpt": "Names for items, monsters, etc. are often reused, especially in annual events or promotions, and therefore require parentheses in the title to differentiate. e.g. Air rune (The Slug Menace); Golem (Desert Treasure II); Silverlight (dyed) (Dimension of Disaster) via {{Parentitle override}}."
  },
  {
    "repo": "wowhead.com",
    "path": "item=52714/dwarven-slug",
    "line_start": 1,
    "line_end": 1,
    "excerpt": "https://www.wowhead.com/item=52714/dwarven-slug \u2014 id-primary URL with cosmetic kebab-name suffix"
  },
  {
    "repo": "vercel/next.js",
    "path": "discussions/66932",
    "line_start": 1,
    "line_end": 20,
    "excerpt": "You could also maybe do t-shirt---id or something like that, and then split on --- to collect the id."
  },
  {
    "repo": "daniel.feldroy.com",
    "path": "posts/django-slug-and-id-url-design",
    "line_start": 1,
    "line_end": 40,
    "excerpt": "It combines a slug with a hashed value representing an internal representative of some kind of index value to ensure uniqueness. ... 175b is a hashed value that is either stored in an indexed character field or broken down by the router into a numeric primary key."
  },
  {
    "repo": "sveltejs/kit",
    "path": "docs/adapter-cloudflare",
    "line_start": 1,
    "line_end": 80,
    "excerpt": "adapter-cloudflare-workers has been deprecated in favour of adapter-cloudflare. ... <prerendered> contains prerendered pages. You can have up to 100 include and exclude rules combined."
  },
  {
    "repo": "sveltejs/kit",
    "path": "issues/5233",
    "line_start": 1,
    "line_end": 30,
    "excerpt": "When pre-rendering ~300 fairly data-heavy pages I am hitting the default 2GB memory limit in Node. Pre-rendered pages are stored in memory until ALL of them have been generated, and then written to disk."
  },
  {
    "repo": "sveltejs/kit",
    "path": "issues/7298",
    "line_start": 1,
    "line_end": 30,
    "excerpt": "_routes.json can be used to bypass _worker.js, which typically handles all requests. By restructuring the build output folder to serve static assets as they are normally routed in-app."
  },
  {
    "repo": "hartenfeller.dev",
    "path": "blog/sveltekit-with-sqlite",
    "line_start": 1,
    "line_end": 30,
    "excerpt": "As the database file only sits on the server, we can create the main DB file in lib/server. lib is the place to put your code that does not strictly belong to any route."
  },
  {
    "repo": "alxndr.blog",
    "path": "2024/07/18/sveltekit-and-sqlite-on-gitlab-pages",
    "line_start": 1,
    "line_end": 40,
    "excerpt": "Use better-sqlite3 in +page.server.ts, mark export const prerender = true, output static HTML for GitLab Pages."
  },
  {
    "repo": "dolthub.com",
    "path": "blog/2024-06-25-polymorphic-associations",
    "line_start": 1,
    "line_end": 40,
    "excerpt": "Choosing a Database Schema for Polymorphic Data \u2014 single type-tagged table with a JSON payload is the recommended sweet spot for sparse polymorphism."
  },
  {
    "repo": "schema.org",
    "path": "VideoGame",
    "line_start": 1,
    "line_end": 30,
    "excerpt": "VideoGame ... gameItem (Thing) \u2014 An item is an object within the game world that can be collected by a player or, occasionally, a non-player character."
  },
  {
    "repo": "developers.google.com",
    "path": "search/docs/appearance/structured-data/intro-structured-data",
    "line_start": 1,
    "line_end": 20,
    "excerpt": "Google recommends using JSON-LD for structured data if your site's setup allows it."
  },
  {
    "repo": "developers.google.com",
    "path": "search/docs/appearance/structured-data/sd-policies",
    "line_start": 1,
    "line_end": 20,
    "excerpt": "Put the structured data on the page that it describes ... use the most specific applicable type and property names defined by schema.org."
  }
]
```

## Caveats

```json
[
  "No surveyed open-source compendium ships a single canonical polymorphic edge table; closest analogue is MediaWiki pagelinks. Pattern is generically endorsed (DoltHub, Karsh) but not validated in this exact domain \u2014 recommend EXPLAIN QUERY PLAN validation before locking indexes.",
  "No surveyed open-source compendium confirmed to emit JSON-LD; this section is partially [unverified]. Gap closer: clone tarkov-dev and grep for application/ld+json.",
  "Path of Building is the only inspected project that ports game composer logic into application code (Lua). The TS port for Ardenfall is a language-different port and requires golden-file parity tests per kind for each anchor patch.",
  "nwdb.info per-entity slug shape not confirmed from public search; only list/pagination URLs verified.",
  "tarkov.dev URL redirect behavior on normalizedName change is [unverified]; only the existence of the normalizedName field in the GraphQL schema is confirmed.",
  "SvelteKit prerender at 3,000+ pages will likely require --max-old-space-size>=8192 based on the documented 300-page/2GB failure mode; the exact threshold for our payload is unmeasured."
]
```

## API exposure notes

```json
[
  {
    "signature": "CREATE TABLE entity_edges (from_kind TEXT, from_id INTEGER, rel_type TEXT, to_kind TEXT, to_id INTEGER, order INTEGER, payload_json TEXT, PRIMARY KEY(from_kind,from_id,rel_type,to_kind,to_id))",
    "description": "Recommended canonical edge table; add covering indexes on (from_kind,from_id,rel_type,order) and (to_kind,to_id,rel_type,order) for forward+reverse queries. Pattern source: DoltHub Polymorphic Data + MediaWiki pagelinks."
  },
  {
    "signature": "CREATE TABLE effects (id INTEGER PRIMARY KEY, kind TEXT NOT NULL, payload_json TEXT NOT NULL)",
    "description": "Single type-tagged effect-leaf table with kind discriminator + JSON payload validated by per-kind Zod schemas. Source pattern: GW2 API details object; DoltHub recommendation for ~60 sparse polymorphic leaves."
  },
  {
    "signature": "GET /v2/items?ids=<csv>&lang=<lang>&v=<schema>",
    "description": "GW2 official API pattern: ids batched (max 200), lang for localization, v=<schema> ISO-8601 datetime for schema version pinning. Reference for how game compendia handle patch-versioned schemas."
  },
  {
    "signature": "export const prerender = true; export async function load(){ const db = new Database('src/lib/server/data.db'); return { rows: db.prepare('SELECT ...').all() } }",
    "description": "SvelteKit +page.server.ts read-model pattern using better-sqlite3 at build time. DB MUST live under src/lib/server to be inaccessible to client bundles."
  },
  {
    "signature": "_routes.json: { version: 1, include: ['/*'], exclude: ['/items/*','/spells/*','/status-effects/*', ...] }",
    "description": "Cloudflare Workers Static Assets routing for SvelteKit. Hard limit: 100 include+exclude rules combined; use plural wildcards only."
  },
  {
    "signature": "/<plural>/<kebab-slug>--<id8>",
    "description": "Recommended URL shape. id8 is the routing authority; slug is cosmetic. Old (slug, id8) tuples 301-redirect to current. Pattern source: dev.to short-id design; Wowhead id-primary URLs."
  }
]
```
