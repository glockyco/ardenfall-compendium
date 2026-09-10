## ADDED Requirements

### Requirement: An export proves which plugin answered

`compendium.preflight` MUST report the running plugin assembly's location, its module version id and its last write time. The controller MUST compare that identity against the plugin deployed under `ARDENFALL_PLUGINS_DIR` and MUST fail the export when they differ. A comparison MUST NOT rest on a value that is equal across builds, such as the Unity product name or a hard-coded plugin version.

The identity MUST reach the snapshot manifest, so a published snapshot names the mod that produced it and not only the game.

#### Scenario: A stale instance is rejected

- **WHEN** the answering game runs a plugin whose module version id differs from the deployed plugin
- **THEN** the export fails before it extracts anything
- **AND** the message names both identities and the deployed path

#### Scenario: The deployed instance is accepted

- **WHEN** the answering game runs the deployed plugin
- **THEN** preflight passes
- **AND** the manifest records the plugin identity beside the game build

#### Scenario: A missing identity is a failure, not a skip

- **WHEN** preflight reports no plugin identity
- **THEN** the export fails
- **AND** the run does not fall back to comparing the product name alone
