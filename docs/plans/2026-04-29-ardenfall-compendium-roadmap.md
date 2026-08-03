---
title: "Ardenfall Compendium — Implementation Roadmap"
type: overview
status: active
created: 2026-04-29
parent:
superseded_by:
archived:
---

# Ardenfall Compendium — Implementation Roadmap

Living tracker for implementation of:

- Baseline spec: `docs/plans/archive/2026-04-28-ardenfall-compendium-design.md`
- Slice 1 amendment: `docs/plans/archive/2026-04-29-ardenfall-compendium-implementation-decisions.md`
- Slice 1 tooling decisions: `docs/plans/archive/2026-05-03-slice1-tooling-decisions.md`
- Investment priorities: `docs/plans/archive/2026-05-07-investment-priorities.md`

The amendment is authoritative where it differs from the baseline spec. The investment-priorities spec governs slice ordering and presentation depth; the roadmap below reflects it.

## How this is organised

The project spans three layered subsystems (BepInEx mod, TS/Bun pipeline, SvelteKit site) plus shared descriptor/schema infrastructure. Rather than one mega-plan, work is split into **slices**. Each active slice may get an execution plan under `docs/plans/` while work is live; when the slice ships, its plan is marked `implemented` and moved to `docs/plans/archive/` (per the planning-files convention) rather than deleted.

Slice ordering is driven by `docs/plans/archive/2026-05-07-investment-priorities.md`: items get the deepest investment first (data breadth, then assets, then presentation depth), maps come second (locations, map system, then map-supporting entities one-by-one), with spells/quests after. Each major entity gets a data slice plus a presentation depth slice; depth is not deferred to a single distant design-system slice. One operational override currently sits above all content work: the site must return to a static-assets-first SvelteKit architecture before Slice 4 or any new entity slice, because avoidable Worker invocations threaten the Cloudflare Workers free-tier envelope and make production failures look like blank client shells.

## Status legend

- **planned** — described here, no plan written yet
- **brainstorming** — design decisions still being closed
- **drafting** — plan being written
- **ready** — plan written and committed, awaiting execution
- **in-progress** — plan execution underway
- **done** — slice executed and merged; the execution plan is marked `implemented` and moved to `docs/plans/archive/`
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
- Site `+error.svelte` for SvelteKit error states, with `site/scripts/smoke-error-route.ts` covering the unknown-item route.
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

### Operational slice — HotRepl v3 typed command migration

**Status:** done
**Plan:** HotRepl repo `docs/plans/archive/2026-05-23-hotrepl-phase4a-consumer-migration.md`
**Spec coverage:** amendment §14 lifecycle/export flow plus HotRepl typed-command roadmap Phase 2.

**Delivers:** clean cutover from Ardenfall's legacy HotRepl control wire to HotRepl.Core 3.0.0 typed commands. The mod now registers `IControlCommandHandler<TArgs,TOutput>` handlers with generated lower-camel schemas; command outputs use typed DTOs; artifact references are keyed maps. The controller consumes the current protocol (`handshake`, `commands_list`, `job_accepted`, terminal `job_result` from `job_status`, `.output`, artifact maps) and removes auth/token/lease/job-result request plumbing.

**Operational notes:** runtime deployment must copy the HotRepl host output and sidecar DLLs, including schema-generation dependencies such as `Namotion.Reflection.dll`. HotRepl has no auth or lease handshake in this protocol; default deployment remains loopback-only (`127.0.0.1`) unless an operator explicitly supplies a broader trusted network boundary.

**Verification evidence:** local gates passed (`bun test controller/test`, `dotnet test mod-tests/ArdenfallCompendium.Tests.csproj --nologo -v q`, `dotnet build mod/ArdenfallCompendium.csproj -c Debug --nologo -v q`, `bun run typecheck`). `bun run hotrepl:setup` also completed, copying HotRepl host sidecars, UnityCommands, and ArdenfallCompendium into the configured BepInEx plugins directory; the local `.env` explicitly set `HOTREPL_BIND_HOST=0.0.0.0`, so that setup run intentionally used host-reachable binding rather than the new script default. Live export against Ardenfall Demo `0.0.10.91` then completed through the typed command controller, publishing `snapshots/snapshots/0.0.10.91-20260524-1022238608580` with counts `{ item: 1273, stat-type: 20, item-category: 7, item-tag: 28 }`, diagnostics `{ fatal: 0, diagnostic: 1807 }`, `pipeline/dist/data.sqlite` at 6,238,208 bytes, 1,779 asset refs, and `game.quit` completed.

### Slice 2 — Item subtype enrichment

