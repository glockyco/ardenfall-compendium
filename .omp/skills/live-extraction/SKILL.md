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

### Protect the save before a mutating probe

The game autosaves on its own, so a probe that moves, kills, or teleports the character writes that
state to disk without asking. Four rules, each earned by breaking it.

- Copy the save folder aside before the first mutating probe, or play a disposable character. A probe
  that only reads needs no copy.
- Never quit while a save is in flight. `GlobalSaveManager.AutoSave` rotates the backups and then calls
  `SaveGameAsync`, so quitting between the two leaves the rotated backup and no primary file. Watch the
  save file's size and time until both stop changing, then quit.
- Never bundle a scene unload with a cross-map teleport. The streamer then transitions against a world
  it is still tearing down, and the map scene never loads. The symptoms are a `currentCell` that
  disagrees with the position, and a character falling with no cell scene loaded. Unload, verify, then
  teleport.
- Hold invulnerability until the character is grounded. Clearing it during an async teleport kills the
  character on arrival, because the fall damage lands before the move completes.

To check a save's real state, make the file read-only, load it, read the position, then restore the
mode. The game cannot overwrite what it cannot write.

### Two installs

Steam holds two Ardenfall installs, and they are different games.

- `Ardenfall Demo` reports `buildProfile: Demo2025`. The compendium targets it, and the controller
  asserts the Unity product name `Ardenfall Demo 2025`, so an export against the other install fails by
  design.
- `Ardenfall` reports `buildProfile: Alpha`. It ships 97 cell scenes against the Demo's 27, so it is the
  install to measure when a question is about world coverage.

Each install root holds a `buildsettings.txt`, and the game reads it at startup through
`BuildSettingsFile.ReadBuildSettingsFromFile`. `enableDebugTools` in that file survives a restart, while
`operator.setPhotoMode` changes only the live value. If you edit the file, keep a `.bak` beside it and
restore it, and never write capture output inside a game folder.

### Operator commands

Use these instead of hand-written submissions. Each one reports the live state it produced, and
`operator.status` reports what the session still holds.

| Command                     | Args                   | Use                                                     |
| --------------------------- | ---------------------- | ------------------------------------------------------- |
| `operator.status`           | none                   | Read invulnerability, photo mode, timescale, and clamp  |
| `operator.setInvulnerable`  | `{"enabled":true}`     | Survive a fall or a fight while exploring               |
| `operator.recoverFromDeath` | none                   | Clear the death state, overlay, and death animation     |
| `operator.teleport`         | `{"x":-3150,"z":3871}` | Move onto the surface under a horizontal target         |
| `operator.setPhotoMode`     | `{"enabled":true}`     | Open the free camera and lift the 10-unit roaming clamp |
| `operator.setTimescale`     | `{"scale":0}`          | Pause or slow the world, from 0 through 1               |

Four behaviours are worth knowing before you rely on them.

- Invulnerability is the game's damage floor, which holds health at 1. It is not immunity to a scripted
  death.
- A teleport refuses when no surface lies under its target, and leaves the character where it was. A
  target in an unstreamed cell is the common cause.
- Photo mode pauses the game, so `operator.status` reports `timescale: 0` until you leave it.
- Disabling photo mode restores the clamp at once and reports `freeCameraClosePending: true`, because
  the game closes the camera behind its close animation and restores the timescale in that step.
  `operator.status` a moment later reports the settled values.

End a session with `operator.setPhotoMode {"enabled":false}` and `operator.status`. An empty `changed`
list means the session holds nothing.

### Gotchas measured against Ardenfall Demo `0.0.10.91`

- Send one statement in each `eval`. A submission that declares a local and then calls several members
  can fail to compile with `(1,4): error CS0584: Internal compiler error: The invoked member is not
supported in a dynamic module.` The same calls succeed one at a time.
- Wait for readiness after `compendium.continueFromMenu`. The click returns at once, and
  `compendium.preflight` still reports `ArdenfallGame.instance is null` for a few seconds.
- Select the subject of a probe by the state under test. A cell probe that names a scene returns
  `not-loaded` when the game streamed that scene out, and that answer proves nothing. Ask which loaded
  scene holds the component you need, then probe that scene.
- Restore every flag a probe sets. `PlayerCharacter.GodMode` is the game's damage floor, and the free
  camera stays clamped to 10 units from the player while `enableDebugTools` is false. That flag also
  changes camera speed, camera smoothing, and the debug interfaces.
- Treat `BuildSettingsFile.Instance.enableDebugTools` and
  `ArdenfallMaster.buildSettings.enableDebugTools` as one field.
  `BuildSettingsFile.Instance` returns `MonoBehaviourSingleton<ArdenfallMaster>.Instance.buildSettings`,
  and a probe measured `aliased=True`. Setting one name changes the other.
- Read the live values back before you call a session clean. One session ended with
  `godMode=False;master=False;file=False;freeCamera=False;timescale=1`.

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
