---
name: live-extraction
description: This skill guides live Ardenfall extraction with HotRepl. Use it for `hotrepl:setup`, `hotrepl:launch`, `hotrepl:export`, live snapshots, HotRepl probes, `HOTREPL_PORT`, or `HOTREPL_URL` changes.
---

# Live extraction

Use this procedure when a configured game installation must produce a live snapshot.

## Export a snapshot

1. Configure the repo-root `.env` with the game paths, `HOTREPL_URL`, and launch command.
2. Run `bun run hotrepl:setup` to build and deploy the mod.
3. Run `bun run hotrepl:launch` to start the game.
4. Run `bun run hotrepl:export` to drive HotRepl, write a snapshot, and run the pipeline.
5. Read `controller/src/export-orchestrator.ts` when you need the controller step sequence.

`hotrepl:deploy` rewrites the game's `hotrepl.bepinex.cfg` from `HOTREPL_BIND_HOST` and `HOTREPL_PORT`. The default port is `18590`.

If another HotRepl-instrumented game holds the default port, set `HOTREPL_PORT` and the matching `HOTREPL_URL` in `.env`. Do not hand-edit the generated config. Each deploy overwrites that file.

Two games that claim one port do not report an error. Connections reach whichever game binds first. An export can therefore target the wrong game without an obvious failure.

## Probe a running game

- Use the **CLI** for interactive C# evaluation and inspection: `hotrepl eval '<C#>'`, `describe`, and `watch`.
- Use `@hotrepl/sdk` for automation. The controller declares `@hotrepl/protocol` and `@hotrepl/sdk`.
- Do not use the MCP server.
- Use the HotRepl checkout at `$HOTREPL_REPO`.
- Load the world with `compendium.continueFromMenu` before you read `worldData` or records.

## Ground game-logic decisions

Read the decompiled source instead of guessing. The gitignored cache is `.decompiled/<gameVersion>-<sha>/`. Regenerate it with `bun run decompile:game`.

Never commit decompiled source, raw game JSON, snapshots, or generated databases.

## Sources

The procedure follows the repository export contract in `docs/plans/2026-05-06-hotrepl-export-workflow-design.md` and the harness skill guidance in `https://code.claude.com/docs/en/skills`.