**Status:** done
**Completed:** 2026-05-14 on `main`; implementation commits `8dc97f6..05e1887`, with the roadmap closeout commit recording live-smoke evidence.
**Plan:** `docs/plans/archive/2026-05-14-item-subtype-enrichment.md`
**Audit:** `docs/plans/archive/2026-05-14-item-subtype-audit.md`; completed in `8dc97f6 chore(items): add decompilation audit tooling`, reconciled into the active plan before implementation.
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
**Plan:** `docs/plans/archive/2026-05-14-slice3-item-icon-assets.md`
**Spec coverage:** baseline §8.4, §9 (`emit-assets`), §12; amendment §13, §16; investment-priorities §2 (presentation depth follows breadth); `docs/plans/archive/2026-05-14-slice3-item-icon-asset-design.md`.
**Audit:** `docs/plans/archive/2026-05-14-item-icon-tooltip-audit.md`; grounded in decompiled `ItemData`, `BaseItem`, item subclass, `ItemCategory`, and UI scripts after Slice 2 live smoke.
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
**Plan:** `docs/plans/archive/2026-05-15-site-prerender-static-assets.md`
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
**Spec:** `docs/plans/archive/2026-05-15-artifact-provenance-release-design.md`
**Plan:** `docs/plans/archive/2026-05-15-artifact-provenance-release.md`

**Why this interrupts the roadmap:** Slice 3.5 proved static prerendering works, but the first production deploy exposed that fixture and release artifacts shared `pipeline/dist`. Production deploys need provenance and artifact identity before further content slices add more generated pages.

**Acceptance criteria:** fixture builds emit fixture artifacts and remain fast; release builds emit release artifacts with Git/source/hash/count/probe metadata; production deploy scripts reject fixture artifacts; `/_release.json`, `/data.sqlite`, `/items`, an item detail route, and a representative asset are smoked against the same release manifest after deploy.

**Verification evidence:** final local gates passed (`bun run codegen:validators`, `bun run typecheck`, `bun test tooling.test.ts`, `bun test pipeline/test`, `bun test controller/test`, `dotnet test mod-tests/ArdenfallCompendium.Tests.csproj`, `bun run --cwd site check`, `bun run --cwd site build:fixture`, `bun run --cwd site smoke:prerender`, `bun run format:check`, `bun run lint`, `git diff --check`). Pre-push hook passed typecheck and 83 Bun tests. Release artifact `pipeline/artifacts/releases/0.0.10.91-20260515-1414238114030` recorded Git commit `e3227c14a3f893fad7393814451fbe49bb65d053`, `dirty: false`, SQLite hash `35ad46d4e421a8ed885ed54cdf05760601ed56e07fe93b66ae2081ac3192fa65`, 1,273 item overview rows, 1,273 item detail rows, 1,745 asset refs, and probe item `055b284f8d0701643bc93d0879ebf85e.11400000` / `A Treatise On The Nature of The Darvaki I` / `1f004d6a9f4e47565f6fc037205f0815a1a7b1651fed6027bf86e68d232f0e80`. Production deploy command `bun run --cwd site deploy:production ../pipeline/artifacts/releases/0.0.10.91-20260515-1414238114030` completed and ran release smoke against `https://ardenfall.compendiums.org`, verifying `/_release.json`, `/data.sqlite`, `/items`, `/items/055b284f8d0701643bc93d0879ebf85e.11400000`, and the probe WebP asset against the same manifest.

### Slice 4 — Item presentation depth

**Status:** done
**Completed:** 2026-05-19 on `main`; implementation commits `dd2cff2..234f454`, with production deployment completed as Cloudflare version `57fa31fe-14d3-4dbf-bab3-35f2ff9a2305` from release artifact `0.0.10.91-20260519-1949114509380`.
**Spec coverage:** investment-priorities §1, §2; baseline §11, §14.
**Design draft:** `docs/plans/archive/2026-05-19-item-presentation-depth-design.md`.
**Implementation plan:** `docs/plans/archive/2026-05-19-item-presentation-depth.md`.
**Audit dependency:** `docs/plans/archive/2026-05-14-item-icon-tooltip-audit.md` confirms rich tooltip rendering belongs here, not Slice 3. `docs/plans/archive/2026-05-15-tooltip-and-ui-surface-audit.md` traces the game tooltip code and adjacent UI surfaces that should shape the Slice 4 design.

**Delivers:** the presentation-contract, linking-contract, and UI-governance track for items, executed after items have full data and icons.

- `item_presentation_rows` as the public item page and tooltip contract, with clean cutover from old `item_detail_rows.fields_json` public plumbing.
- Behavior-grounded, deterministic item presentation under `item-presentation-v1`: display name/type provenance, rich descriptions/effects, base stat rows, requirements, durability facts, state facts, omissions, and diagnostics.
- Safe `rich_text_v1` translation for TMP/game strings. Raw Unity/TMP markup and sanitized HTML strings are retained only as source/debug evidence, never as the DOM contract.
- Generated relationship graph foundation: canonical nodes, aliases, redirects, disambiguations, typed edges, relationship sections, and link audit. Deferred/future entity targets render as inert text or diagnostics, not broken public links.
- Governed UI seed: token-backed shared components, component catalog/intake gate, static tooltip/focus-card presentation, and route files that assemble components instead of duplicating item header/stat/effect/link markup.
- Item overview enhancements: static fallback plus bounded canonical URL-state sorting/filtering on generated facts. Full cross-entity FTS5/Pagefind search and broad facets remain Slice 10 work.

