## Purpose

Defines how one compendium checkout selects, extracts, publishes, and identifies multiple supported Ardenfall builds without mixing their code, data, or artifacts.

## ADDED Requirements

### Requirement: Supported game profiles are explicit

The toolchain MUST define one source profile for each supported Ardenfall product. A profile MUST bind the Unity product name, expected build profile, game installation, extractor build, HotRepl endpoint, snapshot location, and artifact staging slot as one selection.

The Demo and Alpha MUST be supported profiles. An unknown product or a missing profile selection MUST fail before extraction.

#### Scenario: The operator selects Alpha

- **WHEN** the operator runs the extraction workflow with the Alpha profile
- **THEN** every build, deploy, connection, snapshot, and staging input comes from the Alpha profile
- **AND** no Demo path or artifact is used as a fallback

#### Scenario: An unsupported game answers

- **WHEN** the answering Unity product does not match the selected supported profile
- **THEN** extraction fails before it writes entity data
- **AND** the diagnostic names the selected profile and the answering product

### Requirement: Extractor builds are isolated by profile

Each supported source profile MUST compile against its own game assemblies and produce its own deployable extractor output. Building one profile MUST NOT replace the references or output used by another profile.

A source incompatibility between profiles MUST be represented by a typed profile implementation selected at build time. The build MUST NOT silence missing members, use an untyped fallback, or require edits to shared source files between profile builds.

#### Scenario: Both extractor profiles build

- **WHEN** the repository verification builds the Demo and Alpha extractors
- **THEN** each build resolves only the assemblies declared by its profile
- **AND** both outputs remain available after the command completes

#### Scenario: Alpha changes a game API

- **WHEN** shared extraction behavior depends on a game API that differs between Demo and Alpha
- **THEN** each profile supplies a compile-time checked implementation
- **AND** the shared canonical output contract remains identical

### Requirement: Source identity follows snapshots and releases

A snapshot and every release artifact built from it MUST record the selected profile, Unity product name, game version, build identifier, and extractor digest. Publication MUST accept a snapshot only when those values name one supported profile and agree with the profile selected for the release.

#### Scenario: An Alpha snapshot becomes a release

- **WHEN** an Alpha snapshot with complete, matching provenance passes validation
- **THEN** the pipeline creates an Alpha release artifact
- **AND** the artifact retains the Alpha identity without relabeling it as Demo content

#### Scenario: Release identity disagrees with the snapshot

- **WHEN** the requested release profile differs from the snapshot identity
- **THEN** publication fails
- **AND** no release artifact is produced

### Requirement: An interactive map uses one source profile

The site build MUST expose the source profile of its staged release. The map basemap, layer metadata, markers, search rows, and detail links MUST all come from that one release artifact.

#### Scenario: A reader opens an Alpha map

- **WHEN** the site is built from an Alpha release and the reader opens `/map`
- **THEN** the page identifies the Alpha source
- **AND** its terrain and markers resolve only from that Alpha release

#### Scenario: Inputs from two profiles are mixed

- **WHEN** site staging detects files or metadata from more than one source profile
- **THEN** staging fails before the site build
- **AND** the diagnostic names the conflicting profiles
