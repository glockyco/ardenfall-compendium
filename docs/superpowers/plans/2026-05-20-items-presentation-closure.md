# Items Presentation Closure (Slice 4.5) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Each phase lives in its own file under [`2026-05-20-items-presentation-closure/`](./2026-05-20-items-presentation-closure/). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the deterministic-presentation gap on items by extracting every entity items transitively reference (status effects, spells, enchantments, stat types, item categories, item tags, potion recipes, master-tooltip vocabulary), porting the game's tooltip composition methods to TypeScript, materialising the new entity pages on the static site, and cutting items over to SEO-friendly slug routes with legacy GUID redirects — without leaving any half-resolved link in production.

**Architecture:** Mod extracts seven new entity types plus a private master-tooltip vocabulary singleton via a generic reflection-based `Effect` / `SpellEffect` / `EnchantmentEffect` serializer; pipeline canonicalises each entity, runs a TypeScript port of the game's `StringTooltip` / `StatusEffectTooltip` / `SpellTooltip` / `EnchantmentTooltip` / `ArdenfallMasterData.ApplyColorCodes` chain over the typed snapshots, and emits per-entity overview + presentation read-models plus a `<slug>--<id8>` routing scheme; SvelteKit prerenders the new detail pages and a Cloudflare `_redirects` map preserves legacy item GUID URLs. Golden-file parity tests against captured in-game tooltip strings gate the composer.