**Verification evidence:** final local gates passed (`bun run codegen:validators`, `bun run check:fixtures`, `dotnet test mod-tests/ArdenfallCompendium.Tests.csproj`, `bun test pipeline/test`, `bun test tooling.test.ts`, `bun test controller/test`, `bun run typecheck`, `bun run --cwd site check`, `bun run artifact:fixture synthetic fixtures/synthetic/snapshot`, `bun run --cwd site build:fixture`, `bun run --cwd site smoke:prerender`, `bun run --cwd site smoke:item-icons`, `bun run format:check`, `bun run lint`, `git diff --check`). Pre-push hooks passed typecheck and 94 Bun tests. Fresh live export published `snapshots/snapshots/0.0.10.91-20260519-1949114509380` with `items.json.schemaVersion = 2`, `counts.item = 1273`, and `diagnostics = { fatal: 0, diagnostic: 3041 }`. Release artifact `pipeline/artifacts/releases/0.0.10.91-20260519-1949114509380` recorded Git commit `234f45401a831e11e66c9a2509e568778cd227f0`, `dirty: false`, SQLite hash `ad6acdc880808cf21e4105b3f9e7a73c3995c3917c03d3a2a57c6cb1e1e6590c`, 1,273 item overview rows, 1,273 item presentation rows, 1,289 entity nodes, 1,273 relationship sections, 0 relationship diagnostics, 1,745 asset refs, and 85 WebP assets. Production deploy command `bun run --cwd site deploy:production ../pipeline/artifacts/releases/0.0.10.91-20260519-1949114509380` completed and smoke-verified `/_release.json`, `/data.sqlite`, `/items`, `/items/055b284f8d0701643bc93d0879ebf85e.11400000`, and the probe WebP asset against the same manifest.

**Why before maps:** items are the dominant audience surface (investment-priorities §1). Investing in their presentation before locations/maps maximises return on the most-visited pages.

### Slice 4.5 — Items presentation closure

**Status:** done
**Spec coverage:** investment-priorities §1–§2; Slice 4 public presentation and link contracts.

**Delivered:** public stat, item-category, item-tag, and master-tooltip term entities; slug routes and GUID redirects for item pages; route slug helpers shared by site routes; item relationship sections that resolve item-adjacent targets without route-local inference; game-grounded tooltip composition for item presentation facts. Public item pages now depend on generated read models, rich-text nodes, and relationship edges rather than raw game/TMP markup or descriptor parsing in route code.

### Operational slice — HotRepl Phase 4a consumer migration

**Status:** done
**Spec coverage:** amendment §14 lifecycle/export flow; HotRepl typed-command control migration.

**Delivered:** controller-side migration to the current HotRepl typed-command protocol, including command discovery, typed argument/output handling, artifact maps, and unattended `MainMenu → continue → export → quit` flow. The mod command registry and tests cover the typed command surface used by the controller.

### Architecture cleanup and artifact hardening

**Status:** done
**Spec:** `docs/plans/archive/2026-05-26-architecture-cleanup-hardening-design.md`

**Delivered:** descriptor-owned public routes through `site.route`; entity-owned pipeline/site read models behind thin facades; lean item overview payloads; explicit SQLite and sidecar artifact validation before fixture/release publication; Cloudflare Worker compatibility hardening; descriptor coverage diagnostics that fail fast when public or mapped descriptors lack pipeline support.

### Slice 5 — Locations and map data substrate

**Status:** done
**Spec:** `docs/plans/archive/2026-06-02-slice5-location-data-substrate-design.md`
**Audit:** `docs/plans/archive/2026-06-02-location-source-audit.md`
**Spec coverage:** baseline §10; amendment §17–§18; investment-priorities §1 (maps second).

**Delivered:** `LocationAsset` extraction from `MapLocationManager.GetLocations()`; canonical `locations` and `location_volumes`; Unity source `(x,y,z)` to compendium `(map_x,map_y,elevation)` canonicalisation; descriptor-owned `map_layers`; location map point/volume read models; synthetic fixture coverage. No public `/map` or `/locations` route ships in this slice.

### Slice 6 — Map system

**Status:** done
**Spec:** `docs/plans/archive/2026-06-04-slice6-map-system-design.md`
**Spec coverage:** baseline §10; amendment §17; investment-priorities §1.

**Delivered:**

- Vector-first interactive map at `/map`: a deck.gl `OrthographicView` rendered with the standalone `@deck.gl/core` + `@deck.gl/layers` 9.3.x on a GPU (`webgl`) device, loaded only on the map route (CSR exception; deck.gl is a lazy chunk, absent from SSR/prerender output and other route bundles).
- Data-driven `buildEntityLayerSpecs(layerConfig, points, volumes, filters)` factory off the descriptor-owned `map_layers` metadata, with a closed `render_kind` registry that fails loudly on unknown kinds; `point-or-polygon` expands to a marker layer plus a volume-polygon layer. No per-entity branches in render code.
- Build-time `getMapView()` read model shapes layers, points (joined to public location nodes for deep-link short ids), volumes, and per-map bounds; source tables are discovered from `map_layers` and validated against the point/volume suffix contract (fail fast).
- Map UX: pan/zoom, fit-to-bounds, hover tooltip, click-to-select details panel, legend + per-layer toggles, name search with select, and debug-only/fast-travel filters. Debug-only locations are carried in the read model and hidden by default.
- URL-addressable, shareable state (active map, selection, hidden layers, flag filters) synced via `goto` (`replaceState` semantics) after the router is ready; deep links rehydrate selection.
- Cross-linking backbone: public location `entity_nodes` whose `route_path` is the map deep link, validated by the existing relationship audit; the details panel reuses the shared relationship surface (empty until edge-bearing slices land).
- "Map" navigation entry.

