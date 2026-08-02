# Repo Agent Orientation

This repository is the static compendium for the game Ardenfall. The durable rules live in this file and the subsystem `AGENTS.md` files; `docs/plans/` holds planning specs and plans that are scaffolding (they get archived once delivered), so treat them as background, not as the source of truth.

## Where to look first

- Living roadmap (delivered and planned state): `docs/plans/2026-04-29-ardenfall-compendium-roadmap.md`

## Subsystem entry points

- `mod/AGENTS.md` — BepInEx walker, DTOs, snapshot writer.
- `pipeline/AGENTS.md` — descriptor loader, stage orchestrator, canonicaliser, site-metadata emitter.
- `site/AGENTS.md` — SvelteKit pages, store accessors, design tokens, deck.gl map.

## Commands

- Pipeline: `bun test pipeline/test` · Site: `bun run --cwd site check` and `bun test site/test` · Mod (C#): `dotnet test mod-tests/ArdenfallCompendium.Tests.csproj --nologo -v q` · Controller: `bun test controller/test`.
- Repo-wide: `bun run typecheck` · `bun run lint` · `bun run format` · `bun run check:fixtures` · `bun run codegen:validators`.
- Site dev server: `bun run dev`.
- Before yielding non-trivial work, run the full gate (the scoped tests above plus `bun run artifact:fixture synthetic fixtures/synthetic/snapshot`, `bun run --cwd site build:fixture`, `bun run --cwd site smoke:prerender`, `bun run format:check`, `bun run lint`, `git diff --check`). Commit through `skill://commit`; never bypass hooks with `--no-verify`.

## Live data and game logic

- Live extraction is automated. With a configured repo-root `.env` (game paths, `HOTREPL_URL`, launch command), run `bun run hotrepl:setup` (build + deploy the mod), `bun run hotrepl:launch` (start the game), then `bun run hotrepl:export` (drive HotRepl → snapshot → pipeline; see `controller/src/export-orchestrator.ts` for the step sequence).
- `hotrepl:deploy` rewrites the game's `hotrepl.bepinex.cfg` from `HOTREPL_BIND_HOST` and `HOTREPL_PORT` (default `18590`). If another HotRepl-instrumented game already holds the default port, set `HOTREPL_PORT` and the matching `HOTREPL_URL` in `.env` rather than hand-editing the config, which every deploy overwrites. Two games claiming one port do not error: connections land on whichever bound first, so an export can silently target the wrong game.
- Probe a running game directly with HotRepl. Use the **CLI** for interactive C# eval/inspection (`hotrepl eval '<C#>'`, `describe`, `watch`) and `@hotrepl/sdk` for automation; do not use the MCP server. The HotRepl checkout is `$HOTREPL_REPO`. The world must be loaded (`compendium.continueFromMenu`) before `worldData`/records are reachable.
- Ground game-logic decisions in the decompiled source, not guesses. The gitignored cache lives at `.decompiled/<gameVersion>-<sha>/` (regenerate with `bun run decompile:game`). Never commit decompiled source, raw game JSON, snapshots, or generated databases.

## Non-negotiable invariants

- The descriptor at `entities/<id>/entity.json` is the only cross-subsystem source of truth for entity shape. Do not duplicate it in TS, SQL, or C#.
- Filesystem is the registry. Do not maintain manual indexes, enums, or unions of entity ids.
- The site reads pipeline-emitted SQLite metadata only. It does not parse descriptors directly.
- No raw Unity / Odin / game-object JSON in snapshots. The mod walks live runtime graphs and emits explicit DTOs.
- Public presentation and link contracts are generated pipeline data. The site renders typed read models, rich-text nodes, and relationship edges; it does not render raw TMP/HTML or infer durable cross-entity links in route code.
- Public contract replacements are clean cutovers. When a new read model, route contract, or shared UI primitive replaces an old one, remove the old public fallback/plumbing in the same slice; use private `_debug_*` views or diagnostics for temporary inspection.
- Fail fast instead of adding secondary discovery paths, guessed identifiers, or silent fallbacks. Missing source-of-truth data should produce diagnostics or fail the slice; recovery logic is acceptable only when it is an explicit, continuously verified contract.
- Pre-commit runs Prettier, ESLint, and `dotnet format` via lefthook. Do not bypass with `--no-verify` for routine work.
- Generated deploy artifacts are identified by `artifact-manifest.json`. Production deploys consume only release artifacts under `pipeline/artifacts/releases/*`; fixture artifacts under `pipeline/artifacts/fixtures/*` are never deployable.
- `site/static` is a staging cache populated from a validated artifact. Do not treat it as source-of-truth and do not manually edit generated files there.

## Environment variables and `bun run`

`bun run <script>` does NOT auto-load `.env` files before invoking the script
body (oven-sh/bun#23962). Bun does load `.env` for its own runtime
(`process.env` in `bun -e ...` or `bun file.ts`), but the shell command in a
package.json script runs in a child environment that does not see it.

To bridge the gap, every package.json script that depends on values from
`.env` is routed through `scripts/with-env.sh`, which sources the repo-root
`.env` (if present) and `exec`s the rest of its arguments. New env-dependent
scripts MUST use the same wrapper — never assume `bun run` will surface
`.env` for you.

Pattern:

```json
"my:task": "scripts/with-env.sh bash -c ': \"${REQUIRED:?set REQUIRED}\"; ...'"
```

CI and contributors who export variables directly (or use direnv) are
unaffected — the wrapper is a no-op when `.env` is absent.

If you find this document outdated, update it in the same commit as the change that outdates it.
