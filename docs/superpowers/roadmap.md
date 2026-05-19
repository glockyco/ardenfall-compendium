# Ardenfall Compendium — Implementation Roadmap

Living tracker for implementation of:

- Baseline spec: `docs/superpowers/specs/2026-04-28-ardenfall-compendium-design.md`
- Slice 1 amendment: `docs/superpowers/specs/2026-04-29-ardenfall-compendium-implementation-decisions.md`
- Slice 1 tooling decisions: `docs/superpowers/specs/2026-05-03-slice1-tooling-decisions.md`
- Investment priorities: `docs/superpowers/specs/2026-05-07-investment-priorities.md`

The amendment is authoritative where it differs from the baseline spec. The investment-priorities spec governs slice ordering and presentation depth; the roadmap below reflects it.

## How this is organised

The project spans three layered subsystems (BepInEx mod, TS/Bun pipeline, SvelteKit site) plus shared descriptor/schema infrastructure. Rather than one mega-plan, work is split into **slices**. Each active slice may get an execution plan under `docs/superpowers/plans/` while work is live, but completed plans are removed from the working tree once the roadmap/specs capture the outcome; git history is the archive.

Slice ordering is driven by `2026-05-07-investment-priorities.md`: items get the deepest investment first (data breadth, then assets, then presentation depth), maps come second (locations, map system, then map-supporting entities one-by-one), with spells/quests after. Each major entity gets a data slice plus a presentation depth slice; depth is not deferred to a single distant design-system slice. One operational override currently sits above all content work: the site must return to a static-assets-first SvelteKit architecture before Slice 4 or any new entity slice, because avoidable Worker invocations threaten the Cloudflare Workers free-tier envelope and make production failures look like blank client shells.

## Status legend

- **planned** — described here, no plan written yet
- **brainstorming** — design decisions still being closed
- **drafting** — plan being written
- **ready** — plan written and committed, awaiting execution
- **in-progress** — plan execution underway
- **done** — slice executed and merged; completed execution plans are not retained in the working tree
- **deferred** — explicitly parked until a stated trigger fires

## Slices

### Slice 1 — Item walking skeleton

**Status:** done
**Completed:** 2026-05-07 on `main`; merged as `41b8310 merge: slice 1 item walking skeleton`.
**Spec coverage:** baseline §4, §6–§9, §11, §14, §15; all implementation decisions in `2026-04-29-ardenfall-compendium-implementation-decisions.md`; tooling decisions in `2026-05-03-slice1-tooling-decisions.md`.

**Delivered:**

- Bun workspace repo foundation for `pipeline/`, `site/`, and `controller/`, with `mod/` as C# sibling.
- Descriptor-only entity root: `entities/item/entity.json`.
- Item variant descriptor mechanism under `entities/item/variants/`.
- BepInEx extraction path for `ItemData` assets using `BuiltLookupTable.GetAssetsOfType<ItemData>()`.
- Stable asset IDs via `BuiltLookupTable.GetGuid(Object)`.
- Explicit snapshot DTOs; no raw Unity/Odin/game object JSON.
- `Parameter<T>.Get()` and `SmartListParameter<T>.Get()` resolution for item fields.
- Extraction preflight for lookup table, `ArdenfallGame.instance`, `worldData`, and `masterRecordTable` readiness.
- HotRepl-driven extraction lifecycle: `compendium.preflight`, `run.begin`, `entity.plan`, `entity.exportBatch`, `run.finalize`; F8 hotkey retained as fallback.
- Atomic snapshot publish: only complete successful snapshots reach the canonical output path.
- Snapshot manifest with game/build/extractor metadata, preflight result, counts.
- Synthetic + capsule fixture infrastructure with manifest envelope, sha256 pinning, hygiene checks, and forbidden-paths enforcement in CI.
- Snapshot-level lightweight provenance for each extracted item `Parameter<T>` / `SmartListParameter<T>` field (`isSet`, inherited flag, optional parent ref).
- Canonical SQLite tables for `items`, `item_tags`, `item_equipment`, `item_hand_items`, `item_primary_hand_items`, `item_melee_weapons`, `item_armor`.
- Pipeline-emitted site metadata; site does not read raw descriptors.
- Generic `/items` and `/items/[id]` routes driven by emitted metadata/read models.
- Basic item overview/detail UI using structured `fieldList` sections and a registered `custom` escape hatch.
- End-to-end synthetic smoke test plus 5-job CI workflow (lint, pipeline, site, mod format, fixtures).

**Slice 1 item layers:**

