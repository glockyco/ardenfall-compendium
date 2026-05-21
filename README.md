# Ardenfall Compendium

Static, agentic-first wiki and interactive map for the Unity-Mono game **Ardenfall** (Spellcast Studios).

## Repository shape

| Path                | Subsystem                                                                                         | Toolchain           |
| ------------------- | ------------------------------------------------------------------------------------------------- | ------------------- |
| `mod/`              | BepInEx 5 plugin that walks live game objects and emits JSON snapshots                            | C# / `dotnet build` |
| `pipeline/`         | TypeScript pipeline that validates snapshots and produces canonical SQLite + WebP assets          | Bun                 |
| `controller/`       | HotRepl controller that deploys runtime DLLs and drives typed export commands                     | Bun                 |
| `site/`             | SvelteKit static-assets-first site with prerendered entity pages and synced SQLite/WebP artifacts | Bun + Vite          |
| `entities/`         | Filesystem-as-registry of entity descriptors                                                      | JSON                |
| `schemas/`          | JSON Schema authority for descriptors, snapshots, manifests                                       | JSON Schema 2020-12 |
| `docs/superpowers/` | Specs, plans, and roadmap                                                                         | Markdown            |

## Design documents

Read in order:

1. `docs/superpowers/specs/2026-04-28-ardenfall-compendium-design.md`
2. `docs/superpowers/specs/2026-04-29-ardenfall-compendium-implementation-decisions.md`
3. `docs/superpowers/specs/2026-05-03-slice1-tooling-decisions.md`
4. `docs/superpowers/roadmap.md`

## Local quickstart

```sh
bun install
bunx lefthook install
bun run typecheck
bun test
```

Fixture site prerender smoke:

```sh
bun run artifact:fixture synthetic fixtures/synthetic/snapshot
bun run --cwd site build:fixture
bun run --cwd site smoke:prerender
```

Production release deploy:

```sh
bun run artifact:release snapshots/snapshots/<snapshot-id>
bun run --cwd site deploy:production ../pipeline/artifacts/releases/<snapshot-id>
```

The production site is static-assets-first: generated pages are prerendered to HTML and should be served by Cloudflare Static Assets without Worker invocation; the Worker is retained only for exceptional non-prerendered routes.

Production deploys require a release artifact with `artifact-manifest.json`. `site/static` is a staging cache populated from the artifact; it is not source-of-truth. Fixture artifacts are valid for tests but must never be accepted by production deploy scripts.

Mod build (Mac/Linux requires `mono` or `dotnet`):

```sh
cp .env.example .env
# Edit .env for your Ardenfall Demo install, HotRepl checkout, and token.
bun run mod:copy-libs
bun run mod:build
```

HotRepl export smoke:

```sh
# One-time/local setup after .env is filled in.
HOTREPL_TOKEN="$(openssl rand -hex 24)"  # also copy this value into .env if you want to reuse it
bun run hotrepl:setup

# Launch manually, or set ARDENFALL_LAUNCH_COMMAND in .env and run:
bun run hotrepl:launch

# Export through HotRepl once the game is running.
bun run hotrepl:export
```

The local setup contract lives in `.env.example`:

- `ARDENFALL_MANAGED_DIR` points at `Ardenfall_Data/Managed`.
- `ARDENFALL_PLUGINS_DIR` points at `BepInEx/plugins`.
- `HOTREPL_REPO`, `HOTREPL_CORE_OUT`, and `HOTREPL_BEPINEX_OUT` point at a checked-out HotRepl build.
- `HOTREPL_BIND_HOST`, `HOTREPL_URL`, and `HOTREPL_TOKEN` describe the runtime control connection. Do not commit real tokens.
- `ARDENFALL_SNAPSHOT_OUT` and `ARDENFALL_PIPELINE_OUT` are controller output paths.
- `ARDENFALL_LAUNCH_COMMAND` is optional; manual launch remains supported.

## License

MIT.