**Deferred (model reserved in the spec):** base map tile imagery and capture; `LocationMiniMap` SVG embeds; transitive spatial edges; live in-game markers; continuous pan/zoom in the URL; marker icon-atlas rendering (location icons not yet exported).

**Verification evidence:** local gates passed on 2026-06-04 (`bun run codegen:validators`, `bun run check:fixtures`, `dotnet test mod-tests/...` 89 passed, `bun test pipeline/test tooling.test.ts controller/test` and `bun test site/test`, `bun run typecheck`, `bun run --cwd site check` 0/0, `bun run artifact:fixture synthetic fixtures/synthetic/snapshot`, `bun run --cwd site build:fixture`, `bun run --cwd site smoke:prerender`, `bun run --cwd site smoke:map`, `bun run format:check`, `bun run lint`, `git diff --check`). Interactive browser end-to-end run via the harness against `vite preview` confirmed the map mounts on a `webgl` GPU device, markers/volumes render, click and search select with details panel, layer toggle and filters drive the layers, and URL state round-trips/deep-links — all with zero page errors. An automated browser smoke remains deferred consistent with the repo's deferred browser/visual-testing stance.

**Plan deviations (as built):** URL state is synced via `goto` rather than shallow-routing `replaceState` (the latter crashes when called during hydration); continuous pan/zoom were cut from the URL contract (chatty, low value vs selection); the browser E2E was executed via the harness rather than committed as a puppeteer script (no browser-automation dependency added).

**Open questions closed/advanced here:** #6 tile capture — vector-first shipped; capture/stitch strategy still open for the tile slice. #9 map-supporting entity ordering — the next step is a foundation data-architecture slice before adding more entity-specific map markers.

### Slice 7 — Entity kinds and placement foundation

**Status:** done
**Plan:** `docs/plans/archive/2026-06-05-entity-placement-foundation.md`
**Spec coverage:** investment-priorities §4; baseline §10; amendment §17–§18.

**Delivers:** the clean-cut data substrate required before map-supporting entities can ship without one-off extraction paths. The descriptor model gains explicit entity kinds (`definition`, `instance`, `role`); placements become a general contract instead of a location-only table; `map_points` and `map_volumes` are generalized behind descriptor-owned `map_layers`; and runtime extraction is organized around the three verified source mechanisms: lookup assets, master records, and scene `GuidComponent` instances.

This slice migrates the existing location map data onto the generalized placement/read-model substrate and re-verifies `/map` against both fixture and live-export data. It does not ship a broad set of new public entities; it proves the substrate with the smallest useful record-backed entity needed for the next map slices: portals.

**Acceptance criteria:** live export still produces items, related item entities, locations, generalized placements, and portal records with fatal diagnostics at zero; pipeline emits SQLite placement/map read models without route-local descriptor parsing; `/map` renders existing locations from the generalized tables; and old location-only public map plumbing is removed in the same cutover.

**Verification evidence:** live export on 2026-08-02 against Ardenfall Demo `0.0.10.91` produced `counts.location` 48 and `counts.portal` 33 with `diagnostics.fatal` 0, and the pipeline materialized 81 `placements` (48 location, 33 portal), 67 `map_points` (34 location, 33 portal), and 60 `map_volumes`, with all 33 portals carrying public `entity_nodes` deep links of the form `/map?map=<mapId>&sel=<shortId>`. `location_map_points` and `location_map_volumes` no longer exist in the emitted database. Local gates passed: `bun test pipeline/test` 109, `bun test site/test` 20, `bun test controller/test` 32, `dotnet test mod-tests/...` 93, `bun run typecheck`, `bun run --cwd site check` 0/0, `bun run codegen:validators`, `bun run check:fixtures`, `bun run artifact:fixture synthetic fixtures/synthetic/snapshot`, `bun run --cwd site build:fixture`, `bun run --cwd site smoke:prerender`, `bun run --cwd site smoke:map`, `bun run format:check`, `bun run lint`, `git diff --check`.

**Plan deviations (as built):** the generalized map emitter lives in `pipeline/src/map/read-models.ts` rather than under `entities/location/`, because it is a cross-entity concern. It is driven by the descriptors that declare a `map` layer instead of probing SQLite for entity tables, so a placed entity without a projection raises a contract error rather than silently emitting an empty map. `node_short_id` is not denormalized into `map_points`; the site joins `entity_nodes` for it.

### Slice 7.5 — Asset identity for unregistered definition types

**Status:** done
**Spec coverage:** baseline §10; investment-priorities §1.

**Delivers:** `namedAsset`, a fourth identity mechanism for definition types that `BuiltLookupTable` does not register, and the stat-type and item-category rows that depend on it.

Extraction reaches definition assets through `BuiltLookupTable`, which supplies the stable GUID identity a canonical row needs. Two types were never registered in it, so `GetAssetsOfType` returned nothing and `GetGuid` returned null for them while working correctly for every other type. The assets were loaded and real the whole time. Identity for these types now comes from the asset name, carried as `named;<entityId>;<assetName>` so an id declares which mechanism produced it, the same way record ids do.