- `items` (`ItemData`)
- `item_tags` (`ItemData.tags`)
- `item_equipment` (`EquipItemData`)
- `item_hand_items` (`HandItemData`)
- `item_primary_hand_items` (`PrimaryHandItemData`)
- `item_melee_weapons` (`MeleeItemData`)
- `item_armor` (`ArmorItemData`)

This set proves the variant model with one deep inheritance branch (`MeleeItemData`) and one sibling equipment branch (`ArmorItemData`).

**Excludes (handed to later slices):**

- Remaining item subtype coverage → Slice 2.
- Asset extraction and rendering → Slice 3.
- Item presentation depth (tooltips, formatted descriptions, inter-entity links) → Slice 4.
- Locations, map system, map-supporting entities → Slices 6–9.
- Search/FTS5/facets/design depth → Slice 10.
- Spells, quests → Slices 11–12.
- Override mechanism → deferred.

### Slice 1.5 — Stabilisation, deployment, and operational hygiene

**Status:** done
**Completed:** 2026-05-14 on `main`; latest Slice 1.5 cleanup commit before this roadmap update was `6182f25 fix(repo): align local formatting checks with CI`.
**Spec coverage:** investment-priorities §3 (foundation hygiene before breadth); design spec §16 open question 1 (deployment, now closed).

**Delivered:**

- All five identified bugs in the HotRepl extraction path fixed at the source. Specifically: empty `DiagnosticTotals` in `RunFinalizeCommand`; full walker re-run in `EntityPlanCommand`; full walker re-run per batch in `EntityExportBatchCommand`; walker-level diagnostics dropped between batches; reliance on unstable iteration order from `BuiltLookupTable.GetAssetsOfType<T>()`. Walker rows and diagnostics are cached through `ItemExtractionService`; manifest totals aggregate row diagnostics plus walker diagnostics.
- Local C# xUnit regression substrate under `mod-tests/`, including coverage for cached item extraction, entity planning, batch slicing, finalize diagnostics, diagnostic code naming, and run lifecycle behavior.
- Site `+error.svelte` for SvelteKit error states, with `site/scripts/smoke-error-route.mjs` covering the unknown-item route.
- Controller invokes `game.quit` after the `run.finalize` path; quit failures are logged and do not mask the original export result.
- Live deployment of the site to `ardenfall.compendiums.org` via Cloudflare Workers Static Assets and local/operator `wrangler deploy`. CI verifies buildability; it does not deploy and assumes no Cloudflare secrets.
- Operational helper for the controller to drive `MainMenu → continue → world_Ardenfall` through the typed `compendium.continueFromMenu` command, so unattended live smoke runs require no human click.
- Runtime deploy cleanup removes the obsolete pre-rename `BepInEx/plugins/ArdenfallArchives` directory before copying current plugin DLLs.

**Verification evidence:** local gates passed on 2026-05-14 (`bun run format:check`, `bun run typecheck`, `bun test`, `dotnet test mod-tests/ArdenfallCompendium.Tests.csproj`, `bun run --cwd site check`). Live smoke against Ardenfall Demo `0.0.10.91` published `snapshots/snapshots/0.0.10.91-20260514-0632448862090` with `counts.item = 899`, `diagnostics = { fatal: 0, diagnostic: 1273 }`, wrote `pipeline/dist/data.sqlite` at 1,482,752 bytes, and `game.quit` closed HotRepl port 18590. Cloudflare version `d8bb5080-eaf8-4e69-9c1c-d223fb1ecdd7` served `/items`, `/items/fixture-iron-sword`, and `/items/does-not-exist` with the expected 404 error route.
**Why this slice exists:** investment-priorities §3 mandates that known foundation bugs are fixed before breadth slices land. Slice 2 will multiply the volume of items extracted and amplify the missing-diagnostic visibility into other entity types; Slice 3 will make icons real and amplify the cost of any walker quadratic; Slice 4 will surface presentation defects that an opaque error route hides. Each downstream slice is cheaper if Slice 1.5 lands first.

**Excludes:**

- Any new entity types or breadth — Slice 2 owns that.
- Any new presentation primitives beyond `+error.svelte` — Slice 4 owns that.
- Any map work — Slice 5+ owns that.

### Slice 2 — Item subtype enrichment

