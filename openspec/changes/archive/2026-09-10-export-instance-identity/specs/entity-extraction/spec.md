## ADDED Requirements

### Requirement: An export proves which plugin answered

`compendium.preflight` MUST report the running plugin assembly's location, the SHA-256 of its bytes and its last write time. The digest MUST be read while the assembly loads, because a deploy into a running game replaces that file and a later read would report the deployed build as the running one. The controller MUST compare that digest against the plugin deployed under `ARDENFALL_PLUGINS_DIR` and MUST fail the export when they differ. A comparison MUST NOT rest on a value that is equal across builds, such as the Unity product name or a hard-coded plugin version.

The digest MUST reach the snapshot manifest, so a published snapshot names the mod that produced it and not only the game. The manifest MUST NOT carry the plugin path, which is a property of the machine that exported rather than of the snapshot.

#### Scenario: A stale instance is rejected

- **WHEN** the answering game runs a plugin whose digest differs from the deployed plugin
- **THEN** the export fails before it extracts anything
- **AND** the message names both identities and the deployed path

#### Scenario: The deployed instance is accepted

- **WHEN** the answering game runs the deployed plugin
- **THEN** preflight passes
- **AND** the manifest records the plugin digest beside the game build

#### Scenario: A deploy into a running game does not change what the game reports

- **WHEN** the plugin file is replaced while the game runs
- **THEN** the running plugin still reports the digest it was loaded with
- **AND** the next export fails on the mismatch

#### Scenario: A missing identity is a failure, not a skip

- **WHEN** preflight reports no plugin identity
- **THEN** the export fails
- **AND** the run does not fall back to comparing the product name alone
