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
An export that ends with a quit prevents a second measurement. Pass it through the script:
`bun run hotrepl:export -- --no-quit`. The script forwards its arguments to the controller; a
version that did not forward them dropped the flag in silence, so the game quit and the second
export failed to connect. A run that honoured the flag prints no `game.quit` phase.

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

### Read authored world content from every cell

A question about placed content asks for authored values, not for a mechanism. The snapshot carries no
component placements, and gameplay streams one region at a time, so neither source answers the
question. Sweep the cell scenes from the main menu instead. The sweep loads no save, so it protects
none.

1. Start the game and stay at the main menu. Do not call `compendium.continueFromMenu`.
2. Read the scene table with `SceneUtility.GetScenePathByBuildIndex(i)` for each index below
   `SceneManager.sceneCountInBuildSettings`. Build index `N` is the `levelN` file inside
   `data.unity3d`, and the path gives the cell name.
3. For each cell index, call `SceneManager.LoadSceneAsync(i, LoadSceneMode.Additive)`.
4. Read the component with `Resources.FindObjectsOfTypeAll<T>()`, and keep the items whose
   `gameObject.scene.buildIndex` equals `i`. The unfiltered result also holds preloaded prefabs, which
   report an empty scene name and build index `-1`.
5. Read the count in one statement and the rows in another, then reconcile them. A dump that holds
   fewer rows than the count lost data in the client, not in the game.
6. Call `SceneManager.UnloadSceneAsync(i)` before the next cell.
7. End the sweep with `SceneManager.sceneCount` at `1`. Quit only when the sweep is the last
   measurement of the session, because a relaunch waits on Steam.

A sweep of the Demo's 27 cells costs about 90 seconds and needs no character, no teleport, and no
operator flag.

An unseen type cannot be told apart from an absent one, so cross-check a total against a second
producer before it justifies anything. The sweep and an offline enumeration of `data.unity3d` both
reached 140 placed `PickablePlant` components across 27 cells, which is what makes that count a
census rather than a floor.

### Capture a UI surface

Capture a picture when a question is about what a player sees. Read the surface the game renders, not
the source that builds it.

- Write the file from inside the game, with one absolute Windows path:
  `UnityEngine.ScreenCapture.CaptureScreenshot(@"Z:\Users\glockyco\src\github.com\glockyco\ardenfall-compendium\spikes\captures\hud.png")`.
  Wine maps the host root to `Z:`, so the game writes straight into `spikes/captures/`. A relative
  argument is legal for that call and lands inside the game's persistent data directory instead.
- Confirm the host file exists and is not empty. The call returns at once, writes one frame later,
  and reports nothing, so a capture that never landed is silent.
- `unity.screenshot.capture` is the other route, and it needs HotRepl `03f4cb2` or later deployed in
  the game and `@hotrepl/sdk` 4.0.2 or later in the client. Before those the PNG stayed in an
  unreadable in-memory artifact and the SDK failed with `protocol must be http:, https: or s3:`.
  Now the command returns a file-backed reference under the engine's artifact directory, which is
  `C:\users\crossover\AppData\Local\HotRepl\artifacts\<jobId>\screenshot` inside the bottle, and
  `connect({ resolveArtifactPath })` maps `C:\` onto the bottle's `drive_c` so the client reads the
  same bytes. `spikes/artifact-read.ts` is that call.
- Select a surface by its typed layer on `GameGUIManager`, through
  `PlayerCharacter.instance.GameUI.OpenLayer(...)`. Never drive the interface with synthetic input.
  `hudLayer`, `pausePanel`, `optionsPanel` and `levelUpLayer` open with no arguments.
  `potionCraftLayer`, `potionIngredientSelectLayer`, `lockpickLayer`, `merchantInventoryPanel`,
  `trainPanel` and `fastTravelPanel` need real data through their own `Open(...)`.
- Render a message-driven overlay with the message, not with the state behind it.
  `MessagingSystem.SendMessage(typeof(Ardenfall.UI.ShowXPGivenMessage), 10)` draws the `+10 XP` bar
  and changes no stat. A probe confirmed `Level 2` and `111` experience points before and after.
- Close with `OpenLayer(hudLayer, true)`, and confirm `GameUI.CurrentLayer.name` reads `HUD`.
- Keep the PNGs in gitignored `spikes/captures/`. They are third-party art, they belong to one build,
  and the recipe reproduces them.

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

- Identify the backend before you trust an ad-hoc probe. `hotrepl --json info` reports the loader,
  and Ardenfall answers with `BepInEx` on `Unity Mono`. A `MelonLoader` host on `Unity IL2CPP` is
  another instrumented game on the same port, and it answers every request without an error. One
  session read `unity.screenshot.capture` failures and a `maxJobConcurrency` refusal from a game
  named `ancientkingdoms`. Give each instrumented game its own `HOTREPL_PORT`.
  An export needs no hand check: `controller/src/export-orchestrator.ts` fails when the port has no
  single holder, when the product name is another game, and when the plugin that answered is not the
  plugin deployed under `ARDENFALL_PLUGINS_DIR`.
- Read `Steam/logs/console_log.txt` when a launch produces no port. Steam holds the launch behind a
  modal that a shell cannot answer, and the log names it, such as
  `LaunchApp waiting for user response to KickingOtherSession`. A second Steam session is the common
  cause. A direct launch of `Ardenfall.exe` through `wine --cx-app` does not avoid this state. Steam
  removed that process 11 seconds after it started.
- Send one statement in each `eval`. A submission that declares a local and then calls several members
  can fail to compile with `(1,4): error CS0584: Internal compiler error: The invoked member is not
supported in a dynamic module.` The same calls succeed one at a time.
- Wait for readiness after `compendium.continueFromMenu`. The click returns at once, and
  `compendium.preflight` still reports `ArdenfallGame.instance is null` for a few seconds.
- Select the subject of a probe by the state under test. A cell probe that names a scene returns
  `not-loaded` when the game streamed that scene out, and that answer proves nothing. Ask which loaded
  scene holds the component you need, then probe that scene.
- Never pipe a probe's output through `head` or `tail`. A sweep script capped each cell's row dump at
  40 lines, `cell_overworld_-1.-7` holds 47 plants, and the 7 missing rows read exactly like a game
  that had not finished spawning. `Scene.isLoaded` was accurate: a direct count one poll after that
  flag turned true already reported 47, and it still reported 47 five seconds later. Suspect the
  client before the game, and reconcile a dump against a count.
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

The decompiled source proves a mechanism. It does not prove an authored value. `PickablePlant.giveXP`
proves that a harvest awards its own integer, and it says nothing about which plant carries which
integer. Read an authored value from the game, with the cell sweep above.

Offline parsing of `data.unity3d` answers the same question faster, and it is not a source of truth.
The shipped build carries no serialized type tree for a `MonoBehaviour`, so an offline reader infers
each field offset from the declaration order of the decompiled class. That inference is a hypothesis
until a live read of the same component agrees. The flake pins no asset reader, because the live read
is the answer.

For each game-logic decision, state one question, run one probe, and record one result.
A probe targets one game build and decays with that build. Write it in gitignored `spikes/`.
A probe that a change uses then travels with that change and stays in it after the archive, which
`openspec/specs/evidence-standard/spec.md` owns. The repository holds no ledger beside it.

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
