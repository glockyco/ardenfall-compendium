# Ardenfall Compendium

Ardenfall Compendium is a static wiki and export pipeline for the Unity/Mono game **Ardenfall** by Spellcast Studios. It extracts data from a running game, validates the snapshot, builds canonical artifacts, and prerenders a static site for browsing entities and map data.

This repository is for maintainers of the compendium. If you only want to read the compendium, use the published site instead of this source tree.

## What you can do here

- Build and preview the SvelteKit compendium site from fixture data.
- Run a BepInEx mod that exports live game data into JSON snapshots.
- Validate snapshots and turn them into release artifacts.
- Deploy a production artifact to Cloudflare Static Assets.
- Exercise the local [HotRepl](https://github.com/glockyco/HotRepl) workflow used for game automation.

## Requirements

- Bun 1.3.13 or newer.
- .NET SDK for the BepInEx mod build and tests.
- Ardenfall Demo installed locally for live exports.
- BepInEx 5 installed in the Ardenfall Demo game directory for live exports.
- A HotRepl checkout when running the HotRepl smoke/export flow.

## Quickstart by task

Install JavaScript dependencies first:

```bash
bun install --frozen-lockfile
```

### Work on the website from fixture data

```bash
bun run artifact:fixture synthetic fixtures/synthetic/snapshot
bun run --cwd site build:fixture
bun run --cwd site smoke:prerender
bun run dev
```

Fixture artifacts are safe for development and tests. They are never valid production deploy inputs.

### Build the BepInEx export mod

```bash
cp .env.example .env
# Edit .env for your Ardenfall Demo install and HotRepl checkout.

bun run mod:copy-libs
bun run mod:build
```

The mod reads live game objects and emits explicit snapshot DTOs. Snapshots should not contain raw Unity, Odin, or arbitrary game-object JSON.

### Run a live HotRepl export smoke

```bash
# One-time/local setup after .env is filled in.
bun run hotrepl:setup

# Launch manually, or set ARDENFALL_LAUNCH_COMMAND in .env and run:
bun run hotrepl:launch

# Export through HotRepl once the game is running.
bun run hotrepl:export
```

The `.env.example` file documents every local path used by this flow:

- `ARDENFALL_MANAGED_DIR` points at `Ardenfall_Data/Managed`.
- `ARDENFALL_PLUGINS_DIR` points at `BepInEx/plugins`.
- `HOTREPL_REPO`, `HOTREPL_CORE_OUT`, and `HOTREPL_BEPINEX_OUT` point at a checked-out HotRepl build.
- `HOTREPL_BIND_HOST` and `HOTREPL_URL` describe the runtime connection.
- `ARDENFALL_SNAPSHOT_OUT` and `ARDENFALL_PIPELINE_OUT` are controller output paths.
- `ARDENFALL_LAUNCH_COMMAND` is optional; manual launch remains supported.

The HotRepl workflow deploys the local BepInEx host, starts the game, and connects to `HOTREPL_URL`.

### Build and deploy a production artifact

```bash
bun run artifact:release snapshots/snapshots/<snapshot-id>
bun run --cwd site deploy:production ../pipeline/artifacts/releases/<snapshot-id>
```

Production deploys require a release artifact with `artifact-manifest.json`. `site/static` is a staging cache populated from the artifact; it is not source-of-truth.

## Architecture

```text
Ardenfall Demo + BepInEx mod
  ↓ live extraction
snapshots/<snapshot-id>/*.json
  ↓ Bun validation and canonicalization
pipeline/artifacts/{fixtures,releases}/<snapshot-id>
  ↓ staged static assets
site/static + prerendered SvelteKit pages
  ↓
Cloudflare Static Assets
```

| Path                | Purpose                                                                | Toolchain           |
| ------------------- | ---------------------------------------------------------------------- | ------------------- |
| `mod/`              | BepInEx 5 plugin that walks live game objects and emits JSON snapshots | C# / .NET           |
| `controller/`       | HotRepl deployment/export controller for live game automation          | Bun / TypeScript    |
| `pipeline/`         | Snapshot validation and artifact generation                            | Bun / TypeScript    |
| `site/`             | SvelteKit static site and artifact staging scripts                     | Bun / Vite          |
| `entities/`         | Filesystem registry of entity descriptors                              | JSON                |
| `schemas/`          | JSON Schema authority for descriptors, snapshots, and manifests        | JSON Schema 2020-12 |
| `docs/superpowers/` | Design notes, plans, and roadmap                                       | Markdown            |

The production site is static-assets-first: generated pages are prerendered to HTML and should be served by Cloudflare Static Assets without Worker invocation. The Worker is retained only for exceptional non-prerendered routes.

## Common commands

| Task                              | Command                                                          |
| --------------------------------- | ---------------------------------------------------------------- |
| Typecheck TypeScript              | `bun run typecheck`                                              |
| Lint TypeScript/Svelte            | `bun run lint`                                                   |
| Check formatting                  | `bun run format:check`                                           |
| Generate schema validators        | `bun run codegen:validators`                                     |
| Run controller tests              | `bun run controller:test`                                        |
| Build fixture artifact            | `bun run artifact:fixture synthetic fixtures/synthetic/snapshot` |
| Build release artifact            | `bun run artifact:release snapshots/snapshots/<snapshot-id>`     |
| Build mod                         | `bun run mod:build`                                              |
| Deploy HotRepl + mod locally      | `bun run hotrepl:setup`                                          |
| Decompile game assemblies locally | `bun run decompile:game`                                         |

## Maintainer orientation

Start with the living roadmap, then the agent guides:

1. [`docs/superpowers/roadmap.md`](docs/superpowers/roadmap.md) — delivered and planned state.
2. [`AGENTS.md`](AGENTS.md) and the subsystem `AGENTS.md` files — durable working rules, commands, and invariants.

Design specs and plans under `docs/superpowers/` are planning scaffolding that is removed once delivered; treat them as background, not as the source of truth.

## License

MIT.