That single gap had produced three symptoms: `/stats` and `/categories` shipped empty, and 1268 of 1273 items carried a `categoryRef` that could not resolve.

**Verification evidence:** live export on 2026-08-02 against Ardenfall Demo `0.0.10.91` produced `counts.stat-type` 21 and `counts.item-category` 7, both previously zero, with `diagnostics.fatal` 0 and non-fatal diagnostics down from 3044 to 1810 as the category references resolved. All 1273 items now carry a resolvable category, distributed across Spells 280, Armor 261, Consumables 239, Misc 202, Weapons 150, Quest 71, and Notes 65. Stats classify as 5 attributes and 16 skills, and public entity nodes now cover 21 stat types and 7 categories with readable routes such as `/stats/agility--att-agility`.

**Plan deviations (as built):** stat grouping no longer has a `trait` value. It tested whether a stat id appeared in the master tooltip's skill vocabulary, which lists slugs like `heavy_armor` rather than asset ids, so the test could never pass and every non-attribute stat fell through to `trait`. The tooltip lists traits separately as GUIDs of a different asset type, so a `StatType` is an attribute or a skill and the asset's own `isAttribute` decides. Traits, if they ship, will be their own entity.

**Guard added with the fix:** a descriptor that declares a public site route while its snapshot carries zero rows now raises a diagnostic at export time. This condition went unreported for as long as the two entities existed, because the synthetic fixture supplied rows the live game did not, leaving the whole suite green over two empty public sections.

### Portal connectivity and honest portal names

**Status:** done
**Spec coverage:** investment-priorities §4.

**Delivers:** `leads_to` edges projecting the canonical `connected_portal_ref_json`, and a portal name contract that reports absence instead of hiding it. This is the first relationship the compendium derives between two instances of the same entity, and the first edge type after `variant_of`.

**Directed, deliberately.** Most connections are authored as reciprocal pairs, but the game also contains chains and at least one one-way door, so a reciprocal connection is stored as two edges rather than one undirected link. Collapsing pairs would invent return paths the world does not have.

**The name contract.** The extractor substituted the row id whenever `friendlyName` was empty, which shipped a public route labelled `instances;portals;bd9b9562…`. Since an id-shaped label is indistinguishable downstream from an authored one, the extractor now emits `portalNameMissing` and leaves the name null, `portals.name` is nullable, and the map layer supplies a visibly placeholder label. The canonical table records what the game contains; only presentation fills the gap.

**Audit scope corrected with it.** `auditEntityGraph` ran inside the item read-model emitter, so it only ever saw edges emitted before it. Any edge added later — including these — was exempt from the invariant that an edge must target a public node. It now runs once after every emitter.

**Verification evidence:** live export on 2026-08-02 against Ardenfall Demo `0.0.10.91` produced 30 `leads_to` edges from 33 portals, matching the 30 that carry a connection, with zero unresolvable targets and `fatal` 0. The single genuinely unnamed portal produced exactly one `portalNameMissing` diagnostic and now renders as `Unnamed portal`. Driven in a browser against the fixture build: selecting a portal shows its destination, following it moves the selection and updates the deep link, and the reciprocal edge leads back.

**Deferred with reason:** 26 of 33 portal names are authored snake_case (`garkai_sheru-tombs_outside_1`). Those are the content authors' real values, so displaying something friendlier means deriving a label from the connected location — a presentation decision that belongs with the other portal presentation work, not smuggled into a data slice.

### Entity dispatch collapsed into one registry

**Status:** done
**Spec coverage:** investment-priorities §1.

**Delivers:** one `entityRegistry` keyed by entity id, carrying each entity's DDL, canonicaliser, optional read-model emitter, optional map projection, and site capabilities. Adding an entity is one entry rather than seven edits.

This was deferred on the reasoning that the abstraction should be settled against a third entity shape rather than guessed from two placed entities. That reasoning had already been overtaken. Four shapes ship today: a lookup asset with a standalone route (`item`, `item-tag`), a named asset with a standalone route (`stat-type`, `item-category`), a lookup asset placed as point and volume behind a map deep link (`location`), and a record placed as a point behind a map deep link (`portal`). Waiting for characters would have meant hand-editing the seven sites once more and then refactoring anyway.

Item's descriptor-built DDL and the five fixed constants are the same field rather than a special case, and portal's dependency on the map emitter is a declared phase rather than an ordering someone has to remember. `validateDescriptorCoverage` still fails loudly by name when a descriptor declares a public route with no emitter, or a map layer with no projection — it is runtime, not compile-time, as the earlier note claimed.

**Verification evidence:** confirmed a pure refactor against the fixture artifact — 54 tables before and after, none added or removed, no row count changed, identical public node and edge distributions.

### Descriptions for spells and status effects

**Status:** done
**Spec coverage:** investment-priorities §4.

**Delivers:** the text that says what a spell or a status effect actually does, plus `status-effect` as an entity. Live: 172 status effects of which 149 describe themselves, and 38 of 56 spells.

