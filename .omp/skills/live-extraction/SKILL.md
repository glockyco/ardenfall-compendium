---
name: live-extraction
description: This skill guides live Ardenfall extraction with HotRepl. Use it for `hotrepl:setup`, `hotrepl:launch`, `hotrepl:export`, live snapshots, HotRepl probes, `HOTREPL_PORT`, or `HOTREPL_URL` changes.
---

# Live extraction

Use this procedure when a configured game installation must produce a live snapshot.

## Export a snapshot

1. Configure the repo-root `.env` with `ARDENFALL_GAME_DIR`, `HOTREPL_REPO`, `HOTREPL_URL`, and the launch command.
2. Run `bun run bepinex:install` once per game install. It installs the pinned loader and, when the game lives in a CrossOver bottle, sets the `winhttp` DLL override that Wine needs before it loads the Doorstop proxy. Without that override the game starts normally and loads no plugins.
3. Run `bun run hotrepl:setup` to build and deploy the mod. It refuses to deploy when the loader is absent.
4. Run `bun run hotrepl:launch` to start the game.
5. Run `bun run hotrepl:export` to drive HotRepl, write a snapshot, and run the pipeline.
6. Read `controller/src/export-orchestrator.ts` when you need the controller step sequence.

`hotrepl:deploy` rewrites the game's `hotrepl.bepinex.cfg` from `HOTREPL_BIND_HOST` and `HOTREPL_PORT`. The default port is `18590`. Any value other than `127.0.0.1` exposes unauthenticated remote code execution and requires the explicit `--allow-remote-repl` flag.

If another HotRepl-instrumented game holds the default port, set `HOTREPL_PORT` and the matching `HOTREPL_URL` in `.env`. Do not hand-edit the generated config. Each deploy overwrites that file.

Two instrumented games on one port answer without an error. The game that binds first wins.
An export that ends with a quit prevents a second measurement. Pass `--no-quit` to keep the session alive.

## Probe a running game

- Use the **CLI** for interactive C# evaluation and inspection: `hotrepl eval '<C#>'`, `describe`, and `watch`.
- Use `@hotrepl/sdk` for automation. The controller declares `@hotrepl/protocol` and `@hotrepl/sdk`.
- Do not use the MCP server.
- Use the HotRepl checkout at `$HOTREPL_REPO`.
- Load the world with `compendium.continueFromMenu` before you read `worldData` or records.

## Ground game-logic decisions

Read the decompiled source instead of guessing. The gitignored cache is `.decompiled/<gameVersion>-<sha>/`. Regenerate it with `bun run decompile:game`.

For each game-logic decision, state one question, run one probe, and record one result.
A probe targets one game build and decays with that build. The repository holds no probe.
Git ignores `spikes/`. Keep probes in `spikes/`.

A negative result needs a positive control. Run the same probe against a case that carries the value.
Record both results in the change that uses them.
One probe read `variant.nameSets` and returned empty for every race. That empty result became a defect report.
The published field has the name `variant.nameSetRefs`. Every vocabulary was present.

## Store each result with its owner

Place each measurement with the producer that owns it.
A count belongs to the emitted `artifact-manifest.json`.
A mechanism belongs to the spec requirement that it justifies.
The probe and its output belong to the change that used them.
The repository holds no ledger.

Repeat a measurement after extraction code changes. The earlier export ran the earlier code.

Never commit decompiled source, raw game JSON, snapshots, or generated databases.

## Sources

The export contract lives in `controller/src/export-orchestrator.ts` and in the snapshot validator it calls. Read those before you change a phase or a timeout.
