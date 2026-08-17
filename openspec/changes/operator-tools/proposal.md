## Why

A reader trusts a page only when someone has stood in the place it describes. Verifying a published
location, marker, or placed character against the running game currently needs hand-written C#
submissions, and those submissions leave the game in a state nobody recorded.

A live session against Ardenfall Demo `0.0.10.91` measured what that costs.

- `FreeCameraLayerUI.nonDebugMaxDistance` is `10`. Every frame, `FreeCameraLayerUI.Update` pulls the
  free camera back to 10 units from the player while `ArdenfallMaster.buildSettings.enableDebugTools`
  is false. A retail session cannot look at a coastline from above.
- Two separate flag holders gate the same behaviour. `FreeCamera` reads
  `BuildSettingsFile.Instance.enableDebugTools` for its own input, and the clamp reads
  `ArdenfallMaster.Instance.buildSettings.enableDebugTools`. Both read `false` in a retail session.
  After both were set, the camera held 24.96 units from the player across frames.
- Recovering from death needs four calls in the right order: `PlayerCharacter.Revive`,
  `DeathUILayer.CloseLayer`, `CharacterAvatarAnimator.StopOverridingAnimation`, and
  `ForceUpdateValues`. `PlayerCharacter.OnDeath` starts an animation with `stopOnFinish: false`, so
  the death pose survives a revive that omits the last two calls.
- Moving the character is one call, `PlayerCharacter.TeleportFar`, but a target above unstreamed
  terrain has no surface yet, so an unguarded move drops the character.
- The REPL is not a reliable place for this. A submission that declared a local and then called
  several members failed with `(1,4): error CS0584: Internal compiler error: The invoked member is
not supported in a dynamic module.` The same operations succeed when each one is submitted alone.
- Nothing records what a session changed. Today's session set invulnerability and two debug flags,
  and only this document says so.

## What Changes

- Add an operator command surface on the mod, driven by the controller, for the controls a live
  verification session needs: invulnerability, death recovery, teleport, photo mode, and timescale.
- Report the resulting live state from every operator command, so an operator confirms an effect
  without a second probe.
- Record what the session changed, and restore it on request. Photo mode restores both debug-tool
  flags it set, because those flags also gate debug UI and free-camera input.
- Refuse an operator command that has no live target, with a named precondition failure rather than
  a null-reference exception.
- Fail a teleport that finds no surface under its target, and leave the character where it was.
- Keep the export contract unchanged. Operator commands are not part of `compendium.preflight`,
  `run.begin`, `entity.plan`, `entity.exportBatch`, `run.finalize`, or `game.quit`.

No entity descriptor, public route, or relationship predicate changes. Nothing reaches the published
site, and no operator command participates in an export.

## Capabilities

### New Capabilities

- `operator-tools`: the live operator command surface, its reported state, its session-restore
  contract, and its refusal behaviour.

### Modified Capabilities

None.

## Impact

- `mod/src/Control/` gains operator command handlers, their args, and their results.
- `mod/src/Control/CompendiumCommandRegistry.cs` registers them.
- `mod-tests/` covers the operator logic through injected fakes, because the mod tests run on
  `net10.0` without a Unity runtime.
- `controller/` gains no export phase. The controller's required-command list is unchanged.
- `skill://live-extraction` gains the operator command sequence, replacing hand-written probes.