**Status:** done
**Completed:** 2026-05-14 on `main`; implementation commits `8dc97f6..05e1887`, with the roadmap closeout commit recording live-smoke evidence.
**Plan:** `docs/superpowers/plans/2026-05-14-item-subtype-enrichment.md`
**Audit:** `docs/superpowers/specs/2026-05-14-item-subtype-audit.md`; completed in `8dc97f6 chore(items): add decompilation audit tooling`, reconciled into the active plan before implementation.
**Spec coverage:** implementation addendum §9–§11, §16; investment-priorities §1 (item depth first).
**Verification evidence:** local gates passed on 2026-05-14 (`bun run format:check`, `bun run typecheck`, `bun test`, `dotnet test mod-tests/ArdenfallCompendium.Tests.csproj`, `dotnet build mod/ArdenfallCompendium.csproj -c Debug`, `bun run --cwd site check`). Live smoke against Ardenfall Demo `0.0.10.91` published `snapshots/snapshots/0.0.10.91-20260514-1621097145580` with `counts.item = 1273` (> audited baseline 899), `diagnostics = { fatal: 0, diagnostic: 3041 }`, `itemSubtypeUnsupported = 0`, wrote `pipeline/dist/data.sqlite` at 4,751,360 bytes, and `game.quit` completed. Audited collapsed samples recovered to leaf variants: `BASE Arrow -> arrow`, `BASE BOW -> bow`, `Base Throwing -> throwing-item`; live data also included 193 `throwing-potion` rows.

**Delivers:** broadens variant coverage to every concrete item asset type in Ardenfall Demo `0.0.10.91`: `ItemData`, `CurrencyItemData`, `ConsumableItemData`, `LockpickItemData`, `NoteItemData`, `PotionRecipeItemData`, `RepairKitItemData`, `EquipItemData`, `ArrowItemData`, `HandItemData`, `PrimaryHandItemData`, `BowItemData`, `SlateSpellItemData`, `ThrowingItemData`, `ThrowingPotionData`, `MeleeItemData`, and `ArmorItemData`. Slice 2 is audit-gated by decompiled `mod/libs/Assembly-CSharp.dll` C#/IL plus live runtime diagnostics/data; runtime reflection is not an audit source of truth. The live Slice 1.5 snapshot reported 374 unsupported subtype diagnostics: `ItemData` 254, `NoteItemData` 65, `ConsumableItemData` 46, `CurrencyItemData` 4, `LockpickItemData` 2, `PotionRecipeItemData` 2, and `RepairKitItemData` 1. The audit also identified leaf subclasses currently collapsed by ancestor checks, including arrows, bows, throwing items, and `ThrowingPotionData`.

Plan-critical audit decisions:

- `ThrowingPotionData` is a concrete item leaf even though it does not end in `ItemData`; classifier coverage must be explicit.
- `ItemData.category` is `Parameter<ItemCategory>` and is planned as `categoryRef:ref:asset`, not a string.
- `itemAIBehavior` is deferred as behavior/asset data, not exposed as a string.
- `LeveledStatusEffect.StackMode` uses structured DTO fields `{ type, addLevel, maxLevel }`.
- Public names and recipe/effect fields use game behavior (`GetItemName()`, `RecipeName`, `VisualLevel`, `GetEffectName()`, `GetSecondaryLevel()`) rather than raw field reads where audited methods encode semantics.
- Optional asset refs are absent/null when the source object is absent; unresolved non-null refs stay visible with row-scoped diagnostics.
- `PotionRecipe.RecipeName` is read only after validity/has-potion guards; invalid recipes emit `recipeName = null` instead of throwing.
- `ThrowingPotionData.VisualLevel` remains numeric, not integer-truncated; empty-area potion effect names are optional.

Planned canonical tables:

- `item_basic`
- `item_currency`
- `item_lockpicks`
- `item_consumables`
- `item_notes`
- `item_potion_recipes`
- `item_repair_kits`
- `item_arrows`
- `item_bows`
- `item_slate_spells`
- `item_throwing_items`
- `item_throwing_potions`

**Trigger for breakdown:** if a subtype touches spells, notes/books, potion/status effects, or other domains deeply, it becomes its own plan (e.g. `item_slate_spells` may need a forward reference to the Slice 11 spell data; the plan resolves it as a typed JSON leaf for now and revisits when spells land).

### Slice 3 — Asset pipeline (item icons)

