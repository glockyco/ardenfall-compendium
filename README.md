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

Site prerender smoke:

```sh
bun run pipeline:run fixtures/synthetic/snapshot pipeline/dist
bun run --cwd site build
bun run --cwd site smoke:prerender
```

The production site is static-assets-first: generated pages are prerendered to HTML and should be served by Cloudflare Static Assets without Worker invocation; the Worker is retained only for exceptional non-prerendered routes.

Mod build (Mac/Linux requires `mono` or `dotnet`):

```sh
mod/scripts/copy-libs.sh   # copies game DLLs from your local Ardenfall install
dotnet build mod/ArdenfallCompendium.csproj
```

HotRepl export smoke:

```sh
dotnet build /Users/joaichberger/Projects/HotRepl/src/HotRepl.BepInEx/ --nologo -v q
dotnet build mod/ArdenfallCompendium.csproj -c Debug

PLUGINS_DIR="$HOME/Library/Application Support/CrossOver/Bottles/Steam/drive_c/Program Files (x86)/Steam/steamapps/common/Ardenfall Demo/BepInEx/plugins"
HOTREPL_TOKEN="$(openssl rand -hex 24)"
bun run controller:deploy -- \
  --hotrepl-out /Users/joaichberger/Projects/HotRepl/src/HotRepl.BepInEx/bin/Debug/netstandard2.1 \
  --mod-out ./mod/bin/Debug/netstandard2.1 \
  --plugins "$PLUGINS_DIR" \
  --bind-host 0.0.0.0 \
  --token "$HOTREPL_TOKEN"


Launch Ardenfall before exporting. First Steam/CrossOver startup can take a few minutes on a cold or slow network path; `controller:export` waits up to five minutes for the HotRepl listener before failing, so start the export command immediately after launch instead of hand-timing readiness.

bun run controller:export -- --url ws://127.0.0.1:18590 --token "$HOTREPL_TOKEN" --output ./snapshots --pipeline-out ./pipeline/dist
```

## License

MIT.
