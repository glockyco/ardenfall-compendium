## 1. Operator target and session ledger

- [x] 1.1 Add the injected operator target abstraction covering invulnerability, death state, teleport,
      photo-mode gates, and timescale, with a fake for tests.
- [x] 1.2 Add the in-memory session ledger that records each value on first change, restores it on
      disable, and forgets a change the game reversed itself.
- [x] 1.3 Cover the ledger with tests for first-change capture, repeated change, and restore.

## 2. Operator commands

- [x] 2.1 Add the invulnerability command and its result, reporting the live flag.
- [x] 2.2 Add the death-recovery command, clearing death state, death interface, and animation
      override, and reporting which parts changed.
- [x] 2.3 Add the teleport command with a downward surface probe that ignores the character's own
      colliders, reporting the position and surface height, and failing when no surface is found.
- [x] 2.4 Add the photo-mode command that sets the debug flag on enable and restores it on disable,
      reporting the clamp state and any pending camera close.
- [x] 2.5 Add the timescale command that accepts `0` through `1` and rejects any other value.
- [x] 2.6 Add the operator status command that reports live invulnerability, photo mode, timescale, and
      which values the session changed.
- [x] 2.7 Refuse every command with a named `precondition_failed` code when its live target is absent.

## 3. Registration and Unity binding

- [x] 3.1 Register the operator commands in `CompendiumCommandRegistry`.
- [x] 3.2 Add the Unity-backed target that binds to the game members named in `design.md` - Context.

## 4. Tests

- [x] 4.1 Add command tests through the fake target for each requirement scenario in
      `specs/operator-tools/spec.md`.
- [x] 4.2 Assert that the controller's required-command list still contains no operator command.
- [x] 4.3 Run `dotnet test mod-tests/ArdenfallCompendium.Tests.csproj` and `bun test controller/test`.

## 5. Documentation

- [x] 5.1 Document the operator command sequence in `skill://live-extraction`, replacing the
      hand-written probes, and state that invulnerability is the game's damage floor.
- [x] 5.2 Record the operator command surface in `mod/AGENTS.md` beside the existing control-command
      rule.

## 6. Live verification and cleanup

- [x] 6.1 Deploy with `bun run hotrepl:setup`, launch the game, and verify each command against the
      live session, including the teleport refusal.
- [x] 6.2 Disable photo mode, confirm status reports the retail gate values, and stop the game.
- [x] 6.3 Run the repository gate in `AGENTS.md` - Commands.
