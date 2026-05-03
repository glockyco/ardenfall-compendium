# Ardenfall Archives

Static, agentic-first wiki and interactive map for the Unity-Mono game **Ardenfall** (Spellcast Studios).

## Repository shape

| Path                | Subsystem                                                                                   | Toolchain           |
| ------------------- | ------------------------------------------------------------------------------------------- | ------------------- |
| `mod/`              | BepInEx 5 plugin that walks live game objects and emits JSON snapshots                      | C# / `dotnet build` |
| `pipeline/`         | TypeScript pipeline that validates snapshots and produces canonical SQLite + WebP assets    | Bun                 |
| `site/`             | SvelteKit static site that ships the SQLite blob and renders entity pages + interactive map | Bun + Vite          |
| `entities/`         | Filesystem-as-registry of entity descriptors                                                | JSON                |
| `schemas/`          | JSON Schema authority for descriptors, snapshots, manifests                                 | JSON Schema 2020-12 |
| `docs/superpowers/` | Specs, plans, and roadmap                                                                   | Markdown            |

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
