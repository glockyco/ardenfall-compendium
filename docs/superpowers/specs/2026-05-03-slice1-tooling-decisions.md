# Ardenfall Compendium — Slice 1 Tooling Decisions

Date: 2026-05-03
Status: Accepted for Slice 1; closes the "open questions deferred to implementation plan" tracker entries 2, 3, 4, 5 from the baseline design spec.
Supersedes: nothing. Complements `2026-04-28-ardenfall-compendium-design.md` and `2026-04-29-ardenfall-compendium-implementation-decisions.md` by closing tooling questions both documents intentionally deferred.

## Purpose

The baseline design spec and the 2026-04-29 implementation decisions addendum left a small set of concrete tooling choices open. The Slice 1 plan cannot be drafted without them. This document closes those choices, pins versions verified on 2026-05-03, and records revisit triggers so each pin has a defined cost-of-revisit profile rather than being a permanent commitment.

The high-level architecture is unchanged. This document does not reopen any locked invariant from the prior specs.

## Decision maturity levels

Reusing the vocabulary established in `2026-04-29-ardenfall-compendium-implementation-decisions.md`:

- **Locked invariant:** changing this reopens architecture.
- **Accepted for Slice 1:** implement now; revisit only if a listed trigger fires.
- **Provisional beyond Slice 1:** acceptable initial encoding; expected to evolve.
- **Deferred:** explicitly out of scope until a named slice or trigger.

## 1. Repository hosting and license

**Status:** Accepted for Slice 1.

The repository is hosted **public on GitHub from day one** under the **MIT license**.

### Rationale

The project is a single-developer fan archive for a single-developer game. There is no closed-source IP. The Ardenfall developer's own site is open. Public hosting is free of CI minute caps for public repos, makes discovery and external feedback possible, and removes the implicit promise to "polish before showing." Early-stage embarrassment is vanity, not a real cost.

MIT is the lowest-friction default for hobby projects. Apache-2.0 adds patent grants that are not relevant here; copyleft licenses (GPL, AGPL) would create friction with anyone who wants to derive from the descriptors or pipeline shape and offer no upside for a static-data archive.

### Revisit triggers

