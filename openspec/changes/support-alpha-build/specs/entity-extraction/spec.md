## MODIFIED Requirements

### Requirement: An export proves which plugin answered

`compendium.preflight` MUST report the running plugin assembly's location, the SHA-256 of its bytes, its last write time, and the Unity product name. The digest MUST be read while the assembly loads, because a deploy into a running game replaces that file and a later read would report the deployed build as the running one. The controller MUST compare that digest against the plugin deployed to the main game and MUST fail the export when they differ. It MUST also fail when the answering product is not `Ardenfall Alpha`. A comparison MUST NOT rest on a hard-coded plugin version.

The digest and product identity MUST reach the snapshot manifest, so a published snapshot names the mod and game that produced it. The manifest MUST NOT carry the plugin path, which is a property of the exporting machine.

#### Scenario: A stale instance is rejected

- **WHEN** the answering game runs a plugin whose digest differs from the deployed main-game plugin
- **THEN** the export fails before it extracts anything
- **AND** the message names both digests and the deployed path

#### Scenario: The deployed instance is accepted

- **WHEN** the main game runs the deployed plugin
- **THEN** preflight passes
- **AND** the manifest records the plugin digest beside the game build

#### Scenario: A deploy into a running game does not change what the game reports

- **WHEN** the plugin file is replaced while the game runs
- **THEN** the running plugin still reports the digest it was loaded with
- **AND** the next export fails on the mismatch

#### Scenario: A missing identity is a failure, not a skip

- **WHEN** preflight reports no plugin identity or product name
- **THEN** the export fails
- **AND** the run does not fall back to a plugin version or path alone