**Status:** done
**Completed:** 2026-05-14 on `main`; implementation commits `c0623ca..4fb4b17`, with this roadmap closeout commit recording final local verification evidence.
**Plan:** `docs/superpowers/plans/2026-05-14-slice3-item-icon-assets.md`
**Spec coverage:** baseline §8.4, §9 (`emit-assets`), §12; amendment §13, §16; investment-priorities §2 (presentation depth follows breadth); `docs/superpowers/specs/2026-05-14-slice3-item-icon-asset-design.md`.
**Audit:** `docs/superpowers/specs/2026-05-14-item-icon-tooltip-audit.md`; grounded in decompiled `ItemData`, `BaseItem`, item subclass, `ItemCategory`, and UI scripts after Slice 2 live smoke.
**Verification evidence:** local gates passed on 2026-05-14 (`bun run codegen:validators`, `bun run typecheck`, `bun test pipeline/test`, `bun test tooling.test.ts`, `bun run check:fixtures`, `bun run pipeline:run fixtures/synthetic/snapshot pipeline/dist`, `bun run --cwd site smoke:item-icons`, `bun run --cwd site check`, `bun run --cwd site build`, `dotnet format mod/ArdenfallCompendium.csproj --verify-no-changes`, `dotnet test mod-tests/ArdenfallCompendium.Tests.csproj`, `bun run format:check`, `bun run lint`, `git diff --check`). Synthetic generated-artifact build wrote `pipeline/dist/data.sqlite` at 266,240 bytes and 4 asset refs to `pipeline/dist/assets`; site build sync copied `data.sqlite` and 2 WebP assets into `site/static`.

**Delivered:**

- Content-addressed item icon emission from the mod, with behavior-derived display icons matching game UI source order (`BaseItem.GetIcon()` plus slate spell/status-effect overrides), cropped sprite PNG export, display icon colour metadata, and secondary icon slots for future presentation depth.
- Pipeline asset manifest ingestion, WebP optimisation via pinned direct `sharp`, `asset_refs` population, and generated read-model fields for icon hashes/colours.
- Fully automated generated-artifact sync: `pipeline/dist/{data.sqlite,assets/*.webp}` is copied into `site/static` during site build, with stale managed assets pruned and no direct pipeline writes into `site/static`.
- Visible decorative item icon rendering on `/items` and `/items/[id]`, while deliberately excluding Slice 4 tooltip/hover-card work.

**Live baseline after Slice 2:** `snapshots/snapshots/0.0.10.91-20260514-1621097145580` has `1273` items, `1271 lookupAssetGuidMissing:iconRef`, `2 nullAsset:iconRef`, `127 lookupAssetGuidMissing:quickslotIconRef`, and `15 lookupAssetGuidMissing:projectileIconRef`. The old `898/899` icon-missing baseline is obsolete. `categoryRef`, `spellRef`, `fontRef`, and `projectileRef` diagnostics surfaced by Slice 2 are not all Slice 3 work; Slice 3 targeted visible item image assets first.

**Critical implementation notes from audit:**

- Display icon source order is behavior-specific: `BaseItem.GetIcon()` uses `itemData.icon` then `category.defaultItemIcon`; `SlateSpellItem.GetIcon()` prefers spell icon; `ThrowingPotion.GetIcon()` prefers the first status effect icon; UI consumes `GetIconColor()` alongside the sprite.
- Export actual Sprite pixels and content hashes. Do not try to repair this through `BuiltLookupTable` GUID resolution alone; Slice 2 proved those refs are missing for nearly all item icon slots.
- Crop atlas sprites by sprite rect/texture rect before hashing/encoding.
- Keep raw refs (`iconRef`, `quickslotIconRef`, `projectileIconRef`, `categoryRef`) separate from behavior-derived display slots so future presentation can explain provenance.

### Slice 3.5 — Static prerender architecture

**Status:** done
**Completed:** 2026-05-15 on `main`; implementation commits `a73dcdd..070c338`, with the roadmap closeout commit recording final local verification evidence. Production deployment was corrected to Cloudflare version `f36d3e70-6a06-4b5a-a49f-0e0579321937` after regenerating `pipeline/dist` from the real `0.0.10.91-20260515-1414238114030` snapshot.
**Plan:** `docs/superpowers/plans/2026-05-15-site-prerender-static-assets.md`
**Spec coverage:** baseline §11 and §14 (site presentation/SEO), baseline §16 open question 1 (deployment), investment-priorities §3 (foundation cost/reliability before depth), and Slice 1.5 deployment decisions.
**Verification evidence:** local gates passed on 2026-05-15 (`bun run pipeline:run fixtures/synthetic/snapshot pipeline/dist`, `bun run codegen:validators`, `bun run typecheck`, `bun test tooling.test.ts`, `bun test controller/test`, `bun run --cwd site smoke:item-icons`, `bun run --cwd site check`, `bun run --cwd site build`, `bun run --cwd site smoke:prerender`, `bun run format:check`, `bun run lint`, `git diff --check`). Static output checks confirmed `.svelte-kit/cloudflare/items.html` and `.svelte-kit/cloudflare/items/fixture-iron-sword.html` exist; `/items` HTML contains `Iron Sword` and does not contain the Svelte hydration entry. The synthetic generated-artifact build wrote `pipeline/dist/data.sqlite` at 266,240 bytes and 4 asset refs to `pipeline/dist/assets`. Corrected production smoke for Cloudflare version `f36d3e70-6a06-4b5a-a49f-0e0579321937` used a real-data `pipeline/dist/data.sqlite` with 1,273 item overview rows and 1,745 asset refs, and returned 200 for `https://ardenfall.compendiums.org/items`, `https://ardenfall.compendiums.org/items/055b284f8d0701643bc93d0879ebf85e.11400000`, `https://ardenfall.compendiums.org/data.sqlite`, and `https://ardenfall.compendiums.org/assets/1f004d6a9f4e47565f6fc037205f0815a1a7b1651fed6027bf86e68d232f0e80.webp`; the HTML smoke inspected `A Treatise On The Nature of The Darvaki I`, `item-icon`, `/assets/`, and absence of `_app/immutable/entry/app` and `sqlite-wasm`.