Spell pages had shipped with a governing skill and a base mana cost and nothing else, so a reader learned nothing. The game holds the text and it is reachable at extraction time, which a probe settled before any code was written.

**Both descriptions carry a caveat, because without one they mislead.** A spell's text is generated at level 1, while a real cast derives its level from the player's Intelligence and governing skill, so its numbers are a sample. A status effect's strength and duration are authored on each *reference* to it rather than on the effect, so the same effect lands differently depending on what applied it. Neither is a detail: presenting either number bare would state a specific case as a general fact.

**Tooltips carry the game's markup** and go through the same rich-text translator item descriptions use, including the master tooltip vocabulary. Spell and status tooltips extend the same tooltip infrastructure, so that vocabulary belongs to the shared layer rather than to items, and withholding it would render identical strings differently depending on which entity produced them.

**Deliberately excluded:** the effect graph. Both spell effects and status effect payloads are polymorphic Odin-serialized lists, and they are what would link a spell to the status effect it applies. That link is the natural next depth increment and it is a slice, not a field.

**Notable:** adding status effects took one `entityRegistry` entry, the third entity since the dispatch refactor and the third time it held. Their read models carry no icon column, because an icon hash comes from an asset extraction plan they do not have, so the column could only ever be null.

### Spells, and the diagnostics that hid them

**Status:** done
**Spec coverage:** investment-priorities §4.

**Delivers:** `spell` as a first-class entity — 56 rows, public routes, and a `scales_with` edge to the stat type whose skill scales each spell. Identity is `namedAsset`, because none of the 56 is registered in `BuiltLookupTable`, which is the same gap that made stat types and item categories ship empty.

**Why it was invisible.** A live export emitted 1805 `lookupAssetGuidMissing` diagnostics, of which about 1454 were references to Unity sprites, prefabs, and fonts that the compendium deliberately does not catalogue and never could resolve. The 286 spell references that mattered were 16% of the noise. Classifying engine-namespace assets as out of scope, rather than as failures, cut the total to 357 and made the remainder legible. Fixing the spells then took it to 72.

| | before | after |
| --- | --- | --- |
| non-fatal diagnostics | 1811 | **72** |
| `lookupAssetGuidMissing` | 1805 | **65**, all `fontRef` |
| unresolved `spellRef` | 286 | **0** |
| `counts.spell` | absent | **56** |

**Excluded at the time:** spell effects, subspells, tooltips, and cooldowns. Tooltips shipped shortly after in their own slice, once a probe confirmed the level-dependent substitution runs at extraction time. Effects and subspells remain out, since they are a polymorphic serialized graph.

**Two corrections the work forced.**

The first live export was *rejected*, `fatal: 1`, on a spell with an empty display name. The field had been specified fatal, which was wrong: identity comes from the asset name, so an absent label is a presentation gap. It is now a diagnostic, the canonical column is nullable, and presentation supplies a placeholder — the same resolution portals already had. One row of imperfect game data must not block an artifact.

The navigation only ever offered Items and Map, while the layout resolved routes for stats, categories, and tags and discarded them. Three public prerendered sections were unreachable and spells would have been the fourth, so every section went into the header. Characters made it eight.

**Also settled:** adding this entity required exactly one `entityRegistry` entry, which is the first real test of the dispatch refactor. The mod's resolver gained the same treatment, collapsing three per-type branches into one registry, and every extraction source there is now a required argument rather than a default that quietly constructed live Unity services.

### Content coverage against the game, measured 2026-08-02

A sweep of the decompiled source plus a live probe against Ardenfall Demo `0.0.10.91`, establishing what the game authors versus what the compendium models. Every count below was read from the running game, not inferred.

| game asset type | in memory | in `BuiltLookupTable` | modelled | identity mechanism |
| --- | --- | --- | --- | --- |
| `Item.ItemData` | 1273 | 1273 | yes | `lookupAsset` |
| `LocationAsset` | 48 | 48 | yes | `lookupAsset` |
| `Item.ItemTag` | 28 | 28 | yes | `lookupAsset` |
| `StatType` | 21 | **0** | yes | `namedAsset` |
| `ItemCategory` | 7 | **0** | yes | `namedAsset` |
| `StatusEffectData` | 172 | 172 | yes | `lookupAsset` |
| `SpellData` | 56 | **0** | yes | `namedAsset` |
| `Faction` | 48 | 48 | **no** | `lookupAsset` |
| `PerkAsset` | 18 | 18 | **no** | `lookupAsset` |
| `TraitType` | 17 | 17 | **no** | `lookupAsset` |
| `CharacterData` | 212 | 212 | **no** | `lookupAsset` |
| `NPCRecord` instances | 314 | n/a | **no** | `record` |

**Spells are the same defect that made stat types ship empty, still live.** 56 `SpellData` assets exist and none is registered, so all 286 item references to them fail. The catalogue already publishes 280 items in a `Spells` category whose actual spell definition is unreachable. `namedAsset` solves it exactly as it solved stat types, and `RefResolver` currently hardcodes that mechanism for two types, which is the same hand-maintained-list smell the pipeline registry just removed.

**Everything else missing is already reachable.** Status effects, factions, perks and traits are all registered, so they need no identity work at all, only descriptors, extraction, and presentation. Traits are the asset family behind the master tooltip's `allTraits`, which is why the stat grouping could never classify them and why that grouping was reduced to attribute and skill.

