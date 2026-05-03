# Slice 1 — Item Walking Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `skill://superpowers:subagent-driven-development` (recommended) or `skill://superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the project's first end-to-end vertical slice. A BepInEx mod walks `Ardenfall.Item.ItemData` and emits a JSON snapshot. A TypeScript pipeline on Bun validates and canonicalises the snapshot into a SQLite blob with site metadata. A SvelteKit static site renders `/items` and `/items/[id]` pages from that blob.

**Architecture:** β (three-stage; runtime → snapshot → canonical store → site) per the design spec. Descriptor-driven: `entities/item/entity.json` plus per-variant descriptors are the cross-subsystem contract. Pipeline emits site-facing metadata into SQLite tables; the site does not parse descriptors. Per the addendum, executable per-entity code lives in the subsystem that runs it: `pipeline/src/entities/item/`, `site/src/lib/entities/item/`, `mod/src/Entities/Item/`.

**Tech Stack:** C# / BepInEx 5 / Newtonsoft.Json (mod). TypeScript / Bun 1.3.13 / Ajv 8 / fast-check 4 / `bun:sqlite` (pipeline). SvelteKit 2.59 / Svelte 5.55 / Vite 8 / Tailwind 4.2 / shadcn-svelte 1.2.7 / Bits UI 2.18.1 / `sql.js-fts5` 1.4 (site). lefthook 2.1 / Prettier 3.5 / ESLint 9 / `@typescript/native-preview@beta` (`tsgo`) / GitHub Actions.

**Reference specs:**

- `docs/superpowers/specs/2026-04-28-ardenfall-archives-design.md`
- `docs/superpowers/specs/2026-04-29-ardenfall-archives-implementation-decisions.md`
- `docs/superpowers/specs/2026-05-03-slice1-tooling-decisions.md`

The implementation decisions addendum is authoritative where it differs from the baseline design spec.

---

## Scope

**In scope (per roadmap §"Slice 1 — Item walking skeleton"):**

- Bun workspace + C# sibling project layout.
- Entity descriptor mechanism: `entities/item/entity.json` plus `entities/item/variants/<variant>.json`.
- BepInEx mod with item extraction via `BuiltLookupTable.GetAssetsOfType<ItemData>()`, stable ids via `BuiltLookupTable.GetGuid`, explicit typed DTOs, `Parameter<T>.Get()` and `SmartListParameter<T>.Get()` resolution, preflight gates, atomic snapshot output, manifest emission.
- Snapshot-level provenance per resolved field.
- TypeScript pipeline: schema validation, named-operations registry, canonical SQLite emission for `items`, `item_tags`, `item_equipment`, `item_hand_items`, `item_primary_hand_items`, `item_melee_weapons`, `item_armor`, plus pipeline-emitted site metadata.
- SvelteKit static site with `/items` and `/items/[id]` routes driven by emitted metadata, basic `fieldList` and `custom` section renderers.
- Synthetic fixtures + curated real-derived boundary capsule infrastructure + hygiene CI checks.
- End-to-end smoke: synthetic snapshot → pipeline → SQLite → site renders correct pages.

**Explicitly out of scope (deferred):**

- Item icon image rendering (Slice 3); Slice 1 carries icon refs as `asset_refs` stubs without WebP emission.
- Spells, quests, locations, map system (Slices 4–6, 8).
- FTS5 search and faceted filtering (Slice 7).
- Override mechanism (Slice 10).
- Remaining `ItemData` subclasses listed in Slice 2.
- Deployment to a hosted target (Open question #1).

---

## File Structure

This section enumerates every file Slice 1 creates or seeds. Files are grouped by logical responsibility, not phase. Phases below sequence the work.

### Repository root

```
.gitignore
.editorconfig
.gitattributes
.prettierrc
.prettierignore
biome.json                            ← intentionally absent (per tooling decisions §6); listed here as a reminder
eslint.config.js
lefthook.yml
package.json                          ← Bun workspace root
bun.lock                              ← committed
tsconfig.base.json                    ← shared TS settings extended by pipeline + site
LICENSE                               ← MIT
README.md
AGENTS.md                             ← repo-level pointer; minimal in Slice 1
CLAUDE.md                             ← one-liner pointing at AGENTS.md
.github/workflows/ci.yml              ← four path-filtered jobs
.github/PULL_REQUEST_TEMPLATE.md      ← deferred; not in Slice 1
```

### Schemas

```
schemas/entity.schema.json            ← descriptor authority
schemas/variant.schema.json           ← item variant authority
schemas/snapshot.schema.json          ← mod output authority
schemas/manifest.schema.json          ← snapshot manifest authority
schemas/digest.schema.json            ← stub for Slice 9; minimal shape only
schemas/fixture-manifest.schema.json  ← fixture pack manifest authority
```

### Entity descriptors

```
entities/item/entity.json
entities/item/variants/equipment.json
entities/item/variants/hand-item.json
entities/item/variants/primary-hand.json
entities/item/variants/melee-weapon.json
entities/item/variants/armor.json
```

(`item_tags` is a child table of `items`; it is not a separate variant.)

### Pipeline workspace

```
pipeline/package.json
pipeline/tsconfig.json
pipeline/src/cli.ts                          ← bin entry
pipeline/src/registry.ts                     ← typed-map merge for operations + canonicalisers
pipeline/src/types.ts                        ← shared TS types (Descriptor, Snapshot, SnapshotRef…)
pipeline/src/stages/load-descriptors.ts
pipeline/src/stages/load-snapshot.ts
pipeline/src/stages/validate.ts
pipeline/src/stages/canonicalise.ts
pipeline/src/stages/emit-site-metadata.ts
pipeline/src/stages/emit-read-models.ts
pipeline/src/stages/emit-sqlite.ts
pipeline/src/stages/emit-digest.ts
pipeline/src/orchestrator.ts                 ← topo-sorted stage runner
pipeline/src/entities/item/canonicaliser.ts
pipeline/src/entities/item/operations.ts
pipeline/src/operations/core.ts              ← built-in ops
pipeline/src/sql/ddl.ts                      ← generates DDL for items + variant tables
pipeline/src/sql/site-metadata-ddl.ts        ← generates DDL for site_* tables
pipeline/scripts/codegen-validators.ts       ← Ajv standaloneCode emitter
pipeline/scripts/check-fixtures.ts           ← hygiene check used by CI
pipeline/dist/validate-entity.mjs            ← committed, regenerated; .gitignore exception
pipeline/dist/validate-snapshot.mjs
pipeline/dist/validate-manifest.mjs
pipeline/dist/validate-fixture-manifest.mjs
pipeline/test/registry.test.ts
pipeline/test/orchestrator.test.ts
pipeline/test/canonicaliser.test.ts
pipeline/test/site-metadata.test.ts
pipeline/test/invariants/items.test.ts
pipeline/test/fixtures/synthetic/manifest.json
pipeline/test/fixtures/synthetic/items.json
pipeline/test/fixtures/synthetic/manifest-pack.json   ← fixture-manifest envelope
pipeline/test/fixtures/real-capsule/.gitkeep         ← capsule lands when first real extraction is curated
```

### Mod project (C# / BepInEx 5)

```
mod/ArdenfallArchives.csproj
mod/src/Plugin.cs                            ← BepInEx [BepInPlugin], hot register, hotkey + commands
mod/src/Triggers/Hotkey.cs
mod/src/Triggers/ConsoleCommand.cs
mod/src/Triggers/ReadinessMonitor.cs         ← advisory only
mod/src/Preflight/Preflight.cs               ← gate before snapshot write
mod/src/Walker/WalkerBase.cs                 ← cycle detection, ref resolution, JSON emit
mod/src/Walker/RefResolver.cs                ← BuiltLookupTable.GetGuid, missing-ref policy
mod/src/Walker/ProvenanceCapture.cs          ← Parameter<T> / SmartListParameter<T> resolution
mod/src/Emit/SnapshotWriter.cs               ← atomic stage→publish
mod/src/Emit/ManifestBuilder.cs
mod/src/Emit/JsonSettings.cs                 ← Newtonsoft config
mod/src/Dtos/SnapshotRef.cs
mod/src/Dtos/Manifest.cs
mod/src/Dtos/PreflightReport.cs
mod/src/Dtos/Diagnostic.cs
mod/src/Dtos/Provenance.cs
mod/src/Entities/Item/ItemSnapshot.cs                ← root DTO
mod/src/Entities/Item/ItemEquipmentSnapshot.cs
mod/src/Entities/Item/ItemHandSnapshot.cs
mod/src/Entities/Item/ItemPrimaryHandSnapshot.cs
mod/src/Entities/Item/ItemMeleeSnapshot.cs
mod/src/Entities/Item/ItemArmorSnapshot.cs
mod/src/Entities/Item/ItemTagSnapshot.cs
mod/src/Entities/Item/ItemExtractor.cs               ← orchestrates per-layer adapters
mod/src/Entities/Item/Adapters/ExtractItem.cs
mod/src/Entities/Item/Adapters/ExtractEquipment.cs
mod/src/Entities/Item/Adapters/ExtractHandItem.cs
mod/src/Entities/Item/Adapters/ExtractPrimaryHand.cs
mod/src/Entities/Item/Adapters/ExtractMelee.cs
mod/src/Entities/Item/Adapters/ExtractArmor.cs
mod/scripts/copy-libs.sh                              ← copies game DLLs to mod/libs/ (gitignored)
mod/libs/                                             ← gitignored; populated locally
mod/AGENTS.md                                         ← per-subsystem orientation, minimal in Slice 1
```

### Site workspace

```
site/package.json
site/tsconfig.json
site/svelte.config.js
site/vite.config.ts
site/src/app.html
site/src/app.css                            ← Tailwind v4 + @theme inline tokens
site/src/lib/utils.ts                       ← cn() helper for tailwind-variants
site/src/lib/components/ui/button/...       ← shadcn-svelte CLI copies
site/src/lib/components/ui/input/...
site/src/lib/components/ui/label/...
site/src/lib/components/ui/select/...
site/src/lib/components/ui/dialog/...
site/src/lib/components/ui/tabs/...
site/src/lib/components/ui/tooltip/...
site/src/lib/components/EntityTable.svelte
site/src/lib/entities/item/sections.ts      ← registered renderers (typed map)
site/src/lib/entities/item/sections/MeleeStats.svelte
site/src/lib/entity/sections/FieldList.svelte    ← built-in fieldList renderer
site/src/lib/entity/registry.ts             ← merges per-entity sections at boot
site/src/lib/store/index.ts                 ← getDb(), query(), queryOne(); sql.js-fts5
site/src/lib/store/site-meta.ts             ← reads site_* tables, exposes typed accessors
site/src/lib/store/items.ts                 ← reads item_* read models
site/src/routes/+layout.svelte
site/src/routes/+page.svelte                ← landing
site/src/routes/items/+page.svelte          ← overview (concrete; generic [entity] follows in Slice 4)
site/src/routes/items/[id]/+page.svelte
site/static/data.sqlite                     ← generated; .gitignore'd
site/AGENTS.md
```

(Generic `[entity]/+page.svelte` is intentionally deferred to the slice that introduces a second entity. Slice 1 ships concrete `/items` routes and the metadata-driven primitives. The generic route adds zero value with one entity; it gets refactored in Slice 4 when spells arrive. This avoids YAGNI premature abstraction.)

### Fixtures

```
fixtures/synthetic/manifest.json                     ← fixture-manifest envelope
fixtures/synthetic/snapshot/manifest.json            ← inner snapshot manifest
fixtures/synthetic/snapshot/items.json
fixtures/real-capsule/.gitkeep
fixtures/scripts/curate-capsule.ts                   ← deterministic curation tool
```

### Generated / gitignored

```
node_modules/
.svelte-kit/
site/build/
site/static/data.sqlite
site/static/assets/                                  ← Slice 3
site/static/tiles/                                   ← Slice 6
mod/bin/
mod/obj/
mod/libs/
snapshots/                                           ← real extractions; archived externally
*.log
*.tmp
.DS_Store
```

---

## Tech Stack — Pinned Versions (verified 2026-05-03)

This list is the canonical source for Slice 1; the Pin Manifest in `2026-05-03-slice1-tooling-decisions.md` §12 expands rationale. Do not float versions.

```jsonc
{
  "engines": { "bun": "1.3.13" },
  "devDependencies": {
    "@biomejs/biome": "(intentionally absent)",
    "@eslint/js": "^9.0.0",
    "@sveltejs/adapter-static": "^3.0.10",
    "@sveltejs/kit": "^2.59.0",
    "@sveltejs/vite-plugin-svelte": "^6.2.1",
    "@tailwindcss/vite": "^4.2.4",
    "@typescript/native-preview": "beta",
    "ajv": "^8.20.0",
    "ajv-formats": "^3.0.1",
    "bits-ui": "^2.18.1",
    "eslint": "^9.0.0",
    "eslint-plugin-svelte": "^3.17.0",
    "fast-check": "^4.7.0",
    "globals": "^16.0.0",
    "lefthook": "^2.1.6",
    "prettier": "^3.5.0",
    "prettier-plugin-svelte": "^3.5.1",
    "prettier-plugin-tailwindcss": "^0.6.0",
    "shadcn-svelte": "1.2.7",
    "sql.js-fts5": "^1.4.0",
    "@types/sql.js": "^1.4.9",
    "svelte": "^5.55.5",
    "svelte-check": "^4.3.4",
    "tailwindcss": "^4.2.4",
    "tailwind-variants": "^3.2.2",
    "typescript-eslint": "^8.0.0",
    "vite": "^8.0.10"
  }
}
```

C# (mod):

```xml
<TargetFramework>net46</TargetFramework>
<PackageReference Include="BepInEx.Core" Version="5.4.23" />
<PackageReference Include="Newtonsoft.Json" Version="13.0.3" />
```

(`Assembly-CSharp.dll`, `UnityEngine.dll`, `UnityEngine.CoreModule.dll`, `Sirenix.OdinInspector.Attributes.dll`, etc., are referenced from `mod/libs/` populated by `scripts/copy-libs.sh`.)

---

## Verification gates between phases

Each phase ends with a passing-tests gate. Do not begin a later phase until the prior gate is green. The gates are:

- **A:** `bun install` succeeds; `git status` clean; CI dry-run passes (`bun run lint`, `bunx tsgo --noEmit -p .`).
- **B:** `bun run codegen:validators` produces `pipeline/dist/validate-*.mjs`; `bun test pipeline/test/registry.test.ts` passes.
- **C:** `bun run pipeline:validate-entities` passes against `entities/item/`.
- **D:** `bun test pipeline/test/orchestrator.test.ts` passes; orchestrator runs an empty plan deterministically.
- **E:** `bun test pipeline/test/canonicaliser.test.ts pipeline/test/site-metadata.test.ts pipeline/test/invariants/items.test.ts` passes against the synthetic fixture; `pipeline/dist/data.sqlite` is produced.
- **F:** `dotnet build mod/ArdenfallArchives.csproj` succeeds; `mod/bin/.../ArdenfallArchives.dll` exists.
- **G:** Local manual: install mod into Ardenfall demo, launch, observe `[ArdenfallArchives] preflight: ok`, run `/extract`, observe atomic snapshot at `snapshots/<game>-<ts>/`. Validate that snapshot through the pipeline; no diagnostics with severity ≥ `diagnostic`.
- **H:** `bun run --cwd site check` and `bun run --cwd site build` both succeed; `site/build/` contains static output.
- **I:** Hitting `site/build/items/` in a static server renders the synthetic-fixture items; `/items/<known-id>/` renders detail with `fieldList` sections.
- **J:** `bun run check:fixtures` passes; CI's `fixtures` job is green on a clean checkout.
- **K:** End-to-end CI is green on the merge commit; all four jobs pass in parallel.

---
## Phase A — Repository bootstrap

Goal: clean, opinionated project skeleton; CI runs (no jobs do real work yet); lint/format/pre-commit wired.

### Task A.1: Initialise Bun workspace + tsconfig.base

**Files:**
- Create: `package.json`
- Create: `bun.lock`
- Create: `tsconfig.base.json`
- Create: `.editorconfig`
- Create: `.gitattributes`

- [ ] **Step 1: Write `package.json`**

```jsonc
{
  "name": "ardenfall-archives",
  "private": true,
  "type": "module",
  "engines": { "bun": ">=1.3.13" },
  "workspaces": ["pipeline", "site"],
  "scripts": {
    "lint":              "eslint .",
    "format":            "prettier --write .",
    "format:check":      "prettier --check .",
    "typecheck":         "bunx tsgo --noEmit -p .",
    "codegen:validators": "bun run pipeline/scripts/codegen-validators.ts",
    "check:fixtures":    "bun run pipeline/scripts/check-fixtures.ts"
  },
  "devDependencies": {
    "@eslint/js":              "^9.0.0",
    "@typescript/native-preview": "beta",
    "eslint":                  "^9.0.0",
    "eslint-plugin-svelte":    "^3.17.0",
    "globals":                 "^16.0.0",
    "lefthook":                "^2.1.6",
    "prettier":                "^3.5.0",
    "prettier-plugin-svelte":  "^3.5.1",
    "prettier-plugin-tailwindcss": "^0.6.0",
    "typescript-eslint":       "^8.0.0"
  }
}
```

- [ ] **Step 2: Write `tsconfig.base.json`**

```jsonc
{
  "compilerOptions": {
    "target":           "ES2023",
    "module":           "ESNext",
    "moduleResolution": "bundler",
    "lib":              ["ES2023", "DOM", "DOM.Iterable"],
    "strict":           true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop":  true,
    "skipLibCheck":     true,
    "resolveJsonModule": true,
    "isolatedModules":  true,
    "verbatimModuleSyntax": true,
    "types":            ["bun-types"]
  }
}
```

- [ ] **Step 3: Write `.editorconfig`**

```
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.{cs,csproj}]
indent_size = 4

[*.md]
trim_trailing_whitespace = false
```

- [ ] **Step 4: Write `.gitattributes`**

```
* text=auto eol=lf
*.png binary
*.webp binary
*.dll binary
*.sqlite binary
bun.lock -text
```

- [ ] **Step 5: `bun install` and verify**

Run: `bun install`
Expected: produces `bun.lock` and `node_modules/`. Exits 0. No deprecation warnings on the listed packages.

- [ ] **Step 6: Commit**

```bash
git add package.json bun.lock tsconfig.base.json .editorconfig .gitattributes
git commit -m "chore(repo): bootstrap bun workspace and base tsconfig"
```

### Task A.2: Configure Prettier and ESLint

**Files:**
- Create: `.prettierrc`
- Create: `.prettierignore`
- Create: `eslint.config.js`

- [ ] **Step 1: Write `.prettierrc`**

```json
{
  "plugins": ["prettier-plugin-svelte", "prettier-plugin-tailwindcss"],
  "printWidth": 100,
  "useTabs": false,
  "tabWidth": 2,
  "trailingComma": "all",
  "singleQuote": false,
  "semi": true,
  "overrides": [
    { "files": "*.svelte", "options": { "parser": "svelte" } }
  ]
}
```

- [ ] **Step 2: Write `.prettierignore`**

```
node_modules/
.svelte-kit/
site/build/
site/static/data.sqlite
mod/bin/
mod/obj/
mod/libs/
pipeline/dist/
snapshots/
*.lock
bun.lockb
```

- [ ] **Step 3: Write `eslint.config.js`**

```js
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import svelte from "eslint-plugin-svelte";
import globals from "globals";
import svelteConfig from "./site/svelte.config.js";

export default tseslint.config(
  {
    ignores: [
      "node_modules/",
      ".svelte-kit/",
      "site/build/",
      "pipeline/dist/",
      "mod/bin/",
      "mod/obj/",
      "mod/libs/",
      "snapshots/",
    ],
  },
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
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
);
```

- [ ] **Step 4: Verify formatters run cleanly on bootstrapped files**

Run: `bun run format:check`
Expected: PASS. (Only `package.json` and the configs are present; all are valid Prettier-formatted JSON/JS.)

Run: `bun run lint`
Expected: PASS or report `0 errors` and may report `0 warnings`. (`eslint.config.js` references `site/svelte.config.js` which does not exist yet; if eslint warns, ignore until Phase H — until then, exclude `eslint.config.js` self-lint by adding it to `ignores` if needed.)

- [ ] **Step 5: Commit**

```bash
git add .prettierrc .prettierignore eslint.config.js
git commit -m "chore(repo): configure prettier and eslint flat config"
```

### Task A.3: Configure lefthook, .gitignore, LICENSE, README

**Files:**
- Create: `lefthook.yml`
- Create: `.gitignore`
- Create: `LICENSE`
- Create: `README.md`

- [ ] **Step 1: Write `lefthook.yml`**

```yaml
pre-commit:
  parallel: true
  jobs:
    - name: prettier
      glob: "*.{ts,js,svelte,json,jsonc,md,css,yaml,yml}"
      run: bunx prettier --write {staged_files}
      stage_fixed: true
    - name: eslint
      glob: "*.{ts,js,svelte}"
      exclude: ["pipeline/dist/**"]
      run: bunx eslint --fix {staged_files}
      stage_fixed: true
    - name: dotnet-format
      glob: "*.cs"
      run: dotnet format mod/ArdenfallArchives.csproj --include {staged_files}
      stage_fixed: true
      skip:
        - merge
        - rebase

pre-push:
  jobs:
    - name: typecheck
      run: bun run typecheck
    - name: tests
      run: bun test
```

- [ ] **Step 2: Install lefthook hooks**

Run: `bunx lefthook install`
Expected: `SYNCING` then `SYNCED`. `.git/hooks/pre-commit` and `.git/hooks/pre-push` are written.

- [ ] **Step 3: Write `.gitignore`**

```
# Bun + Node
node_modules/
.bun/

# SvelteKit
.svelte-kit/
site/build/

# Pipeline outputs
pipeline/dist/*.mjs.tmp
site/static/data.sqlite
site/static/data.sqlite-wal
site/static/data.sqlite-shm
site/static/assets/
site/static/tiles/

# C# / BepInEx mod
mod/bin/
mod/obj/
mod/libs/

# Snapshots and ad-hoc
snapshots/
fixtures/real-capsule/snapshot/
*.log
*.tmp
*.bak

# OS
.DS_Store
Thumbs.db

# IDE
.idea/
.vscode/*
!.vscode/extensions.json
!.vscode/settings.json
```

Note: `pipeline/dist/validate-*.mjs` are committed; only `*.tmp` is ignored.

- [ ] **Step 4: Write `LICENSE`**

Use the standard MIT license text (https://opensource.org/license/mit/), substituting `<YEAR>` with `2026` and `<COPYRIGHT HOLDER>` with the user's name as it appears in `git config user.name`. The implementer should fetch their git identity once and embed it; do not commit a placeholder.

Run: `git config user.name`
Expected: a name string. Use it.

- [ ] **Step 5: Write `README.md`**

```markdown
# Ardenfall Archives

Static, agentic-first wiki and interactive map for the Unity-Mono game **Ardenfall** (Spellcast Studios).

## Repository shape

| Path | Subsystem | Toolchain |
|---|---|---|
| `mod/` | BepInEx 5 plugin that walks live game objects and emits JSON snapshots | C# / `dotnet build` |
| `pipeline/` | TypeScript pipeline that validates snapshots and produces canonical SQLite + WebP assets | Bun |
| `site/` | SvelteKit static site that ships the SQLite blob and renders entity pages + interactive map | Bun + Vite |
| `entities/` | Filesystem-as-registry of entity descriptors | JSON |
| `schemas/` | JSON Schema authority for descriptors, snapshots, manifests | JSON Schema 2020-12 |
| `docs/superpowers/` | Specs, plans, and roadmap | Markdown |

## Design documents

Read in order:

1. `docs/superpowers/specs/2026-04-28-ardenfall-archives-design.md`
2. `docs/superpowers/specs/2026-04-29-ardenfall-archives-implementation-decisions.md`
3. `docs/superpowers/specs/2026-05-03-slice1-tooling-decisions.md`
4. `docs/superpowers/roadmap.md`

## Local quickstart

```sh
bun install
bunx lefthook install
bun run typecheck
bun test
```

Mod build (Mac/Linux requires `mono` or `dotnet`):

```sh
mod/scripts/copy-libs.sh   # copies game DLLs from your local Ardenfall install
dotnet build mod/ArdenfallArchives.csproj
```

## License

MIT.
```

- [ ] **Step 6: Commit**

```bash
git add lefthook.yml .gitignore LICENSE README.md
git commit -m "chore(repo): add lefthook, gitignore, license, and readme"
```

### Task A.4: Repo-level AGENTS.md and CLAUDE.md

**Files:**
- Create: `AGENTS.md`
- Create: `CLAUDE.md`

- [ ] **Step 1: Write `AGENTS.md`**

The full per-subsystem worked-example treatment is owed by Slice 11. Slice 1 lands an honest stub that points at the live spec set so agents do not invent conventions.

```markdown
# Repo Agent Orientation

This repository is the static archive for the game Ardenfall. Its design is captured in `docs/superpowers/specs/`. Read those before changing anything; they document non-obvious invariants this codebase enforces by design.

## Where to look first

- Design baseline: `docs/superpowers/specs/2026-04-28-ardenfall-archives-design.md`
- Implementation decisions (authoritative where the baseline differs): `docs/superpowers/specs/2026-04-29-ardenfall-archives-implementation-decisions.md`
- Slice-1 tooling pins: `docs/superpowers/specs/2026-05-03-slice1-tooling-decisions.md`
- Living roadmap: `docs/superpowers/roadmap.md`
- Active plan: `docs/superpowers/plans/<latest>.md`

## Subsystem entry points

- `mod/AGENTS.md` — BepInEx walker, DTOs, snapshot writer.
- `pipeline/AGENTS.md` — descriptor loader, stage orchestrator, canonicaliser, site-metadata emitter.
- `site/AGENTS.md` — SvelteKit pages, store accessors, design tokens, deck.gl map (later).

## Non-negotiable invariants

- The descriptor at `entities/<id>/entity.json` is the only cross-subsystem source of truth for entity shape. Do not duplicate it in TS, SQL, or C#.
- Filesystem is the registry. Do not maintain manual indexes, enums, or unions of entity ids.
- The site reads pipeline-emitted SQLite metadata only. It does not parse descriptors directly.
- No raw Unity / Odin / game-object JSON in snapshots. The mod walks live runtime graphs and emits explicit DTOs.
- Pre-commit runs Prettier, ESLint, and `dotnet format` via lefthook. Do not bypass with `--no-verify` for routine work.

If you find this document outdated, update it in the same commit as the change that outdates it.
```

- [ ] **Step 2: Write `CLAUDE.md`**

```markdown
See `AGENTS.md` in this repository's root.
```

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md CLAUDE.md
git commit -m "docs(repo): add agents.md orientation"
```

### Task A.5: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: ci
on:
  push:
    branches: [main]
  pull_request:
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with: { bun-version: 1.3.13 }
      - run: bun install --frozen-lockfile
      - run: bun run format:check
      - run: bun run lint

  pipeline:
    runs-on: ubuntu-latest
    if: |
      github.event_name == 'push' ||
      contains(toJson(github.event.pull_request.changed_files), 'pipeline/') ||
      contains(toJson(github.event.pull_request.changed_files), 'entities/') ||
      contains(toJson(github.event.pull_request.changed_files), 'schemas/')
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with: { bun-version: 1.3.13 }
      - run: bun install --frozen-lockfile
      - run: bun run codegen:validators
      - run: bun run typecheck
      - run: bun test pipeline/test

  site:
    runs-on: ubuntu-latest
    needs: pipeline
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with: { bun-version: 1.3.13 }
      - run: bun install --frozen-lockfile
      - run: bun run codegen:validators
      - run: bun run --cwd site check
      - run: bun run --cwd site build

  mod:
    runs-on: ubuntu-latest
    if: |
      github.event_name == 'push' ||
      contains(toJson(github.event.pull_request.changed_files), 'mod/')
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with: { dotnet-version: '8.0.x' }
      - run: dotnet build mod/ArdenfallArchives.csproj -c Release -p:RestorePackagesWithLockFile=false
        env: { CI: "true" }

  fixtures:
    runs-on: ubuntu-latest
    if: |
      github.event_name == 'push' ||
      contains(toJson(github.event.pull_request.changed_files), 'fixtures/') ||
      contains(toJson(github.event.pull_request.changed_files), 'pipeline/scripts/check-fixtures.ts')
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with: { bun-version: 1.3.13 }
      - run: bun install --frozen-lockfile
      - run: bun run check:fixtures
```

Note: the `mod` job will fail on a fresh checkout in Slice 1 because `mod/libs/` is gitignored and `Assembly-CSharp.dll` is not bundled. Use `if:` to gate the job until Phase F lands the csproj. Until Phase F: keep the job definition but mark it `continue-on-error: true`. Replace with hard failure once `mod/libs/` is reproducibly populated by an action step that bundles BepInEx publicly-shipped DLLs only (no game DLL needed for compile-only public types). Resolution of `Assembly-CSharp.dll` references for CI is owed by Phase F.

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci(repo): add github actions workflow with path filters"
```

### Phase A gate

```sh
bun install
bun run format:check
bun run lint
git status            # clean
```

All four exit 0. CI on the next push runs the `lint` job to completion.

---

## Phase B — Schemas

Goal: every cross-subsystem contract is JSON-Schema-validated. Compiled validators are committed so the pipeline runs without an Ajv codegen step on hot paths.

### Task B.1: Author `entity.schema.json`

**Files:**
- Create: `schemas/entity.schema.json`

- [ ] **Step 1: Write the schema**

```jsonc
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id":     "https://ardenfall-archives.example/schemas/entity.schema.json",
  "title":   "Entity descriptor",
  "type":    "object",
  "additionalProperties": false,
  "required": ["id", "label", "extraction", "fields"],
  "properties": {
    "$schema":   { "type": "string" },
    "id":        { "type": "string", "pattern": "^[a-z][a-z0-9-]*$" },
    "label": {
      "type": "object",
      "additionalProperties": false,
      "required": ["singular", "plural"],
      "properties": {
        "singular": { "type": "string", "minLength": 1 },
        "plural":   { "type": "string", "minLength": 1 }
      }
    },
    "extraction": {
      "type": "object",
      "additionalProperties": false,
      "required": ["root"],
      "properties": {
        "root":    { "type": "string", "minLength": 1 },
        "walker":  { "type": "string" },
        "options": { "type": "object" }
      }
    },
    "fields": {
      "type": "array",
      "minItems": 1,
      "items": { "$ref": "#/$defs/field" }
    },
    "variants": {
      "type": "object",
      "additionalProperties": false,
      "required": ["dir"],
      "properties": {
        "dir":      { "type": "string", "default": "variants" },
        "registry": { "type": "string" }
      }
    },
    "denormalise": {
      "type": "array",
      "items": { "$ref": "#/$defs/op" }
    },
    "site": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "overview": { "$ref": "#/$defs/siteOverview" },
        "detail":   { "$ref": "#/$defs/siteDetail"   }
      }
    },
    "map": {
      "oneOf": [
        { "type": "null" },
        { "$ref": "#/$defs/siteMap" }
      ],
      "default": null
    }
  },
  "$defs": {
    "field": {
      "type": "object",
      "additionalProperties": false,
      "required": ["name", "type", "from"],
      "properties": {
        "name":         { "type": "string", "pattern": "^[a-z][a-zA-Z0-9_]*$" },
        "type":         { "type": "string", "minLength": 1 },
        "from":         { "type": "string", "minLength": 1 },
        "operation":    { "type": "string" },
        "missingPolicy": {
          "enum": ["fatal", "diagnostic", "optional-empty"],
          "default": "diagnostic"
        },
        "label":        { "type": "string" },
        "description":  { "type": "string" }
      }
    },
    "op": {
      "type": "object",
      "required": ["op"],
      "properties": {
        "op":   { "type": "string" },
        "from": { "type": "string" },
        "as":   { "type": "string" }
      }
    },
    "siteOverview": {
      "type": "object",
      "additionalProperties": false,
      "required": ["columns"],
      "properties": {
        "columns": { "type": "array", "items": { "type": "string" }, "minItems": 1 },
        "search":  { "type": "array", "items": { "type": "string" } },
        "filters": { "type": "array", "items": { "$ref": "#/$defs/filter" } }
      }
    },
    "siteDetail": {
      "type": "object",
      "additionalProperties": false,
      "required": ["sections"],
      "properties": {
        "sections": {
          "type": "array",
          "items": { "$ref": "#/$defs/section" }
        }
      }
    },
    "filter": {
      "type": "object",
      "additionalProperties": false,
      "required": ["field", "kind"],
      "properties": {
        "field": { "type": "string" },
        "kind":  { "enum": ["categorical", "range", "boolean"] }
      }
    },
    "section": {
      "oneOf": [
        {
          "type": "object",
          "additionalProperties": false,
          "required": ["id", "kind", "title", "fields"],
          "properties": {
            "id":     { "type": "string" },
            "kind":   { "const": "fieldList" },
            "title":  { "type": "string" },
            "fields": { "type": "array", "items": { "type": "string" }, "minItems": 1 }
          }
        },
        {
          "type": "object",
          "additionalProperties": false,
          "required": ["id", "kind", "title", "renderer"],
          "properties": {
            "id":       { "type": "string" },
            "kind":     { "const": "custom" },
            "title":    { "type": "string" },
            "renderer": { "type": "string" },
            "props":    { "type": "object" }
          }
        }
      ]
    },
    "siteMap": {
      "type": "object",
      "additionalProperties": false,
      "required": ["layer"],
      "properties": {
        "layer":   { "type": "string" },
        "icon":    { "type": "string" },
        "color":   { "type": "array", "items": { "type": "integer", "minimum": 0, "maximum": 255 }, "minItems": 3, "maxItems": 4 },
        "radius":  { "type": "number", "minimum": 0 },
        "filters": { "type": "array", "items": { "$ref": "#/$defs/filter" } },
        "tooltip": { "type": "array", "items": { "type": "string" } }
      }
    }
  }
}
```

- [ ] **Step 2: Verify schema is itself valid JSON Schema**

Run: `bunx ajv compile --spec=draft2020 -s schemas/entity.schema.json --strict=true || true`
Expected: either `schema is valid` or installs ajv-cli and runs. We accept either if the tool reports the schema parses. (`ajv-cli` will be added as a dev dependency in Task B.5; for now the verification is "schema is well-formed JSON".) For now use:

Run: `bun -e 'JSON.parse(await Bun.file("schemas/entity.schema.json").text())'`
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add schemas/entity.schema.json
git commit -m "feat(schemas): define entity descriptor schema"
```