**Tech Stack:** BepInEx 5 mod (C# / netstandard2.1), Newtonsoft.Json, Ardenfall asset reflection. Bun-based pipeline (TypeScript, Zod, better-sqlite3, Ajv). SvelteKit 2 / Svelte 5 site on Cloudflare Workers Static Assets via `adapter-cloudflare`. xUnit on the mod side, Bun test on everything else.

**Reference spec:** `docs/superpowers/specs/2026-05-20-items-presentation-closure-design.md`.
**Supporting documents:** `2026-05-20-item-asset-graph-audit.md`, `2026-05-20-compendium-architecture-survey.md`, `2026-05-20-items-presentation-closure-architecture-review.md`.

---

## How this plan is executed

- Each phase is a self-contained release-candidate: it ends with a green local gate run (see "Verification gates" below) and at least one commit. **Never close a phase with red gates.**
- Phases are sequential. Dependent phases assume their predecessors are green.
- Subagent-driven execution is recommended (`superpowers:subagent-driven-development`): fresh subagent per task, two-stage review between tasks, batch only within a single phase.
- The user pre-pushes commits between phases at their discretion; **never push without explicit approval**.
- Natural pause points for human review:
  1. After Phase 3 (foundation complete, no behaviour change).
  2. After Phase 6 (three new small entities live, slug machinery exercised at scale).
  3. After Phase 9 (composer port + golden harness proven on a small example).
  4. After Phase 13 (every public entity ships).
  5. After Phase 17 (live release).
     Use these checkpoints to push, review, or pause execution.

## Repository invariants the plan assumes

- Pipeline canonical tables live under `pipeline/src/sql/ddl.ts` and `pipeline/src/sql/site-metadata-ddl.ts`; read-model DDL lives in `pipeline/src/stages/emit-read-models.ts`. Schema migrations happen by replacing the DDL — there is no online migration story; the artifact is rebuilt from scratch.
- All `*.ts` files use ESM, top-level `await` where needed, `bun` runtime, no Node-only APIs.
- All `*.cs` files target netstandard2.1 (`mod/ArdenfallCompendium.csproj`); the test project targets the BepInEx-compatible profile under `mod-tests/`.
- Site routes follow SvelteKit 2 conventions: `+page.server.ts` is the data source, `+page.svelte` the renderer; `export const prerender = true` flips the route to static.
- Schemas under `schemas/*.schema.json` regenerate validators via `bun run codegen:validators` — never edit `pipeline/dist/validate-*.mjs` by hand.

## Verification gates that apply to every phase

Unless a phase file explicitly overrides, every phase ends with this verification sweep:

```sh
bun run codegen:validators
bun run check:fixtures
dotnet test mod-tests/ArdenfallCompendium.Tests.csproj
bun test pipeline/test
bun test tooling.test.ts
bun test controller/test
bun run typecheck
bun run --cwd site check
bun run format:check
bun run lint
git diff --check
```

A phase that touches the site build also runs:

```sh
bun run artifact:fixture synthetic fixtures/synthetic/snapshot
NODE_OPTIONS=--max-old-space-size=8192 bun run --cwd site build:fixture
bun run --cwd site smoke:prerender
bun run --cwd site smoke:item-icons
```

## Phase index

| #    | Phase                                         | Spec §           | Detailed plan                                                                                        | Summary                                                                                                                                                                                  |
| ---- | --------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅ 1 | Master-tooltip vocabulary v2                  | §4.2, §3.3       | [01-master-tooltip.md](./2026-05-20-items-presentation-closure/01-master-tooltip.md)                 | Extend the private singleton with the full vocabulary the composer needs.                                                                                                                |
| ✅ 2 | Slug + ID8 routing core                       | §4.6             | [02-slug-routing.md](./2026-05-20-items-presentation-closure/02-slug-routing.md)                     | `short_id` column, deterministic slug derivation, uniqueness audit, SvelteKit param matcher, redirects emitter — without cutting any route over yet.                                     |
| ✅ 3 | New-entity scaffolding                        | §4.1             | [03-entity-scaffolding.md](./2026-05-20-items-presentation-closure/03-entity-scaffolding.md)         | Shared descriptor + snapshot envelope + validation contract + diagnostics taxonomy common to the seven new entities.                                                                     |
| ✅ 4 | `stat-type` entity                            | §3.2             | [04-stat-type.md](./2026-05-20-items-presentation-closure/04-stat-type.md)                           | Mod export + pipeline canonical + read-model + public detail/overview routes. Establishes the "small entity template" used in Phases 5–6 and 13.                                         |
| ✅ 5 | `item-category` entity                        | §3.2             | [05-item-category.md](./2026-05-20-items-presentation-closure/05-item-category.md)                   | Apply the small-entity template + expose `categoryColor` to the icon tint path.                                                                                                          |
| 6    | `item-tag` entity                             | §3.2             | [06-item-tag.md](./2026-05-20-items-presentation-closure/06-item-tag.md)                             | Apply the small-entity template; description carries the in-game tag-row text.                                                                                                           |
| 7    | Generic effect serializer (mod)               | §4.4, §6.6       | [07-effect-serializer.md](./2026-05-20-items-presentation-closure/07-effect-serializer.md)           | Reflection-based serializer with typed wrapper handlers + leaf-type deny-list.                                                                                                           |
| 8    | Variable-binding audit (mod)                  | §7.7             | [08-variable-binding-audit.md](./2026-05-20-items-presentation-closure/08-variable-binding-audit.md) | Per-extraction sweep emitting `effect-bindings-audit.json`; pipeline diagnostics on unresolved bindings.                                                                                 |
| 9    | Composer port + golden harness                | §4.3, §7.1, §7.2 | [09-composer-port.md](./2026-05-20-items-presentation-closure/09-composer-port.md)                   | Pure TS ports of `StringTooltip` + `ArdenfallMasterData.ApplyColorCodes`; per-effect-kind Zod schemas; golden-snapshot test infrastructure.                                              |
| 10   | `status-effect` entity + composer             | §3.2, §4.3, §7.3 | [10-status-effect.md](./2026-05-20-items-presentation-closure/10-status-effect.md)                   | Full `StatusEffectData` + Effect payloads + tooltip composer + read-model + site pages. Establishes the "composer-entity template" used in Phases 11–12.                                 |
| 11   | `spell` entity + composer                     | §3.2, §4.3, §7.4 | [11-spell.md](./2026-05-20-items-presentation-closure/11-spell.md)                                   | Apply the composer-entity template for `SpellData`, `SpellEffect[]`, sub-spells, primary/secondary level handling, spell-prefix wrap.                                                    |
| 12   | `enchantment` entity + composer               | §3.2, §4.3, §7.5 | [12-enchantment.md](./2026-05-20-items-presentation-closure/12-enchantment.md)                       | Apply the composer-entity template for `EnchantmentData`, `EnchantmentEffect[]`, `targetVars` wholesale-replacement semantics, suppression flags.                                        |
| 13   | `potion-recipe` entity                        | §3.2             | [13-potion-recipe.md](./2026-05-20-items-presentation-closure/13-potion-recipe.md)                   | Apply the small-entity template; derived recipe name; ingredient tag-refs; cross-link to drinkable/throwing potion items.                                                                |
| 14   | Item re-extraction + presentation re-composer | §3.1, §6.5       | [14-item-rework.md](./2026-05-20-items-presentation-closure/14-item-rework.md)                       | Per-variant catch-up (`hardAttackDamMult`, `enchantments[]`, full statTypeRef), pre-computed per-variant `stat_rows_json`, item presentation composer reading through new entities.      |
| 15   | Relationship graph rebuild                    | §4.5             | [15-graph-rebuild.md](./2026-05-20-items-presentation-closure/15-graph-rebuild.md)                   | Full predicate vocabulary, forward + reverse `entity_relationship_sections` materialisation, slug-aware audit.                                                                           |
| 16   | Item route cutover + legacy redirects         | §8.2             | [16-route-cutover.md](./2026-05-20-items-presentation-closure/16-route-cutover.md)                   | `entity_nodes.route_path` / `canonical_slug` switched to `<slug>--<id8>` for items; SvelteKit route swaps `[id]` to `[slug]`; Cloudflare `_redirects` populated from `entity_redirects`. |
| 17   | SEO hygiene + final verification + release    | §8.3, §10        | [17-release.md](./2026-05-20-items-presentation-closure/17-release.md)                               | JSON-LD on every entity page, sitemap regeneration, IndexNow ping, fresh live export, release artifact, deploy, production smoke, roadmap closeout.                                      |

## Execution recommendations

- One subagent per task — the plan's per-phase files are written for subagent-driven execution. Each task has explicit files, code, commands.
- Pause at the natural review checkpoints listed above.
- After each phase the coordinator (you, the orchestrator agent) reviews the phase's commits before opening the next phase's file.
- For repetitive entity work (Phases 5, 6, 11, 12, 13) the detailed file references "the small entity template" or "the composer-entity template" defined in Phase 4 / Phase 10 respectively. Templates are explicit; the per-phase files name the inputs.

---

## Spec ↔ plan cross-reference

| Spec section                         | Phases that cover it                                                                                             |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| §2 Scope                             | All phases collectively                                                                                          |
| §3.1 Items themselves                | Phase 14                                                                                                         |
| §3.2 Referent entities               | Phases 4–6, 10–13                                                                                                |
| §3.3 Composer chain                  | Phases 1, 9                                                                                                      |
| §4.1 Entity set                      | Phase 3                                                                                                          |
| §4.2 Master-tooltip vocabulary       | Phase 1                                                                                                          |
| §4.3 Composer port                   | Phases 9–12                                                                                                      |
| §4.4 Effect-instance representation  | Phases 7, 10                                                                                                     |
| §4.5 Relationship graph              | Phase 15                                                                                                         |
| §4.6 Slug + redirect strategy        | Phases 2, 16                                                                                                     |
| §4.7 Site routes                     | Phases 4–6, 10–13, 16                                                                                            |
| §4.8 Icon tinting / local site fixes | Phases 5 (category-color), 14 (presentation re-cut)                                                              |
| §5 Sequencing                        | This index                                                                                                       |
| §6 Data shapes                       | Phases 1, 3, 7, 10–13, 14                                                                                        |
| §7 Composer port specification       | Phase 9 (string-tooltip + master-data), 10 (status-effect-tooltip), 11 (spell-tooltip), 12 (enchantment-tooltip) |
| §8 Migration & cutover               | Phases 2, 16                                                                                                     |
| §9 Risks & mitigations               | Acknowledged inside phase files                                                                                  |
| §10 Acceptance criteria              | Phase 17                                                                                                         |

---

## Plan self-review hook

This index file is the contract. When closing a phase, update its row in the phase index above with a status emoji (✅ done / 🔵 in progress / ⏳ pending). Do NOT edit the per-phase files after they ship — those are immutable execution records.