**Quests are first-class.** `Questing/QuestData` is a real ScriptableObject with authored identity, journal text, phases, objectives, and rewards, with runtime progress held separately in `QuestInstance`. Authored quest content is extractable, and only the progress state is out of scope.

**Loot provenance is the largest single gap in reader value.** `ItemListAsset`, `ItemGroup`, and the counted and leveled wrappers describe what drops and what is stocked. Nothing extracts them, so the compendium cannot answer where an item comes from, which is among the most valuable questions a game wiki answers.

**Not entities, deliberately.** `ItemFilter` is a reusable internal predicate, not a taxonomy. Reputation and bounty are runtime state on `FactionInstance`, while only `Faction` itself is authored. `CharacterRace`, `CharacterModule`, and the race-list selector are mostly rendering and AI configuration. `VolumeRecord` is a gameplay ownership volume, unrelated to the location polygons already on the map.

**One published stat is not in the game's model.** `CoreStats`, `CharMajorSkillsDataList`, and the exported master tooltip all define 5 attributes and 15 skills. The compendium extracts 21 authored `StatType` assets and publishes 16 skills. The extra one is `Unarmed`, referenced by no character and absent from every gameplay list. It is authored content so it still ships, and it is now reported as a diagnostic rather than passing silently. Whether an orphaned asset should hold a public route is an open decision.

**Item subtype coverage is complete.** All 17 concrete `ItemData` subclasses have a matching variant descriptor, with no obsolete or unmodelled subtype. The gaps there are field-level: melee omits most authored combat fields, and equipment omits enchantments entirely, which loses enchantment identity and the built-in versus configurable distinction.

### Slice 8+ — Map-supporting entities (game-specific)

**Status:** planned (ordered after Slice 7 foundation)
**Spec coverage:** investment-priorities §4.

**Delivers:** the entities that make the compendium answer more questions. The candidate set is no longer speculative — see the coverage table above, which was measured against the running game.

Ordered by measured reader value against cost. The survey at [`2026-08-02-program-survey`](2026-08-02-program-survey.md) supplies the evidence, and it changed this ordering: new entities rank below both connective work and the last mile, because most pages still have no inbound edge and several shipped defects were reader-visible when the survey ran.

**Correctness of what already ships.** The site draws transparent cards, the map draws white borders, 967 item pages render an empty Description heading, and every non-item 404 claims an item was missing. Most are trivial fixes. They come first because they are wrong now, on pages already published.

**Honest gaps, rendered.** 833 items carry omission data and 496 carry diagnostics, all of it emitted by the pipeline and displayed nowhere. The project's principle is to ship gaps honestly and the last step was never taken.

**Edges.**

1. ~~Items to status effects~~ - **done.** 266 `applies` edges.
2. ~~Items to spells~~ - **done.** 286 `casts` edges. Both directions render, and every one of the 552 item effect facts now resolves.
3. ~~Stat types to stat types~~ - **done.** Labels that match a published stat are links.
4. ~~Items to categories and tags~~ - **done.** 1,268 `categorised_as` and 76 `tagged` edges. Item pages name both, and the tag and category pages were left alone because their existing tables already say it.

**That exhausts the field-shaped edges**, and the remaining orphans are not spread evenly. Items are 1,273 of the 1,455, and nothing in the game points at an item except loot tables, recipes, merchants, and quests, none of which are modelled. `PotionRecipe` is partly extracted already but amounts to one recipe and four potions live.

So the next connective work is no longer a field, it is an entity:

**The descriptor is now enforced end to end.** [`2026-08-03-canonical-table-contract`](archive/2026-08-03-canonical-table-contract.md) closed the last gap. Every entity declares its canonical table, every field says whether it becomes a column and under what name, and both directions are asserted, so a rename in hand-written SQL that no descriptor mentions fails the build. Three fields that were extracted into 129 rows and stored nowhere are gone.

**Before that**, relationships were unified. Four slices in one day each grew a bespoke site accessor beside a generic mechanism that already existed, which is the Ancient Kingdoms failure exactly. Relationships are now declared once by predicate, the pipeline projects sections from the edges it emits, and an unregistered predicate fails the build. Adding a relationship is one registry entry and no site change, which matters because obtainability adds five at once.

5. **Item obtainability**, in progress. Not loot alone. [`2026-08-02-item-obtainability`](2026-08-02-item-obtainability.md) audits every route by which a player can get an item, and there are nine. Loot tables are one.

   The authored half is fully enumerable today and needs no world traversal: 348 loot lists, 314 placed NPC records whose inventories double as their death drops, merchant stock, 13 quests whose Odin graphs turn out to be traversable at runtime, and 48 potion recipes whose ingredients are matched by tag rather than by item. That is the slice.

   The placed half is containers and spawners, which are not record-backed and exist only as scene objects in a world of 683 streamed cells. Completing them needs a world walk, which tile capture also needs, so the two should be planned together rather than each paying for traversal separately.

   **Characters shipped first**, see [`2026-08-03-item-provenance-characters`](archive/2026-08-03-item-provenance-characters.md). 212 pages, 2,126 `drops` edges, and 545 of 1,273 items now name a source. Merchant stock was specced and then cut on measurement, because the game implements it fully and no character in the demo has any configured.

   That leaves 728 items still unsourced. Quest rewards and recipes are the remaining authored sources and they are small, 13 quests and 48 recipes, so most of the remainder is almost certainly in containers. Measure before picking the next one.