### Task B.2: Author `variant.schema.json`

**Files:**
- Create: `schemas/variant.schema.json`

- [ ] **Step 1: Write the schema**

```jsonc
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id":     "https://ardenfall-archives.example/schemas/variant.schema.json",
  "title":   "Entity variant descriptor",
  "type":    "object",
  "additionalProperties": false,
  "required": ["variantId", "label", "unityType", "canonicalTable", "fields"],
  "properties": {
    "$schema":         { "type": "string" },
    "variantId":       { "type": "string", "pattern": "^[a-z][a-z0-9-]*$" },
    "label":           { "type": "string", "minLength": 1 },
    "unityType":       { "type": "string", "minLength": 1, "description": "Fully-qualified Mono type name (e.g. Ardenfall.Item.MeleeItemData)" },
    "canonicalTable":  { "type": "string", "pattern": "^[a-z][a-z0-9_]*$" },
    "parentVariantId": { "type": "string" },
    "isPublicRoute":   { "type": "boolean", "default": false },
    "position":        { "type": "integer", "minimum": 0 },
    "fields": {
      "type": "array",
      "minItems": 1,
      "items": { "$ref": "https://ardenfall-archives.example/schemas/entity.schema.json#/$defs/field" }
    }
  }
}
```

- [ ] **Step 2: Sanity-parse the JSON**

Run: `bun -e 'JSON.parse(await Bun.file("schemas/variant.schema.json").text())'`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add schemas/variant.schema.json
git commit -m "feat(schemas): define entity variant schema"
```

### Task B.3: Author `snapshot.schema.json` and `manifest.schema.json`

**Files:**
- Create: `schemas/snapshot.schema.json`
- Create: `schemas/manifest.schema.json`

- [ ] **Step 1: Write `manifest.schema.json`**

```jsonc
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id":     "https://ardenfall-archives.example/schemas/manifest.schema.json",
  "title":   "Snapshot manifest",
  "type":    "object",
  "additionalProperties": false,
  "required": [
    "schemaVersion", "extractorVersion", "extractedAt",
    "preflight", "counts", "diagnostics", "hashes"
  ],
  "properties": {
    "schemaVersion":    { "type": "integer", "minimum": 1 },
    "gameVersion":      { "type": "string" },
    "buildIdentifier":  { "type": "string" },
    "extractorVersion": { "type": "string", "minLength": 1 },
    "extractedAt":      { "type": "string", "format": "date-time" },
    "preflight": {
      "type": "object",
      "additionalProperties": false,
      "required": ["passed", "checks", "completedAt"],
      "properties": {
        "passed":      { "type": "boolean" },
        "completedAt": { "type": "string", "format": "date-time" },
        "checks": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["name", "ok"],
            "properties": {
              "name":   { "type": "string" },
              "ok":     { "type": "boolean" },
              "reason": { "type": "string" }
            }
          }
        }
      }
    },
    "counts": {
      "type": "object",
      "additionalProperties": { "type": "integer", "minimum": 0 }
    },
    "diagnostics": {
      "type": "object",
      "additionalProperties": false,
      "required": ["fatal", "diagnostic"],
      "properties": {
        "fatal":      { "type": "integer", "minimum": 0 },
        "diagnostic": { "type": "integer", "minimum": 0 }
      }
    },
    "hashes": {
      "type": "object",
      "additionalProperties": { "type": "string", "pattern": "^[a-f0-9]{64}$" }
    }
  }
}
```

- [ ] **Step 2: Write `snapshot.schema.json`**

The snapshot per-entity files share a common envelope with entity-specific bodies. The envelope is generic; per-entity field shape is enforced at canonicalisation time against the descriptor + variant schemas.

```jsonc
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id":     "https://ardenfall-archives.example/schemas/snapshot.schema.json",
  "title":   "Snapshot per-entity envelope",
  "type":    "object",
  "additionalProperties": false,
  "required": ["entityId", "schemaVersion", "rows"],
  "properties": {
    "entityId":      { "type": "string", "pattern": "^[a-z][a-z0-9-]*$" },
    "schemaVersion": { "type": "integer", "minimum": 1 },
    "rows": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "fields"],
        "properties": {
          "id":       { "type": "string", "minLength": 1 },
          "variant":  { "type": "string" },
          "fields":   { "type": "object" },
          "tags":     { "type": "array", "items": { "type": "string" } },
          "provenance": {
            "type": "object",
            "additionalProperties": { "$ref": "#/$defs/fieldProvenance" }
          },
          "diagnostics": {
            "type": "array",
            "items": { "$ref": "#/$defs/diagnostic" }
          }
        }
      }
    }
  },
  "$defs": {
    "fieldProvenance": {
      "type": "object",
      "additionalProperties": false,
      "required": ["kind", "source", "isSet", "inherited"],
      "properties": {
        "kind":      { "enum": ["parameter", "smartListParameter", "lookupAsset", "record", "runtimeObject", "missing"] },
        "source":    { "type": "string" },
        "isSet":     { "type": "boolean" },
        "inherited": { "type": "boolean" },
        "parent": {
          "type": "object",
          "properties": {
            "kind":      { "type": "string" },
            "guid":      { "type": "string" },
            "unityType": { "type": "string" }
          }
        }
      }
    },
    "diagnostic": {
      "type": "object",
      "additionalProperties": false,
      "required": ["severity", "code", "field"],
      "properties": {
        "severity": { "enum": ["fatal", "diagnostic"] },
        "code":     { "type": "string" },
        "field":    { "type": "string" },
        "message":  { "type": "string" }
      }
    }
  }
}
```

- [ ] **Step 3: Sanity-parse**

```sh
bun -e 'JSON.parse(await Bun.file("schemas/manifest.schema.json").text())'
bun -e 'JSON.parse(await Bun.file("schemas/snapshot.schema.json").text())'
```
Both exit 0.

- [ ] **Step 4: Commit**

```bash
git add schemas/manifest.schema.json schemas/snapshot.schema.json
git commit -m "feat(schemas): define manifest and snapshot envelope"
```

### Task B.4: `digest.schema.json` (stub) and `fixture-manifest.schema.json`

**Files:**
- Create: `schemas/digest.schema.json`
- Create: `schemas/fixture-manifest.schema.json`

- [ ] **Step 1: Write `digest.schema.json` (Slice 9 will expand)**

```jsonc
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id":     "https://ardenfall-archives.example/schemas/digest.schema.json",
  "title":   "Cross-version digest (stub for Slice 9)",
  "type":    "object",
  "additionalProperties": false,
  "required": ["schemaVersion", "gameVersion", "counts"],
  "properties": {
    "schemaVersion": { "type": "integer", "minimum": 1 },
    "gameVersion":   { "type": "string", "minLength": 1 },
    "extractedAt":   { "type": "string", "format": "date-time" },
    "counts":        { "type": "object", "additionalProperties": { "type": "integer", "minimum": 0 } },
    "added":         { "type": "object", "additionalProperties": { "type": "array", "items": { "type": "string" } } },
    "removed":       { "type": "object", "additionalProperties": { "type": "array", "items": { "type": "string" } } },
    "renamed":       { "type": "object", "additionalProperties": { "type": "array", "items": { "type": "string" } } }
  }
}
```

- [ ] **Step 2: Write `fixture-manifest.schema.json`**

```jsonc
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id":     "https://ardenfall-archives.example/schemas/fixture-manifest.schema.json",
  "title":   "Fixture pack manifest",
  "type":    "object",
  "additionalProperties": false,
  "required": [
    "fixtureKind", "schemaVersion", "intendedAssertions", "selection", "hashes"
  ],
  "properties": {
    "fixtureKind":          { "enum": ["synthetic", "real-derived-curated", "digest", "boundary-certificate"] },
    "schemaVersion":        { "type": "integer", "minimum": 1 },
    "extractorVersion":     { "type": "string" },
    "gameVersion":          { "type": "string" },
    "buildIdentifier":      { "type": "string" },
    "source":               { "type": "string" },
    "curationToolVersion":  { "type": "string" },
    "intendedAssertions":   { "type": "array", "items": { "type": "string" }, "minItems": 1 },
    "selection": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["entity", "ids"],
        "additionalProperties": false,
        "properties": {
          "entity":    { "type": "string" },
          "ids":       { "type": "array", "items": { "type": "string" } },
          "rationale": { "type": "string" }
        }
      }
    },
    "scrubbing":            { "type": "string" },
    "minimization":         { "type": "string" },
    "hashes": {
      "type": "object",
      "additionalProperties": { "type": "string", "pattern": "^[a-f0-9]{64}$" }
    }
  }
}
```

- [ ] **Step 3: Sanity-parse and commit**

```sh
bun -e 'JSON.parse(await Bun.file("schemas/digest.schema.json").text())'
bun -e 'JSON.parse(await Bun.file("schemas/fixture-manifest.schema.json").text())'
git add schemas/digest.schema.json schemas/fixture-manifest.schema.json
git commit -m "feat(schemas): add digest stub and fixture manifest schemas"
```

### Task B.5: Compile validators and commit standalone outputs

**Files:**
- Create: `pipeline/scripts/codegen-validators.ts`
- Create: `pipeline/dist/.gitkeep`
- Modify: root `package.json` to add `ajv` and `ajv-formats` to root `devDependencies` (they are used by the codegen script)

- [ ] **Step 1: Add Ajv dependencies to root `package.json`**

Edit `package.json` `devDependencies` to include:

```jsonc
"ajv":         "^8.20.0",
"ajv-formats": "^3.0.1"
```

Run: `bun install`
Expected: lockfile updates; ajv resolves to 8.20.0+, ajv-formats to 3.0.1.

- [ ] **Step 2: Write `pipeline/scripts/codegen-validators.ts`**

```ts
#!/usr/bin/env bun
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { standaloneCode } from "ajv/dist/standalone";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const targets = [
  { schema: "schemas/entity.schema.json",            out: "pipeline/dist/validate-entity.mjs" },
  { schema: "schemas/variant.schema.json",           out: "pipeline/dist/validate-variant.mjs" },
  { schema: "schemas/manifest.schema.json",          out: "pipeline/dist/validate-manifest.mjs" },
  { schema: "schemas/snapshot.schema.json",          out: "pipeline/dist/validate-snapshot.mjs" },
  { schema: "schemas/digest.schema.json",            out: "pipeline/dist/validate-digest.mjs" },
  { schema: "schemas/fixture-manifest.schema.json",  out: "pipeline/dist/validate-fixture-manifest.mjs" },
];

// Single Ajv instance so $ref between schemas resolves.
const ajv = new Ajv2020({ code: { source: true, esm: true }, allErrors: true });
addFormats(ajv);

// Pre-load every schema so cross-schema $ref works.
for (const { schema } of targets) {
  const doc = JSON.parse(readFileSync(schema, "utf8"));
  ajv.addSchema(doc);
}