**Why this interrupts the roadmap:** Slice 3 exposed that Ardenfall currently ships `/items` and detail pages as empty client-rendered SPA shells (`ssr = false`, `prerender = false`) that hydrate from `/data.sqlite` in the browser. That is the wrong default for this compendium. Almost all generated pages are deterministic for a given snapshot and should be static HTML built once during deploy. Cloudflare Workers Static Assets serve matching files without invoking Worker code; SvelteKit also excludes `prerender = true` routes from the dynamic SSR manifest. Both behaviours directly reduce Worker invocations, Worker bundle surface, blank-shell failure modes, and edge runtime dependency risk.

**Research notes:**

Cloudflare Workers Static Assets documentation states that matching files in the configured assets directory are served without invoking Worker code, and only non-matching requests fall through to the Worker. SvelteKit page-options documentation states that `ssr = false` renders an empty shell and is not the right mode for static generation; prerendered routes are generated at build time and excluded from dynamic SSR manifests. SvelteKit dynamic routes require either crawler-discovered links or an `entries()` generator. `adapter-cloudflare` remains the correct adapter because it emits a Worker plus the static asset bundle for Workers Static Assets; the target is not "no Worker exists", but "normal page and asset traffic resolves as static assets before Worker execution".

**Target architecture:**

- Root layout defaults to `ssr = true`, `prerender = true`, and `csr = false` for static pages. Re-enable CSR only for a route whose user value requires browser interactivity; such routes must document why Worker/static HTML alone is insufficient.
- Route data moves from browser `@sqlite.org/sqlite-wasm` access to server/build-time `+page.server.ts` loads backed by a server-only SQLite reader over `site/static/data.sqlite`.
- `/items` is prerendered as static HTML containing the overview table and decorative item icons.
- `/items/[id]` exports `entries()` from generated item IDs and prerenders every current item detail page.
- `/data.sqlite` and `/assets/*.webp` remain deployed static artifacts for future interactive routes and downloadable/debug use, but the initial item pages must not require fetching `/data.sqlite` in the browser.
- `EntityTable` becomes static HTML in this slice. Client sorting/filtering is deferred until Slice 10 unless a route explicitly opts into CSR with a measured need.
- Cloudflare deployment keeps `[assets] directory = ".svelte-kit/cloudflare"` and `run_worker_first` unset/false so matching static assets short-circuit the Worker.

**Acceptance criteria:**

- `bun run --cwd site build` produces static item overview HTML and at least one static item detail HTML file from the synthetic fixture. With SvelteKit's default `trailingSlash = "never"`, those files are `.svelte-kit/cloudflare/items.html` and `.svelte-kit/cloudflare/items/<id>.html`; do not force directory-style `index.html` output unless canonical URL policy changes.
- The prerendered item overview HTML contains visible item text (for example `Iron Sword`) and at least one `/assets/<hash>.webp` image reference.
- The prerendered item detail HTML contains the item name and decorative icon markup without requiring Svelte hydration.
- `site/.svelte-kit/cloudflare/_worker.js` no longer needs the item overview/detail route modules for normal traffic; the plan verifies this through static output and HTTP checks rather than brittle minified-string assertions.
- `bun run --cwd site check`, `bun run --cwd site build`, `bun test tooling.test.ts`, and local prerender smoke pass.
- A browser or HTTP smoke after deploy must prove `/items`, an item detail route, `/data.sqlite`, and a representative `/assets/*.webp` all return 200. Page HTML checks must inspect actual HTML content, not just status codes.
- Deployment closeout must record the Cloudflare version ID and a production smoke that inspects HTML content for `/items` and one item detail page.

### Slice 3.6 — Artifact provenance release contract

