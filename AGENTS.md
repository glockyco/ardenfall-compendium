# Repo Agent Orientation

## Where to look first

- `openspec/specs/` — what the compendium must do now, one file per capability.
- `openspec/changes/` — work in flight, with its tasks. Run `openspec list` for status.
- `openspec/changes/archive/` — a delivered change, with the evidence that proved it.

A requirement about the compendium lives in a spec. A measurement lives in the change that measured it, or in the artifact that emits it. Neither lives in prose elsewhere.

## Subsystem entry points

- `mod/AGENTS.md` — BepInEx walker, DTOs, and snapshot writer.
- `pipeline/AGENTS.md` — descriptor loader, stage orchestrator, canonicaliser, and site-metadata emitter.
- `site/AGENTS.md` — SvelteKit pages, store accessors, design tokens, and deck.gl map.

## Toolchain

`flake.nix` pins every tool this repository needs: Bun, Node, the .NET SDK, `ilspycmd` and `sqlite3`. Enter the shell with `nix develop`, or let direnv enter it from `.envrc`. Every command below assumes that shell.

Node is separate from Bun on purpose. `vite build` spawns Node, so SvelteKit prerendering uses the `better-sqlite3` branch of `site/src/lib/server/db.ts` instead of the `bun:sqlite` one.

The dev shell and `.github/workflows/ci.yml` pin their versions independently. Keep both sides in step when either moves.

Git hooks run their tools through `nix develop`, so a commit works from a GUI client or an agent shell that has no toolchain on PATH. Never put machine-specific paths in `lefthook.yml`.

## Commands

- Pipeline: `bun test pipeline/test` · Site: `bun run --cwd site check` and `bun test site/test` · Mod (C#): `dotnet test mod-tests/ArdenfallCompendium.Tests.csproj --nologo -v q` · Controller: `bun test controller/test` · Cross-package: `bun test tooling.test.ts artifact-staging.test.ts`.
- Repo-wide: `bun run typecheck` · `bun run lint` · `bun run format` · `bun run check:fixtures` · `bun run codegen:validators`.
- `bun run typecheck` checks root tooling, standalone TypeScript scripts, `pipeline`, and `controller`. The site is typechecked separately with `bun run --cwd site check`. Run both.
- Keep TypeScript on version 6. `svelte-check` peers `^5 || ^6`, and `typescript-eslint` peers `<6.1.0`.
- Site dev server: `bun run dev`.
- Before yielding non-trivial work, run the full gate:
  - Run the scoped tests above.
  - Run `bun run typecheck` and `bun run --cwd site check`.
  - Run `bun run artifact:fixture synthetic fixtures/synthetic/snapshot`.
  - Run `bun run --cwd site build:fixture`.
  - Run `bun run --cwd site smoke:accessibility`.
  - Run `bun run --cwd site smoke:error-route`.
  - Run `bun run --cwd site smoke:map`.
  - Run `bun run --cwd site smoke:pagefind`.
  - Run `bun run --cwd site smoke:prerender`.
  - Run `bun run check:entity-fields`.
  - Run `bun run check:fixtures`. A shell that exports `CI=true` makes this check reject a local
    checkout that holds live outputs, such as `snapshots`, `site/.data/data.sqlite`, and
    `site/static/assets`. Run it with `CI=false` in that shell; never delete live outputs to pass it.
  - Run `bun run check:validators`.
  - Run `bun run lint` and `bun run format:check`.
  - Run `git diff --check`.
- Commit through `skill://commit-policy`.

## Live data and game logic

- For live extraction, use `skill://live-extraction`.

## What counts as verified

The gate above proves the fixture path. It does not prove the compendium, because the fixture is a set of shapes we chose and the game is not. Every defect listed in the roadmap's Slice 8.5 evidence was found by one of the three steps below and by none of the tests.

- **Export from the running game.** Two whole families were missing from every live snapshot while every test passed, and a family that reaches no map layer was silent. `bun run hotrepl:export` costs about two minutes; `--no-quit` exports twice in one session, which is how reproducibility is checked.
- **Build the site from a release artifact.** Staging refuses a dirty tree, so this also proves the artifact's provenance. Live data carries shapes no fixture had: two items under one name, 95 races with no name, a variant referencing one name set twice.
- **Open the result in a browser.** Prerendered HTML hides hydration errors. A keyed `{#each}` with duplicate keys crashed a published race page while its HTML looked correct and every smoke passed.

When live data exposes a shape the fixture lacks, add it to `fixtures/synthetic/snapshot` in the same change, so the next regression is caught by CI rather than by a browser.

## Non-negotiable invariants

- The descriptor's `site.route` decides whether an entity gets a public page. Start page work in the descriptor, not in a route file.
- The descriptor filesystem under `entities/<id>/entity.json` is the entity registry for discovery. Do not maintain manual indexes, enums, or unions of descriptor ids.
- Synthetic fixtures must preserve awkward live-data shapes, including nameless rows and absent references.
- The site reads pipeline-emitted SQLite metadata only. It does not parse descriptors directly.
- Public presentation and link contracts are generated pipeline data. The site renders typed read models, rich-text nodes, and relationship edges. It does not render raw TMP/HTML or infer durable cross-entity links in route code.
- Public contract replacements are clean cutovers. When a new read model, route contract, or shared UI primitive replaces an old one, remove the old public fallback in the same slice. Use private `_debug_*` views or diagnostics for temporary inspection.

## Environment variables and `bun run`

`bun run <script>` does not auto-load `.env` files into the script body (oven-sh/bun#23962). Bun loads `.env` for its own runtime, such as `process.env` in `bun -e ...` or `bun file.ts`. A package script runs in a child environment that does not receive those values.

Route every package script that depends on `.env` through `scripts/with-env.sh`. The wrapper sources the repo-root `.env`, when present, and then runs the command. New environment-dependent scripts must use this wrapper.

Pattern:

```json
"my:task": "scripts/with-env.sh bash -c ': \"${REQUIRED:?set REQUIRED}\"; ...'"
```

CI and contributors that export variables directly, or use direnv, are unaffected. The wrapper is a no-op when `.env` is absent.

If this guide becomes outdated, update it in the same commit as the change that makes it outdated.
