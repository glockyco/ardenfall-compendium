## ADDED Requirements

### Requirement: A capture renders the world the game streams

A capture MUST obtain each cell's geometry from the game's own world streamer, by moving the streamer's focus to that cell and waiting for its queue to drain, and MUST render from that state. A capture MUST NOT load a scene of its own, MUST NOT instantiate a distant-cell prefab of its own, and MUST NOT switch off a renderer to hide a second copy of a cell.

Every position in the requested range MUST be rendered. There MUST be no mode that renders only the cells that ship an authored scene.

When a capture ends it MUST hand the streamer's focus back to the camera and wait for the streamer to restore the player's world before it reports completion.

#### Scenario: The player's own cell is captured

- **WHEN** a capture reaches the cell the player stands in
- **THEN** the plate shows that cell as the player sees it from above
- **AND** the capture treats it like every other cell

#### Scenario: A cell ships no authored scene

- **WHEN** a capture reaches a grid position with no cell scene in the build
- **THEN** the plate shows what the game streams there: distant terrain, water, or nothing
- **AND** the position is recorded in the tile index

#### Scenario: The capture ends

- **WHEN** the last cell is rendered
- **THEN** the streamer's focus returns to the camera
- **AND** the export that follows sees the cells the player had before the capture

## MODIFIED Requirements

### Requirement: A capture records every input it depends on

A capture MUST set its own lighting, and MUST NOT depend on the session's time of day, weather, or interior lighting state. A capture MUST record the game build, the map, the grid, the pixels per unit, the camera parameters, the lighting values it set, the culling mask, the pinned time, and the pinned weather.

A rerun with equal recorded inputs MUST produce equal bounds and an equal tile index.

#### Scenario: Two captures share their inputs

- **WHEN** two captures record equal inputs for one map
- **THEN** their bounds are equal
- **AND** their tile index covers the same tile positions

#### Scenario: A capture runs while the world reports no sunlight

- **WHEN** a capture begins while the session's directional light sits at zero intensity
- **THEN** the capture sets its own sun and ambient values
- **AND** the plate is lit by those values rather than by the session

### Requirement: A capture mutates no world state

A capture MUST exclude transient content with a camera culling mask rather than by deactivating objects. The mask MUST name its layers, and a named layer the build does not carry MUST fail the capture, because `LayerMask.GetMask` counts an unknown name as nothing and the plate would silently carry what the name meant to leave out. Where a capture cannot express an exclusion as a layer, it MUST restore what it changed before it returns, and MUST report what it changed.

After a capture, an export running in the same session MUST produce the same data it produces without a capture.

#### Scenario: Transient content is excluded

- **WHEN** a capture renders a cell containing characters, items, and effects
- **THEN** the plate contains none of them
- **AND** every object in the scene remains active

#### Scenario: The mask names a layer the build lacks

- **WHEN** a capture starts against a build that has no layer of a name the mask uses
- **THEN** the capture fails and names the missing layer
- **AND** no plate is written

#### Scenario: An export follows a capture in one session

- **WHEN** an export runs after a capture in the same session
- **THEN** its snapshot matches an export from a session with no capture
