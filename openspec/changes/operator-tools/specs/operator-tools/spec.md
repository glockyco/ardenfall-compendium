## Purpose

Defines the live operator commands that let a person verify published compendium data inside the
running game, and the state each command reports and restores.

## ADDED Requirements

### Requirement: Every operator command reports the state it produced

An operator command SHALL return the live values it changed. An operator SHALL NOT need a second
command to confirm an effect. When the game completes part of a change on a later frame, the command
SHALL name that pending transition instead of reporting a state the game has not reached.

#### Scenario: Enabling invulnerability reports the live flag

- **WHEN** an operator enables invulnerability
- **THEN** the command succeeds
- **AND** its output reports invulnerability as enabled

#### Scenario: Status reports every operator-owned value

- **WHEN** an operator requests operator status
- **THEN** the output reports invulnerability, photo mode, timescale, and whether the session changed
  each one

#### Scenario: Status forgets a change the game reversed

- **WHEN** the session changed a value and the game has since returned it to the value the session found
- **THEN** operator status does not report that value as changed

### Requirement: An operator command without a live target fails by name

When the game exposes no live character or no live game instance, an operator command SHALL fail with
a `precondition_failed` error and a named code. It SHALL NOT throw an unhandled exception, and it
SHALL change no state.

#### Scenario: No live character

- **WHEN** an operator sends a command that needs the player character and no player character exists
- **THEN** the command fails with kind `precondition_failed`
- **AND** the error code names the missing target
- **AND** operator status reports the same values as before the command

### Requirement: Death recovery returns the character to a playable state

Death recovery SHALL clear the death state, close the death interface, and stop the death animation
override. It SHALL succeed whether or not the character is currently dead, and it SHALL report which
of those parts it changed.

#### Scenario: Recovering a dead character

- **WHEN** the character is dead and an operator requests death recovery
- **THEN** the command succeeds
- **AND** the output reports the character as alive
- **AND** the output reports the death interface as closed and the animation override as stopped

#### Scenario: Recovering a living character clears residue

- **WHEN** the character is alive and an operator requests death recovery
- **THEN** the command succeeds
- **AND** the output reports the animation override as stopped
- **AND** the output reports that the death state needed no change

### Requirement: Teleport places the character on a surface or refuses the move

A teleport SHALL move the character only to a position resting above a surface found under the
requested horizontal target. When no surface is found within the probe distance, the command SHALL
fail with `precondition_failed` and leave the character at its original position. A surface SHALL NOT
be the character itself.

#### Scenario: Surface found under the target

- **WHEN** an operator teleports to a horizontal target that has a surface beneath it
- **THEN** the command succeeds
- **AND** the output reports the resulting position and the surface height it used

#### Scenario: No surface under the target

- **WHEN** an operator teleports to a horizontal target with no surface within the probe distance
- **THEN** the command fails with kind `precondition_failed`
- **AND** the output reports no new position
- **AND** the character remains at its original position

### Requirement: Photo mode lifts the camera clamp and restores it

Enabling photo mode SHALL free the camera from the retail roaming clamp. Disabling photo mode SHALL
restore every value it changed to the value that value held before the session enabled photo mode.

#### Scenario: Enabling photo mode frees the camera

- **WHEN** an operator enables photo mode in a session where the roaming clamp is active
- **THEN** the command succeeds
- **AND** the output reports the roaming clamp as lifted
- **AND** the output reports photo mode as enabled

#### Scenario: Disabling photo mode restores the original debug flag

- **WHEN** an operator enables photo mode and later disables it
- **THEN** the command succeeds
- **AND** the debug flag holds the value it held before photo mode was enabled
- **AND** the output reports photo mode as disabled

#### Scenario: The game finishes the camera close on a later frame

- **WHEN** an operator disables photo mode while the free camera is open
- **THEN** the output reports the roaming clamp as restored
- **AND** the output reports the free-camera close as pending while the game has not finished it

#### Scenario: Photo mode pauses the game

- **WHEN** an operator enables photo mode
- **THEN** operator status reports the live timescale the game applied
- **AND** status does not report the timescale as a value the operator changed

### Requirement: Timescale accepts only the range the game applies

A timescale command SHALL accept a value from `0` through `1` inclusive and report the applied value.
It SHALL reject any other value with `validation_failed` and change nothing.

#### Scenario: Pausing the game

- **WHEN** an operator sets the timescale to `0`
- **THEN** the command succeeds
- **AND** the output reports the applied timescale as `0`

#### Scenario: Rejecting an out-of-range timescale

- **WHEN** an operator sets the timescale to a value above `1`
- **THEN** the command fails with kind `validation_failed`
- **AND** the applied timescale is unchanged

### Requirement: Operator commands stay out of the export contract

An export SHALL NOT require, call, or depend on an operator command. The commands an export requires
SHALL remain unchanged by this capability.

#### Scenario: Export requires no operator command

- **WHEN** the controller lists the commands an export requires
- **THEN** the list contains no operator command