**Status:** done
**Completed:** 2026-05-15 on `main`; implementation commits `ace3f3f..e3227c1`. Production deployment completed as Cloudflare version `50c8bd69-d461-4b40-be00-3e4cf4a9e408` from release artifact `0.0.10.91-20260515-1414238114030`.
**Spec:** `docs/superpowers/specs/2026-05-15-artifact-provenance-release-design.md`
**Plan:** `docs/superpowers/plans/2026-05-15-artifact-provenance-release.md`

**Why this interrupts the roadmap:** Slice 3.5 proved static prerendering works, but the first production deploy exposed that fixture and release artifacts shared `pipeline/dist`. Production deploys need provenance and artifact identity before further content slices add more generated pages.

**Acceptance criteria:** fixture builds emit fixture artifacts and remain fast; release builds emit release artifacts with Git/source/hash/count/probe metadata; production deploy scripts reject fixture artifacts; `/_release.json`, `/data.sqlite`, `/items`, an item detail route, and a representative asset are smoked against the same release manifest after deploy.

**Verification evidence:** final local gates passed (`bun run codegen:validators`, `bun run typecheck`, `bun test tooling.test.ts`, `bun test pipeline/test`, `bun test controller/test`, `dotnet test mod-tests/ArdenfallCompendium.Tests.csproj`, `bun run --cwd site check`, `bun run --cwd site build:fixture`, `bun run --cwd site smoke:prerender`, `bun run format:check`, `bun run lint`, `git diff --check`). Pre-push hook passed typecheck and 83 Bun tests. Release artifact `pipeline/artifacts/releases/0.0.10.91-20260515-1414238114030` recorded Git commit `e3227c14a3f893fad7393814451fbe49bb65d053`, `dirty: false`, SQLite hash `35ad46d4e421a8ed885ed54cdf05760601ed56e07fe93b66ae2081ac3192fa65`, 1,273 item overview rows, 1,273 item detail rows, 1,745 asset refs, and probe item `055b284f8d0701643bc93d0879ebf85e.11400000` / `A Treatise On The Nature of The Darvaki I` / `1f004d6a9f4e47565f6fc037205f0815a1a7b1651fed6027bf86e68d232f0e80`. Production deploy command `bun run --cwd site deploy:production ../pipeline/artifacts/releases/0.0.10.91-20260515-1414238114030` completed and ran release smoke against `https://ardenfall.compendiums.org`, verifying `/_release.json`, `/data.sqlite`, `/items`, `/items/055b284f8d0701643bc93d0879ebf85e.11400000`, and the probe WebP asset against the same manifest.

### Slice 4 — Item presentation depth

**Status:** done
**Completed:** 2026-05-19 on `main`; implementation commits `dd2cff2..234f454`, with production deployment completed as Cloudflare version `57fa31fe-14d3-4dbf-bab3-35f2ff9a2305` from release artifact `0.0.10.91-20260519-1949114509380`.
**Spec coverage:** investment-priorities §1, §2; baseline §11, §14.
**Design draft:** `docs/superpowers/specs/2026-05-19-item-presentation-depth-design.md`.
**Implementation plan:** `docs/superpowers/plans/2026-05-19-item-presentation-depth.md`.
**Audit dependency:** `docs/superpowers/specs/2026-05-14-item-icon-tooltip-audit.md` confirms rich tooltip rendering belongs here, not Slice 3. `docs/superpowers/specs/2026-05-15-tooltip-and-ui-surface-audit.md` traces the game tooltip code and adjacent UI surfaces that should shape the Slice 4 design.

**Delivers:** the presentation-contract, linking-contract, and UI-governance track for items, executed after items have full data and icons.

- `item_presentation_rows` as the public item page and tooltip contract, with clean cutover from old `item_detail_rows.fields_json` public plumbing.
- Behavior-grounded, deterministic item presentation under `item-presentation-v1`: display name/type provenance, rich descriptions/effects, base stat rows, requirements, durability facts, state facts, omissions, and diagnostics.
- Safe `rich_text_v1` translation for TMP/game strings. Raw Unity/TMP markup and sanitized HTML strings are retained only as source/debug evidence, never as the DOM contract.
- Generated relationship graph foundation: canonical nodes, aliases, redirects, disambiguations, typed edges, relationship sections, and link audit. Deferred/future entity targets render as inert text or diagnostics, not broken public links.
- Governed UI seed: token-backed shared components, component catalog/intake gate, static tooltip/focus-card presentation, and route files that assemble components instead of duplicating item header/stat/effect/link markup.
- Item overview enhancements: static fallback plus bounded canonical URL-state sorting/filtering on generated facts. Full cross-entity FTS5/Pagefind search and broad facets remain Slice 10 work.