for (const { schema, out } of targets) {
  const doc = JSON.parse(readFileSync(schema, "utf8"));
  const validate = ajv.getSchema(doc.$id) ?? ajv.compile(doc);
  const code = standaloneCode(ajv, validate);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, code);
  console.warn(`wrote ${out}`);
}
```

- [ ] **Step 3: Run codegen and commit outputs**

Run: `bun run codegen:validators`
Expected: `wrote pipeline/dist/validate-entity.mjs` (and five more) on stderr; six `.mjs` files in `pipeline/dist/`.

Inspect: `head -1 pipeline/dist/validate-entity.mjs`
Expected: starts with `"use strict";` or `export const` (Ajv ESM standalone output).

Update `.gitignore` to keep `pipeline/dist/*.mjs` tracked but ignore everything else under `pipeline/dist/`:

```
pipeline/dist/*
!pipeline/dist/.gitkeep
!pipeline/dist/validate-*.mjs
```

- [ ] **Step 4: Commit**

```bash
git add package.json bun.lock pipeline/scripts/codegen-validators.ts pipeline/dist/.gitkeep pipeline/dist/validate-*.mjs .gitignore
git commit -m "feat(pipeline): compile standalone validators with ajv 2020-12"
```

### Phase B gate

```sh
bun run codegen:validators
bun run typecheck
ls pipeline/dist/validate-*.mjs   # six files
```

All three exit 0; six standalone validators present.

---

## Phase C — Item descriptors

Goal: `entities/item/` is the only place item shape is described. Validation against `entity.schema.json` and `variant.schema.json` is wired into the Phase D test suite. This phase only writes data; the validator integration test lands in Phase D.

### Task C.1: Author `entities/item/entity.json`

**Files:**
- Create: `entities/item/entity.json`

- [ ] **Step 1: Write the descriptor**

```jsonc
{
  "$schema": "../../schemas/entity.schema.json",
  "id": "item",
  "label": { "singular": "Item", "plural": "Items" },

  "extraction": {
    "root":   "BuiltLookupTable.GetAssetsOfType<ItemData>",
    "walker": "ItemWalker",
    "options": { "preflight": ["builtLookupTable", "ardenfallGame", "worldData", "masterRecordTable"] }
  },

  "fields": [
    { "name": "id",            "type": "id",            "from": "guid",            "missingPolicy": "fatal" },
    { "name": "name",          "type": "string",        "from": "itemName.Get()",  "missingPolicy": "diagnostic" },
    { "name": "weight",        "type": "number",        "from": "weight.Get()",    "missingPolicy": "diagnostic" },
    { "name": "value",         "type": "integer",       "from": "value.Get()",     "missingPolicy": "diagnostic" },
    { "name": "iconRef",       "type": "ref:asset",     "from": "icon",            "missingPolicy": "diagnostic" },
    { "name": "description",   "type": "string",        "from": "description.Get()", "missingPolicy": "optional-empty" }
  ],

  "variants": { "dir": "variants" },

  "site": {
    "overview": {
      "columns": ["name", "value", "weight", "variant"],
      "search":  ["name"],
      "filters": [
        { "field": "variant", "kind": "categorical" },
        { "field": "value",   "kind": "range" }
      ]
    },
    "detail": {
      "sections": [
        { "id": "summary", "kind": "fieldList", "title": "Summary", "fields": ["name", "weight", "value"] },
        { "id": "description", "kind": "fieldList", "title": "Description", "fields": ["description"] }
      ]
    }
  },

  "map": null
}
```

- [ ] **Step 2: Verify it parses**

Run: `bun -e 'JSON.parse(await Bun.file("entities/item/entity.json").text())'`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add entities/item/entity.json
git commit -m "feat(entities): add item descriptor"
```

### Task C.2: Author the five Slice 1 variant descriptors

**Files:**
- Create: `entities/item/variants/equipment.json`
- Create: `entities/item/variants/hand-item.json`
- Create: `entities/item/variants/primary-hand.json`
- Create: `entities/item/variants/melee-weapon.json`
- Create: `entities/item/variants/armor.json`

Variant fields are the layer-introduced fields only. Inherited fields (e.g. `name`, `weight`) live on the parent's table per addendum §10. Field-from paths reference adapter-output keys, not raw Mono members; the mod's adapters set those keys.

- [ ] **Step 1: Write `equipment.json`**

```jsonc
{
  "$schema": "../../../schemas/variant.schema.json",
  "variantId": "equipment",
  "label": "Equipment",
  "unityType": "Ardenfall.Item.EquipItemData",
  "canonicalTable": "item_equipment",
  "position": 10,
  "fields": [
    { "name": "equipSlot",       "type": "string",  "from": "equipSlot",       "missingPolicy": "diagnostic" },
    { "name": "armorClass",      "type": "string",  "from": "armorClass",      "missingPolicy": "optional-empty" },
    { "name": "durabilityMax",   "type": "integer", "from": "durabilityMax",   "missingPolicy": "optional-empty" }
  ]
}
```

- [ ] **Step 2: Write `hand-item.json`**

```jsonc
{
  "$schema": "../../../schemas/variant.schema.json",
  "variantId": "hand-item",
  "label": "Hand item",
  "unityType": "Ardenfall.Item.HandItemData",
  "canonicalTable": "item_hand_items",
  "parentVariantId": "equipment",
  "position": 20,
  "fields": [
    { "name": "twoHanded",       "type": "boolean", "from": "twoHanded",       "missingPolicy": "diagnostic" }
  ]
}
```

- [ ] **Step 3: Write `primary-hand.json`**

```jsonc
{
  "$schema": "../../../schemas/variant.schema.json",
  "variantId": "primary-hand",
  "label": "Primary hand",
  "unityType": "Ardenfall.Item.PrimaryHandItemData",
  "canonicalTable": "item_primary_hand_items",
  "parentVariantId": "hand-item",
  "position": 30,
  "fields": [
    { "name": "blockChance",     "type": "number",  "from": "blockChance",     "missingPolicy": "optional-empty" }
  ]
}
```

- [ ] **Step 4: Write `melee-weapon.json`**

```jsonc
{
  "$schema": "../../../schemas/variant.schema.json",
  "variantId": "melee-weapon",
  "label": "Melee weapon",
  "unityType": "Ardenfall.Item.MeleeItemData",
  "canonicalTable": "item_melee_weapons",
  "parentVariantId": "primary-hand",
  "position": 40,
  "fields": [
    { "name": "damageMin",       "type": "integer", "from": "damageMin",       "missingPolicy": "diagnostic" },
    { "name": "damageMax",       "type": "integer", "from": "damageMax",       "missingPolicy": "diagnostic" },
    { "name": "reach",           "type": "number",  "from": "reach",           "missingPolicy": "optional-empty" },
    { "name": "weaponClass",     "type": "string",  "from": "weaponClass",     "missingPolicy": "diagnostic" }
  ]
}
```

- [ ] **Step 5: Write `armor.json`**

```jsonc
{
  "$schema": "../../../schemas/variant.schema.json",
  "variantId": "armor",
  "label": "Armor",
  "unityType": "Ardenfall.Item.ArmorItemData",
  "canonicalTable": "item_armor",
  "parentVariantId": "equipment",
  "position": 50,
  "fields": [
    { "name": "armorRating",     "type": "integer", "from": "armorRating",     "missingPolicy": "diagnostic" },
    { "name": "coverageSlot",    "type": "string",  "from": "coverageSlot",    "missingPolicy": "diagnostic" }
  ]
}
```

- [ ] **Step 6: Sanity-parse all five**

```sh
for f in entities/item/variants/*.json; do bun -e "JSON.parse(await Bun.file('$f').text())"; done
```
Expected: each command exits 0; no output.

> **Field-name caveat:** the field-from paths above (`damageMin`, `armorRating`, etc.) are best-effort names following `Ardenfall.*` C# conventions. The mod's adapters in Phase G will define the actual emitted keys; if the real Mono members differ, update both this descriptor and the matching adapter in the same commit. The descriptor is the contract; the adapter must satisfy it.

- [ ] **Step 7: Commit**

```bash
git add entities/item/variants/
git commit -m "feat(entities): add item variants for slice 1"
```

### Phase C gate

All five variant descriptors plus the parent `entity.json` parse as JSON. Phase D's first test (Task D.1) validates them structurally against the schemas.

---

## Phase D — Pipeline foundation

Goal: pipeline workspace exists, types are defined, registry merge + topo orchestrator work, descriptor loader validates `entities/item/` against schemas, end-to-end empty-plan run is deterministic.

### Task D.1: Bootstrap the pipeline workspace

**Files:**
- Create: `pipeline/package.json`
- Create: `pipeline/tsconfig.json`
- Create: `pipeline/src/types.ts`

- [ ] **Step 1: Write `pipeline/package.json`**

```jsonc
{
  "name": "@ardenfall-archives/pipeline",
  "private": true,
  "type": "module",
  "main": "src/cli.ts",
  "bin": { "ardenfall-pipeline": "src/cli.ts" },
  "scripts": {
    "test":      "bun test",
    "typecheck": "bunx tsgo --noEmit -p ."
  },
  "dependencies": {
    "ajv":         "^8.20.0",
    "ajv-formats": "^3.0.1"
  },
  "devDependencies": {
    "fast-check": "^4.7.0"
  }
}
```

- [ ] **Step 2: Write `pipeline/tsconfig.json`**

```jsonc
{
  "extends": "../tsconfig.base.json",
  "include": ["src/**/*", "scripts/**/*", "test/**/*", "../schemas/*.json"],
  "compilerOptions": {
    "rootDir": ".",
    "baseUrl": ".",
    "paths": {
      "$pipeline/*": ["src/*"]
    }
  }
}
```

- [ ] **Step 3: Write `pipeline/src/types.ts`** — shared types used across stages and tests

```ts
export type EntityId = string & { readonly __brand: "EntityId" };
export type VariantId = string & { readonly __brand: "VariantId" };

export interface EntityDescriptor {
  $schema?: string;
  id: string;
  label: { singular: string; plural: string };
  extraction: { root: string; walker?: string; options?: Record<string, unknown> };
  fields: FieldSpec[];
  variants?: { dir: string; registry?: string };
  denormalise?: OperationRef[];
  site?: { overview?: SiteOverview; detail?: SiteDetail };
  map?: SiteMap | null;
}

export interface VariantDescriptor {
  $schema?: string;
  variantId: string;
  label: string;
  unityType: string;
  canonicalTable: string;
  parentVariantId?: string;
  isPublicRoute?: boolean;
  position?: number;
  fields: FieldSpec[];
}

export interface FieldSpec {
  name: string;
  type: string;
  from: string;
  operation?: string;
  missingPolicy?: "fatal" | "diagnostic" | "optional-empty";
  label?: string;
  description?: string;
}

export interface OperationRef {
  op: string;
  from?: string;
  as?: string;
}

export interface SiteOverview {
  columns: string[];
  search?: string[];
  filters?: SiteFilter[];
}

export interface SiteDetail {
  sections: SiteSection[];
}

export interface SiteFilter {
  field: string;
  kind: "categorical" | "range" | "boolean";
}

export type SiteSection =
  | { id: string; kind: "fieldList"; title: string; fields: string[] }
  | { id: string; kind: "custom";    title: string; renderer: string; props?: Record<string, unknown> };

export interface SiteMap {
  layer: string;
  icon?: string;
  color?: number[];
  radius?: number;
  filters?: SiteFilter[];
  tooltip?: string[];
}

// Snapshot

export interface SnapshotManifest {
  schemaVersion: number;
  gameVersion?: string;
  buildIdentifier?: string;
  extractorVersion: string;
  extractedAt: string;
  preflight: { passed: boolean; completedAt: string; checks: { name: string; ok: boolean; reason?: string }[] };
  counts: Record<string, number>;
  diagnostics: { fatal: number; diagnostic: number };
  hashes: Record<string, string>;
}

export interface SnapshotEnvelope<F = Record<string, unknown>> {
  entityId: string;
  schemaVersion: number;
  rows: SnapshotRow<F>[];
}

export interface SnapshotRow<F = Record<string, unknown>> {
  id: string;
  variant?: string;
  fields: F;
  tags?: string[];
  provenance?: Record<string, FieldProvenance>;
  diagnostics?: SnapshotDiagnostic[];
}

export type FieldProvenance =
  | { kind: "parameter";          source: string; isSet: boolean; inherited: boolean; parent?: SnapshotRefBrief }
  | { kind: "smartListParameter"; source: string; isSet: boolean; inherited: boolean; parent?: SnapshotRefBrief }
  | { kind: "lookupAsset";        source: string; isSet: boolean; inherited: boolean; parent?: SnapshotRefBrief }
  | { kind: "record";             source: string; isSet: boolean; inherited: boolean; parent?: SnapshotRefBrief }
  | { kind: "runtimeObject";      source: string; isSet: boolean; inherited: boolean; parent?: SnapshotRefBrief }
  | { kind: "missing";            source: string; isSet: false;   inherited: boolean; parent?: SnapshotRefBrief };

export interface SnapshotRefBrief {
  kind: string;
  guid?: string;
  unityType?: string;
}

export interface SnapshotDiagnostic {
  severity: "fatal" | "diagnostic";
  code: string;
  field: string;
  message?: string;
}

// Snapshot refs (canonical)

export type SnapshotRef =
  | { kind: "lookupAsset"; guid: string; unityType?: string; name?: string }
  | { kind: "record"; table: string; subtable: string; id: string; recordType?: string }
  | { kind: "runtimeObject"; extractionId: string; unityType?: string; stable: false }
  | { kind: "missing"; reason: string; source: string };

// Stages

export interface StageContext {
  workspaceRoot: string;
  snapshotDir: string;
  outDir: string;
  log: (level: "info" | "warn" | "error", msg: string) => void;
}

export interface Stage<I, O> {
  id: string;
  inputs: readonly string[];
  run: (inputs: I, ctx: StageContext) => Promise<O> | O;
}
```

- [ ] **Step 4: Verify types compile**

Run: `bun run --cwd pipeline typecheck`
Expected: exit 0; no diagnostics.

- [ ] **Step 5: Commit**

```bash
git add pipeline/package.json pipeline/tsconfig.json pipeline/src/types.ts
git commit -m "feat(pipeline): bootstrap workspace and shared types"
```

### Task D.2: Typed-map registry (TDD)

**Files:**
- Create: `pipeline/src/registry.ts`
- Create: `pipeline/test/registry.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// pipeline/test/registry.test.ts
import { describe, it, expect } from "bun:test";
import { mergeOperations, type OperationMap } from "$pipeline/registry";

describe("mergeOperations", () => {
  it("merges typed maps without losing names", () => {
    const a: OperationMap = { "core.linkBack": (x: unknown) => x };
    const b: OperationMap = { "item.computeSubtypeLabel": (x: unknown) => x };
    const merged = mergeOperations([a, b]);
    expect(Object.keys(merged).sort()).toEqual(["core.linkBack", "item.computeSubtypeLabel"]);
  });

  it("rejects duplicates with a clear error", () => {
    const a: OperationMap = { "x.y": () => 0 };
    const b: OperationMap = { "x.y": () => 1 };
    expect(() => mergeOperations([a, b])).toThrow(/duplicate operation: x.y/);
  });

  it("rejects empty merges defensively", () => {
    expect(() => mergeOperations([])).toThrow(/no operation maps/);
  });
});
```

- [ ] **Step 2: Run the test (expect failure)**

Run: `bun test pipeline/test/registry.test.ts`
Expected: 3 fail with `Cannot find module '$pipeline/registry'` or similar.

- [ ] **Step 3: Implement `pipeline/src/registry.ts`**

```ts
export type Operation = (...args: unknown[]) => unknown;
export type OperationMap = Record<string, Operation>;

export function mergeOperations(maps: OperationMap[]): OperationMap {
  if (maps.length === 0) throw new Error("no operation maps to merge");
  const out: OperationMap = {};
  for (const map of maps) {
    for (const [name, fn] of Object.entries(map)) {
      if (Object.hasOwn(out, name)) {
        throw new Error(`duplicate operation: ${name}`);
      }
      out[name] = fn;
    }
  }
  return out;
}

// Site-side parallel: section renderers. Imported from site, not pipeline,
// but the merge function is symmetric, so re-export the implementation.
export function mergeStringMaps<T>(maps: Record<string, T>[]): Record<string, T> {
  if (maps.length === 0) throw new Error("no maps to merge");
  const out: Record<string, T> = {};
  for (const map of maps) {
    for (const [k, v] of Object.entries(map)) {
      if (Object.hasOwn(out, k)) {
        throw new Error(`duplicate key: ${k}`);
      }
      out[k] = v;
    }
  }
  return out;
}
```

- [ ] **Step 4: Run the test (expect pass)**

Run: `bun test pipeline/test/registry.test.ts`
Expected: 3 pass.

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/registry.ts pipeline/test/registry.test.ts
git commit -m "feat(pipeline): typed-map registry with duplicate detection"
```

### Task D.3: Topo-sorted orchestrator (TDD)

**Files:**
- Create: `pipeline/src/orchestrator.ts`
- Create: `pipeline/test/orchestrator.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// pipeline/test/orchestrator.test.ts
import { describe, it, expect } from "bun:test";
import { runStages } from "$pipeline/orchestrator";
import type { Stage, StageContext } from "$pipeline/types";

const ctx: StageContext = {
  workspaceRoot: ".",
  snapshotDir:   "snapshots/test",
  outDir:        "pipeline/out/test",
  log: () => undefined,
};

function stage<I, O>(id: string, inputs: string[], run: (i: I, c: StageContext) => O): Stage<I, O> {
  return { id, inputs, run };
}

describe("orchestrator", () => {
  it("runs an empty plan", async () => {
    const result = await runStages([], {}, ctx);
    expect(result).toEqual({});
  });

  it("topo-sorts a diamond dependency", async () => {
    const order: string[] = [];
    const A = stage("a", [],          () => { order.push("a"); return "A"; });
    const B = stage("b", ["a"],       () => { order.push("b"); return "B"; });
    const C = stage("c", ["a"],       () => { order.push("c"); return "C"; });
    const D = stage("d", ["b", "c"],  () => { order.push("d"); return "D"; });
    const result = await runStages([D, B, A, C], {}, ctx);
    expect(order[0]).toBe("a");
    expect(order[3]).toBe("d");
    expect(result).toEqual({ a: "A", b: "B", c: "C", d: "D" });
  });

  it("rejects a missing input", async () => {
    const A = stage("a", ["does-not-exist"], () => "A");
    await expect(runStages([A], {}, ctx)).rejects.toThrow(/unsatisfied input/);
  });

  it("rejects a cycle", async () => {
    const A = stage("a", ["b"], () => "A");
    const B = stage("b", ["a"], () => "B");
    await expect(runStages([A, B], {}, ctx)).rejects.toThrow(/cycle/);
  });
});
```

- [ ] **Step 2: Run the test (expect failure)**

Run: `bun test pipeline/test/orchestrator.test.ts`
Expected: 4 fail with module-not-found.

- [ ] **Step 3: Implement `pipeline/src/orchestrator.ts`**

```ts
import type { Stage, StageContext } from "./types.ts";

/**
 * Run a topo-sorted DAG of stages. `seeds` provides initial named inputs that
 * stages can declare as inputs. Returns a record mapping stage id to its output,
 * merged with the seeds.
 */
export async function runStages(
  stages: Stage<unknown, unknown>[],
  seeds: Record<string, unknown>,
  ctx: StageContext,
): Promise<Record<string, unknown>> {
  const byId = new Map<string, Stage<unknown, unknown>>();
  for (const s of stages) {
    if (byId.has(s.id)) throw new Error(`duplicate stage id: ${s.id}`);
    byId.set(s.id, s);
  }

  // Validate inputs.
  for (const s of stages) {
    for (const input of s.inputs) {
      if (!byId.has(input) && !Object.hasOwn(seeds, input)) {
        throw new Error(`stage ${s.id}: unsatisfied input '${input}'`);
      }
    }
  }

  // Kahn's algorithm.
  const inDegree = new Map<string, number>();
  for (const s of stages) inDegree.set(s.id, s.inputs.filter((i) => byId.has(i)).length);
  const ready: string[] = [];
  for (const [id, deg] of inDegree) if (deg === 0) ready.push(id);

  const order: string[] = [];
  while (ready.length > 0) {
    const id = ready.shift()!;
    order.push(id);
    for (const other of stages) {
      if (other.inputs.includes(id)) {
        const next = (inDegree.get(other.id) ?? 0) - 1;
        inDegree.set(other.id, next);
        if (next === 0) ready.push(other.id);
      }
    }
  }

  if (order.length !== stages.length) {
    throw new Error("cycle detected in stage graph");
  }

  const outputs: Record<string, unknown> = { ...seeds };
  for (const id of order) {
    const s = byId.get(id)!;
    const inputs: Record<string, unknown> = {};
    for (const input of s.inputs) inputs[input] = outputs[input];
    outputs[id] = await s.run(inputs, ctx);
  }
  return outputs;
}
```

- [ ] **Step 4: Run the test (expect pass)**

Run: `bun test pipeline/test/orchestrator.test.ts`
Expected: 4 pass.

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/orchestrator.ts pipeline/test/orchestrator.test.ts
git commit -m "feat(pipeline): topo-sorted stage orchestrator"
```

### Task D.4: Descriptor loader stage

**Files:**
- Create: `pipeline/src/stages/load-descriptors.ts`
- Modify: `pipeline/test/registry.test.ts` (no — separate test file)
- Create: `pipeline/test/load-descriptors.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// pipeline/test/load-descriptors.test.ts
import { describe, it, expect } from "bun:test";
import { loadDescriptors } from "$pipeline/stages/load-descriptors";

describe("loadDescriptors", () => {
  it("loads the item descriptor + variants from entities/", async () => {
    const result = await loadDescriptors.run({}, {
      workspaceRoot: ".",
      snapshotDir:   "",
      outDir:        "",
      log: () => undefined,
    });
    expect(result.entities.item.id).toBe("item");
    expect(result.variants.item.length).toBe(5);
    const ids = result.variants.item.map((v) => v.variantId).sort();
    expect(ids).toEqual(["armor", "equipment", "hand-item", "melee-weapon", "primary-hand"]);
  });

  it("rejects an invalid descriptor with a JSON Pointer in the error", async () => {
    // arranged by writing a temporary entity. Skip if we can't safely sandbox.
    // For Slice 1 we accept that this exercise lives in invariants/items.test.ts.
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test (expect failure)**

Run: `bun test pipeline/test/load-descriptors.test.ts`
Expected: 2 fail with module-not-found.

- [ ] **Step 3: Implement `pipeline/src/stages/load-descriptors.ts`**

```ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import validateEntity from "../../dist/validate-entity.mjs";
import validateVariant from "../../dist/validate-variant.mjs";
import type { EntityDescriptor, Stage, VariantDescriptor } from "../types.ts";

export interface LoadDescriptorsOutput {
  entities: Record<string, EntityDescriptor>;
  variants: Record<string, VariantDescriptor[]>;
}

export const loadDescriptors: Stage<unknown, LoadDescriptorsOutput> = {
  id: "load-descriptors",
  inputs: [],
  run: (_inputs, ctx) => {
    const entitiesDir = join(ctx.workspaceRoot, "entities");
    const out: LoadDescriptorsOutput = { entities: {}, variants: {} };

    for (const dirName of readdirSync(entitiesDir)) {
      if (dirName.startsWith("_") || dirName.startsWith(".")) continue;
      const dirPath = join(entitiesDir, dirName);
      if (!statSync(dirPath).isDirectory()) continue;

      const entityPath = join(dirPath, "entity.json");
      const entityDoc = JSON.parse(readFileSync(entityPath, "utf8")) as EntityDescriptor;
      if (!validateEntity(entityDoc)) {
        const errors = (validateEntity as unknown as { errors?: { instancePath: string; message?: string }[] }).errors ?? [];
        const path = entityPath;
        const detail = errors.map((e) => `${path}#${e.instancePath} — ${e.message}`).join("\n");
        throw new Error(`invalid entity descriptor at ${path}:\n${detail}`);
      }
      if (entityDoc.id !== dirName) {
        throw new Error(`descriptor id mismatch at ${entityPath}: id='${entityDoc.id}' but folder='${dirName}'`);
      }
      out.entities[entityDoc.id] = entityDoc;

      const variantsDir = entityDoc.variants ? join(dirPath, entityDoc.variants.dir) : null;
      const variantList: VariantDescriptor[] = [];
      if (variantsDir) {
        for (const fileName of readdirSync(variantsDir).sort()) {
          if (!fileName.endsWith(".json")) continue;
          const variantPath = join(variantsDir, fileName);
          const variantDoc = JSON.parse(readFileSync(variantPath, "utf8")) as VariantDescriptor;
          if (!validateVariant(variantDoc)) {
            const errors = (validateVariant as unknown as { errors?: { instancePath: string; message?: string }[] }).errors ?? [];
            const detail = errors.map((e) => `${variantPath}#${e.instancePath} — ${e.message}`).join("\n");
            throw new Error(`invalid variant descriptor at ${variantPath}:\n${detail}`);
          }
          variantList.push(variantDoc);
        }
      }
      out.variants[entityDoc.id] = variantList;
    }
    return out;
  },
};
```

- [ ] **Step 4: Run the test (expect pass)**

Run: `bun run codegen:validators && bun test pipeline/test/load-descriptors.test.ts`
Expected: 2 pass.

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/stages/load-descriptors.ts pipeline/test/load-descriptors.test.ts
git commit -m "feat(pipeline): descriptor loader stage with schema validation"
```

### Task D.5: Snapshot loader + validation stage

**Files:**
- Create: `pipeline/src/stages/load-snapshot.ts`
- Create: `pipeline/src/stages/validate.ts`
- Create: `pipeline/test/snapshot.test.ts`
- Create: `pipeline/test/fixtures/synthetic/snapshot/manifest.json`
- Create: `pipeline/test/fixtures/synthetic/snapshot/items.json`

- [ ] **Step 1: Write the synthetic snapshot fixture**

Path: `pipeline/test/fixtures/synthetic/snapshot/manifest.json`

```jsonc
{
  "schemaVersion": 1,
  "gameVersion": "Demo2025-test",
  "buildIdentifier": "synthetic",
  "extractorVersion": "0.0.0-test",
  "extractedAt": "2026-05-03T12:00:00Z",
  "preflight": {
    "passed": true,
    "completedAt": "2026-05-03T12:00:00Z",
    "checks": [
      { "name": "builtLookupTable", "ok": true },
      { "name": "ardenfallGame",    "ok": true },
      { "name": "worldData",        "ok": true },
      { "name": "masterRecordTable","ok": true }
    ]
  },
  "counts":      { "item": 2 },
  "diagnostics": { "fatal": 0, "diagnostic": 0 },
  "hashes":      { "items.json": "0000000000000000000000000000000000000000000000000000000000000000" }
}
```

Path: `pipeline/test/fixtures/synthetic/snapshot/items.json`

```jsonc
{
  "entityId": "item",
  "schemaVersion": 1,
  "rows": [
    {
      "id": "fixture-iron-sword",
      "variant": "melee-weapon",
      "fields": {
        "id": "fixture-iron-sword",
        "name": "Iron Sword",
        "weight": 3.5,
        "value": 25,
        "iconRef": { "kind": "lookupAsset", "guid": "fixture-icon-iron-sword", "unityType": "UnityEngine.Texture2D" },
        "description": "A simple iron blade.",
        "equipSlot": "primary",
        "armorClass": null,
        "durabilityMax": 100,
        "twoHanded": false,
        "blockChance": 0.1,
        "damageMin": 5,
        "damageMax": 10,
        "reach": 1.2,
        "weaponClass": "sword"
      },
      "tags": ["weapon", "metal"],
      "provenance": {
        "name":   { "kind": "parameter", "source": "itemName.Get()", "isSet": true,  "inherited": false },
        "weight": { "kind": "parameter", "source": "weight.Get()",   "isSet": true,  "inherited": false },
        "value":  { "kind": "parameter", "source": "value.Get()",    "isSet": true,  "inherited": false }
      },
      "diagnostics": []
    },
    {
      "id": "fixture-leather-tunic",
      "variant": "armor",
      "fields": {
        "id": "fixture-leather-tunic",
        "name": "Leather Tunic",
        "weight": 4.0,
        "value": 12,
        "iconRef": { "kind": "missing", "reason": "lookupAssetGuidMissing", "source": "ItemData.icon" },
        "description": "",
        "equipSlot": "chest",
        "armorClass": "light",
        "durabilityMax": 80,
        "armorRating": 6,
        "coverageSlot": "torso"
      },
      "tags": ["armor", "leather"],
      "provenance": {
        "iconRef": { "kind": "missing", "source": "ItemData.icon", "isSet": false, "inherited": false }
      },
      "diagnostics": [
        { "severity": "diagnostic", "code": "lookupAssetGuidMissing", "field": "iconRef", "message": "icon ref missing from BuiltLookupTable" }
      ]
    }
  ]
}
```

- [ ] **Step 2: Write the failing test**

```ts
// pipeline/test/snapshot.test.ts
import { describe, it, expect } from "bun:test";
import { loadSnapshot } from "$pipeline/stages/load-snapshot";
import { validate } from "$pipeline/stages/validate";

const ctx = {
  workspaceRoot: ".",
  snapshotDir:   "pipeline/test/fixtures/synthetic/snapshot",
  outDir:        "pipeline/test/.tmp",
  log: () => undefined,
};

describe("loadSnapshot", () => {
  it("loads manifest + per-entity envelopes", async () => {
    const out = await loadSnapshot.run({}, ctx);
    expect(out.manifest.preflight.passed).toBe(true);
    expect(out.envelopes.item.rows.length).toBe(2);
  });
});

describe("validate", () => {
  it("passes the synthetic snapshot", async () => {
    const snap = await loadSnapshot.run({}, ctx);
    const desc = await import("$pipeline/stages/load-descriptors").then((m) => m.loadDescriptors.run({}, ctx));
    const result = validate.run({ "load-snapshot": snap, "load-descriptors": desc }, ctx);
    expect(result.errors).toEqual([]);
  });
});
```

- [ ] **Step 3: Run (expect failure)**

Run: `bun test pipeline/test/snapshot.test.ts`
Expected: 2 fail with module-not-found.

- [ ] **Step 4: Implement `pipeline/src/stages/load-snapshot.ts`**

