# Repo Agent Orientation

## Where to look first

- Living roadmap: `docs/plans/2026-04-29-ardenfall-compendium-roadmap.md`

## Subsystem entry points

- `mod/AGENTS.md` — BepInEx walker, DTOs, and snapshot writer.
- `pipeline/AGENTS.md` — descriptor loader, stage orchestrator, canonicaliser, and site-metadata emitter.
- `site/AGENTS.md` — SvelteKit pages, store accessors, design tokens, and deck.gl map.

## Commands

- Pipeline: `bun test pipeline/test` · Site: `bun run --cwd site check` and `bun test site/test` · Mod (C#): `dotnet test mod-tests/ArdenfallCompendium.Tests.csproj --nologo -v q` · Controller: `bun test controller/test` · Cross-package: `bun test tooling.test.ts artifact-staging.test.ts`.
- Repo-wide: `bun run typecheck` · `bun run lint` · `bun run format` · `bun run check:fixtures` · `bun run codegen:validators`.
- `bun run typecheck` checks root tooling, standalone TypeScript scripts, `pipeline`, and `controller`. The site is typechecked separately with `bun run --cwd site check`. Run both.
- Keep TypeScript on version 6. `svelte-check` peers `^5 || ^6`, and `typescript-eslint` peers `<6.1.0`.
- Site dev server: `bun run dev`.
- Before yielding non-trivial work, run the full gate:
  - Run the scoped tests above.
  - Run `bun run artifact:fixture synthetic fixtures/synthetic/snapshot`.
  - Run `bun run --cwd site build:fixture`.
  - Run `bun run --cwd site smoke:prerender`.
  - Run `bun run --cwd site smoke:pagefind`.
  - Run `bun run format:check`.
  - Run `bun run lint`.
  - Run `git diff --check`.
- Commit through `skill://commit`.

## Live data and game logic

- For live extraction, use `skill://live-extraction`.

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