**Verification evidence:** final local gates passed (`bun run codegen:validators`, `bun run check:fixtures`, `dotnet test mod-tests/ArdenfallCompendium.Tests.csproj`, `bun test pipeline/test`, `bun test tooling.test.ts`, `bun test controller/test`, `bun run typecheck`, `bun run --cwd site check`, `bun run artifact:fixture synthetic fixtures/synthetic/snapshot`, `bun run --cwd site build:fixture`, `bun run --cwd site smoke:prerender`, `bun run --cwd site smoke:item-icons`, `bun run format:check`, `bun run lint`, `git diff --check`). Pre-push hooks passed typecheck and 94 Bun tests. Fresh live export published `snapshots/snapshots/0.0.10.91-20260519-1949114509380` with `items.json.schemaVersion = 2`, `counts.item = 1273`, and `diagnostics = { fatal: 0, diagnostic: 3041 }`. Release artifact `pipeline/artifacts/releases/0.0.10.91-20260519-1949114509380` recorded Git commit `234f45401a831e11e66c9a2509e568778cd227f0`, `dirty: false`, SQLite hash `ad6acdc880808cf21e4105b3f9e7a73c3995c3917c03d3a2a57c6cb1e1e6590c`, 1,273 item overview rows, 1,273 item presentation rows, 1,289 entity nodes, 1,273 relationship sections, 0 relationship diagnostics, 1,745 asset refs, and 85 WebP assets. Production deploy command `bun run --cwd site deploy:production ../pipeline/artifacts/releases/0.0.10.91-20260519-1949114509380` completed and smoke-verified `/_release.json`, `/data.sqlite`, `/items`, `/items/055b284f8d0701643bc93d0879ebf85e.11400000`, and the probe WebP asset against the same manifest.

**Why before maps:** items are the dominant audience surface (investment-priorities §1). Investing in their presentation before locations/maps maximises return on the most-visited pages.

### Slice 5 — Locations and map data substrate

**Status:** planned
**Spec coverage:** baseline §10; amendment §17–§18; investment-priorities §1 (maps second).

**Delivers:** `LocationAsset` extraction; `locations` and `location_volumes` canonical tables; coordinate canonicalisation per design spec §10.3 (Y-negation performed once at canonicalisation); descriptor-driven point/polygon support. This slice prepares map data without requiring tile capture or deck.gl UI yet.

### Slice 6 — Map system

**Status:** planned
**Spec coverage:** baseline §10; amendment §17; investment-priorities §1.

**Delivers:** deck.gl `OrthographicView` map; emitted `map_layers` metadata/read models; the generic `createEntityLayer(descriptor, data, filters)` loop replacing AK's wall of imperative calls; first tile pyramid if capture tooling is ready.

**Open questions to close in this slice's plan:** orthographic camera setup, zoom levels, projection bounds, capture stitching strategy.

### Slice 7+ — Map-supporting entities (game-specific)