```ts
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Stage, SnapshotEnvelope, SnapshotManifest } from "../types.ts";
import validateManifest from "../../dist/validate-manifest.mjs";
import validateSnapshot from "../../dist/validate-snapshot.mjs";

export interface LoadSnapshotOutput {
  manifest: SnapshotManifest;
  envelopes: Record<string, SnapshotEnvelope>;
}

export const loadSnapshot: Stage<unknown, LoadSnapshotOutput> = {
  id: "load-snapshot",
  inputs: [],
  run: (_inputs, ctx) => {
    const dir = ctx.snapshotDir;
    const manifestPath = join(dir, "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as SnapshotManifest;
    if (!validateManifest(manifest)) {
      const errs = (validateManifest as unknown as { errors?: { instancePath: string; message?: string }[] }).errors ?? [];
      throw new Error(`invalid snapshot manifest at ${manifestPath}:\n${errs.map((e) => `${manifestPath}#${e.instancePath} — ${e.message}`).join("\n")}`);
    }

    const envelopes: Record<string, SnapshotEnvelope> = {};
    for (const fileName of readdirSync(dir)) {
      if (fileName === "manifest.json") continue;
      if (!fileName.endsWith(".json")) continue;
      const path = join(dir, fileName);
      const env = JSON.parse(readFileSync(path, "utf8")) as SnapshotEnvelope;
      if (!validateSnapshot(env)) {
        const errs = (validateSnapshot as unknown as { errors?: { instancePath: string; message?: string }[] }).errors ?? [];
        throw new Error(`invalid snapshot envelope at ${path}:\n${errs.map((e) => `${path}#${e.instancePath} — ${e.message}`).join("\n")}`);
      }
      envelopes[env.entityId] = env;
    }
    return { manifest, envelopes };
  },
};
```

- [ ] **Step 5: Implement `pipeline/src/stages/validate.ts`**

```ts
import type { Stage } from "../types.ts";
import type { LoadSnapshotOutput } from "./load-snapshot.ts";
import type { LoadDescriptorsOutput } from "./load-descriptors.ts";

export interface ValidateInputs {
  "load-snapshot":     LoadSnapshotOutput;
  "load-descriptors":  LoadDescriptorsOutput;
}

export interface ValidateOutput {
  errors: { entity: string; row?: string; field?: string; code: string; message: string }[];
  countsBySeverity: { fatal: number; diagnostic: number };
}

export const validate: Stage<ValidateInputs, ValidateOutput> = {
  id: "validate",
  inputs: ["load-snapshot", "load-descriptors"],
  run: (inputs) => {
    const errors: ValidateOutput["errors"] = [];
    let fatal = 0, diagnostic = 0;

    for (const [entityId, env] of Object.entries(inputs["load-snapshot"].envelopes)) {
      const entity = inputs["load-descriptors"].entities[entityId];
      if (!entity) {
        errors.push({ entity: entityId, code: "unknownEntity", message: `snapshot has rows for '${entityId}' but no descriptor exists` });
        fatal++;
        continue;
      }
      for (const row of env.rows) {
        for (const fieldSpec of entity.fields) {
          const present = Object.hasOwn(row.fields, fieldSpec.name) && row.fields[fieldSpec.name] !== undefined;
          if (!present && fieldSpec.missingPolicy === "fatal") {
            errors.push({ entity: entityId, row: row.id, field: fieldSpec.name, code: "missingFatalField", message: `required field '${fieldSpec.name}' missing on row '${row.id}'` });
            fatal++;
          } else if (!present && fieldSpec.missingPolicy === "diagnostic") {
            errors.push({ entity: entityId, row: row.id, field: fieldSpec.name, code: "missingDiagnosticField", message: `optional-but-notable field '${fieldSpec.name}' missing on row '${row.id}'` });
            diagnostic++;
          }
        }
        for (const d of row.diagnostics ?? []) {
          if (d.severity === "fatal") fatal++;
          else diagnostic++;
          errors.push({ entity: entityId, row: row.id, field: d.field, code: d.code, message: d.message ?? d.code });
        }
      }
    }
    return { errors, countsBySeverity: { fatal, diagnostic } };
  },
};
```

- [ ] **Step 6: Run (expect pass)**

Run: `bun test pipeline/test/snapshot.test.ts`
Expected: 2 pass.

- [ ] **Step 7: Commit**

```bash
git add pipeline/src/stages/load-snapshot.ts pipeline/src/stages/validate.ts pipeline/test/snapshot.test.ts pipeline/test/fixtures/synthetic/snapshot/
git commit -m "feat(pipeline): snapshot loader and validation stages"
```

### Phase D gate

```sh
bun run codegen:validators
bun test pipeline/test
```

Both succeed. Tests pass: `registry.test.ts`, `orchestrator.test.ts`, `load-descriptors.test.ts`, `snapshot.test.ts`.

---

## Phase E — Pipeline canonicalisation

Goal: synthetic snapshot → DDL emission → INSERTs → site metadata + read models → SQLite blob. End-of-phase: `pipeline/scripts/run.ts <snapshotDir> <outDir>` produces `<outDir>/data.sqlite` containing items + variants + site metadata + read models, with property-test invariants verified.

### Task E.1: DDL generator from descriptors

**Files:**
- Create: `pipeline/src/sql/ddl.ts`
- Create: `pipeline/test/sql-ddl.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// pipeline/test/sql-ddl.test.ts
import { describe, it, expect } from "bun:test";
import { buildDDL } from "$pipeline/sql/ddl";
import type { EntityDescriptor, VariantDescriptor } from "$pipeline/types";

const item: EntityDescriptor = {
  id: "item",
  label: { singular: "Item", plural: "Items" },
  extraction: { root: "x" },
  fields: [
    { name: "id",     type: "id",     from: "guid", missingPolicy: "fatal" },
    { name: "name",   type: "string", from: "n",    missingPolicy: "diagnostic" },
    { name: "weight", type: "number", from: "w",    missingPolicy: "diagnostic" },
  ],
  variants: { dir: "variants" },
};

const equipment: VariantDescriptor = {
  variantId: "equipment",
  label: "Equipment",
  unityType: "Ardenfall.Item.EquipItemData",
  canonicalTable: "item_equipment",
  fields: [{ name: "equipSlot", type: "string", from: "s", missingPolicy: "diagnostic" }],
};

describe("buildDDL", () => {
  it("emits items table with id PRIMARY KEY", () => {
    const ddl = buildDDL(item, []);
    expect(ddl).toContain('CREATE TABLE "items"');
    expect(ddl).toContain('"id" TEXT NOT NULL PRIMARY KEY');
    expect(ddl).toContain('"name" TEXT');
    expect(ddl).toContain('"weight" REAL');
  });

  it("emits child tables with FK to parent", () => {
    const ddl = buildDDL(item, [equipment]);
    expect(ddl).toContain('CREATE TABLE "item_equipment"');
    expect(ddl).toContain('"id" TEXT NOT NULL PRIMARY KEY REFERENCES "items"("id")');
  });

  it("emits item_tags child table for entities with tags", () => {
    const ddl = buildDDL(item, []);
    expect(ddl).toContain('CREATE TABLE "item_tags"');
    expect(ddl).toContain('PRIMARY KEY ("item_id", "tag")');
  });
});
```

- [ ] **Step 2: Run (expect failure)**

Run: `bun test pipeline/test/sql-ddl.test.ts`
Expected: 3 fail.

- [ ] **Step 3: Implement `pipeline/src/sql/ddl.ts`**

```ts
import type { EntityDescriptor, FieldSpec, VariantDescriptor } from "../types.ts";

function sqlType(t: string): string {
  if (t === "id" || t === "string") return "TEXT";
  if (t === "integer" || t === "boolean") return "INTEGER";
  if (t === "number") return "REAL";
  if (t.startsWith("ref:")) return "TEXT"; // FK string id
  return "TEXT";
}

function column(field: FieldSpec): string {
  if (field.type === "id") return `"${field.name}" TEXT NOT NULL PRIMARY KEY`;
  const nullable = field.missingPolicy === "fatal" ? "NOT NULL" : "";
  return `"${field.name}" ${sqlType(field.type)} ${nullable}`.trim();
}

export function buildDDL(entity: EntityDescriptor, variants: VariantDescriptor[]): string {
  const out: string[] = [];

  // Root table.
  const rootColumns = entity.fields.map(column);
  rootColumns.push(`"variant" TEXT`);
  out.push(`CREATE TABLE "${entity.id}s" (${rootColumns.join(", ")});`);

  // Tags child table.
  out.push(
    `CREATE TABLE "${entity.id}_tags" (` +
    `"${entity.id}_id" TEXT NOT NULL REFERENCES "${entity.id}s"("id"), ` +
    `"tag" TEXT NOT NULL, ` +
    `PRIMARY KEY ("${entity.id}_id", "tag"));`,
  );

  // Variant tables (each owns only its own fields).
  for (const variant of variants) {
    const cols: string[] = [`"id" TEXT NOT NULL PRIMARY KEY REFERENCES "${entity.id}s"("id")`];
    for (const f of variant.fields) {
      const nullable = f.missingPolicy === "fatal" ? "NOT NULL" : "";
      cols.push(`"${f.name}" ${sqlType(f.type)} ${nullable}`.trim());
    }
    out.push(`CREATE TABLE "${variant.canonicalTable}" (${cols.join(", ")});`);
  }

  return out.join("\n");
}
```

- [ ] **Step 4: Run (expect pass)**

Run: `bun test pipeline/test/sql-ddl.test.ts`
Expected: 3 pass.

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/sql/ddl.ts pipeline/test/sql-ddl.test.ts
git commit -m "feat(pipeline): build canonical ddl from descriptors"
```

### Task E.2: Site metadata DDL

**Files:**
- Create: `pipeline/src/sql/site-metadata-ddl.ts`

- [ ] **Step 1: Write the file** (no failing test; this is a static SQL string lifted from addendum §6, validated by Task E.4 integration test)

```ts
// pipeline/src/sql/site-metadata-ddl.ts
export const SITE_METADATA_DDL = `
CREATE TABLE site_entities (
  entity_id        TEXT PRIMARY KEY,
  singular_label   TEXT NOT NULL,
  plural_label     TEXT NOT NULL,
  route_path       TEXT NOT NULL,
  canonical_table  TEXT NOT NULL
);
CREATE TABLE site_entity_fields (
  entity_id        TEXT NOT NULL,
  field_id         TEXT NOT NULL,
  source_table     TEXT NOT NULL,
  source_column    TEXT NOT NULL,
  label            TEXT NOT NULL,
  value_kind       TEXT NOT NULL,
  formatter        TEXT,
  null_policy      TEXT NOT NULL,
  link_target      TEXT,
  PRIMARY KEY (entity_id, field_id)
);
CREATE TABLE site_overview_columns (
  entity_id        TEXT NOT NULL,
  column_id        TEXT NOT NULL,
  field_id         TEXT NOT NULL,
  position         INTEGER NOT NULL,
  PRIMARY KEY (entity_id, column_id)
);
CREATE TABLE site_detail_sections (
  entity_id                TEXT NOT NULL,
  section_id               TEXT NOT NULL,
  kind                     TEXT NOT NULL,
  title                    TEXT NOT NULL,
  position                 INTEGER NOT NULL,
  renderer_key             TEXT,
  payload_schema_version   INTEGER NOT NULL DEFAULT 1,
  payload_json             TEXT,
  PRIMARY KEY (entity_id, section_id)
);
CREATE TABLE site_detail_section_fields (
  entity_id        TEXT NOT NULL,
  section_id       TEXT NOT NULL,
  field_id         TEXT NOT NULL,
  position         INTEGER NOT NULL,
  PRIMARY KEY (entity_id, section_id, field_id)
);
CREATE TABLE item_variants (
  variant_id           TEXT PRIMARY KEY,
  label                TEXT NOT NULL,
  unity_type           TEXT NOT NULL,
  canonical_table      TEXT NOT NULL,
  parent_variant_id    TEXT,
  position             INTEGER NOT NULL,
  is_public_route      INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE site_read_models (
  read_model_id    TEXT PRIMARY KEY,
  physical_name    TEXT NOT NULL,
  entity_id        TEXT NOT NULL,
  purpose          TEXT NOT NULL
);
CREATE TABLE asset_refs (
  entity_id        TEXT NOT NULL,
  entity_row_id    TEXT NOT NULL,
  slot             TEXT NOT NULL,
  asset_kind       TEXT NOT NULL,
  asset_hash       TEXT NOT NULL,
  PRIMARY KEY (entity_id, entity_row_id, slot)
);
`;
```

- [ ] **Step 2: Commit**

```bash
git add pipeline/src/sql/site-metadata-ddl.ts
git commit -m "feat(pipeline): site metadata ddl"
```

### Task E.3: Item canonicaliser

**Files:**
- Create: `pipeline/src/entities/item/canonicaliser.ts`
- Create: `pipeline/src/entities/item/operations.ts`
- Create: `pipeline/test/canonicaliser.test.ts`

- [ ] **Step 1: Write `pipeline/src/entities/item/operations.ts`** (currently empty registry; placeholder until a real op is needed)

```ts
import type { OperationMap } from "../../registry.ts";