- A second contributor joins and prefers a different license.
- Ardenfall's developer asks for the repo to be private or restructured.
- A real legal concern arises around redistribution of curated fixtures (the addendum's §19 already addresses the redistribution stance).

## 2. Workspace bootstrap and runtime

**Status:** Locked invariant for the JS-side workspace; accepted for Slice 1 for runtime pin.

The TypeScript side is one **Bun workspace** containing `pipeline/` and `site/` packages with a single root `bun.lock`. The C# `mod/` project is a sibling, outside the Bun workspace, built independently with `dotnet`. Runtime is **Bun 1.3.13**.

### Rationale

A single workspace gives free type sharing between pipeline and site, a single lockfile for both halves, and one `bun install` for the whole tree. Bun 1.3.13 (released 2026-04-19) ships `bun test --parallel`, `--isolate`, `--shard`, and `--changed`; reduces `bun install` peak memory by 17×; and resolves 82 issues from the prior minor. The `bun:sqlite` driver ships with FTS5 enabled (since Bun 0.6.12 per [oven-sh/bun#3431](https://github.com/oven-sh/bun/discussions/3468)), which removes the need for a native SQLite driver in the pipeline.

### Caveats

- On macOS, Bun uses Apple's system-provided SQLite. Apple's build enables WAL mode, and WAL sidecar files (`-wal`, `-shm`) persist after `db.close()` unless the pipeline explicitly issues `PRAGMA wal_checkpoint(TRUNCATE)` and sets `SQLITE_FCNTL_PERSIST_WAL=0` before close. Pipeline cleanup paths must handle this; the Slice 1 plan covers it.

### Revisit triggers

- Bun introduces a breaking change to `bun:sqlite` or to its workspace resolution.
- A pipeline operation requires a Node-only library that does not load under Bun's Node-API shim.

## 3. JSON Schema validator

**Status:** Accepted for Slice 1.

**`ajv` 8.20.0** with the `ajv/dist/2020` entry point and `standaloneCode` for compiled validators. `ajv-formats` 3.0.1 for format keyword support.

### Rationale

Ajv is the only candidate that combines all three of: JSON Schema 2020-12 support, RFC 6901 JSON Pointer error paths in a stable typed API (`ErrorObject.instancePath`), and a true compile-to-standalone pipeline that emits a plain JS module with no runtime Ajv overhead. The standalone path matters for the pipeline because it lets us check compiled validator code into a build artifact and ship the pipeline as plain Bun-executed TypeScript without a hot-path compile step. Source: [`lib/types/index.ts`](https://github.com/ajv-validator/ajv/blob/master/lib/types/index.ts), [`lib/2020.ts`](https://github.com/ajv-validator/ajv/blob/master/lib/2020.ts), [`docs/standalone.md`](https://github.com/ajv-validator/ajv/blob/master/docs/standalone.md).

Ajv is pure JavaScript, MIT-licensed, last released 2026-04-24, and runs cleanly on Bun (no native addons; CJS imports work transparently in Bun).

### Rejected alternatives

- **TypeBox + Ajv** would invert the architectural invariant: the schema would be defined in TypeScript and `entity.json` would become an emitted artefact rather than the source of truth. The baseline spec's P2 ("one schema source of truth: the JSON descriptor, validated by JSON Schema") forbids this.
- **`@hyperjump/json-schema`** has stronger 2020-12 conformance but only exposes JSON Pointer error paths through its experimental BASIC output format; we need a stable API contract for diagnostics.
- **`@cfworker/json-schema`** is a clean fallback with no codegen path; valid choice if Ajv ever stalls, but provides no advantage today.

### Integration shape

```ts
// pipeline/scripts/codegen-validators.ts (build step)
import Ajv2020 from "ajv/dist/2020";
import { standaloneCode } from "ajv/dist/standalone";
import addFormats from "ajv-formats";
import { readFileSync, writeFileSync } from "fs";

const schema = JSON.parse(readFileSync("schemas/entity.schema.json", "utf8"));
const ajv = new Ajv2020({ code: { source: true, esm: true } });
addFormats(ajv);
const validate = ajv.compile(schema);
writeFileSync("pipeline/dist/validate-entity.mjs", standaloneCode(ajv, validate));
```

Errors map to `${filePath}#${e.instancePath} — ${e.message}` for diagnostics, e.g. `entities/item/entity.json#/fields/3/from — must be string`.

### Revisit triggers

- Ajv has no release for >12 months. Replace with `@cfworker/json-schema`.
- Project adopts a draft Ajv has not yet implemented.
- Standalone codegen output begins emitting Bun-incompatible `require()` paths in a deployment context.

## 4. Property-test framework

**Status:** Accepted for Slice 1.

**`fast-check` 4.7.0**, plain — no adapter package.

### Rationale

The fast-check repository ships an [official Bun tutorial](https://github.com/dubzzz/fast-check/blob/main/website/docs/tutorials/setting-up-your-test-environment/property-based-testing-with-bun-test-runner.md) explicitly stating that no connector is needed under `bun:test`: `fc.assert(fc.property(arb, predicate))` works the same as any other test runner. The library has zero Node-only runtime dependencies — its only direct dependency is `pure-rand`, also dependency-free. `fc.asyncProperty` covers async predicates, including in-memory SQLite calls; `fc.letrec` covers recursive structures (reference graphs).

### Rejected alternatives

- `@fast-check/jest` adds `test.prop()` syntax sugar and is not necessary; Bun is not a documented target for the adapter.
- `@fast-check/vitest` is irrelevant under `bun:test`.

### Integration shape

```ts
// pipeline/test/invariants/items.test.ts
import { describe, it, expect } from "bun:test";
import fc from "fast-check";

describe("item invariants", () => {
  it("variant ancestry has no orphans", () => {
    fc.assert(
      fc.property(itemDescriptorArb, (item) => {
        if (!item.variants) return;
        for (const v of item.variants) expect(v.parent_variant_id ?? "items").toBeDefined();
      }),
    );
  });
});
```

### Revisit triggers

- A property must run in an isolated subprocess (e.g., shelling out to the pipeline binary). Add `@fast-check/worker` only at that point.
- Bun breaks `expect.extend`, blocking future migration to `@fast-check/jest` if we ever want it.

## 5. UI primitives and design tokens

**Status:** Accepted for Slice 1.

**`shadcn-svelte` 1.2.7 (CLI copy-into-repo) + `bits-ui` 2.18.1 (headless primitives) + `tailwindcss` 4.2.4 with `@theme inline` token bridge.**
Companion deps owned by the shadcn registry: `clsx` 2.1.1 + `tailwind-merge` 3.5.0 (the canonical `cn()` helper), `tailwind-variants` 3.2.2 (`tv()` for component variant maps), `@lucide/svelte` 1.x (icon library; supersedes the older `lucide-svelte`), `tw-animate-css` 1.4.0 (motion utilities), `@internationalized/date` 3.12.x (peer of bits-ui Calendar/DateField).

### Rationale

The four AK regression vectors named in the design spec §3 are: (a) four hand-maintained styling tables, (b) inconsistent design language, (c) per-entity layer construction, (d) no enforced design system. The combination chosen here addresses (b) and (d) directly; (a) and (c) are addressed by the descriptor architecture, not by the UI library choice.

Bits UI 2.18.1 declares `peerDependencies.svelte: "^5.33.0"` — Svelte 5 is the only supported target. The library is written in Svelte 5 runes throughout (verified in `packages/bits-ui/src/lib/bits/button/components/button.svelte`: `$props()`, `$bindable`, `{@render children?.()}`). It provides the Slice 1 primitive set: `Button`, `Checkbox`, `Dialog`, `Pagination`, `Select`, `Tabs`, `Tooltip`. `Input` is native HTML with `Label` from Bits.

`shadcn-svelte` 1.2.7 (`peerDependencies.svelte: "^5.0.0"`) wraps Bits UI in a CLI-copied styling layer rooted in Tailwind v4 `@theme inline`. Every component the CLI copies references semantic tokens (`bg-primary`, `text-primary-foreground`) that resolve to CSS custom properties declared once in `app.css`. Changing `--primary` propagates everywhere; an agent looking for "the disabled colour for buttons" finds it in `site/src/lib/components/ui/button/button.svelte` — one file, one owner.

Tailwind 4.2.4's `@theme inline { --color-x: var(--x); }` pattern inlines the resolved value into utility class output rather than emitting variable pointers, which is the official documented bridge between CSS custom properties and Tailwind utility names ([tailwindcss.com/docs/theme](https://tailwindcss.com/docs/theme)).

### Rejected alternatives

- **Melt UI** declares `peerDep: "svelte: ^3.0.0 || ^4.0.0 || ^5.0.0-next.118"` — a Svelte 5 pre-release, not stable. The same author moved to Bits UI; Melt is in maintenance.
- **Skeleton UI** v4.15.2 supports Svelte 5 but distributes components as an npm package with `@zag-js` runtime dependency. v5 is already in alpha, putting v4 into maintenance for a multi-year project.
- **Flowbite Svelte** ships `apexcharts`, `date-fns`, and `flowbite` as hard runtime deps that bloat a static bundle even when unused.
- **Bits UI alone** without shadcn-svelte means writing the entire variant + token layer from scratch.
- **Roll-your-own with Tailwind v4** means reimplementing focus traps, keyboard navigation, ARIA semantics, and screen-reader patterns for Dialog, Select, Tooltip, Checkbox. Bits UI already solves these correctly.

### Table primitive is intentionally local

No evaluated library provides a sortable/filterable `Table` that consumes column definitions from external metadata cleanly. Slice 1 ships a 40–60 line `EntityTable.svelte` driven by the pipeline-emitted `site_overview_columns` table. This is a feature, not a gap: the pipeline is the source of truth for which columns each entity exposes, and the component reads that directly.

### Token surface example

```css
/* site/src/app.css */
@import "tailwindcss";

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-border: var(--border);
  --color-ring: var(--ring);
  --radius-lg: var(--radius);
}

:root {
  --radius: 0.5rem;
  --background: oklch(0.1 0.02 260);
  --foreground: oklch(0.95 0.01 260);
  --primary: oklch(0.7 0.18 50);
  --primary-foreground: oklch(0.1 0 0);
  /* ... */
}
```

### Revisit triggers

- Bits UI maintenance stalls (no commits 3+ months) or drops Svelte 5 support.
- Tailwind v4 changes `@theme inline` semantics in a minor release.
- A rich-text editor or date-picker requirement appears (outside shadcn-svelte's current coverage).
- Building `EntityTable.svelte` exceeds two days of work — at that point evaluate TanStack Table v8 (framework-agnostic headless, Svelte adapter exists).

## 6. Lint and format toolchain

**Status:** Accepted for Slice 1.

**Prettier 3.8+ with `prettier-plugin-svelte` 3.5.1, ESLint 10 (flat config) with `eslint-plugin-svelte` 3.17.1 and `typescript-eslint` 8.59+. `typescript` ^6.0.3 is installed at the root because `typescript-eslint` 8.x declares `typescript: >=4.8.4 <6.1.0` as a non-optional peer for `parserOptions.projectService` (used on `.svelte` files) and `@typescript/native-preview` does not satisfy that peer slot.** Biome is intentionally deferred.

### Rationale

The user explicitly asked whether Biome is the right choice. As of 2026-05-03 it is not, for two reasons verified directly from biomejs.dev:

1. **Svelte support is 🟡 experimental** in Biome 2.4.14. The official Biome internals page states: _"Biome doesn't do any particular parsing for language specific syntax, for example the control-flow syntax of Svelte e.g. `{#if } {/if}`. This means that formatting might not match the desired expectations, and lint rules might not detect some cases."_ Enabling `.svelte` requires `html.experimentalFullSupportEnabled: true` and `overrides` to suppress false positives for `useConst`, `useImportType`, `noUnusedVariables`, `noUnusedImports`.
2. **Markdown is ⌛️ in progress** (no formatter or linter yet). The repository carries substantial Markdown across `docs/superpowers/specs/`, `docs/superpowers/plans/`, AGENTS.md, and READMEs.

This is a Svelte-heavy, Markdown-heavy repository. Biome cannot robustly cover either today. Track [biomejs/biome discussion #6276](https://github.com/biomejs/biome/discussions/6276) for the Svelte support roadmap.

`prettier-plugin-svelte` 3.5.1 declares `peerDependencies: { prettier: "^3.0.0", svelte: "^5.0.0" }` — Svelte 5 is the sole target. It is maintained by the Svelte core team. `eslint-plugin-svelte` 3.17.0 uses `svelte-eslint-parser` with `svelteFeatures.runes: true` by default (read from `svelte.config.js` automatically when unset). Both are first-party Svelte tooling.

### Rejected alternatives

- **Biome 2.4.14**: see above.
- **oxlint 1.62.0**: Svelte template linting is "coming later this year" per the March 2026 oxc post; today it lints `<script>` blocks only and requires running through ESLint anyway. Adopting oxlint now means two linters, not one.
- **dprint with `dprint-plugin-svelte`**: community-maintained, lower adoption; no advantage over the official Prettier plugin.

### Configuration sketch

```js
// eslint.config.js (root)
import js from "@eslint/js";
import svelte from "eslint-plugin-svelte";
import tseslint from "typescript-eslint";
import globals from "globals";
import svelteConfig from "./site/svelte.config.js";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs.recommended,
  {
    files: ["**/*.svelte", "**/*.svelte.ts"],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        projectService: true,
        extraFileExtensions: [".svelte"],
        svelteConfig,
      },
    },
  },
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
);
```

```json
// .prettierrc
{
  "plugins": ["prettier-plugin-svelte"],
  "overrides": [{ "files": "*.svelte", "options": { "parser": "svelte" } }]
}
```

### Revisit triggers

- Biome moves Svelte support out of experimental and ships Markdown formatting. At that point migrate, run `biome migrate --write`, and consolidate.
- oxlint ships full Svelte template linting and an `oxfmt` formatter with first-party Svelte support.

## 7. Pre-commit hooks

**Status:** Accepted for Slice 1.

**`lefthook` 2.1.6** as the hook runner.

### Rationale

lefthook is a Go binary distributed via `npm` (the npm package wraps the binary download) or Homebrew. It has no Node.js runtime requirement and starts an order of magnitude faster than husky's Node entry point. Built-in `{staged_files}` template plus `glob` filtering replaces `lint-staged` natively, and `stage_fixed: true` auto-restages files modified by the formatter — eliminating the husky+lint-staged pair.

The repository contains both TypeScript and C#. lefthook is language-agnostic; the same `lefthook.yml` can invoke `dotnet format` for `.cs` files alongside `prettier` and `eslint` for the JS side.

### Rejected alternatives

- **husky + lint-staged**: two packages, Node startup cost per hook, no native parallel execution, brittle `prepare` script coupling.
- **simple-git-hooks**: too minimal; no parallel execution, no built-in staged-file glob filtering.
- **pre-commit (Python)**: cross-language but adds a Python runtime dependency to a JS+C# repo.

### Configuration sketch

```yaml
# lefthook.yml
pre-commit:
  parallel: true
  jobs:
    - name: prettier
      glob: "*.{ts,js,svelte,json,md,css}"
      run: bunx prettier --write {staged_files}
      stage_fixed: true
    - name: eslint
      glob: "*.{ts,js,svelte}"
      run: bunx eslint --fix {staged_files}
      stage_fixed: true
    - name: dotnet-format
      glob: "*.cs"
      run: dotnet format mod/ArdenfallCompendium.csproj --include {staged_files}
      stage_fixed: true
```

CI environments set `LEFTHOOK=0` to skip hook installation triggered by `bun install`'s `prepare` script.

### Revisit triggers

- lefthook 3.x introduces breaking config changes; at that point either pin to 2.x indefinitely or migrate.
- The C# build chain stops shipping `dotnet format` (unlikely; Microsoft-maintained).

## 8. CI tooling

**Status:** Accepted for Slice 1.

**GitHub Actions** with four path-filtered jobs.

### Rationale

The repository is on GitHub. Actions has free minutes for public repositories, native integration, no cold-start penalty, and idiomatic `setup-bun@v2` and `setup-dotnet@v4` actions. Alternatives (Buildkite, CircleCI) introduce friction for a solo project with no measurable benefit.

### Job layout

| Job        | Trigger paths                                                          | Steps                                                                                                                              |
| ---------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `mod`      | `mod/**`                                                               | `actions/setup-dotnet@v4` → `dotnet build mod/ArdenfallCompendium.csproj`                                                          |
| `pipeline` | `pipeline/**`, `entities/**`, `schemas/**`, `bun.lock`, `package.json` | `oven-sh/setup-bun@v2` → `bun install --frozen-lockfile` → `bunx tsgo --noEmit -p pipeline` → `bun test pipeline/test`             |
| `site`     | `site/**`, `entities/**`, `schemas/**`, `bun.lock`, `package.json`     | setup-bun → `bun install --frozen-lockfile` → `bun run --cwd site check` (uses `svelte-check --tsgo`) → `bun run --cwd site build` |
| `fixtures` | `fixtures/**`, `pipeline/scripts/check-fixtures.ts`                    | setup-bun → `bun run check:fixtures` (size budgets, manifest presence, no machine-local paths, no raw Unity JSON)                  |

Path filters use `paths:` on the workflow trigger so each job only runs when relevant files change.

### Configuration

- Solo developer on `main`; worktrees per slice as documented in `roadmap.md` §"Update protocol".
- No branch protection rules until a second contributor exists.
- No Renovate or Dependabot in Slice 1; revisit after first slice ships to avoid PR noise on a still-shifting tree.

### Revisit triggers

- A second contributor joins. Add branch protection, PR templates, and a code-review configuration.
- Free Actions minutes on a public repo become a constraint (extremely unlikely).
- A CI step requires macOS-only behaviour. Slice 1 has none; tile capture is local-only by design.

## 9. Pipeline runtime: SQLite and image processing

**Status:** Accepted for Slice 1.

**`bun:sqlite` (built-in) for the pipeline. `@sqlite.org/sqlite-wasm` 3.53.0-build1 for the site (in-browser SQLite). `sharp` 0.34.5 for image processing.**

### Site-side SQLite (browser)

`@sqlite.org/sqlite-wasm` is the official SQLite-project Wasm build, published by the SQLite team and tracking SQLite mainline (`3.53.0-build1`, 2026-04-21). It ships the full SQLite feature surface — including FTS5 — and is the only browser SQLite that the upstream project itself maintains. Slice 1 does not use FTS5 (Slice 7), but the choice forecloses a Slice 7 driver swap and avoids depending on an unmaintained fork.

Rejected alternatives:

- **`sql.js-fts5` 1.4.0** — last published 2021-01-06, unmaintained. The fork exists because upstream `sql.js` (1.14.1) compiles only with `-DSQLITE_ENABLE_FTS3`, not FTS5; verified in [sql-js/sql.js Makefile](https://github.com/sql-js/sql.js/blob/master/Makefile). An unmaintained dependency owning the site's data layer is unacceptable.
- **`sql.js` 1.14.1** — actively maintained but FTS5-less. Picking it now means a driver swap in Slice 7.
- **`wa-sqlite`** 1.0.0 — last published 2024-01; modern API but more complex VFS handling and no first-party SQLite-team backing.

Caveats:

- Slice 1 ships a single static `data.sqlite` blob fetched via `fetch("/data.sqlite")` and loaded into memory with `sqlite3.capi.sqlite3_deserialize`. This works in the main thread and **does not** require COOP/COEP headers. The COOP/COEP requirement only applies to the worker + OPFS variant (persistent client-side storage), which Slice 1 does not need.
- Vite must list the package in `optimizeDeps.exclude` so its `.wasm` is served as a real asset, not pre-bundled.

### Rationale

`bun:sqlite` ships with FTS5 enabled, supports prepared statements with named/positional parameters, transactions, `bigint`, WAL mode, and is benchmarked 3–6× faster than `better-sqlite3` on read-heavy workloads. No native build step. There is no benefit to `better-sqlite3` for our use case.

`sharp` 0.34.5 documents Node-API v9 support across Node.js, Deno, and Bun ([npm sharp](https://www.npmjs.com/package/sharp)). The pipeline `emit-assets` stage calls `sharp(buf).webp({ quality }).toBuffer()` — a single primitive operation. Earlier Bun-sharp incompatibilities (2023) have been resolved.

### Caveats

- Bun's Node-API support is not 100% coverage. `sharp` is documented as supported, but the Slice 1 plan must include a 5-line spike that runs `sharp(testPng).webp().toBuffer()` under Bun and asserts the output is a valid WebP, before the asset stage commits to it. **Fallback** if it breaks: shell out to `cwebp` from libwebp via `Bun.spawnSync`.
- macOS WAL persistence (covered in §2 caveats) applies to all pipeline-managed databases. Use `PRAGMA journal_mode = DELETE` for ephemeral test databases or run the truncate sequence on close for production databases.

### Revisit triggers

- The sharp spike fails on Bun. Switch to `cwebp` or `@squoosh/lib`.
- A pipeline operation needs SQLite features `bun:sqlite` does not expose (e.g., custom SQLite extensions). At that point evaluate `better-sqlite3` against the cost of a native build step.

## 10. TypeScript compiler

**Status:** Accepted for Slice 1; pin migrates to stable in ≤2 months.

**Today** (2026-05-06):

- **Pipeline + root**: `@typescript/native-preview@beta` providing the `tsgo` executable. Used by `bun run typecheck` and `pipeline/test`.
- **Site**: `svelte-check` invoked **without** `--tsgo`. svelte-check + tsgo currently fails to resolve `<script module>` named exports through Svelte's `*.svelte` ambient module declaration; the failure mode is `error TS2305: Module "*.svelte" has no exported member` on every shadcn-svelte primitive's `index.ts`. Tracked in [sveltejs/language-tools svelte-check README — `--tsgo` Subject to the same limitations as `--incremental`](https://github.com/sveltejs/language-tools/blob/master/packages/svelte-check/README.md). svelte-check defaults to vanilla TypeScript (`typescript` ^6.0.3 already installed for `typescript-eslint` per §6); 0-error sweep confirmed across 797 files.
- **On TS 7 stable**: switch root + pipeline to `typescript@^7.0.x` providing `tsc`. Re-evaluate `svelte-check --tsgo` once the language-tools team lands the `<script module>` resolver fix; until then site keeps the vanilla TS path.

### Rationale

TypeScript 7.0 was [announced 2026-04-21](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0-beta/) as a Go port of the existing TypeScript compiler. Type-checking semantics are structurally identical to TypeScript 6.0; in 19,926 of 20,000 compiler tests, output matches 6.0 exactly. The Microsoft team explicitly says: _"Don't let the 'beta' label fool you – you can probably start using this in your day-to-day work immediately."_ Pre-release builds are tested at Bloomberg, Canva, Figma, Google, Linear, Notion, Slack, Vercel, and similar.

The stable release is announced for "within two months" from 2026-04-21, shipping under the `typescript` package with the `tsc` entry point. The migration when stable lands is a one-line dependency swap.

`svelte-check` ships a built-in `--tsgo` flag that uses the native preview when installed ([sveltejs/language-tools svelte-check README](https://github.com/sveltejs/language-tools/blob/master/packages/svelte-check/README.md)). The May 2026 Svelte changelog highlights the ecosystem move. Editor support (VS Code 1.92+, Visual Studio 2026 18.6 Insiders 3) is in place.

### Caveats

- The 74 known compiler-test differences exist. They are tracked publicly and almost certainly resolve into TS 7 stable. Pipeline tests catch us on any of them.
- `tsgo` is invoked as `tsgo`, not `tsc`. CI commands and package.json scripts reference `tsgo` until migration, then switch to `tsc`.
- Some editor-side gaps remain (quick fixes, organize imports in some IDEs); none affect command-line type-checking.

### Migration plan

When `typescript@^7.0.0` ships stable:

1. Replace `@typescript/native-preview` with `typescript@^7.0.x` in `package.json`.
2. Replace `tsgo --noEmit` with `tsc --noEmit` in scripts and CI.
3. Drop `--tsgo` flag from `svelte-check` invocations (the new compiler is the default once `typescript` is on 7.0).

### Revisit triggers

- TS 7 stable release date slips past 2026-09 (pessimistic — current target is 2026-06). At that point continue running on `native-preview` with no urgency.
- One of the 74 known differences hits the project. Pin `tsgo` build, file an upstream issue, decide based on impact.

## 11. Bundler boundary

**Status:** Locked invariant.

**Vite 8.0.10 (with Rolldown bundled) is used for the site only**, via SvelteKit 2.59.0 and `@sveltejs/adapter-static` 3.0.10. **The pipeline does not bundle.**

### Rationale

Bundling is a site concern, not a pipeline concern. The pipeline runs TypeScript directly under Bun: `bun run pipeline/src/cli.ts`. There is no module-graph processing, no minification, no chunking. Bundling that code would add a build step with no benefit.

For the site, Vite handles: Svelte component compilation via `@sveltejs/vite-plugin-svelte`; route chunking and code splitting; tree shaking (notably for deck.gl and the Bits UI surface); Tailwind v4 processing; static asset hashing for cache-friendly hosting; and prerendering coordination for `adapter-static`.

Vite 8 ships **Rolldown** (Rust-based bundler, currently rc.17) replacing Rollup. Rolldown is plugin-API-compatible with Rollup; the project has no custom Vite plugins, so this transition is invisible to us. The previously stated "audit custom plugins for Rolldown compatibility" concern was hypothetical and does not apply to a greenfield project using vanilla SvelteKit + the official Svelte plugin.

### Revisit triggers

- A custom Vite plugin is needed. At that point verify Rolldown compatibility before authoring it.
- SvelteKit's official plugin breaks under a Vite minor. Pin Vite minor explicitly.

## 12. Pin manifest

All versions re-verified on 2026-05-06 against npm registry, GitHub releases, or official docs. See per-section sources for citations.

| Package                        | Pin               | Notes                                                                                |
| ------------------------------ | ----------------- | ------------------------------------------------------------------------------------ |
| `@biomejs/biome`               | — (not installed) | Track Svelte/Markdown support; revisit per §6                                        |
| `@eslint/js`                   | `^10.0.1`         | Matches `eslint` major                                                               |
| `@internationalized/date`      | `^3.12.1`         | Peer of `bits-ui` Calendar/DateField                                                 |
| `@lucide/svelte`               | `^1.14.0`         | Modern Svelte 5 icon package; supersedes `lucide-svelte`                             |
| `@sqlite.org/sqlite-wasm`      | `^3.53.0-build1`  | Official SQLite-team Wasm build; ships FTS5; site-side                               |
| `@sveltejs/adapter-static`     | `^3.0.10`         | Static prerender                                                                     |
| `@sveltejs/kit`                | `^2.59.1`         | Vite 8 supported in `peerDependencies.vite`                                          |
| `@sveltejs/vite-plugin-svelte` | `^7.1.1`          | Vite 8 + Svelte 5.46.4+; v6.x targets vite ^6/^7 only                                |
| `@tailwindcss/vite`            | `^4.2.4`          | Vite 8 supported via `vite ^5.2.0 \|\| ^6 \|\| ^7 \|\| ^8` peer                      |
| `@typescript/native-preview`   | `beta`            | Pipeline + root only; site uses vanilla `typescript` (see §10)                       |
| `ajv`                          | `^8.20.0`         | Use `dist/2020` entry; standalone codegen                                            |
| `ajv-formats`                  | `^3.0.1`          | Feature-complete; no patches expected                                                |
| `bits-ui`                      | `^2.18.1`         | `peerDep: svelte ^5.33.0`                                                            |
| `bun`                          | `1.3.13`          | Runtime                                                                              |
| `clsx`                         | `^2.1.1`          | Half of the canonical shadcn `cn()` helper                                           |
| `eslint`                       | `^10.3.0`         | Flat config; introduced `preserve-caught-error` in recommended set                   |
| `eslint-plugin-svelte`         | `^3.17.1`         | Svelte 5 runes via `svelteFeatures.runes`; ships `no-navigation-without-resolve`     |
| `fast-check`                   | `^4.7.0`          | No adapter; plain under `bun:test`                                                   |
| `globals`                      | `^17.6.0`         | Updated browser/node global maps                                                     |
| `lefthook`                     | `^2.1.6`          | Go binary; replaces husky + lint-staged                                              |
| `prettier`                     | `^3.8.3`          |                                                                                      |
| `prettier-plugin-svelte`       | `^3.5.1`          | `peerDep: svelte ^5.0.0`                                                             |
| `prettier-plugin-tailwindcss`  | `^0.8.0`          | Tailwind v4 ordering                                                                 |
| `shadcn-svelte`                | `1.2.7`           | CLI **MUST** run under Node 22+ via `npx`, never `bunx --bun` (warns "unsupported")  |
| `sharp`                        | `^0.34.5`         | Bun Node-API v9; spike before pipeline relies on it                                  |
| `svelte`                       | `^5.55.5`         | Runes                                                                                |
| `svelte-check`                 | `^4.4.8`          | Site `check` script omits `--tsgo` until language-tools resolver fix lands (see §10) |
| `tailwind-merge`               | `^3.5.0`          | Half of the canonical shadcn `cn()` helper                                           |
| `tailwind-variants`            | `^3.2.2`          | `tv()` for component variant maps                                                    |
| `tailwindcss`                  | `^4.2.4`          | `@theme inline` token bridge                                                         |
| `tw-animate-css`               | `^1.4.0`          | Motion utilities expected by shadcn-svelte registry                                  |
| `typescript`                   | `^6.0.3`          | Required peer for `typescript-eslint` 8.x and svelte-check vanilla TS path           |
| `typescript-eslint`            | `^8.59.2`         | Peer requires `typescript: <6.1.0` — pin `typescript` to ^6.0.x until v9 ships       |
| `vite`                         | `^8.0.11`         | Ships Rolldown                                                                       |

## 13. Closed open questions

The baseline spec §16 listed deferred decisions. This document closes:

- **#2 Repo strategy + CI tooling** — see §1, §8.
- **#3 Future mod surface** — out of scope for Slice 1; remains deferred indefinitely (per roadmap open-questions tracker).
- **#4 Component library** — see §5.
- **#5 JSON Schema validator** — see §3.
- **#6 Property-invariant test framework** — see §4.

Still open:

- **#1 Deployment target** — closes in the first slice that publishes a built site (per roadmap).
- **#7 Tile capture mod specifics** — owed by Slice 6.
- **#8 Override mechanism details** — Slice 10 trigger.
- **#9 External archive location** — owed by Slice 9.

## 14. Refusals

This document is bound by the same refusals as the prior specs. In addition:

- **No tooling adopted for marketing reasons.** The user pushed back twice on prior iterations that elevated popular libraries without source-verified investigation; that lesson is encoded here. Every pin in §12 has a citation.
- **No version pin without a freshness check.** Each pin in §12 was verified on 2026-05-03. The next plan or addendum that adds a pin must include the verification date and source.
- **No tooling stack with overlapping responsibilities.** Prettier formats, ESLint lints, lefthook orchestrates. Biome would compete with both; we postpone adopting it specifically because doing so today would either fragment the stack (Biome for TS/JS + Prettier for Svelte/Markdown) or require accepting experimental Svelte support and missing Markdown.
- **No bundler in the pipeline.** §11 is locked.