**Status:** planned (concrete entity set firm-up owed by Slice 6's plan)
**Spec coverage:** investment-priorities §4.

**Delivers:** the entities that make the map useful. Concrete set is deliberately not pre-enumerated here. Likely candidates for Ardenfall:

- Monsters / enemies (with map placement plus detail pages with drop tables once items are richly modelled).
- Vendors (map placement plus inventory tables linking to items).
- Zone connections / portals.
- Resource nodes / gathering points.
- Points of interest / lore markers.

Each candidate gets its own slice number (7, 8, …), ordered by map-marker volume and detail-page value. Each candidate slice ships data + map-layer integration; some may earn a follow-up presentation-depth slice (e.g. monster pages with item drop tables).

**Trigger to firm up:** Slice 6's plan must enumerate the candidate set and propose an order. That decision then folds into this roadmap as a non-provisional ordering for the next planning horizon.

Any map-supporting entity slice that ships public detail pages must reuse Slice 4's presentation, rich-text, component, and relationship contracts. Marker-only slices can stay map/read-model focused; public pages must not invent route-local link or tooltip systems.

### Slice 10 — Search, facets, and cross-cutting design depth

**Status:** planned
**Spec coverage:** baseline §11, §14, §15 P5; amendment §16; investment-priorities §5.

**Delivers:** Cross-entity FTS5/Pagefind search routes, broad facets, generated search/filter read models, and scale-up governance only if accumulated Slice 4+ pressure proves it necessary: lint rules, Storybook, visual regression, or richer catalog automation. It does not introduce the design-system foundation; it extends the Slice 4 catalog/component/token contract when the lighter dev-gallery path stops being cheaper.

**Why later than the AK precedent's design slice:** Ardenfall Compendium seeds design-system governance in Slice 4 beside the first deep content surface. Slice 10 waits for enough cross-entity content and component volume to justify search infrastructure and heavier governance automation.

### Slice 11 — Spells

**Status:** planned
**Spec coverage:** amendment §18; investment-priorities §1 (spells after items/maps).

**Delivers:** `SpellData` extraction and canonicalisation: typed `spells` root table; generated tooltips through the shared `rich_text_v1` contract when feasible; references to `StatType`; type-tagged validated JSON for `SpellEffect` / `SubSpellData.effects`; public spell nodes/routes in the shared relationship graph; resolution of Slice 4 slate-spell item references without introducing a spell-specific HTML or link pipeline.

**Note:** the original roadmap had spells at Slice 4. Investment-priorities §1 reorders this; spells run after the items + maps + map-supporting-entities tracks.

### Slice 12 — Quests and graph-heavy data

**Status:** planned
**Spec coverage:** amendment §18; investment-priorities §1.

**Delivers:** typed `quests` root table; child tables for stable phases/objectives/events/rewards where practical; validated type-tagged JSON for FlowCanvas/Odin graph internals until queries prove typed tables are warranted. Public quest links, aliases, redirects, disambiguation, and related-entity sections reuse the Slice 4 relationship-graph contract; internal quest logic graphs do not become a second public link graph.

### Slice 13 — Versioning, diff, and snapshot archive

**Status:** planned
**Spec coverage:** baseline §13, §16.9; amendment §15.

**Delivers:** committed summary digests; cross-version diff CLI; raw snapshot/canonical SQLite archive workflow; PR-body digest template; external archive backend selected.

### Slice 14 — Override mechanism

**Status:** deferred
**Trigger:** first authored correction that the extracted data cannot carry, or first need to distinguish resolved value from authored default/override in public output.
**Spec coverage:** baseline §6, §16.8; amendment §12.

### Slice 15 — AGENTS.md / CLAUDE.md per subsystem with worked examples

**Status:** planned
**Spec coverage:** baseline §15 P8.

**Delivers:** repo-level and per-subsystem agent guidance with explicit good/bad examples. Earlier slices may land minimal stubs; this slice fills them in once architecture has stopped moving. Examples should cover generated presentation/read-model cutovers, typed rich-text rendering with no raw `{@html}`, relationship-graph link governance, and component-intake decisions.

## Open questions tracker

| #   | Question                               | Status                                    | Closes in slice                                                                                                                                                   |
| --- | -------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Deployment target                      | **closed**                                | Slice 1.5 deployed `ardenfall.compendiums.org` through local/operator Wrangler + Cloudflare Workers Static Assets                                                 |
| 2   | Repo strategy + CI tooling             | **closed**                                | Slice 1 (`2026-05-03-slice1-tooling-decisions.md` §1, §8)                                                                                                         |
| 3   | Component library / primitive strategy | **closed (foundation + governance seed)** | Slice 1 chose Tailwind v4/shadcn-svelte/Bits primitives; Slice 4 seeds component catalog, token, and intake governance; Slice 10 scales automation only if needed |
| 4   | JSON Schema validator                  | **closed**                                | Slice 1 (`2026-05-03-slice1-tooling-decisions.md` §3)                                                                                                             |
| 5   | Property-test framework                | **closed**                                | Slice 1 (`2026-05-03-slice1-tooling-decisions.md` §4)                                                                                                             |
| 6   | Tile capture specifics                 | open                                      | Slice 6                                                                                                                                                           |
| 7   | External archive backend               | open                                      | Slice 13                                                                                                                                                          |
| 8   | Future gameplay-mod surface            | deferred                                  | indefinitely                                                                                                                                                      |
| 9   | Map-supporting entity ordering         | open                                      | Slice 6 (firm-up)                                                                                                                                                 |

## Update protocol

When a slice transitions:

- **Brainstorming → drafting:** all decisions that materially affect the slice are closed or marked provisional with revisit triggers.
- **Drafting → ready:** active plan location and commit hash recorded while the plan is live.
- **Ready → in-progress:** branch noted when work does not happen directly on `main`.
- **In-progress → done:** completion date recorded; any spec deviations noted under the slice with rationale; completed plan/progress artifacts removed from the working tree.
- **Public-contract replacement:** when a slice replaces a public read model, route contract, rich-text/link contract, or shared UI primitive, remove old public fallback/plumbing in the same slice. Temporary inspection surfaces must be private/debug-only, and downstream slice entries must reference the new contract.
- **Slice re-shaped:** old slice marked `superseded by Slice N`, new slice added.
- **Investment priority shift:** evidence (analytics, user feedback, structural game change) recorded in `2026-05-07-investment-priorities.md` under "Revisit triggers"; affected slice ordering updated here.