6. **Spells to status effects.** The 116 unreachable status effects are referenced from the Odin-serialised effect graph on `SpellData`. A slice rather than a field.
7. **Status effects to status effects.** `StatusEffectData.modifyStatusEffects` is a direct authored reference, but the extractor does not currently emit it, so it needs mod work first.

**Search.** Delivered. Pagefind runs after the prerender and indexes all 1,794 pages, so every page is findable by name even when nothing links to it. The index ships from `build:prepared`, which means no deployable build can omit it, and a smoke fails on an absent or empty index. The sitemap and meta descriptions still matter for crawlers.

**A current release.** Nothing has been published since 2026-06-05, four entities ago. The path is proven, the blocker was only that old artifacts predate the count contract.

**Then the map.** Tile capture makes 400 extracted markers legible. It is specced and sized, and it deliberately follows the connective work.

**Then new content**, in this order once things link: characters and NPCs, loot provenance through `ItemListAsset`, traits and perks and factions, recipes, quests. Each adds nodes, so each is worth more after the graph and search exist than before.

### Tile capture

Deferred from Slice 6 with the strategy left open. Now designed in [`2026-08-02-tile-capture`](2026-08-02-tile-capture.md), informed by a probe of the game and an audit of two sibling projects that have each built one.

The short version: the game's own map art is not a basemap, so capture means rendering the world through a camera we position, which makes the world-to-pixel mapping ours by construction and closes open question #7 as a side effect. Sizing is around 3,000 WebP tiles across both maps, an order of magnitude inside the Cloudflare Pages file budget.

The audit also produced a number worth keeping in view. Adding one marker type costs **1 file here, 17 in Ancient Kingdoms, and 20 in Erenshor**. Ancient Kingdoms has a generic layer helper and still hardcodes every call, which is the failure mode to watch: a generic renderer does not help when the list of types is restated everywhere else.

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
**Remaining:** `AGENTS.md`, `mod/AGENTS.md`, `pipeline/AGENTS.md`, `site/AGENTS.md`, and `CLAUDE.md` provide subsystem guidance. The slice still needs explicit worked good/bad examples for generated presentation/read-model cutovers, typed rich-text rendering without raw `{@html}`, relationship-graph link governance, and component-intake decisions.

## Open questions tracker

| #   | Question                               | Status                                        | Closes in slice                                                                                                                                                   |
| --- | -------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Deployment target                      | **closed**                                    | Slice 1.5 deployed `ardenfall.compendiums.org` through local/operator Wrangler + Cloudflare Workers Static Assets                                                 |
| 2   | Repo strategy + CI tooling             | **closed**                                    | Slice 1 (`2026-05-03-slice1-tooling-decisions.md` §1, §8)                                                                                                         |
| 3   | Component library / primitive strategy | **closed (foundation + governance seed)**     | Slice 1 chose Tailwind v4/shadcn-svelte/Bits primitives; Slice 4 seeds component catalog, token, and intake governance; Slice 10 scales automation only if needed |
| 4   | JSON Schema validator                  | **closed**                                    | Slice 1 (`2026-05-03-slice1-tooling-decisions.md` §3)                                                                                                             |
| 5   | Property-test framework                | **closed**                                    | Slice 1 (`2026-05-03-slice1-tooling-decisions.md` §4)                                                                                                             |
| 6   | Tile capture specifics                 | advanced (vector-first shipped; capture open) | Slice 6 shipped vector-first. Probed 2026-08-02: shipped map art is not a basemap, so capture means rendering the world. See "Tile capture" below                |
| 7   | External archive backend               | open                                          | Slice 13                                                                                                                                                          |
| 8   | Future gameplay-mod surface            | deferred                                      | indefinitely                                                                                                                                                      |
| 9   | Map-supporting entity ordering         | **closed (firmed up)**                        | Slice 6 plan; ordering recorded in Slice 7+ above                                                                                                                 |

## Update protocol

When a slice transitions:

- **Brainstorming → drafting:** all decisions that materially affect the slice are closed or marked provisional with revisit triggers.
- **Drafting → ready:** active plan location and commit hash recorded while the plan is live.
- **Ready → in-progress:** branch noted when work does not happen directly on `main`.
- **In-progress → done:** completion date recorded; any spec deviations noted under the slice with rationale; the execution plan is set to `implemented` and moved to `docs/plans/archive/`.
- **Public-contract replacement:** when a slice replaces a public read model, route contract, rich-text/link contract, or shared UI primitive, remove old public fallback/plumbing in the same slice. Temporary inspection surfaces must be private/debug-only, and downstream slice entries must reference the new contract.
- **Slice re-shaped:** old slice marked `superseded by Slice N`, new slice added.
- **Investment priority shift:** evidence (analytics, user feedback, structural game change) recorded in `2026-05-07-investment-priorities.md` under "Revisit triggers"; affected slice ordering updated here.