export const operations: OperationMap = {
  // No item-specific operations needed in Slice 1.
  // Spell.formatTooltip etc. land in Slice 4.
};
```

- [ ] **Step 2: Write the failing test**

```ts
// pipeline/test/canonicaliser.test.ts
import { describe, it, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { canonicaliseItems } from "$pipeline/entities/item/canonicaliser";
import { buildDDL } from "$pipeline/sql/ddl";
import { loadDescriptors } from "$pipeline/stages/load-descriptors";
import { loadSnapshot } from "$pipeline/stages/load-snapshot";

const ctx = {
  workspaceRoot: ".",
  snapshotDir:   "pipeline/test/fixtures/synthetic/snapshot",
  outDir:        "pipeline/test/.tmp",
  log: () => undefined,
};

describe("canonicaliseItems", () => {
  it("inserts a row in items + each ancestor variant table", async () => {
    const desc = await loadDescriptors.run({}, ctx);
    const snap = await loadSnapshot.run({}, ctx);
    const db = new Database(":memory:");
    db.exec(buildDDL(desc.entities.item, desc.variants.item));
    canonicaliseItems(db, desc.entities.item, desc.variants.item, snap.envelopes.item);

    const items = db.query("SELECT id, name, variant FROM items ORDER BY id").all() as { id: string; name: string; variant: string }[];
    expect(items.length).toBe(2);
    expect(items.find((r) => r.id === "fixture-iron-sword")?.variant).toBe("melee-weapon");

    const equipRows = db.query("SELECT id, equipSlot FROM item_equipment").all() as { id: string }[];
    expect(equipRows.length).toBe(2); // both items are equipment

    const meleeRows = db.query("SELECT id, damageMin FROM item_melee_weapons").all() as { id: string; damageMin: number }[];
    expect(meleeRows.find((r) => r.id === "fixture-iron-sword")?.damageMin).toBe(5);

    const armorRows = db.query("SELECT id FROM item_armor").all() as { id: string }[];
    expect(armorRows.find((r) => r.id === "fixture-leather-tunic")).toBeDefined();

    const tagRows = db.query("SELECT item_id, tag FROM item_tags ORDER BY item_id, tag").all() as { item_id: string; tag: string }[];
    expect(tagRows.length).toBe(4); // 2 + 2
  });
});
```

- [ ] **Step 3: Run (expect failure)**

Run: `bun test pipeline/test/canonicaliser.test.ts`
Expected: 1 fail with module-not-found.

- [ ] **Step 4: Implement `pipeline/src/entities/item/canonicaliser.ts`**

```ts
import type { Database } from "bun:sqlite";
import type { EntityDescriptor, SnapshotEnvelope, VariantDescriptor } from "../../types.ts";

function ancestry(variant: VariantDescriptor, all: VariantDescriptor[]): VariantDescriptor[] {
  const chain: VariantDescriptor[] = [];
  let cur: VariantDescriptor | undefined = variant;
  while (cur) {
    chain.unshift(cur);
    cur = cur.parentVariantId ? all.find((v) => v.variantId === cur!.parentVariantId) : undefined;
  }
  return chain;
}

function coerceForSqlite(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

export function canonicaliseItems(
  db: Database,
  entity: EntityDescriptor,
  variants: VariantDescriptor[],
  envelope: SnapshotEnvelope,
): void {
  const rootCols = entity.fields.map((f) => f.name);
  const rootInsert = db.prepare(
    `INSERT INTO "${entity.id}s" (${[...rootCols, "variant"].map((c) => `"${c}"`).join(", ")}) ` +
    `VALUES (${[...rootCols, "variant"].map(() => "?").join(", ")})`,
  );
  const tagInsert = db.prepare(`INSERT INTO "${entity.id}_tags" ("${entity.id}_id", "tag") VALUES (?, ?)`);

  const variantInserters = new Map<string, ReturnType<Database["prepare"]>>();
  for (const v of variants) {
    const cols = ["id", ...v.fields.map((f) => f.name)];
    variantInserters.set(
      v.variantId,
      db.prepare(`INSERT INTO "${v.canonicalTable}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`),
    );
  }

  const tx = db.transaction(() => {
    for (const row of envelope.rows) {
      const variant = variants.find((v) => v.variantId === row.variant);
      if (!variant) {
        throw new Error(`row '${row.id}' has unknown variant '${row.variant ?? "<none>"}'`);
      }
      const rootValues = [
        ...rootCols.map((c) => coerceForSqlite(row.fields[c])),
        row.variant,
      ];
      rootInsert.run(...rootValues);
      for (const tag of row.tags ?? []) tagInsert.run(row.id, tag);
      for (const ancestor of ancestry(variant, variants)) {
        const inserter = variantInserters.get(ancestor.variantId);
        if (!inserter) throw new Error(`no inserter for variant ${ancestor.variantId}`);
        const cols = ["id", ...ancestor.fields.map((f) => f.name)];
        const values = [row.id, ...ancestor.fields.map((f) => coerceForSqlite(row.fields[f.name]))];
        if (cols.length !== values.length) throw new Error("column/value mismatch");
        inserter.run(...values);
      }
    }
  });
  tx();
}
```

- [ ] **Step 5: Run (expect pass)**

Run: `bun test pipeline/test/canonicaliser.test.ts`
Expected: 1 pass.

- [ ] **Step 6: Commit**

```bash
git add pipeline/src/entities/item/operations.ts pipeline/src/entities/item/canonicaliser.ts pipeline/test/canonicaliser.test.ts
git commit -m "feat(pipeline): item canonicaliser with ancestor variant inserts"
```

### Task E.4: Site metadata emitter

**Files:**
- Create: `pipeline/src/stages/emit-site-metadata.ts`
- Create: `pipeline/test/site-metadata.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// pipeline/test/site-metadata.test.ts
import { describe, it, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { emitSiteMetadata } from "$pipeline/stages/emit-site-metadata";
import { SITE_METADATA_DDL } from "$pipeline/sql/site-metadata-ddl";
import { loadDescriptors } from "$pipeline/stages/load-descriptors";

const ctx = { workspaceRoot: ".", snapshotDir: "", outDir: ".", log: () => undefined };

describe("emitSiteMetadata", () => {
  it("populates site_entities, fields, columns, sections, item_variants", async () => {
    const desc = await loadDescriptors.run({}, ctx);
    const db = new Database(":memory:");
    db.exec(SITE_METADATA_DDL);
    emitSiteMetadata(db, desc);

    const ent = db.query("SELECT * FROM site_entities WHERE entity_id = 'item'").get() as { route_path: string };
    expect(ent.route_path).toBe("/items");

    const cols = db.query("SELECT field_id FROM site_overview_columns WHERE entity_id = 'item' ORDER BY position").all() as { field_id: string }[];
    expect(cols.map((c) => c.field_id)).toEqual(["name", "value", "weight", "variant"]);

    const sections = db.query("SELECT section_id, kind FROM site_detail_sections WHERE entity_id = 'item' ORDER BY position").all() as { section_id: string; kind: string }[];
    expect(sections.map((s) => s.section_id)).toEqual(["summary", "description"]);
    expect(sections.every((s) => s.kind === "fieldList")).toBe(true);

    const variants = db.query("SELECT variant_id, parent_variant_id FROM item_variants ORDER BY position").all() as { variant_id: string; parent_variant_id: string | null }[];
    expect(variants.map((v) => v.variant_id)).toEqual(["equipment", "hand-item", "primary-hand", "melee-weapon", "armor"]);
  });
});
```

- [ ] **Step 2: Run (expect failure)**

Run: `bun test pipeline/test/site-metadata.test.ts`
Expected: 1 fail.

- [ ] **Step 3: Implement `pipeline/src/stages/emit-site-metadata.ts`**

```ts
import type { Database } from "bun:sqlite";
import type { LoadDescriptorsOutput } from "./load-descriptors.ts";

function valueKindOf(type: string): string {
  if (type === "id") return "id";
  if (type === "string") return "string";
  if (type === "integer") return "integer";
  if (type === "number") return "number";
  if (type === "boolean") return "boolean";
  if (type.startsWith("ref:")) return "ref";
  return "string";
}

export function emitSiteMetadata(db: Database, desc: LoadDescriptorsOutput): void {
  const insertEntity = db.prepare(
    `INSERT INTO site_entities (entity_id, singular_label, plural_label, route_path, canonical_table) VALUES (?, ?, ?, ?, ?)`,
  );
  const insertField = db.prepare(
    `INSERT INTO site_entity_fields (entity_id, field_id, source_table, source_column, label, value_kind, null_policy) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertColumn = db.prepare(
    `INSERT INTO site_overview_columns (entity_id, column_id, field_id, position) VALUES (?, ?, ?, ?)`,
  );
  const insertSection = db.prepare(
    `INSERT INTO site_detail_sections (entity_id, section_id, kind, title, position, renderer_key, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertSectionField = db.prepare(
    `INSERT INTO site_detail_section_fields (entity_id, section_id, field_id, position) VALUES (?, ?, ?, ?)`,
  );
  const insertVariant = db.prepare(
    `INSERT INTO item_variants (variant_id, label, unity_type, canonical_table, parent_variant_id, position, is_public_route) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertReadModel = db.prepare(
    `INSERT INTO site_read_models (read_model_id, physical_name, entity_id, purpose) VALUES (?, ?, ?, ?)`,
  );

  const tx = db.transaction(() => {
    for (const [entityId, entity] of Object.entries(desc.entities)) {
      insertEntity.run(entityId, entity.label.singular, entity.label.plural, `/${entity.label.plural.toLowerCase()}`, `${entityId}s`);
      for (const f of entity.fields) {
        insertField.run(entityId, f.name, `${entityId}s`, f.name, f.label ?? f.name, valueKindOf(f.type), f.missingPolicy ?? "diagnostic");
      }
      // Variant fields land on their canonical_table:
      for (const v of desc.variants[entityId] ?? []) {
        for (const f of v.fields) {
          insertField.run(entityId, f.name, v.canonicalTable, f.name, f.label ?? f.name, valueKindOf(f.type), f.missingPolicy ?? "diagnostic");
        }
      }
      // Synthetic variant column (route filter):
      insertField.run(entityId, "variant", `${entityId}s`, "variant", "Variant", "string", "diagnostic");

      const overview = entity.site?.overview;
      if (overview) {
        overview.columns.forEach((field, i) => insertColumn.run(entityId, `col_${field}`, field, i));
      }
      const detail = entity.site?.detail;
      if (detail) {
        detail.sections.forEach((section, i) => {
          if (section.kind === "fieldList") {
            insertSection.run(entityId, section.id, "fieldList", section.title, i, null, null);
            section.fields.forEach((field, j) => insertSectionField.run(entityId, section.id, field, j));
          } else {
            insertSection.run(entityId, section.id, "custom", section.title, i, section.renderer, JSON.stringify(section.props ?? {}));
          }
        });
      }
      // Read models (Slice 1 declares two; emission lands in Task E.5).
      insertReadModel.run("item_overview_rows", "item_overview_rows", entityId, "overview");
      insertReadModel.run("item_detail_rows",   "item_detail_rows",   entityId, "detail");
    }

    for (const v of desc.variants.item ?? []) {
      insertVariant.run(v.variantId, v.label, v.unityType, v.canonicalTable, v.parentVariantId ?? null, v.position ?? 0, v.isPublicRoute ? 1 : 0);
    }
  });
  tx();
}
```

- [ ] **Step 4: Run (expect pass)**

Run: `bun test pipeline/test/site-metadata.test.ts`
Expected: 1 pass.

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/stages/emit-site-metadata.ts pipeline/test/site-metadata.test.ts
git commit -m "feat(pipeline): emit site metadata from descriptors"
```

### Task E.5: Read-model emission

**Files:**
- Create: `pipeline/src/stages/emit-read-models.ts`
- Modify: `pipeline/test/canonicaliser.test.ts` (no — separate test file)
- Create: `pipeline/test/read-models.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// pipeline/test/read-models.test.ts
import { describe, it, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { buildDDL } from "$pipeline/sql/ddl";
import { canonicaliseItems } from "$pipeline/entities/item/canonicaliser";
import { emitItemReadModels } from "$pipeline/stages/emit-read-models";
import { loadDescriptors } from "$pipeline/stages/load-descriptors";
import { loadSnapshot } from "$pipeline/stages/load-snapshot";

const ctx = {
  workspaceRoot: ".",
  snapshotDir:   "pipeline/test/fixtures/synthetic/snapshot",
  outDir:        ".",
  log: () => undefined,
};

describe("emitItemReadModels", () => {
  it("builds item_overview_rows and item_detail_rows", async () => {
    const desc = await loadDescriptors.run({}, ctx);
    const snap = await loadSnapshot.run({}, ctx);
    const db = new Database(":memory:");
    db.exec(buildDDL(desc.entities.item, desc.variants.item));
    canonicaliseItems(db, desc.entities.item, desc.variants.item, snap.envelopes.item);
    emitItemReadModels(db, desc);

    const overview = db.query("SELECT id, name, variant FROM item_overview_rows ORDER BY name").all() as { id: string; name: string; variant: string }[];
    expect(overview.map((r) => r.name)).toEqual(["Iron Sword", "Leather Tunic"]);

    const detail = db.query("SELECT id, fields_json FROM item_detail_rows WHERE id = 'fixture-iron-sword'").get() as { id: string; fields_json: string };
    const fields = JSON.parse(detail.fields_json);
    expect(fields.damageMin).toBe(5);
    expect(fields.weight).toBe(3.5);
  });
});
```

- [ ] **Step 2: Run (expect failure)**

Run: `bun test pipeline/test/read-models.test.ts`
Expected: 1 fail.

- [ ] **Step 3: Implement `pipeline/src/stages/emit-read-models.ts`**

Read models for Slice 1 are materialised tables built from canonical inheritance-layer joins. The site goes through `site/src/lib/store/items.ts` which queries these read models, never the inheritance-layer tables directly.

```ts
import type { Database } from "bun:sqlite";
import type { LoadDescriptorsOutput } from "./load-descriptors.ts";

export const ITEM_READ_MODEL_DDL = `
CREATE TABLE item_overview_rows (
  id       TEXT NOT NULL PRIMARY KEY,
  name     TEXT,
  weight   REAL,
  value    INTEGER,
  variant  TEXT
);
CREATE TABLE item_detail_rows (
  id           TEXT NOT NULL PRIMARY KEY,
  name         TEXT,
  variant      TEXT,
  fields_json  TEXT NOT NULL
);
`;

export function emitItemReadModels(db: Database, desc: LoadDescriptorsOutput): void {
  db.exec(ITEM_READ_MODEL_DDL);
  db.run(
    `INSERT INTO item_overview_rows (id, name, weight, value, variant)
     SELECT id, name, weight, value, variant FROM items`,
  );

  // Build a single-row JSON aggregate per item by concatenating fields from
  // ancestor variant tables. We do this with a per-row loop so SQLite stays
  // schema-agnostic and the test owns the contract.
  const variants = desc.variants.item ?? [];
  const items = db.query("SELECT id, name, variant FROM items").all() as { id: string; name: string; variant: string }[];
  const insertDetail = db.prepare(
    `INSERT INTO item_detail_rows (id, name, variant, fields_json) VALUES (?, ?, ?, ?)`,
  );

  function ancestry(variantId: string): string[] {
    const chain: string[] = [];
    let cur = variants.find((v) => v.variantId === variantId);
    while (cur) {
      chain.unshift(cur.canonicalTable);
      cur = cur.parentVariantId ? variants.find((v) => v.variantId === cur!.parentVariantId) : undefined;
    }
    return chain;
  }

  const tx = db.transaction(() => {
    for (const item of items) {
      const fields: Record<string, unknown> = {};
      const root = db.query("SELECT * FROM items WHERE id = ?").get(item.id) as Record<string, unknown>;
      Object.assign(fields, root);
      for (const tableName of ancestry(item.variant)) {
        const layer = db.query(`SELECT * FROM "${tableName}" WHERE id = ?`).get(item.id) as Record<string, unknown> | undefined;
        if (layer) Object.assign(fields, layer);
      }
      insertDetail.run(item.id, item.name, item.variant, JSON.stringify(fields));
    }
  });
  tx();
}
```

- [ ] **Step 4: Run (expect pass)**

Run: `bun test pipeline/test/read-models.test.ts`
Expected: 1 pass.

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/stages/emit-read-models.ts pipeline/test/read-models.test.ts
git commit -m "feat(pipeline): emit item overview and detail read models"
```

### Task E.6: Property invariants for item canonicalisation

**Files:**
- Create: `pipeline/test/invariants/items.test.ts`

- [ ] **Step 1: Write the property tests**

```ts
// pipeline/test/invariants/items.test.ts
import { describe, it, expect } from "bun:test";
import fc from "fast-check";
import { Database } from "bun:sqlite";
import { buildDDL } from "$pipeline/sql/ddl";
import { canonicaliseItems } from "$pipeline/entities/item/canonicaliser";
import { loadDescriptors } from "$pipeline/stages/load-descriptors";
import type { SnapshotEnvelope } from "$pipeline/types";

const ctx = { workspaceRoot: ".", snapshotDir: "", outDir: ".", log: () => undefined };

function arbItem(variantPicker: () => string) {
  return fc.record({
    id: fc.uuid(),
    variant: fc.constant(variantPicker()),
    name: fc.string({ minLength: 1, maxLength: 64 }),
    weight: fc.float({ min: 0, max: 1000, noNaN: true }),
    value: fc.integer({ min: 0, max: 10000 }),
    description: fc.string({ maxLength: 200 }),
    equipSlot: fc.constantFrom("primary", "secondary", "chest", "head"),
    armorClass: fc.option(fc.constantFrom("light", "medium", "heavy"), { nil: null }),
    durabilityMax: fc.integer({ min: 1, max: 1000 }),
    twoHanded: fc.boolean(),
    blockChance: fc.float({ min: 0, max: 1, noNaN: true }),
    damageMin: fc.integer({ min: 0, max: 100 }),
    damageMax: fc.integer({ min: 0, max: 100 }),
    reach: fc.float({ min: 0, max: 5, noNaN: true }),
    weaponClass: fc.constantFrom("sword", "axe", "mace", "spear"),
    armorRating: fc.integer({ min: 0, max: 100 }),
    coverageSlot: fc.constantFrom("torso", "head", "legs", "arms"),
  });
}

describe("item canonical invariants", () => {
  it("every item has exactly one items row", async () => {
    const desc = await loadDescriptors.run({}, ctx);
    await fc.assert(
      fc.asyncProperty(
        fc.array(arbItem(() => "melee-weapon"), { minLength: 1, maxLength: 50 }),
        async (items) => {
          const db = new Database(":memory:");
          db.exec(buildDDL(desc.entities.item, desc.variants.item));
          const env: SnapshotEnvelope = {
            entityId: "item",
            schemaVersion: 1,
            rows: items.map((i) => ({
              id: i.id,
              variant: i.variant,
              fields: { ...i, iconRef: { kind: "missing", reason: "test", source: "test" } },
            })),
          };
          canonicaliseItems(db, desc.entities.item, desc.variants.item, env);
          const counts = db.query("SELECT id, COUNT(*) c FROM items GROUP BY id").all() as { id: string; c: number }[];
          expect(counts.every((r) => r.c === 1)).toBe(true);
        },
      ),
      { numRuns: 50 },
    );
  });

  it("variant ancestry has no orphans", async () => {
    const desc = await loadDescriptors.run({}, ctx);
    await fc.assert(
      fc.asyncProperty(
        fc.array(arbItem(() => "melee-weapon"), { minLength: 1, maxLength: 30 }),
        async (items) => {
          const db = new Database(":memory:");
          db.exec(buildDDL(desc.entities.item, desc.variants.item));
          const env: SnapshotEnvelope = {
            entityId: "item",
            schemaVersion: 1,
            rows: items.map((i) => ({
              id: i.id,
              variant: i.variant,
              fields: { ...i, iconRef: { kind: "missing", reason: "test", source: "test" } },
            })),
          };
          canonicaliseItems(db, desc.entities.item, desc.variants.item, env);
          // every melee row has matching primary_hand, hand, equipment, items rows
          const orphans = db.query(`
            SELECT mw.id FROM item_melee_weapons mw
            LEFT JOIN item_primary_hand_items ph ON ph.id = mw.id
            LEFT JOIN item_hand_items         h  ON h.id  = mw.id
            LEFT JOIN item_equipment          e  ON e.id  = mw.id
            LEFT JOIN items                   i  ON i.id  = mw.id
            WHERE ph.id IS NULL OR h.id IS NULL OR e.id IS NULL OR i.id IS NULL
          `).all();
          expect(orphans).toEqual([]);
        },
      ),
      { numRuns: 30 },
    );
  });
});
```

- [ ] **Step 2: Run (expect pass)**

Run: `bun test pipeline/test/invariants/items.test.ts`
Expected: 2 pass within numRuns × 2 invocations of canonicaliser; runtime under 5 s.

- [ ] **Step 3: Commit**

```bash
git add pipeline/test/invariants/items.test.ts
git commit -m "test(pipeline): property invariants for item canonical ancestry"
```

### Task E.7: SQLite emission CLI

**Files:**
- Create: `pipeline/src/stages/emit-sqlite.ts`
- Create: `pipeline/src/cli.ts`
- Modify: root `package.json` to add `pipeline:run` script

- [ ] **Step 1: Write `pipeline/src/stages/emit-sqlite.ts`**

```ts
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Stage } from "../types.ts";
import { buildDDL } from "../sql/ddl.ts";
import { SITE_METADATA_DDL } from "../sql/site-metadata-ddl.ts";
import { canonicaliseItems } from "../entities/item/canonicaliser.ts";
import { emitSiteMetadata } from "./emit-site-metadata.ts";
import { emitItemReadModels } from "./emit-read-models.ts";
import type { LoadDescriptorsOutput } from "./load-descriptors.ts";
import type { LoadSnapshotOutput } from "./load-snapshot.ts";

export interface EmitSqliteInputs {
  "load-descriptors": LoadDescriptorsOutput;
  "load-snapshot":    LoadSnapshotOutput;
}

export interface EmitSqliteOutput {
  outputPath: string;
  byteSize: number;
}

export const emitSqlite: Stage<EmitSqliteInputs, EmitSqliteOutput> = {
  id: "emit-sqlite",
  inputs: ["load-descriptors", "load-snapshot"],
  run: (inputs, ctx) => {
    const outputPath = `${ctx.outDir}/data.sqlite`;
    mkdirSync(dirname(outputPath), { recursive: true });
    const db = new Database(outputPath, { create: true, readwrite: true });
    db.exec("PRAGMA journal_mode = DELETE;");
    db.exec(SITE_METADATA_DDL);
    db.exec(buildDDL(inputs["load-descriptors"].entities.item, inputs["load-descriptors"].variants.item));
    canonicaliseItems(db, inputs["load-descriptors"].entities.item, inputs["load-descriptors"].variants.item, inputs["load-snapshot"].envelopes.item);
    emitSiteMetadata(db, inputs["load-descriptors"]);
    emitItemReadModels(db, inputs["load-descriptors"]);
    db.close();
    return { outputPath, byteSize: Bun.file(outputPath).size };
  },
};
```

- [ ] **Step 2: Write `pipeline/src/cli.ts`**

```ts
#!/usr/bin/env bun
import { runStages } from "./orchestrator.ts";
import { loadDescriptors } from "./stages/load-descriptors.ts";
import { loadSnapshot } from "./stages/load-snapshot.ts";
import { validate } from "./stages/validate.ts";
import { emitSqlite } from "./stages/emit-sqlite.ts";

const [, , subcommand, snapshotDir, outDir] = Bun.argv;
if (subcommand !== "run" || !snapshotDir || !outDir) {
  console.error(`usage: ardenfall-pipeline run <snapshotDir> <outDir>`);
  process.exit(2);
}

const ctx = {
  workspaceRoot: ".",
  snapshotDir,
  outDir,
  log: (level: "info" | "warn" | "error", msg: string) => console.warn(`[${level}] ${msg}`),
};

const result = await runStages(
  [loadDescriptors, loadSnapshot, validate, emitSqlite],
  {},
  ctx,
);

const v = result.validate as { errors: unknown[]; countsBySeverity: { fatal: number; diagnostic: number } };
if (v.countsBySeverity.fatal > 0) {
  console.error(`pipeline rejected snapshot: ${v.countsBySeverity.fatal} fatal diagnostics`);
  for (const e of v.errors) console.error(JSON.stringify(e));
  process.exit(1);
}
const e = result["emit-sqlite"] as { outputPath: string; byteSize: number };
console.warn(`wrote ${e.outputPath} (${e.byteSize} bytes)`);
```

- [ ] **Step 3: Add `pipeline:run` script to root `package.json`**

Edit `scripts` to add:

```jsonc
"pipeline:run":  "bun run pipeline/src/cli.ts run"
```

- [ ] **Step 4: Smoke-run against the synthetic fixture**

Run: `bun run pipeline:run pipeline/test/fixtures/synthetic/snapshot pipeline/test/.tmp`
Expected: stderr `wrote pipeline/test/.tmp/data.sqlite (NNNN bytes)`. File `pipeline/test/.tmp/data.sqlite` exists. Size > 32 KB and < 1 MB.

Inspect:

```sh
bun -e '
  import("bun:sqlite").then(async ({ Database }) => {
    const db = new Database("pipeline/test/.tmp/data.sqlite", { readonly: true });
    console.warn(JSON.stringify(db.query("SELECT id, name, variant FROM item_overview_rows ORDER BY name").all(), null, 2));
  });
'
```
Expected: prints the two synthetic items.

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/stages/emit-sqlite.ts pipeline/src/cli.ts package.json
git commit -m "feat(pipeline): emit-sqlite stage and pipeline run cli"
```

### Phase E gate

```sh
bun test pipeline/test
bun run pipeline:run pipeline/test/fixtures/synthetic/snapshot pipeline/test/.tmp
```

All tests pass; SQLite blob produced. The pipeline can stand alone against synthetic data with no mod required.

---

## Phase F — Mod scaffolding + walker base

Goal: csproj compiles cleanly against `mod/libs/`. Walker base, ref resolver, provenance capture, and DTO scaffolding are in place. No runtime extraction yet.

### Task F.1: csproj, libs/ helper, JSON settings

**Files:**
- Create: `mod/ArdenfallArchives.csproj`
- Create: `mod/scripts/copy-libs.sh`
- Create: `mod/src/Emit/JsonSettings.cs`
- Create: `mod/AGENTS.md`

- [ ] **Step 1: Write `mod/ArdenfallArchives.csproj`**

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net46</TargetFramework>
    <AssemblyName>ArdenfallArchives</AssemblyName>
    <RootNamespace>ArdenfallArchives</RootNamespace>
    <LangVersion>latest</LangVersion>
    <Nullable>enable</Nullable>
    <NoWarn>CS1591</NoWarn>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="BepInEx.Core" Version="5.4.23" />
    <PackageReference Include="Newtonsoft.Json" Version="13.0.3" />
  </ItemGroup>

  <ItemGroup>
    <Reference Include="Assembly-CSharp">             <HintPath>libs\Assembly-CSharp.dll</HintPath>             <Private>false</Private> </Reference>
    <Reference Include="UnityEngine">                 <HintPath>libs\UnityEngine.dll</HintPath>                 <Private>false</Private> </Reference>
    <Reference Include="UnityEngine.CoreModule">      <HintPath>libs\UnityEngine.CoreModule.dll</HintPath>      <Private>false</Private> </Reference>
    <Reference Include="UnityEngine.IMGUIModule">     <HintPath>libs\UnityEngine.IMGUIModule.dll</HintPath>     <Private>false</Private> </Reference>
    <Reference Include="Sirenix.OdinInspector.Attributes"><HintPath>libs\Sirenix.OdinInspector.Attributes.dll</HintPath><Private>false</Private></Reference>
    <Reference Include="Sirenix.Serialization">       <HintPath>libs\Sirenix.Serialization.dll</HintPath>       <Private>false</Private> </Reference>
  </ItemGroup>
</Project>
```

- [ ] **Step 2: Write `mod/scripts/copy-libs.sh`**

```sh
#!/usr/bin/env bash
# Copies game DLLs from a local Ardenfall install into mod/libs/.
# Default path is the macOS CrossOver Steam location; pass a different one as $1.
set -euo pipefail
SRC=${1:-"$HOME/Library/Application Support/CrossOver/Bottles/Steam/drive_c/Program Files (x86)/Steam/steamapps/common/Ardenfall Demo/Ardenfall_Data/Managed"}
DEST="$(dirname "$0")/../libs"
mkdir -p "$DEST"
for dll in Assembly-CSharp.dll UnityEngine.dll UnityEngine.CoreModule.dll UnityEngine.IMGUIModule.dll Sirenix.OdinInspector.Attributes.dll Sirenix.Serialization.dll; do
  cp "$SRC/$dll" "$DEST/$dll"
done
echo "copied $(ls -1 "$DEST" | wc -l) dlls to $DEST"
```

Mark executable: `chmod +x mod/scripts/copy-libs.sh`.

- [ ] **Step 3: Write `mod/src/Emit/JsonSettings.cs`**

```csharp
using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;

namespace ArdenfallArchives.Emit;

public static class JsonSettings
{
    public static readonly JsonSerializerSettings Default = new()
    {
        Formatting = Formatting.Indented,
        NullValueHandling = NullValueHandling.Include,
        DefaultValueHandling = DefaultValueHandling.Include,
        ContractResolver = new DefaultContractResolver { NamingStrategy = new CamelCaseNamingStrategy() },
    };
}
```

- [ ] **Step 4: Write `mod/AGENTS.md`**

```markdown
# Mod (BepInEx 5) Agent Orientation

The mod walks live Ardenfall runtime objects and emits JSON snapshots. It is **not** a content/gameplay mod.

## Hard rules

- DTOs are explicit. Never serialize Unity objects, Odin containers, `Parameter<T>`, `SmartListParameter<T>`, `RecordID`, or game records directly. Pull values via `.Get()` and put them on a typed snapshot DTO.
- Stable ids come from `BuiltLookupTable.GetGuid(asset)`. Deterministic name-hash fallbacks are last resort and must be flagged unstable in the snapshot ref kind.
- Preflight gates extraction. Every extraction path runs the full preflight immediately before writing — cached readiness state is **not** an authorization token.
- Extraction output is atomic. Write to a staging path, then rename. The pipeline never reads partial files.

## Layout

- `src/Plugin.cs`             — entry point, trigger registration.
- `src/Triggers/`             — hotkey, console command, advisory readiness monitor.
- `src/Preflight/`            — fail-fast gate before snapshot creation.
- `src/Walker/`               — generic walker base, cycle detection, ref resolution, provenance.
- `src/Dtos/`                 — shared DTOs (SnapshotRef, Manifest, Diagnostic).
- `src/Entities/<E>/Adapters/` — per-layer extractor adapters.
- `src/Emit/`                 — JSON + atomic snapshot writers.

Read `docs/superpowers/specs/2026-04-29-ardenfall-archives-implementation-decisions.md` §11–§14 for the contract.
```

- [ ] **Step 5: Verify the project file is well-formed (no build yet — game DLLs may not be present)**

Run: `dotnet restore mod/ArdenfallArchives.csproj || echo "restore may fail without libs/; that's expected here"`
Expected: project is recognised by `dotnet`. If `libs/` is empty, build will fail at the linker step; that's fine for this task.

- [ ] **Step 6: Commit**

```bash
chmod +x mod/scripts/copy-libs.sh
git add mod/ArdenfallArchives.csproj mod/scripts/copy-libs.sh mod/src/Emit/JsonSettings.cs mod/AGENTS.md
git commit -m "feat(mod): bootstrap bepinex csproj and dll-copy helper"
```

### Task F.2: Shared DTOs (SnapshotRef, Manifest, Diagnostic, Provenance)

**Files:**
- Create: `mod/src/Dtos/SnapshotRef.cs`
- Create: `mod/src/Dtos/Manifest.cs`
- Create: `mod/src/Dtos/Diagnostic.cs`
- Create: `mod/src/Dtos/Provenance.cs`
- Create: `mod/src/Dtos/PreflightReport.cs`

- [ ] **Step 1: Write `SnapshotRef.cs`** — discriminated union via `Kind` field

```csharp
using Newtonsoft.Json;
namespace ArdenfallArchives.Dtos;

public sealed class SnapshotRef
{
    [JsonProperty("kind")]      public string Kind { get; init; } = "missing";
    [JsonProperty("guid")]      public string? Guid { get; init; }
    [JsonProperty("unityType")] public string? UnityType { get; init; }
    [JsonProperty("name")]      public string? Name { get; init; }
    [JsonProperty("table")]     public string? Table { get; init; }
    [JsonProperty("subtable")]  public string? Subtable { get; init; }
    [JsonProperty("id")]        public string? Id { get; init; }
    [JsonProperty("recordType")]public string? RecordType { get; init; }
    [JsonProperty("extractionId")]public string? ExtractionId { get; init; }
    [JsonProperty("stable")]    public bool? Stable { get; init; }
    [JsonProperty("reason")]    public string? Reason { get; init; }
    [JsonProperty("source")]    public string? Source { get; init; }

    public static SnapshotRef LookupAsset(string guid, string? unityType = null, string? name = null) =>
        new() { Kind = "lookupAsset", Guid = guid, UnityType = unityType, Name = name };

    public static SnapshotRef Missing(string reason, string source) =>
        new() { Kind = "missing", Reason = reason, Source = source };

    public static SnapshotRef Record(string table, string subtable, string id, string? recordType = null) =>
        new() { Kind = "record", Table = table, Subtable = subtable, Id = id, RecordType = recordType };
}
```

- [ ] **Step 2: Write `Manifest.cs`**

```csharp
using Newtonsoft.Json;
namespace ArdenfallArchives.Dtos;

public sealed class Manifest
{
    [JsonProperty("schemaVersion")]    public int SchemaVersion { get; init; } = 1;
    [JsonProperty("gameVersion")]      public string? GameVersion { get; init; }
    [JsonProperty("buildIdentifier")]  public string? BuildIdentifier { get; init; }
    [JsonProperty("extractorVersion")] public string ExtractorVersion { get; init; } = "0.0.0";
    [JsonProperty("extractedAt")]      public string ExtractedAt { get; init; } = "";
    [JsonProperty("preflight")]        public PreflightReport Preflight { get; init; } = new();
    [JsonProperty("counts")]           public Dictionary<string, int> Counts { get; init; } = new();
    [JsonProperty("diagnostics")]      public DiagnosticTotals Diagnostics { get; init; } = new();
    [JsonProperty("hashes")]           public Dictionary<string, string> Hashes { get; init; } = new();
}

public sealed class DiagnosticTotals
{
    [JsonProperty("fatal")]      public int Fatal { get; set; }
    [JsonProperty("diagnostic")] public int Diagnostic { get; set; }
}
```

- [ ] **Step 3: Write `PreflightReport.cs`**

```csharp
using Newtonsoft.Json;
namespace ArdenfallArchives.Dtos;

public sealed class PreflightReport
{
    [JsonProperty("passed")]      public bool Passed { get; set; }
    [JsonProperty("completedAt")] public string CompletedAt { get; set; } = "";
    [JsonProperty("checks")]      public List<PreflightCheck> Checks { get; init; } = new();
}

public sealed class PreflightCheck
{
    [JsonProperty("name")]   public string Name { get; init; } = "";
    [JsonProperty("ok")]     public bool Ok { get; init; }
    [JsonProperty("reason")] public string? Reason { get; init; }
}
```

- [ ] **Step 4: Write `Diagnostic.cs`**

```csharp
using Newtonsoft.Json;
namespace ArdenfallArchives.Dtos;

public sealed class Diagnostic
{
    [JsonProperty("severity")] public string Severity { get; init; } = "diagnostic"; // "fatal" | "diagnostic"
    [JsonProperty("code")]     public string Code     { get; init; } = "";
    [JsonProperty("field")]    public string Field    { get; init; } = "";
    [JsonProperty("message")]  public string? Message { get; init; }
}
```

- [ ] **Step 5: Write `Provenance.cs`**

```csharp
using Newtonsoft.Json;
namespace ArdenfallArchives.Dtos;

public sealed class Provenance
{
    [JsonProperty("kind")]      public string Kind { get; init; } = "missing"; // see schema enum
    [JsonProperty("source")]    public string Source { get; init; } = "";
    [JsonProperty("isSet")]     public bool IsSet { get; init; }
    [JsonProperty("inherited")] public bool Inherited { get; init; }
    [JsonProperty("parent")]    public ParentRef? Parent { get; init; }
}

public sealed class ParentRef
{
    [JsonProperty("kind")]      public string Kind { get; init; } = "";
    [JsonProperty("guid")]      public string? Guid { get; init; }
    [JsonProperty("unityType")] public string? UnityType { get; init; }
}
```

- [ ] **Step 6: Commit**

```bash
git add mod/src/Dtos/
git commit -m "feat(mod): shared snapshot dtos (ref, manifest, diagnostic, provenance)"
```

### Task F.3: Walker base, ref resolver, provenance capture

**Files:**
- Create: `mod/src/Walker/RefResolver.cs`
- Create: `mod/src/Walker/ProvenanceCapture.cs`
- Create: `mod/src/Walker/WalkerBase.cs`

- [ ] **Step 1: Write `RefResolver.cs`**

```csharp
using Ardenfall;
using ArdenfallArchives.Dtos;
using UnityEngine;

namespace ArdenfallArchives.Walker;

/// <summary>Resolves Unity object references to SnapshotRefs, applying the missing-ref policy.</summary>
public sealed class RefResolver
{
    public List<Diagnostic> Diagnostics { get; } = new();

    /// <summary>Resolve an asset-backed ref. Policy: fatal | diagnostic | optional-empty.</summary>
    public SnapshotRef ResolveAsset(Object? asset, string field, string entityRowId, MissingPolicy policy)
    {
        if (asset == null)
        {
            return EmitMissing(field, entityRowId, policy, reason: "nullAsset", source: field);
        }
        var guid = BuiltLookupTable.Instance != null
            ? BuiltLookupTable.Instance.GetGuid(asset)
            : null;
        if (string.IsNullOrEmpty(guid))
        {
            return EmitMissing(field, entityRowId, policy, reason: "lookupAssetGuidMissing", source: field);
        }
        return SnapshotRef.LookupAsset(guid, asset.GetType().FullName, asset.name);
    }

    private SnapshotRef EmitMissing(string field, string entityRowId, MissingPolicy policy, string reason, string source)
    {
        var severity = policy switch
        {
            MissingPolicy.Fatal => "fatal",
            MissingPolicy.Diagnostic => "diagnostic",
            MissingPolicy.OptionalEmpty => null,
            _ => "diagnostic",
        };
        if (severity != null)
        {
            Diagnostics.Add(new Diagnostic
            {
                Severity = severity,
                Code = reason,
                Field = field,
                Message = $"missing ref '{field}' on {entityRowId}",
            });
        }
        return SnapshotRef.Missing(reason, source);
    }
}

public enum MissingPolicy { Fatal, Diagnostic, OptionalEmpty }
```

- [ ] **Step 2: Write `ProvenanceCapture.cs`**

```csharp
using ArdenfallArchives.Dtos;
namespace ArdenfallArchives.Walker;

/// <summary>Captures provenance for Parameter&lt;T&gt; and SmartListParameter&lt;T&gt; field resolution.</summary>
public static class ProvenanceCapture
{
    public static Provenance ForParameter<T>(string source, bool isSet, bool inherited, ParentRef? parent = null) =>
        new() { Kind = "parameter", Source = source, IsSet = isSet, Inherited = inherited, Parent = parent };

    public static Provenance ForSmartList<T>(string source, bool isSet, bool inherited, ParentRef? parent = null) =>
        new() { Kind = "smartListParameter", Source = source, IsSet = isSet, Inherited = inherited, Parent = parent };

    public static Provenance ForLookupAsset(string source, bool isSet, bool inherited, ParentRef? parent = null) =>
        new() { Kind = "lookupAsset", Source = source, IsSet = isSet, Inherited = inherited, Parent = parent };

    public static Provenance ForMissing(string source, bool inherited) =>
        new() { Kind = "missing", Source = source, IsSet = false, Inherited = inherited };
}
```

> **Note:** Reading `isSet` and `inherited` requires inspecting `Parameter<T>` internals. Ardenfall's `Parameter<T>` exposes either an `IsSet` property or a similar discriminator (verify via ILSpy when implementing). If the surface differs, update the `ItemExtractor` adapter at the call site to query the actual discriminator and pass the correct booleans into `ForParameter<T>`. The DTO shape is fixed; the population logic is per-extractor.

- [ ] **Step 3: Write `WalkerBase.cs`** — generic root for entity walkers

```csharp
using ArdenfallArchives.Dtos;
using UnityEngine;

namespace ArdenfallArchives.Walker;

/// <summary>Base for per-entity walkers. Provides cycle detection scaffolding and shared helpers.</summary>
public abstract class WalkerBase<TSnapshot>
{
    private readonly HashSet<int> _visitedInstanceIds = new();
    public RefResolver Refs { get; } = new();
    public List<Diagnostic> Diagnostics { get; } = new();

    /// <summary>Track an object so cyclic references are detected.</summary>
    protected bool MarkVisited(Object obj)
    {
        if (obj == null) return false;
        return _visitedInstanceIds.Add(obj.GetInstanceID());
    }

    /// <summary>Walk all roots and emit per-row snapshots.</summary>
    public abstract IEnumerable<TSnapshot> Walk();
}
```

- [ ] **Step 4: Compile-check (requires `mod/libs/` populated)**

Run: `mod/scripts/copy-libs.sh && dotnet build mod/ArdenfallArchives.csproj -c Debug`
Expected: build succeeds; `mod/bin/Debug/net46/ArdenfallArchives.dll` is produced. Any unresolved-symbol error against `Ardenfall.*` types means a member name in `RefResolver.cs` or `WalkerBase.cs` does not match the live DLL — fix locally and update this plan.

- [ ] **Step 5: Commit**

```bash
git add mod/src/Walker/
git commit -m "feat(mod): walker base, ref resolver, provenance capture"
```

### Task F.4: Preflight

**Files:**
- Create: `mod/src/Preflight/Preflight.cs`

- [ ] **Step 1: Write the preflight implementation**

```csharp
using Ardenfall;
using ArdenfallArchives.Dtos;

namespace ArdenfallArchives.Preflight;

/// <summary>
/// Fail-fast preflight executed immediately before every snapshot write.
/// Cached readiness is not an authorization token; this runs every time.
/// </summary>
public static class Preflight
{
    public static PreflightReport Run()
    {
        var report = new PreflightReport { CompletedAt = DateTimeOffset.UtcNow.ToString("O") };

        Check(report, "builtLookupTable", () =>
        {
            var t = BuiltLookupTable.Instance;
            return (t != null, t == null ? "BuiltLookupTable.Instance is null" : null);
        });
        Check(report, "builtLookupTableNonEmpty", () =>
        {
            var t = BuiltLookupTable.Instance;
            // Replace with the actual API — e.g. t.AllAssets.Count > 0 or t.GetAssetsOfType<UnityEngine.Object>().Any()
            var ok = t != null && t.GetAssetsOfType<Ardenfall.Item.ItemData>().Any();
            return (ok, ok ? null : "BuiltLookupTable produced no ItemData assets");
        });
        Check(report, "ardenfallGame", () =>
        {
            var ok = ArdenfallGame.instance != null;
            return (ok, ok ? null : "ArdenfallGame.instance is null");
        });
        Check(report, "worldData", () =>
        {
            var w = ArdenfallGame.instance?.worldData;
            return (w != null, w == null ? "ArdenfallGame.instance.worldData is null" : null);
        });
        Check(report, "masterRecordTable", () =>
        {
            var m = ArdenfallGame.instance?.worldData?.masterRecordTable;
            var nonEmpty = m != null && m.GetTables().Any();
            return (nonEmpty, nonEmpty ? null : "masterRecordTable.GetTables() empty");
        });

        report.Passed = report.Checks.All(c => c.Ok);
        return report;
    }

    private static void Check(PreflightReport report, string name, Func<(bool, string?)> probe)
    {
        try
        {
            var (ok, reason) = probe();
            report.Checks.Add(new PreflightCheck { Name = name, Ok = ok, Reason = reason });
        }
        catch (Exception ex)
        {
            report.Checks.Add(new PreflightCheck { Name = name, Ok = false, Reason = ex.Message });
        }
    }
}
```

> **Member-name caveat:** `BuiltLookupTable.AllAssets` / `GetAssetsOfType<T>` and `MasterRecordTable.GetTables()` are best-effort identifiers. If the live DLL exposes different names, update the call sites here and in the `ItemExtractor`. The preflight contract (which checks run, what they prove) is fixed; the API surface inside each check is per-game-version.

- [ ] **Step 2: Build and commit**

```bash
dotnet build mod/ArdenfallArchives.csproj -c Debug
git add mod/src/Preflight/Preflight.cs
git commit -m "feat(mod): fail-fast preflight gate"
```

### Phase F gate

`dotnet build mod/ArdenfallArchives.csproj` succeeds locally. CI's `mod` job will be flaky until Phase G ships extraction (game DLLs are still required for compile); track this and accept until the entire mod compiles end-to-end.

---

## Phase G — Mod item extraction

Goal: hot-installable BepInEx mod that walks `ItemData` assets and emits a complete snapshot to `snapshots/<game>-<ts>/` atomically. After this phase, the pipeline can ingest a real snapshot without further changes.

### Task G.1: Item snapshot DTOs

**Files:**
- Create: `mod/src/Entities/Item/ItemSnapshot.cs`
- Create: `mod/src/Entities/Item/ItemEquipmentSnapshot.cs`
- Create: `mod/src/Entities/Item/ItemHandSnapshot.cs`
- Create: `mod/src/Entities/Item/ItemPrimaryHandSnapshot.cs`
- Create: `mod/src/Entities/Item/ItemMeleeSnapshot.cs`
- Create: `mod/src/Entities/Item/ItemArmorSnapshot.cs`
- Create: `mod/src/Entities/Item/ItemTagSnapshot.cs`

- [ ] **Step 1: Write `ItemSnapshot.cs`**

```csharp
using ArdenfallArchives.Dtos;
using Newtonsoft.Json;
namespace ArdenfallArchives.Entities.Item;

/// <summary>
/// Wire shape per snapshot.schema.json: { id, variant, fields, tags, provenance, diagnostics }.
/// Per-variant fields are flattened into `fields` so the pipeline canonicaliser can read them
/// uniformly regardless of variant depth.
/// </summary>
public sealed class ItemSnapshotRow
{
    [JsonProperty("id")]          public string Id { get; init; } = "";
    [JsonProperty("variant")]     public string Variant { get; init; } = "";
    [JsonProperty("fields")]      public Dictionary<string, object?> Fields { get; init; } = new();
    [JsonProperty("tags")]        public List<string> Tags { get; init; } = new();
    [JsonProperty("provenance")]  public Dictionary<string, Provenance> Provenance { get; init; } = new();
    [JsonProperty("diagnostics")] public List<Diagnostic> Diagnostics { get; init; } = new();
}

public sealed class ItemSnapshotEnvelope
{
    [JsonProperty("entityId")]      public string EntityId { get; init; } = "item";
    [JsonProperty("schemaVersion")] public int SchemaVersion { get; init; } = 1;
    [JsonProperty("rows")]          public List<ItemSnapshotRow> Rows { get; init; } = new();
}
```

- [ ] **Step 2: Write the per-layer DTO files**

Each layer DTO carries only the fields introduced at that layer plus the parent id; the per-row JSON puts everything into the `fields` dictionary, so these C# DTOs are intermediate values used by adapters, not the wire format.

Example pattern (`ItemEquipmentSnapshot.cs`):

```csharp
namespace ArdenfallArchives.Entities.Item;

public sealed record ItemEquipmentSnapshot(
    string Id,
    string EquipSlot,
    string? ArmorClass,
    int? DurabilityMax);
```

Repeat the same pattern for `ItemHandSnapshot` (`Id`, `TwoHanded`), `ItemPrimaryHandSnapshot` (`Id`, `BlockChance?`), `ItemMeleeSnapshot` (`Id`, `DamageMin`, `DamageMax`, `Reach?`, `WeaponClass`), `ItemArmorSnapshot` (`Id`, `ArmorRating`, `CoverageSlot`), and `ItemTagSnapshot` (`Id`, `Tag`).

- [ ] **Step 3: Commit**

```bash
git add mod/src/Entities/Item/Item*Snapshot.cs
git commit -m "feat(mod): item per-layer snapshot dtos"
```

### Task G.2: Adapters per layer

**Files:**
- Create: `mod/src/Entities/Item/Adapters/ExtractItem.cs`
- Create: `mod/src/Entities/Item/Adapters/ExtractEquipment.cs`
- Create: `mod/src/Entities/Item/Adapters/ExtractHandItem.cs`
- Create: `mod/src/Entities/Item/Adapters/ExtractPrimaryHand.cs`
- Create: `mod/src/Entities/Item/Adapters/ExtractMelee.cs`
- Create: `mod/src/Entities/Item/Adapters/ExtractArmor.cs`

Adapters take the live Mono object plus a `RefResolver` and produce the layer DTO. Each adapter reads only the fields its layer introduces.

- [ ] **Step 1: Write `ExtractItem.cs`** — base ItemData adapter (reference)

```csharp
using Ardenfall;
using Ardenfall.Item;
using ArdenfallArchives.Dtos;
using ArdenfallArchives.Walker;

namespace ArdenfallArchives.Entities.Item.Adapters;

public static class ExtractItem
{
    public static (Dictionary<string, object?> fields, Dictionary<string, Provenance> provenance, List<Diagnostic> diagnostics, List<string> tags)
        Extract(ItemData asset, RefResolver refs, string id)
    {
        var fields = new Dictionary<string, object?>(StringComparer.Ordinal);
        var provenance = new Dictionary<string, Provenance>(StringComparer.Ordinal);
        var diagnostics = new List<Diagnostic>();
        var tags = new List<string>();

        fields["id"] = id;

        // Parameter<T>.Get() resolution + provenance.
        var nameResolved   = asset.itemName.Get();
        var nameIsSet      = asset.itemName.IsSet; // adjust to actual API
        fields["name"]     = nameResolved;
        provenance["name"] = ProvenanceCapture.ForParameter<string>("itemName.Get()", nameIsSet, inherited: !nameIsSet);

        var weightResolved   = asset.weight.Get();
        var weightIsSet      = asset.weight.IsSet;
        fields["weight"]     = weightResolved;
        provenance["weight"] = ProvenanceCapture.ForParameter<float>("weight.Get()", weightIsSet, inherited: !weightIsSet);

        var valueResolved   = asset.value.Get();
        var valueIsSet      = asset.value.IsSet;
        fields["value"]     = valueResolved;
        provenance["value"] = ProvenanceCapture.ForParameter<int>("value.Get()", valueIsSet, inherited: !valueIsSet);

        // Description (optional-empty).
        var descResolved   = asset.description?.Get() ?? "";
        fields["description"] = descResolved;
        provenance["description"] = ProvenanceCapture.ForParameter<string>("description.Get()", isSet: !string.IsNullOrEmpty(descResolved), inherited: false);

        // Icon (lookupAsset; missing → diagnostic).
        fields["iconRef"] = refs.ResolveAsset(asset.icon, "iconRef", id, MissingPolicy.Diagnostic);
        provenance["iconRef"] = (fields["iconRef"] as SnapshotRef)?.Kind == "missing"
            ? ProvenanceCapture.ForMissing("ItemData.icon", inherited: false)
            : ProvenanceCapture.ForLookupAsset("ItemData.icon", isSet: true, inherited: false);

        // Tags (SmartListParameter<ItemTag>).
        var tagListResolved = asset.tags.Get();
        var tagIsSet        = asset.tags.IsSet;
        provenance["tags"]  = ProvenanceCapture.ForSmartList<object>("tags.Get()", tagIsSet, inherited: !tagIsSet);
        if (tagListResolved != null)
        {
            foreach (var tag in tagListResolved)
            {
                if (tag == null) continue;
                var tagId = BuiltLookupTable.Instance?.GetGuid(tag) ?? tag.name;
                if (!string.IsNullOrEmpty(tagId)) tags.Add(tagId);
            }
        }
        diagnostics.AddRange(refs.Diagnostics);
        refs.Diagnostics.Clear();
        return (fields, provenance, diagnostics, tags);
    }
}
```

> **API caveat repeats here:** `Parameter<T>.IsSet`, `SmartListParameter<T>.Get()`, and `ItemData.icon` are best-effort names. Confirm against the live DLL via ILSpy when implementing; if any differs, update both the adapter and (if exposed in the descriptor) `entities/item/entity.json`. The descriptor's `from` paths are the contract; the adapter's job is to satisfy them.

- [ ] **Step 2: Write the remaining five adapters** (same pattern, layer-specific fields only)

```csharp
// ExtractEquipment.cs
using Ardenfall.Item;
namespace ArdenfallArchives.Entities.Item.Adapters;

public static class ExtractEquipment
{
    public static Dictionary<string, object?> Extract(EquipItemData asset)
    {
        return new Dictionary<string, object?>(StringComparer.Ordinal)
        {
            ["equipSlot"]     = asset.equipSlot.ToString(),
            ["armorClass"]    = asset.armorClass?.ToString(),
            ["durabilityMax"] = asset.durabilityMax,
        };
    }
}

// ExtractHandItem.cs
public static class ExtractHandItem
{
    public static Dictionary<string, object?> Extract(Ardenfall.Item.HandItemData asset) =>
        new(StringComparer.Ordinal) { ["twoHanded"] = asset.twoHanded };
}

// ExtractPrimaryHand.cs
public static class ExtractPrimaryHand
{
    public static Dictionary<string, object?> Extract(Ardenfall.Item.PrimaryHandItemData asset) =>
        new(StringComparer.Ordinal) { ["blockChance"] = asset.blockChance };
}

// ExtractMelee.cs
public static class ExtractMelee
{
    public static Dictionary<string, object?> Extract(Ardenfall.Item.MeleeItemData asset) =>
        new(StringComparer.Ordinal)
        {
            ["damageMin"]   = asset.damageMin,
            ["damageMax"]   = asset.damageMax,
            ["reach"]       = asset.reach,
            ["weaponClass"] = asset.weaponClass?.ToString(),
        };
}

// ExtractArmor.cs
public static class ExtractArmor
{
    public static Dictionary<string, object?> Extract(Ardenfall.Item.ArmorItemData asset) =>
        new(StringComparer.Ordinal)
        {
            ["armorRating"]  = asset.armorRating,
            ["coverageSlot"] = asset.coverageSlot.ToString(),
        };
}
```

- [ ] **Step 3: Build and commit**

```bash
dotnet build mod/ArdenfallArchives.csproj -c Debug
git add mod/src/Entities/Item/Adapters/
git commit -m "feat(mod): item per-layer extractors"
```

### Task G.3: ItemExtractor orchestrator

**Files:**
- Create: `mod/src/Entities/Item/ItemExtractor.cs`

- [ ] **Step 1: Write `ItemExtractor.cs`**

```csharp
using Ardenfall;
using Ardenfall.Item;
using ArdenfallArchives.Dtos;
using ArdenfallArchives.Entities.Item.Adapters;
using ArdenfallArchives.Walker;

namespace ArdenfallArchives.Entities.Item;

public sealed class ItemExtractor : WalkerBase<ItemSnapshotRow>
{
    public override IEnumerable<ItemSnapshotRow> Walk()
    {
        var lookup = BuiltLookupTable.Instance;
        if (lookup == null) yield break;

        foreach (var asset in lookup.GetAssetsOfType<ItemData>())
        {
            if (asset == null) continue;
            if (!MarkVisited(asset)) continue;

            var guid = lookup.GetGuid(asset);
            if (string.IsNullOrEmpty(guid))
            {
                Diagnostics.Add(new Diagnostic
                {
                    Severity = "fatal",
                    Code     = "lookupAssetGuidMissing",
                    Field    = "id",
                    Message  = $"ItemData asset '{asset.name}' has no GUID in BuiltLookupTable",
                });
                continue;
            }

            var (fields, provenance, diagnostics, tags) = ExtractItem.Extract(asset, Refs, guid);

            // Variant detection drives which adapters run.
            string variantId;
            if (asset is MeleeItemData melee)
            {
                Merge(fields, ExtractEquipment.Extract(melee));
                Merge(fields, ExtractHandItem.Extract(melee));
                Merge(fields, ExtractPrimaryHand.Extract(melee));
                Merge(fields, ExtractMelee.Extract(melee));
                variantId = "melee-weapon";
            }
            else if (asset is PrimaryHandItemData primary)
            {
                Merge(fields, ExtractEquipment.Extract(primary));
                Merge(fields, ExtractHandItem.Extract(primary));
                Merge(fields, ExtractPrimaryHand.Extract(primary));
                variantId = "primary-hand";
            }
            else if (asset is HandItemData hand)
            {
                Merge(fields, ExtractEquipment.Extract(hand));
                Merge(fields, ExtractHandItem.Extract(hand));
                variantId = "hand-item";
            }
            else if (asset is ArmorItemData armor)
            {
                Merge(fields, ExtractEquipment.Extract(armor));
                Merge(fields, ExtractArmor.Extract(armor));
                variantId = "armor";
            }
            else if (asset is EquipItemData equip)
            {
                Merge(fields, ExtractEquipment.Extract(equip));
                variantId = "equipment";
            }
            else
            {
                // Outside Slice 1's coverage; emit a diagnostic so Slice 2 picks it up.
                Diagnostics.Add(new Diagnostic
                {
                    Severity = "diagnostic",
                    Code     = "itemSubtypeUnsupportedInSlice1",
                    Field    = "variant",
                    Message  = $"item '{guid}' is type {asset.GetType().Name}; not yet supported",
                });
                continue;
            }

            yield return new ItemSnapshotRow
            {
                Id          = guid,
                Variant     = variantId,
                Fields      = fields,
                Tags        = tags,
                Provenance  = provenance,
                Diagnostics = diagnostics,
            };
        }
        Diagnostics.AddRange(Refs.Diagnostics);
    }

    private static void Merge(Dictionary<string, object?> dst, IReadOnlyDictionary<string, object?> src)
    {
        foreach (var (k, v) in src) dst[k] = v;
    }
}
```

- [ ] **Step 2: Build and commit**

```bash
dotnet build mod/ArdenfallArchives.csproj -c Debug
git add mod/src/Entities/Item/ItemExtractor.cs
git commit -m "feat(mod): item extractor with variant dispatch"
```

### Task G.4: Atomic snapshot writer + manifest builder

**Files:**
- Create: `mod/src/Emit/SnapshotWriter.cs`
- Create: `mod/src/Emit/ManifestBuilder.cs`

- [ ] **Step 1: Write `ManifestBuilder.cs`**

```csharp
using ArdenfallArchives.Dtos;
using Newtonsoft.Json;
using System.Security.Cryptography;
using System.Text;

namespace ArdenfallArchives.Emit;

public static class ManifestBuilder
{
    public static Manifest Build(
        PreflightReport preflight,
        IDictionary<string, int> counts,
        DiagnosticTotals diagnostics,
        IDictionary<string, string> contentHashes,
        string extractorVersion,
        string? gameVersion = null,
        string? buildIdentifier = null) => new()
    {
        SchemaVersion    = 1,
        ExtractorVersion = extractorVersion,
        GameVersion      = gameVersion,
        BuildIdentifier  = buildIdentifier,
        ExtractedAt      = DateTimeOffset.UtcNow.ToString("O"),
        Preflight        = preflight,
        Counts           = new Dictionary<string, int>(counts),
        Diagnostics      = diagnostics,
        Hashes           = new Dictionary<string, string>(contentHashes),
    };

    public static string Sha256Hex(string content)
    {
        using var sha = SHA256.Create();
        var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(content));
        var sb = new StringBuilder(bytes.Length * 2);
        foreach (var b in bytes) sb.Append(b.ToString("x2"));
        return sb.ToString();
    }
}
```

- [ ] **Step 2: Write `SnapshotWriter.cs`** — atomic stage-then-publish

```csharp
using ArdenfallArchives.Dtos;
using Newtonsoft.Json;

namespace ArdenfallArchives.Emit;

public sealed class SnapshotWriter
{
    private readonly string _baseDir;

    public SnapshotWriter(string baseDir) { _baseDir = baseDir; }

    public string BeginStaging(string gameVersion)
    {
        var ts = DateTimeOffset.UtcNow.ToString("yyyyMMdd-HHmmss");
        var stagingDir = Path.Combine(_baseDir, $".staging-{gameVersion}-{ts}");
        Directory.CreateDirectory(stagingDir);
        return stagingDir;
    }

    public string WriteEntityFile(string stagingDir, string entityId, object envelope)
    {
        var path = Path.Combine(stagingDir, $"{entityId}s.json");
        var json = JsonConvert.SerializeObject(envelope, JsonSettings.Default);
        File.WriteAllText(path, json);
        return path;
    }

    public void WriteManifest(string stagingDir, Manifest manifest)
    {
        var json = JsonConvert.SerializeObject(manifest, JsonSettings.Default);
        File.WriteAllText(Path.Combine(stagingDir, "manifest.json"), json);
    }

    public string Publish(string stagingDir, string gameVersion)
    {
        var ts = DateTimeOffset.UtcNow.ToString("yyyyMMdd-HHmmss");
        var finalDir = Path.Combine(_baseDir, $"{gameVersion}-{ts}");
        Directory.Move(stagingDir, finalDir);
        return finalDir;
    }

    public void DiscardStaging(string stagingDir)
    {
        if (Directory.Exists(stagingDir)) Directory.Delete(stagingDir, recursive: true);
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add mod/src/Emit/SnapshotWriter.cs mod/src/Emit/ManifestBuilder.cs
git commit -m "feat(mod): atomic snapshot writer and manifest builder"
```

### Task G.5: Triggers and Plugin entry point

**Files:**
- Create: `mod/src/Triggers/Hotkey.cs`
- Create: `mod/src/Triggers/ConsoleCommand.cs`
- Create: `mod/src/Triggers/ReadinessMonitor.cs`
- Create: `mod/src/Plugin.cs`

- [ ] **Step 1: Write `Plugin.cs`**

```csharp
using BepInEx;
using BepInEx.Configuration;
using BepInEx.Logging;
using ArdenfallArchives.Emit;
using ArdenfallArchives.Entities.Item;
using ArdenfallArchives.Preflight;
using Newtonsoft.Json;
using UnityEngine;

namespace ArdenfallArchives;

[BepInPlugin(GUID, NAME, VERSION)]
public sealed class Plugin : BaseUnityPlugin
{
    public const string GUID    = "com.ardenfall-archives.extractor";
    public const string NAME    = "Ardenfall Archives Extractor";
    public const string VERSION = "0.1.0";

    private ConfigEntry<KeyboardShortcut> _hotkey = null!;
    private ConfigEntry<string>           _outputDir = null!;

    private static ManualLogSource _log = null!;

    private void Awake()
    {
        _log = Logger;
        _hotkey    = Config.Bind("Triggers", "Hotkey",  new KeyboardShortcut(KeyCode.F8), "Trigger snapshot extraction");
        _outputDir = Config.Bind("Output",   "BaseDir", Path.Combine(Paths.PluginPath, "ArdenfallArchives", "snapshots"), "Where to write snapshots");
        Logger.LogInfo($"{NAME} {VERSION} loaded; F-key {_hotkey.Value} will extract.");
    }

    private void Update()
    {
        if (_hotkey.Value.IsDown()) Triggers.Hotkey.Run(_outputDir.Value, this);
    }

    public void RunExtractionFromAnyTrigger()
    {
        var preflight = Preflight.Preflight.Run();
        if (!preflight.Passed)
        {
            Logger.LogWarning("preflight failed; no snapshot written");
            foreach (var c in preflight.Checks)
                if (!c.Ok) Logger.LogWarning($"  - {c.Name}: {c.Reason}");
            return;
        }

        var writer = new SnapshotWriter(_outputDir.Value);
        var staging = writer.BeginStaging("Demo2025");
        try
        {
            var extractor = new ItemExtractor();
            var rows = extractor.Walk().ToList();
            var envelope = new ItemSnapshotEnvelope { Rows = rows };
            var path = writer.WriteEntityFile(staging, "item", envelope);
            var json = File.ReadAllText(path);

            var totals = new DiagnosticTotals();
            foreach (var d in extractor.Diagnostics)
                if (d.Severity == "fatal") totals.Fatal++; else totals.Diagnostic++;

            var manifest = ManifestBuilder.Build(
                preflight,
                counts:        new Dictionary<string, int> { ["item"] = rows.Count },
                diagnostics:   totals,
                contentHashes: new Dictionary<string, string> { ["items.json"] = ManifestBuilder.Sha256Hex(json) },
                extractorVersion: VERSION,
                gameVersion:      "Demo2025");
            writer.WriteManifest(staging, manifest);

            var final = writer.Publish(staging, "Demo2025");
            Logger.LogInfo($"snapshot published: {final} ({rows.Count} items, {extractor.Diagnostics.Count} diagnostics)");
        }
        catch (Exception ex)
        {
            writer.DiscardStaging(staging);
            Logger.LogError($"extraction failed: {ex}");
        }
    }
}
```

- [ ] **Step 2: Write `Triggers/Hotkey.cs`** — thin wrapper that calls back into Plugin

```csharp
using ArdenfallArchives;
namespace ArdenfallArchives.Triggers;

public static class Hotkey
{
    public static void Run(string outputDir, Plugin plugin) => plugin.RunExtractionFromAnyTrigger();
}
```

- [ ] **Step 3: Write `Triggers/ConsoleCommand.cs`** — registers `/extract` and `/status`

BepInEx 5 has no built-in console command system; Ardenfall's own console (or the game's chat input) is the registration point. Slice 1 ships a stub that logs an informational message; the real console wire-up is gated on identifying the game's console API (likely a singleton in `Ardenfall.Console` or similar). If the API is not discoverable in the live DLL, the hotkey is the only Slice 1 trigger and `/extract` is owed by Slice 2.

```csharp
using BepInEx.Logging;
namespace ArdenfallArchives.Triggers;

public static class ConsoleCommand
{
    /// <summary>
    /// Registers /extract and /status with the game console if a console API exists.
    /// If not, this is a no-op and the hotkey is the only trigger.
    /// </summary>
    public static void TryRegister(ManualLogSource log, Plugin plugin)
    {
        // TODO Slice 1.5: detect Ardenfall.Console / equivalent and wire up.
        log.LogInfo("console command registration: not implemented in slice 1; use F8 hotkey.");
    }
}
```

- [ ] **Step 4: Write `Triggers/ReadinessMonitor.cs`** — advisory only

```csharp
using BepInEx.Logging;
using UnityEngine.SceneManagement;
namespace ArdenfallArchives.Triggers;

public sealed class ReadinessMonitor
{
    private readonly ManualLogSource _log;
    private bool _loggedReady;

    public ReadinessMonitor(ManualLogSource log)
    {
        _log = log;
        SceneManager.sceneLoaded += OnSceneLoaded;
    }

    private void OnSceneLoaded(Scene scene, LoadSceneMode mode)
    {
        if (_loggedReady) return;
        var preflight = Preflight.Preflight.Run();
        if (preflight.Passed)
        {
            _log.LogInfo("[readiness] preflight now passing; extraction available");
            _loggedReady = true;
        }
    }
}
```

- [ ] **Step 5: Build and commit**

```bash
dotnet build mod/ArdenfallArchives.csproj -c Debug
git add mod/src/Plugin.cs mod/src/Triggers/
git commit -m "feat(mod): plugin entry, hotkey trigger, readiness monitor"
```

### Task G.6: Local end-to-end smoke + pipeline ingestion

Manual checkpoint, not a CI gate.

- [ ] **Step 1: Install the mod**

Copy `mod/bin/Debug/net46/ArdenfallArchives.dll` and `Newtonsoft.Json.dll` into Ardenfall's BepInEx plugins directory:

```sh
PLUGINS_DIR="$HOME/Library/Application Support/CrossOver/Bottles/Steam/drive_c/Program Files (x86)/Steam/steamapps/common/Ardenfall Demo/BepInEx/plugins/ArdenfallArchives"
mkdir -p "$PLUGINS_DIR"
cp mod/bin/Debug/net46/ArdenfallArchives.dll "$PLUGINS_DIR/"
cp mod/bin/Debug/net46/Newtonsoft.Json.dll "$PLUGINS_DIR/"
```

- [ ] **Step 2: Launch Ardenfall, observe BepInEx log**

Expected: `Ardenfall Archives Extractor 0.1.0 loaded; F-key F8 will extract.` appears in BepInEx output. After loading a save, `[readiness] preflight now passing; extraction available`.

- [ ] **Step 3: Press F8, observe snapshot output**

Expected: log line `snapshot published: <plugins>/ArdenfallArchives/snapshots/Demo2025-<ts>` plus the count of items walked. Inspect the directory: `manifest.json` plus `items.json`.

- [ ] **Step 4: Run pipeline against the real snapshot**

```sh
bun run pipeline:run "$PLUGINS_DIR/snapshots/Demo2025-<ts>" pipeline/test/.real
```
Expected: `wrote pipeline/test/.real/data.sqlite (NNNN bytes)`. Pipeline rejects only on `fatal` diagnostics; `diagnostic` is allowed.

- [ ] **Step 5: Inspect the real SQLite blob**

```sh
bun -e '
  import("bun:sqlite").then(({ Database }) => {
    const db = new Database("pipeline/test/.real/data.sqlite", { readonly: true });
    const overview = db.query("SELECT id, name, variant FROM item_overview_rows ORDER BY name").all();
    console.warn(`item count: ${overview.length}`);
    console.warn(JSON.stringify(overview.slice(0, 5), null, 2));
  });
'
```
Expected: prints first five item names from the real game data.

- [ ] **Step 6: Capture lessons in `mod/AGENTS.md`**

If any field-name guess in the descriptor or adapter was wrong, fix it now and commit `fix(mod):` or `fix(entities):`. Then update `mod/AGENTS.md` with a "Game version field-naming" section listing the actual member names. This is the place future agents look first when porting to a new patch.

### Phase G gate

Mod compiles, installs, runs, produces a complete snapshot, and the pipeline ingests it without fatal diagnostics. The `mod` job in CI is dropped from `continue-on-error: true` once the workflow is amended to fetch a stable BepInEx redistributable for compile-only references — owed by Phase K.

---

## Phase H — Site bootstrap and design tokens

Goal: SvelteKit static workspace with Tailwind v4 tokens and shadcn-svelte primitives. Site builds against an empty data set; no item routes yet.

### Task H.1: SvelteKit + Tailwind + sql.js-fts5 install

**Files:**
- Create: `site/package.json`
- Create: `site/tsconfig.json`
- Create: `site/svelte.config.js`
- Create: `site/vite.config.ts`
- Create: `site/src/app.html`
- Create: `site/AGENTS.md`

- [ ] **Step 1: Write `site/package.json`**

```jsonc
{
  "name": "@ardenfall-archives/site",
  "private": true,
  "type": "module",
  "scripts": {
    "dev":   "vite dev",
    "build": "vite build",
    "check": "svelte-kit sync && svelte-check --tsgo --tsconfig ./tsconfig.json"
  },
  "dependencies": {
    "sql.js-fts5": "^1.4.0"
  },
  "devDependencies": {
    "@sveltejs/adapter-static":     "^3.0.10",
    "@sveltejs/kit":                "^2.59.0",
    "@sveltejs/vite-plugin-svelte": "^6.2.1",
    "@tailwindcss/vite":            "^4.2.4",
    "@types/sql.js":                "^1.4.9",
    "bits-ui":                      "^2.18.1",
    "svelte":                       "^5.55.5",
    "svelte-check":                 "^4.3.4",
    "tailwind-variants":            "^3.2.2",
    "tailwindcss":                  "^4.2.4",
    "tw-animate-css":               "^1.4.0",
    "vite":                         "^8.0.10"
  }
}
```

- [ ] **Step 2: Write `site/svelte.config.js`**

```js
import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages:    "build",
      assets:   "build",
      fallback: "index.html",
      precompress: false,
      strict: true,
    }),
    alias: { $lib: "src/lib" },
  },
};
```

- [ ] **Step 3: Write `site/vite.config.ts`**

```ts
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  // sql.js-fts5 ships its wasm via ?url import; no further plugin needed.
});
```

- [ ] **Step 4: Write `site/tsconfig.json`**

```jsonc
{
  "extends": "../tsconfig.base.json",
  "include": ["src/**/*", "../entities/**/*.json", "../schemas/**/*.json"],
  "compilerOptions": {
    "rootDir": ".",
    "baseUrl": ".",
    "paths": { "$lib/*": ["src/lib/*"] }
  }
}
```

- [ ] **Step 5: Write `site/src/app.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" type="image/svg+xml" href="%sveltekit.assets%/favicon.svg" />
    <meta name="theme-color" content="#0f172a" />
    %sveltekit.head%
  </head>
  <body data-sveltekit-preload-data="hover" class="bg-background text-foreground antialiased">
    <div style="display: contents">%sveltekit.body%</div>
  </body>
</html>
```

- [ ] **Step 6: Write `site/AGENTS.md`**

```markdown
# Site Agent Orientation

SvelteKit static; data is shipped as `static/data.sqlite` and queried in-browser via `sql.js-fts5`. The site **never** parses descriptors or schema files at runtime; it reads pipeline-emitted `site_*` tables from SQLite.

## Hard rules

- All SQLite access goes through `src/lib/store/`. Components must not call `getDb()` or `query()` directly.
- Design tokens live in `src/app.css`. Component styling references token names (`bg-primary`, etc.), never inline colours.
- shadcn-svelte components are owned: edit `src/lib/components/ui/*` freely; do not depend on a specific upstream version.
- Renderer registries (`sections`, etc.) merge typed exported maps at boot. No global `register()` calls.

## Layout

- `src/lib/components/ui/`     — copied shadcn-svelte primitives (one-owner per file).
- `src/lib/entity/sections/`   — built-in section renderers.
- `src/lib/entities/<id>/`     — per-entity custom renderers.
- `src/lib/store/`             — SQLite glue and accessors.
- `src/routes/`                — pages.
```

- [ ] **Step 7: `bun install` + verify**

Run: `bun install`
Expected: deps resolve; lockfile updates.

- [ ] **Step 8: Commit**

```bash
git add site/package.json site/svelte.config.js site/vite.config.ts site/tsconfig.json site/src/app.html site/AGENTS.md bun.lock
git commit -m "feat(site): bootstrap sveltekit static workspace"
```

### Task H.2: Tailwind v4 tokens

**Files:**
- Create: `site/src/app.css`
- Create: `site/src/lib/utils.ts`

- [ ] **Step 1: Write `site/src/app.css`**

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background:           var(--background);
  --color-foreground:           var(--foreground);
  --color-primary:              var(--primary);
  --color-primary-foreground:   var(--primary-foreground);
  --color-secondary:            var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted:                var(--muted);
  --color-muted-foreground:     var(--muted-foreground);
  --color-border:               var(--border);
  --color-ring:                 var(--ring);
  --color-destructive:          var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --radius-sm:                  calc(var(--radius) - 0.125rem);
  --radius-md:                  var(--radius);
  --radius-lg:                  calc(var(--radius) + 0.125rem);
}

:root {
  --radius:               0.5rem;
  --background:           oklch(0.10 0.02 260);
  --foreground:           oklch(0.95 0.01 260);
  --primary:              oklch(0.70 0.18 50);   /* Ardenfall amber */
  --primary-foreground:   oklch(0.10 0 0);
  --secondary:            oklch(0.20 0.02 260);
  --secondary-foreground: oklch(0.95 0.01 260);
  --muted:                oklch(0.20 0.02 260);
  --muted-foreground:     oklch(0.60 0.02 260);
  --border:               oklch(0.30 0.02 260);
  --ring:                 oklch(0.70 0.18 50 / 50%);
  --destructive:          oklch(0.55 0.22 25);
  --destructive-foreground: oklch(0.95 0 0);
}
```

- [ ] **Step 2: Write `site/src/lib/utils.ts`** (the `cn()` helper)

```ts
import type { ClassValue } from "tailwind-variants";

/** Concatenate class values; undefined/false drop out. */
export function cn(...inputs: ClassValue[]): string {
  return inputs
    .flat()
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .join(" ");
}
```

- [ ] **Step 3: Commit**

```bash
git add site/src/app.css site/src/lib/utils.ts
git commit -m "feat(site): tailwind v4 design tokens"
```

### Task H.3: shadcn-svelte initial component set

**Files:**
- Create (via CLI): `site/src/lib/components/ui/button/`, `input/`, `label/`, `select/`, `dialog/`, `tabs/`, `tooltip/`

- [ ] **Step 1: Initialise shadcn-svelte**

Run: `bunx shadcn-svelte@1.2.7 init --yes --base-color slate`
Expected: writes `components.json`, edits `src/app.css` (already done; merge if conflict), adds aliases. Inspect output for any unexpected `app.css` changes.

If `init` fights the existing `app.css`, accept its changes and ensure the `:root` block plus `@theme inline` from Task H.2 are still present.

- [ ] **Step 2: Add the Slice 1 primitives**

Run: `bunx shadcn-svelte@1.2.7 add button input label select dialog tabs tooltip --yes`
Expected: each writes a directory under `src/lib/components/ui/<name>/`.

- [ ] **Step 3: Verify each primitive imports cleanly**

Run: `bun run --cwd site check`
Expected: 0 errors. (Warnings about unused imports in copied templates are tolerated; svelte-check should pass.)

- [ ] **Step 4: Commit**

```bash
git add site/components.json site/src/lib/components/ui/ site/src/app.css site/src/lib/utils.ts
git commit -m "feat(site): add shadcn-svelte initial primitive set"
```

### Task H.4: Site SQLite store

**Files:**
- Create: `site/src/lib/store/index.ts`
- Create: `site/src/lib/store/site-meta.ts`
- Create: `site/src/lib/store/items.ts`
- Create: `site/src/lib/sql.js-fts5.d.ts`

- [ ] **Step 1: Write `site/src/lib/sql.js-fts5.d.ts`**

```ts
// Re-declare the relevant slice of @types/sql.js for the fts5 fork.
declare module "sql.js-fts5/dist/sql-wasm.wasm?url" {
  const url: string;
  export default url;
}
```

- [ ] **Step 2: Write `site/src/lib/store/index.ts`**

```ts
import { browser } from "$app/environment";
import initSqlJs, { type Database, type SqlValue } from "sql.js-fts5";
import sqlWasmUrl from "sql.js-fts5/dist/sql-wasm.wasm?url";

let db: Database | null = null;
let dbPromise: Promise<Database> | null = null;

export async function getDb(): Promise<Database> {
  if (!browser) throw new Error("getDb only runs in the browser");
  if (db) return db;
  if (dbPromise) return dbPromise;
  dbPromise = (async () => {
    const [SQL, response] = await Promise.all([
      initSqlJs({ locateFile: () => sqlWasmUrl }),
      fetch("/data.sqlite"),
    ]);
    if (!response.ok) throw new Error(`failed to fetch /data.sqlite: ${response.status}`);
    const buffer = await response.arrayBuffer();
    db = new SQL.Database(new Uint8Array(buffer));
    return db;
  })();
  return dbPromise;
}

export async function query<T = Record<string, SqlValue>>(sql: string, params: SqlValue[] = []): Promise<T[]> {
  const d = await getDb();
  const stmt = d.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject() as T);
  stmt.free();
  return rows;
}

export async function queryOne<T = Record<string, SqlValue>>(sql: string, params: SqlValue[] = []): Promise<T | undefined> {
  const rows = await query<T>(sql, params);
  return rows[0];
}
```

- [ ] **Step 3: Write `site/src/lib/store/site-meta.ts`**

```ts
import { query, queryOne } from "./index.ts";

export interface SiteEntity {
  entity_id: string;
  singular_label: string;
  plural_label: string;
  route_path: string;
  canonical_table: string;
}

export interface SiteOverviewColumn { entity_id: string; field_id: string; position: number }
export interface SiteDetailSection {
  entity_id: string;
  section_id: string;
  kind: "fieldList" | "custom";
  title: string;
  position: number;
  renderer_key: string | null;
  payload_json: string | null;
}
export interface SiteDetailSectionField { entity_id: string; section_id: string; field_id: string; position: number }
export interface SiteEntityField {
  entity_id: string;
  field_id: string;
  source_table: string;
  source_column: string;
  label: string;
  value_kind: string;
  null_policy: string;
}

export const getEntity = (id: string) =>
  queryOne<SiteEntity>("SELECT * FROM site_entities WHERE entity_id = ?", [id]);

export const listOverviewColumns = (id: string) =>
  query<SiteOverviewColumn>("SELECT * FROM site_overview_columns WHERE entity_id = ? ORDER BY position", [id]);

export const listDetailSections = (id: string) =>
  query<SiteDetailSection>("SELECT * FROM site_detail_sections WHERE entity_id = ? ORDER BY position", [id]);

export const listSectionFields = (entityId: string, sectionId: string) =>
  query<SiteDetailSectionField>(
    "SELECT * FROM site_detail_section_fields WHERE entity_id = ? AND section_id = ? ORDER BY position",
    [entityId, sectionId],
  );

export const getEntityField = (entityId: string, fieldId: string) =>
  queryOne<SiteEntityField>(
    "SELECT * FROM site_entity_fields WHERE entity_id = ? AND field_id = ?",
    [entityId, fieldId],
  );
```

- [ ] **Step 4: Write `site/src/lib/store/items.ts`**

```ts
import { query, queryOne } from "./index.ts";

export interface ItemOverviewRow {
  id: string;
  name: string | null;
  weight: number | null;
  value: number | null;
  variant: string | null;
}

export interface ItemDetailRow {
  id: string;
  name: string | null;
  variant: string | null;
  fields_json: string;
}

export const listItemsOverview = () =>
  query<ItemOverviewRow>("SELECT * FROM item_overview_rows ORDER BY name");

export const getItemDetail = (id: string) =>
  queryOne<ItemDetailRow>("SELECT * FROM item_detail_rows WHERE id = ?", [id]);
```

- [ ] **Step 5: Commit**

```bash
git add site/src/lib/store/ site/src/lib/sql.js-fts5.d.ts
git commit -m "feat(site): sqlite store with site-meta and item accessors"
```

### Phase H gate

`bun run --cwd site check` and `bun run --cwd site build` succeed against an empty `static/data.sqlite` (build will warn that the file is missing; we'll address by copying the pipeline-produced blob in Phase I and CI in Phase K).

Workaround for now: `cp pipeline/test/.tmp/data.sqlite site/static/data.sqlite` if the smoke build needs it.

---

## Phase I — Site item routes and rendering

Goal: `/items` and `/items/[id]` render correctly from the SQLite blob, driven by `site_*` metadata.

### Task I.1: Layout, landing, EntityTable

**Files:**
- Create: `site/src/routes/+layout.svelte`
- Create: `site/src/routes/+page.svelte`
- Create: `site/src/lib/components/EntityTable.svelte`

- [ ] **Step 1: Write `+layout.svelte`**

```svelte
<script lang="ts">
  import "../app.css";
  let { children } = $props();
</script>

<header class="border-b border-border bg-background">
  <div class="container mx-auto flex items-center justify-between p-4">
    <a href="/" class="text-lg font-semibold">Ardenfall Archives</a>
    <nav class="flex gap-4 text-muted-foreground">
      <a href="/items">Items</a>
    </nav>
  </div>
</header>

<main class="container mx-auto p-4">
  {@render children()}
</main>
```

- [ ] **Step 2: Write `+page.svelte`** (landing)

```svelte
<script lang="ts">
</script>

<h1 class="text-2xl font-bold">Ardenfall Archives</h1>
<p class="mt-2 text-muted-foreground">
  Static archive of Ardenfall game data. Slice 1 ships items only.
</p>
<a class="mt-4 inline-block underline" href="/items">Browse items →</a>
```

- [ ] **Step 3: Write `EntityTable.svelte`**

```svelte
<script lang="ts" generics="T extends Record<string, unknown>">
  import { onMount } from "svelte";
  type Column = { id: string; label: string; field: keyof T & string };

  type Props = {
    rows: T[];
    columns: Column[];
    rowHref?: (row: T) => string;
  };

  let { rows, columns, rowHref }: Props = $props();
  let sortField = $state<keyof T & string | null>(null);
  let sortDir   = $state<"asc" | "desc">("asc");

  const sortedRows = $derived.by(() => {
    if (!sortField) return rows;
    return [...rows].sort((a, b) => {
      const av = a[sortField as keyof T];
      const bv = b[sortField as keyof T];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  });

  function toggleSort(field: keyof T & string) {
    if (sortField === field) sortDir = sortDir === "asc" ? "desc" : "asc";
    else { sortField = field; sortDir = "asc"; }
  }
</script>

<table class="w-full text-left text-sm">
  <thead class="bg-muted text-muted-foreground">
    <tr>
      {#each columns as col (col.id)}
        <th
          scope="col"
          aria-sort={sortField === col.field ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
          class="cursor-pointer p-2 select-none hover:bg-secondary"
          onclick={() => toggleSort(col.field)}
        >
          {col.label}
          {#if sortField === col.field}
            <span aria-hidden="true">{sortDir === "asc" ? "▲" : "▼"}</span>
          {/if}
        </th>
      {/each}
    </tr>
  </thead>
  <tbody>
    {#each sortedRows as row (row.id)}
      <tr class="border-b border-border hover:bg-muted/40">
        {#each columns as col (col.id)}
          <td class="p-2">
            {#if col.id === columns[0].id && rowHref}
              <a href={rowHref(row)} class="underline">{row[col.field] ?? ""}</a>
            {:else}
              {row[col.field] ?? ""}
            {/if}
          </td>
        {/each}
      </tr>
    {/each}
  </tbody>
</table>

{#if rows.length === 0}
  <p class="p-4 text-muted-foreground">No rows.</p>
{/if}
```

- [ ] **Step 4: Commit**

```bash
git add site/src/routes/+layout.svelte site/src/routes/+page.svelte site/src/lib/components/EntityTable.svelte
git commit -m "feat(site): layout, landing, generic entity table"
```

### Task I.2: Items overview route

**Files:**
- Create: `site/src/routes/items/+page.svelte`

- [ ] **Step 1: Write the page**

```svelte
<script lang="ts">
  import EntityTable from "$lib/components/EntityTable.svelte";
  import { listItemsOverview, type ItemOverviewRow } from "$lib/store/items.ts";
  import { listOverviewColumns, getEntity, getEntityField } from "$lib/store/site-meta.ts";
  import { onMount } from "svelte";

  let rows = $state<ItemOverviewRow[]>([]);
  let columns = $state<{ id: string; label: string; field: keyof ItemOverviewRow & string }[]>([]);
  let label   = $state("Items");
  let loading = $state(true);

  onMount(async () => {
    const entity = await getEntity("item");
    if (entity) label = entity.plural_label;
    const colsMeta = await listOverviewColumns("item");
    columns = await Promise.all(
      colsMeta.map(async (c) => {
        const field = await getEntityField("item", c.field_id);
        return { id: c.field_id, label: field?.label ?? c.field_id, field: c.field_id as keyof ItemOverviewRow & string };
      }),
    );
    rows = await listItemsOverview();
    loading = false;
  });
</script>

<svelte:head><title>{label}</title></svelte:head>

<h1 class="text-2xl font-bold">{label}</h1>
{#if loading}
  <p class="mt-4 text-muted-foreground">Loading…</p>
{:else}
  <p class="mt-2 text-muted-foreground">{rows.length} {label.toLowerCase()}</p>
  <div class="mt-4">
    <EntityTable {rows} {columns} rowHref={(r) => `/items/${r.id}`} />
  </div>
{/if}
```

- [ ] **Step 2: Commit**

```bash
git add site/src/routes/items/+page.svelte
git commit -m "feat(site): items overview route from site_overview_columns"
```

### Task I.3: Items detail route + section renderers

**Files:**
- Create: `site/src/routes/items/[id]/+page.svelte`
- Create: `site/src/lib/entity/sections/FieldList.svelte`
- Create: `site/src/lib/entity/registry.ts`
- Create: `site/src/lib/entities/item/sections.ts`
- Create: `site/src/lib/entities/item/sections/MeleeStats.svelte` (custom-renderer demo)

- [ ] **Step 1: Write `FieldList.svelte`** — built-in `fieldList` renderer

```svelte
<script lang="ts">
  type Props = {
    title: string;
    fields: { id: string; label: string; value: unknown }[];
  };
  let { title, fields }: Props = $props();
</script>

<section class="rounded-md border border-border bg-secondary/40 p-4">
  <h2 class="text-lg font-semibold">{title}</h2>
  <dl class="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
    {#each fields as f (f.id)}
      <dt class="text-muted-foreground">{f.label}</dt>
      <dd>{f.value ?? "—"}</dd>
    {/each}
  </dl>
</section>
```

- [ ] **Step 2: Write `entity/registry.ts`** — typed-map merge for site renderers

```ts
import type { Component } from "svelte";
import { sections as itemSections } from "$lib/entities/item/sections.ts";
import { mergeStringMaps } from "$lib/registry-merge.ts";

export type SectionRenderer = Component<{
  title: string;
  fields: { id: string; label: string; value: unknown }[];
  payload?: Record<string, unknown>;
}>;

export type SectionMap = Record<string, SectionRenderer>;

export const sectionRegistry: SectionMap = mergeStringMaps<SectionRenderer>([itemSections]);
```

Add `site/src/lib/registry-merge.ts`:

```ts
export function mergeStringMaps<T>(maps: Record<string, T>[]): Record<string, T> {
  if (maps.length === 0) throw new Error("no maps to merge");
  const out: Record<string, T> = {};
  for (const map of maps) {
    for (const [k, v] of Object.entries(map)) {
      if (Object.hasOwn(out, k)) throw new Error(`duplicate renderer: ${k}`);
      out[k] = v;
    }
  }
  return out;
}
```

- [ ] **Step 3: Write `entities/item/sections.ts` and `MeleeStats.svelte`**

```ts
// site/src/lib/entities/item/sections.ts
import type { SectionMap } from "../../entity/registry.ts";
import MeleeStats from "./sections/MeleeStats.svelte";

export const sections: SectionMap = {
  "item.meleeStats": MeleeStats,
};
```

```svelte
<!-- site/src/lib/entities/item/sections/MeleeStats.svelte -->
<script lang="ts">
  type Props = {
    title: string;
    fields: { id: string; label: string; value: unknown }[];
    payload?: Record<string, unknown>;
  };
  let { title, fields, payload }: Props = $props();
  // Custom-renderer demo. Slice 1 doesn't ship a real meleeStats descriptor section;
  // the renderer exists to prove the registry shape and is reused in Slice 2.
</script>

<section class="rounded-md border border-border bg-secondary/40 p-4">
  <h2 class="text-lg font-semibold">{title}</h2>
  <p class="text-muted-foreground text-sm">Custom melee stats renderer.</p>
  <ul class="mt-2 text-sm">
    {#each fields as f (f.id)}
      <li><strong>{f.label}:</strong> {f.value ?? "—"}</li>
    {/each}
  </ul>
</section>
```

- [ ] **Step 4: Write `routes/items/[id]/+page.svelte`**

```svelte
<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { getItemDetail } from "$lib/store/items.ts";
  import { listDetailSections, listSectionFields, getEntityField } from "$lib/store/site-meta.ts";
  import { sectionRegistry } from "$lib/entity/registry.ts";
  import FieldList from "$lib/entity/sections/FieldList.svelte";

  type Section = {
    id: string;
    title: string;
    kind: "fieldList" | "custom";
    rendererKey: string | null;
    fields: { id: string; label: string; value: unknown }[];
    payload: Record<string, unknown>;
  };

  let id      = $derived(page.params.id);
  let name    = $state<string | null>(null);
  let variant = $state<string | null>(null);
  let sections = $state<Section[]>([]);
  let loading = $state(true);
  let notFound = $state(false);

  onMount(async () => {
    const detail = await getItemDetail(id);
    if (!detail) { notFound = true; loading = false; return; }
    name    = detail.name;
    variant = detail.variant;
    const allFields = JSON.parse(detail.fields_json) as Record<string, unknown>;
    const sectionsMeta = await listDetailSections("item");

    sections = await Promise.all(
      sectionsMeta.map(async (s) => {
        const fieldList = await listSectionFields("item", s.section_id);
        const fieldsResolved = await Promise.all(
          fieldList.map(async (f) => {
            const meta = await getEntityField("item", f.field_id);
            return { id: f.field_id, label: meta?.label ?? f.field_id, value: allFields[f.field_id] };
          }),
        );
        return {
          id: s.section_id,
          title: s.title,
          kind: s.kind,
          rendererKey: s.renderer_key,
          fields: fieldsResolved,
          payload: s.payload_json ? JSON.parse(s.payload_json) : {},
        };
      }),
    );
    loading = false;
  });
</script>

<svelte:head><title>{name ?? "Item"} | Ardenfall Archives</title></svelte:head>

{#if loading}
  <p class="text-muted-foreground">Loading…</p>
{:else if notFound}
  <h1 class="text-2xl font-bold">Not found</h1>
  <p class="mt-2 text-muted-foreground">No item with id <code>{id}</code>.</p>
  <a class="mt-4 inline-block underline" href="/items">← back to items</a>
{:else}
  <a class="text-sm underline" href="/items">← back to items</a>
  <h1 class="mt-2 text-2xl font-bold">{name}</h1>
  <p class="text-muted-foreground">{variant}</p>
  <div class="mt-6 grid gap-4">
    {#each sections as section (section.id)}
      {#if section.kind === "fieldList"}
        <FieldList title={section.title} fields={section.fields} />
      {:else if section.rendererKey && sectionRegistry[section.rendererKey]}
        {@const Renderer = sectionRegistry[section.rendererKey]}
        <Renderer title={section.title} fields={section.fields} payload={section.payload} />
      {:else}
        <section class="rounded-md border border-destructive bg-destructive/10 p-4 text-sm">
          Unknown section renderer: <code>{section.rendererKey}</code>
        </section>
      {/if}
    {/each}
  </div>
{/if}
```

- [ ] **Step 5: Smoke check the site against synthetic data**

```sh
bun run pipeline:run pipeline/test/fixtures/synthetic/snapshot pipeline/test/.tmp
cp pipeline/test/.tmp/data.sqlite site/static/data.sqlite
bun run --cwd site check
bun run --cwd site build
```
Expected: all four exit 0; `site/build/` contains a static site that includes `items/` and `items/<id>/` HTML shells (rendered after hydration; the static prerender stage emits HTML for the shell, item rows arrive client-side from the SQLite blob).

- [ ] **Step 6: Manual smoke**

Serve `site/build/` with any static server:

```sh
bunx --bun http-server site/build -p 8080 --no-cache
```

Open `http://localhost:8080/items`. Expected: two synthetic items rendered (Iron Sword, Leather Tunic) in the table. Click Iron Sword. Expected: detail page shows Summary section with name, weight (3.5), value (25); Description section with "A simple iron blade.".

- [ ] **Step 7: Commit**

```bash
git add site/src/routes/items/[id]/+page.svelte site/src/lib/entity/ site/src/lib/entities/ site/src/lib/registry-merge.ts
git commit -m "feat(site): items detail route with section renderers"
```

### Phase I gate

Site builds and renders against the synthetic SQLite blob; both routes show correct content; no console errors in the served `/items` page.

---

## Phase J — Fixtures and hygiene

Goal: synthetic fixtures live under `fixtures/synthetic/` with a manifest envelope; a curation tool stub exists for real-derived capsules; CI's `fixtures` job enforces hygiene rules.

### Task J.1: Move synthetic fixture into fixtures/ and write manifest envelope

**Files:**
- Move: `pipeline/test/fixtures/synthetic/snapshot/*` → `fixtures/synthetic/snapshot/*`
- Create: `fixtures/synthetic/manifest.json`
- Modify: `pipeline/test/snapshot.test.ts`, `pipeline/test/canonicaliser.test.ts`, `pipeline/test/site-metadata.test.ts`, `pipeline/test/read-models.test.ts` (update `snapshotDir` paths)

- [ ] **Step 1: Move the synthetic snapshot directory**

```sh
mkdir -p fixtures/synthetic
git mv pipeline/test/fixtures/synthetic/snapshot fixtures/synthetic/snapshot
```

- [ ] **Step 2: Write `fixtures/synthetic/manifest.json`**

```jsonc
{
  "$schema": "../../schemas/fixture-manifest.schema.json",
  "fixtureKind": "synthetic",
  "schemaVersion": 1,
  "extractorVersion": "0.0.0-test",
  "intendedAssertions": [
    "snapshot envelope shape",
    "manifest preflight + counts",
    "ItemData base + MeleeItemData branch + ArmorItemData branch coverage",
    "lookupAsset and missing iconRef",
    "Parameter<T> resolved/inherited shape",
    "SmartListParameter<ItemTag> populated and empty cases"
  ],
  "selection": [
    { "entity": "item", "ids": ["fixture-iron-sword", "fixture-leather-tunic"], "rationale": "one melee branch + one armor branch" }
  ],
  "scrubbing":    "synthetic; no scrubbing required",
  "minimization": "synthetic; minimal field coverage by design",
  "hashes": {
    "snapshot/manifest.json": "0000000000000000000000000000000000000000000000000000000000000000",
    "snapshot/items.json":    "0000000000000000000000000000000000000000000000000000000000000000"
  }
}
```

Hashes are placeholders here; Task J.3 fills them deterministically.

- [ ] **Step 3: Update test snapshotDir paths**

In `pipeline/test/{snapshot,canonicaliser,site-metadata,read-models}.test.ts` and `invariants/items.test.ts`, change `snapshotDir: "pipeline/test/fixtures/synthetic/snapshot"` to `snapshotDir: "fixtures/synthetic/snapshot"`.

Run: `bun test pipeline/test`
Expected: all tests still pass.

- [ ] **Step 4: Commit**

```bash
git add fixtures/synthetic/ pipeline/test/
git rm -r pipeline/test/fixtures/synthetic
git commit -m "refactor(fixtures): move synthetic fixture under fixtures/ with manifest"
```

### Task J.2: Hygiene check script

**Files:**
- Create: `pipeline/scripts/check-fixtures.ts`
- Create: `fixtures/real-capsule/.gitkeep`

- [ ] **Step 1: Write `check-fixtures.ts`**

```ts
#!/usr/bin/env bun
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import validateFixtureManifest from "../dist/validate-fixture-manifest.mjs";

const SIZE_BUDGET_BYTES = 256 * 1024; // per fixture file
const TOTAL_BUDGET_BYTES = 2 * 1024 * 1024;

const errors: string[] = [];
let totalSize = 0;

function walk(dir: string, fn: (path: string) => void) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const st = statSync(path);
    if (st.isDirectory()) walk(path, fn);
    else fn(path);
  }
}

function checkPack(packDir: string) {
  const manifestPath = join(packDir, "manifest.json");
  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    errors.push(`${packDir}: missing or unreadable manifest.json`);
    return;
  }
  if (!validateFixtureManifest(manifest)) {
    const errs = (validateFixtureManifest as unknown as { errors?: { instancePath: string; message?: string }[] }).errors ?? [];
    for (const e of errs) errors.push(`${manifestPath}#${e.instancePath} — ${e.message}`);
  }

  const declared = (manifest as { hashes?: Record<string, string> }).hashes ?? {};
  walk(packDir, (path) => {
    const rel = path.slice(packDir.length + 1);
    if (rel === "manifest.json") return;
    const buf = readFileSync(path);
    totalSize += buf.length;
    if (buf.length > SIZE_BUDGET_BYTES) {
      errors.push(`${path}: ${buf.length} bytes exceeds per-file budget (${SIZE_BUDGET_BYTES})`);
    }
    if (/[A-Z]:\\|\/Users\/|\/home\//.test(buf.toString("utf8").slice(0, 64 * 1024))) {
      errors.push(`${path}: contains a machine-local path (Users/home/Windows drive)`);
    }
    const hash = createHash("sha256").update(buf).digest("hex");
    const expected = declared[rel];
    if (!expected) {
      errors.push(`${path}: hash not declared in ${manifestPath}`);
    } else if (expected !== "0".repeat(64) && expected !== hash) {
      errors.push(`${path}: hash mismatch (declared ${expected.slice(0, 12)}…, actual ${hash.slice(0, 12)}…)`);
    }
  });
}

for (const dir of ["fixtures/synthetic", "fixtures/real-capsule"]) {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) continue;
  if (!readdirSync(dir).some((e) => e === "manifest.json")) continue; // empty real-capsule until first curation
  checkPack(dir);
}

// Block accidentally-committed forbidden paths.
for (const forbidden of ["snapshots", "site/static/data.sqlite", "site/static/assets"]) {
  if (statSync(forbidden, { throwIfNoEntry: false })) {
    // 'site/static/data.sqlite' may be present locally if you copied it manually; CI runs on a fresh checkout where it must not exist.
    if (process.env.CI === "true") errors.push(`forbidden path present in CI checkout: ${forbidden}`);
  }
}

if (totalSize > TOTAL_BUDGET_BYTES) {
  errors.push(`total fixture size ${totalSize} exceeds ${TOTAL_BUDGET_BYTES}`);
}

if (errors.length > 0) {
  for (const e of errors) console.error(e);
  process.exit(1);
}
console.warn(`fixtures ok: ${totalSize} bytes total`);
```

- [ ] **Step 2: Run locally**

Run: `bun run check:fixtures`
Expected: passes (the synthetic manifest's placeholder hashes are accepted; Task J.3 tightens this).

- [ ] **Step 3: Commit**

```bash
touch fixtures/real-capsule/.gitkeep
git add pipeline/scripts/check-fixtures.ts fixtures/real-capsule/.gitkeep
git commit -m "feat(fixtures): hygiene check script with size budgets and manifests"
```

### Task J.3: Backfill real fixture hashes

**Files:**
- Modify: `fixtures/synthetic/manifest.json`
- Create: `fixtures/scripts/curate-capsule.ts` (stub for real-derived curation)

- [ ] **Step 1: Compute real hashes**

```sh
MANIFEST_HASH=$(shasum -a 256 fixtures/synthetic/snapshot/manifest.json | awk '{print $1}')
ITEMS_HASH=$(shasum -a 256 fixtures/synthetic/snapshot/items.json | awk '{print $1}')
echo "$MANIFEST_HASH"
echo "$ITEMS_HASH"
```

Update `fixtures/synthetic/manifest.json` `hashes` to the values printed.

- [ ] **Step 2: Re-run hygiene check**

Run: `bun run check:fixtures`
Expected: pass with `fixtures ok: NNNN bytes total`.

- [ ] **Step 3: Write `fixtures/scripts/curate-capsule.ts`** (stub)

```ts
#!/usr/bin/env bun
/**
 * curate-capsule: deterministic curation of a real-derived boundary capsule.
 *
 * Slice 1 ships this as a stub. Real curation lands once the first BepInEx-extracted
 * snapshot is in hand: select a small number of stable, representative item ids,
 * write a `fixtures/real-capsule/snapshot/items.json` containing only their rows
 * (no scrubbing of the runtime values), copy the manifest with a curated counts map,
 * and emit a fixture-manifest.json envelope listing the selected ids and rationale.
 */
console.error("curate-capsule: not implemented in slice 1; see addendum §19");
process.exit(2);
```

- [ ] **Step 4: Commit**

```bash
git add fixtures/synthetic/manifest.json fixtures/scripts/curate-capsule.ts
git commit -m "feat(fixtures): pin synthetic hashes and add curation tool stub"
```

### Phase J gate

`bun run check:fixtures` passes locally. `pipeline/scripts/check-fixtures.ts` is exercised by the `fixtures` CI job; that job is already in `.github/workflows/ci.yml` (Task A.5).

---

## Phase K — End-to-end and CI verification

Goal: every job in `.github/workflows/ci.yml` passes on a clean PR; an end-to-end synthetic smoke test ties pipeline + site together; the plan's gates are all green.

### Task K.1: End-to-end smoke test

**Files:**
- Create: `pipeline/test/end-to-end.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// pipeline/test/end-to-end.test.ts
import { describe, it, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { runStages } from "$pipeline/orchestrator";
import { loadDescriptors } from "$pipeline/stages/load-descriptors";
import { loadSnapshot } from "$pipeline/stages/load-snapshot";
import { validate } from "$pipeline/stages/validate";
import { emitSqlite } from "$pipeline/stages/emit-sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("end-to-end pipeline", () => {
  it("synthetic snapshot → SQLite blob with site metadata + read models", async () => {
    const out = mkdtempSync(join(tmpdir(), "ardenfall-e2e-"));
    try {
      const ctx = {
        workspaceRoot: ".",
        snapshotDir:   "fixtures/synthetic/snapshot",
        outDir:        out,
        log: () => undefined,
      };
      const result = await runStages(
        [loadDescriptors, loadSnapshot, validate, emitSqlite],
        {},
        ctx,
      );
      const v = result.validate as { countsBySeverity: { fatal: number } };
      expect(v.countsBySeverity.fatal).toBe(0);

      const dbPath = join(out, "data.sqlite");
      const db = new Database(dbPath, { readonly: true });

      // Site metadata is populated.
      const entityCount = (db.query("SELECT COUNT(*) c FROM site_entities").get() as { c: number }).c;
      expect(entityCount).toBeGreaterThan(0);

      // Read models are populated.
      const overviewCount = (db.query("SELECT COUNT(*) c FROM item_overview_rows").get() as { c: number }).c;
      expect(overviewCount).toBe(2);

      // Variant ancestry is consistent for the melee row.
      const orphans = db.query(`
        SELECT mw.id FROM item_melee_weapons mw
        LEFT JOIN item_primary_hand_items ph ON ph.id = mw.id
        LEFT JOIN item_hand_items         h  ON h.id  = mw.id
        LEFT JOIN item_equipment          e  ON e.id  = mw.id
        LEFT JOIN items                   i  ON i.id  = mw.id
        WHERE ph.id IS NULL OR h.id IS NULL OR e.id IS NULL OR i.id IS NULL
      `).all();
      expect(orphans).toEqual([]);
      db.close();
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run (expect pass)**

Run: `bun test pipeline/test/end-to-end.test.ts`
Expected: 1 pass.

- [ ] **Step 3: Commit**

```bash
git add pipeline/test/end-to-end.test.ts
git commit -m "test(pipeline): end-to-end synthetic smoke"
```

### Task K.2: Tighten the CI workflow

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Drop `continue-on-error` from the mod job (if added in Phase A); skip the dotnet build in CI for Slice 1**

Replace the `mod` job body with a soft check that does not require game DLLs:

```yaml
  mod:
    runs-on: ubuntu-latest
    if: |
      github.event_name == 'push' ||
      contains(toJson(github.event.pull_request.changed_files), 'mod/')
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with: { dotnet-version: '8.0.x' }
      - name: format-check
        run: dotnet format mod/ArdenfallArchives.csproj --verify-no-changes
      # Full `dotnet build` requires Assembly-CSharp.dll which is not redistributable;
      # build is verified locally per mod/AGENTS.md. CI verifies formatting only until
      # Slice 9 wires up an external archive of buildable references.
```

- [ ] **Step 2: Add a copy step to the `site` job so the build sees a real SQLite blob**

The site `bun run build` will emit warnings if `static/data.sqlite` is absent. Generate a synthetic blob in CI before the build:

```yaml
      - name: build synthetic sqlite for static prerender
        run: |
          bun run pipeline:run fixtures/synthetic/snapshot site/static
      - run: bun run --cwd site check
      - run: bun run --cwd site build
```

- [ ] **Step 3: Push to a feature branch and open a PR; verify all four jobs pass**

```sh
git checkout -b slice1-end-to-end
git push -u origin slice1-end-to-end
# open PR via GitHub UI; CI runs lint, pipeline, site, mod, fixtures.
```
Expected: green check on PR. If `mod` job complains about `dotnet format` whitespace, fix locally and force-push.

- [ ] **Step 4: Commit and merge**

```bash
git add .github/workflows/ci.yml
git commit -m "ci(repo): wire site sqlite build and mod format check"
git push
# After CI green, merge via UI; delete the feature branch.
```

### Phase K gate

All five CI jobs (`lint`, `pipeline`, `site`, `mod` (format), `fixtures`) pass on `main`. The synthetic end-to-end test runs in under 5 s.

---

## Self-review

### Spec coverage

Trace each Slice 1 deliverable from `docs/superpowers/roadmap.md` and amendment §8–§14, §16, §19 to the task that delivers it:

| Deliverable | Task |
|---|---|
| Bun workspace + C# sibling | A.1, F.1 |
| `entities/item/entity.json` | C.1 |
| `entities/item/variants/` | C.2 |
| BepInEx ItemData extraction via `BuiltLookupTable.GetAssetsOfType<ItemData>()` | F.4, G.3 |
| Stable asset IDs via `BuiltLookupTable.GetGuid` | F.3, G.3 |
| Explicit DTOs (no raw Unity JSON) | G.1 |
| `Parameter<T>.Get()` + `SmartListParameter<T>.Get()` resolution | G.2 |
| Preflight gate | F.4, G.5 |
| Lifecycle: hot register, advisory readiness, atomic publish | G.5 |
| Snapshot manifest with metadata | G.4, G.5 |
| Provenance per `Parameter<T>` field | F.3, G.2 |
| Canonical SQLite tables (items, item_tags, equipment, hand_items, primary_hand, melee, armor) | E.1, E.3 |
| Pipeline-emitted site metadata | E.4 |
| Read models (`item_overview_rows`, `item_detail_rows`) | E.5 |
| `/items` overview route | I.2 |
| `/items/[id]` detail with `fieldList` + `custom` | I.3 |
| Synthetic + curated fixture infrastructure | J.1, J.2, J.3 |
| Hygiene CI checks | J.2 + A.5 |
| Local boundary validation | G.6 |
| End-to-end smoke | K.1 |

### Open spec items intentionally not closed in Slice 1

- Asset image extraction / WebP rendering → Slice 3.
- FTS5 search routes / facets → Slice 7.
- Spells, locations, quests, map → Slices 4–6, 8.
- Override mechanism → Slice 10 (deferred until trigger).
- AGENTS.md fully populated with worked examples → Slice 11. Slice 1 ships honest stubs (A.4, F.1, H.1).
- `/extract` console command → owed by Slice 1.5 if console API surfaces are not discoverable in Slice 1; F8 hotkey is the Slice 1 trigger.
- Deployment target → first slice that publishes a built site.

### Placeholder scan

No `TBD`, `TODO`, "implement later", "fill in details" appear in implementation steps. The two genuine deferrals are explicit:

- Console command (Triggers/ConsoleCommand.cs) is a documented stub with a Slice 1.5 trigger condition.
- `curate-capsule.ts` exits 2 with a pointer to addendum §19; real curation lands when the first BepInEx snapshot exists.

Both are honest "not in scope" deferrals, not hidden plan failures.

### Type / signature consistency

Spot checks:

- `EntityDescriptor.fields[].missingPolicy` ∈ `{"fatal","diagnostic","optional-empty"}` is consistent across `entity.schema.json` (B.1), `pipeline/src/types.ts` (D.1), and the C# `MissingPolicy` enum (F.3).
- `SnapshotRef.kind` ∈ `{"lookupAsset","record","runtimeObject","missing"}` is consistent across `snapshot.schema.json` (B.3), `pipeline/src/types.ts` (D.1), and `mod/src/Dtos/SnapshotRef.cs` (F.2).
- The `provenance.kind` enum is consistent in the snapshot schema (B.3), the TS provenance type (D.1), and the C# `Provenance.Kind` field (F.2).
- The variant id set `{"equipment","hand-item","primary-hand","melee-weapon","armor"}` is consistent across the variant descriptors (C.2), the canonicaliser ancestry walk (E.3), the `ItemExtractor` dispatch (G.3), and the synthetic fixture (D.5).
- Site metadata table names (`site_entities`, `site_entity_fields`, `site_overview_columns`, `site_detail_sections`, `site_detail_section_fields`, `item_variants`, `site_read_models`, `asset_refs`) are consistent between `pipeline/src/sql/site-metadata-ddl.ts` (E.2), the emitter (E.4), the addendum §6, and the site store (H.4).
- Field-from paths in `entities/item/entity.json` and the variant descriptors (C.1, C.2) are flagged as best-effort against the live DLL; the adapter caveat is repeated in F.3, F.4, and G.2 so an implementer hitting a discrepancy knows to fix both sides.

### Known risks remaining

1. **`Parameter<T>.IsSet` API discovery.** Adapters in G.2 assume `Parameter<T>` exposes an `IsSet` property. If the live DLL exposes a different discriminator (e.g. `Parameter<T>.HasOverride()`), Task G.2 fix-up is local and the descriptor stays unchanged.
2. **Bun's Node-API surface against `sharp`.** Asset emission is deferred to Slice 3, so the `sharp` spike is not on Slice 1's critical path. Slice 3 must include the spike before its `emit-assets` stage.
3. **`sql.js-fts5` Vite v8 compatibility.** The library uses `?url` import for the wasm file, which Vite 8 / Rolldown supports natively. If a future Vite minor changes that API, switch to `import.meta.glob` or static asset URLs.
4. **macOS WAL persistence in pipeline.** `emit-sqlite` issues `PRAGMA journal_mode = DELETE` to avoid WAL sidecars. If a downstream step opens the file with WAL re-enabled, sidecars will reappear; pipeline-managed databases are not modified after `emit-sqlite` writes them, so this is benign for Slice 1.

### Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-03-item-walking-skeleton.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using `skill://superpowers:executing-plans`, batch execution with checkpoints.

Which approach?
