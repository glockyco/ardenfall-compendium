## Context

See `proposal.md` - Why. Paths below are relative to
`.decompiled/steam-22145060-63c576261184/csharp/`, and live results come from a session against
Ardenfall Demo `0.0.10.91`.

The game already owns every operation this capability needs.

- `Ardenfall/CharacterBase.cs:178` declares `GodMode`. `Ardenfall/CharacterStatsController.cs:692-695`
  raises health back to `1` while it is set, so it is a damage floor and not a damage block.
- `Ardenfall/PlayerCharacter.cs:368-374` opens the death interface and plays the death clip with
  `stopOnFinish: false`. `Ardenfall/PlayerCharacter.cs:1145-1155` clears the death state, disables the
  ragdoll, and closes that interface, but it does not stop the clip.
  `Ardenfall/Animation/CharacterAvatarAnimator.cs:527-543` stops the override, and `:673-696`
  reapplies `Dead` to the animator controllers.
- `Ardenfall/CharacterBase.cs:1133` and `Ardenfall/PlayerCharacter.cs:880-905` move a character, and
  the player override drives a loading screen and the world streamer.
- `Ardenfall/ArdenfallGame.cs:306-330` opens and closes the free camera.
  `Ardenfall/ArdenfallGame.cs:240-244` sets the tool timescale, and `:267-268` multiplies it into
  `Time.timeScale`.
- One flag gates the clamp, and two accessors reach it.
  `Ardenfall/UI/FreeCameraLayerUI.cs:340-346` clamps the camera to `nonDebugMaxDistance`, declared as
  `10` at `:110`, while `ArdenfallMaster.buildSettings.enableDebugTools` is false.
  `Ardenfall/FreeCamera.cs:112`, `:129`, and `:153` gate the camera's own input on
  `BuildSettingsFile.Instance.enableDebugTools`, and `Ardenfall/BuildSettingsFile.cs:24` defines that
  accessor as `MonoBehaviourSingleton<ArdenfallMaster>.Instance.buildSettings`. The two names are one
  field.
- That flag carries more than the clamp. `Ardenfall/UI/FreeCameraLayerUI.cs:160-163` forces camera
  smoothing and speed to its non-debug values, and `:328` gates the cinematic interface.

Live results, one probe per claim:

- `object.ReferenceEquals(BuildSettingsFile.Instance, MonoBehaviourSingleton<ArdenfallMaster>.Instance.buildSettings)`
  returned `aliased=True`, and the same probe returned `sameAsFind=True` for
  `FindObjectOfType<ArdenfallMaster>()`.
- A write of `BuildSettingsFile.Instance.enableDebugTools = true` read back as
  `master=True;file=True` through both accessors, and the restore read back
  `master=False;file=False`. One field, two names.
- After the flag was set, `EnableFreeCamera()`, and a 25-unit offset,
  `"enabled=" + freeCameraEnabled + ";distance=" + Vector3.Distance(camera, eye)` returned
  `enabled=True;distance=24.96307` on a later frame. The clamp holds that distance at `10`.
- `"dead=" + Dead + ";health=" + Stats.health.Value + ";deathLayer=" + deathLayer.gameObject.activeSelf`
  returned `dead=False;health=39.19125;deathLayer=False`.

## Goals / Non-Goals

**Goals:**

- One command per operator intent, with the resulting state in its output.
- A session ledger the operator can read and restore, covering every gate a command changed.
- Logic that the `net10.0` mod tests can execute without a Unity runtime.

**Non-Goals:**

- No new camera, input, or rendering code. The commands drive the game's own camera and gates.
- No capture or export phase. Capture bounds and tiles belong to `tile-capture-basemap`.
- No persistence. A session ledger lives in memory and dies with the process.
- No gameplay balance change. Invulnerability stays the game's own damage floor.

## Decisions

### Drive the game's own operations, and never reimplement one

Each command calls the member named in Context. A local revive, a local clamp, or a local timescale
would copy game behaviour that the next build can change, and the copy would then disagree with the
game while every test still passed.

### Put the live bindings behind one injected target

The mod tests run on `net10.0` with no Unity runtime, so a handler that touches
`PlayerCharacter.instance` cannot execute in a test. `CompendiumPreflightCommand` already solves this
with an injected `IGameIdentitySource`, and the extractors do the same with one asset source each.

Operator handlers will take one injected target that exposes the live values and operations they
need. A fake target drives the tests, and the Unity implementation binds to the members in Context.

Alternative considered: one interface per command. Rejected because these commands read and write one
shared live state - the player, the game singleton, and the debug flag - and a status command must
report all of it. Splitting that across five interfaces would give five producers of the same facts.

### Expose the debug flag once, and restore what the session changed

`enableDebugTools` is one field behind two accessors, so the target exposes it once. A second property
would invite a caller to set one name and read the other, and a later reader would take the pair for
two independent gates, which is the reading this plan first recorded.

That flag also changes camera smoothing, camera speed, and the cinematic interface
(`Ardenfall/UI/FreeCameraLayerUI.cs:160-163`, `:328`). A command that set it without recording its
previous value would leave a session that nobody can return to retail behaviour, so the session
records the value on first change and restores exactly that value on disable.

### Refuse rather than crash

`PlayerCharacter.instance` is null before the world loads; a retail session measured
`compendium.preflight` reporting `ArdenfallGame.instance is null` before
`compendium.continueFromMenu`. Every handler checks its target first and returns
`PreconditionFailed` with a named code, matching `ContinueFromMenuCommand`'s `continueButtonMissing`.

### Probe for a surface before moving, and refuse when there is none

`Ardenfall/PlayerCharacter.cs:880-905` streams the world after the move, so a target over unstreamed
terrain has no collider yet. The teleport casts downward, ignores the character's own colliders, and
fails when no surface is found. It reports the surface height it used, so an operator can tell a
rooftop from a seabed.

## Risks / Trade-offs

- [Enabling debug tools changes more than the clamp] → Record and restore the flag, and report it from
  status so a session can prove it returned to retail behaviour.
- [A restored flag is still wrong if the game changed it meanwhile] → Status reports the live flag
  value, not the recorded one, so a mismatch is visible instead of assumed.
- [Invulnerability is a damage floor, not immunity] → Name it invulnerability in the output and state
  the floor in the skill, so nobody reads it as immunity to scripted death.
- [A teleport can still land inside geometry] → Report the surface height and the collider the probe
  used, so an operator sees which surface was chosen.
- [Unity-bound code stays untested] → Keep the untestable part to the binding itself, and verify it in
  a live smoke against the running game before the change is done.

## Migration Plan

1. Add the operator target abstraction, the handlers, their args, and their results.
2. Register them in `CompendiumCommandRegistry`.
3. Cover the logic in `mod-tests` through the fake target.
4. Deploy to the game with `bun run hotrepl:setup`, then verify each command against a live session.
5. Restore the session with the disable path, and confirm status reports retail values.

Rollback is the reverse registration: without the handlers, the export contract and every existing
command behave as they do today.
