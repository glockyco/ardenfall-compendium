## Why

Readers need to inspect the current main Ardenfall game with its own terrain and placed content, but the compendium targets the discontinued Demo build. Supporting both builds would preserve duplicate extraction code, commands, artifacts, and verification for a source the project no longer needs.

## What Changes

- **BREAKING:** Make the main `Ardenfall` game the compendium's only supported source and remove Demo extraction and publication support.
- Port the typed extraction mod to the main game's current assemblies and APIs.
- Replace Demo product checks with strict main-game identity checks while preserving plugin-digest and HotRepl port verification.
- Export canonical snapshots, basemap tiles, releases, and the site from the main game through the normal first-class commands.
- Build and open `/map` with main-game markers and terrain from the same release artifact.
- Remove Demo-specific environment examples, policies, tests, compatibility paths, and obsolete retail capture scripts.
- Add no entity descriptor, public route, or relationship predicate. Existing descriptors, canonical tables, and `/map` remain the only public contracts.

## Capabilities

### New Capabilities

- `build-profile-publication`: Defines the main game as the sole supported source across extractor builds, snapshots, releases, staging, and reader-visible provenance.

### Modified Capabilities

- `evidence-standard`: Replaces the Demo-only boundary with a main-game-only boundary while retaining fail-fast identity checks.
- `entity-extraction`: Requires the deployed extractor and running main game to match by product identity and plugin digest.

## Impact

- Affected code: the mod's game API calls and references, `controller/src/export-orchestrator.ts`, `pipeline/src/publication-identity.ts`, snapshot and artifact provenance, and site source metadata.
- Affected guidance: `AGENTS.md`, `.omp/skills/live-extraction/SKILL.md`, `.env.example`, package commands, and the verification gate.
- Affected tests: mod extraction contracts, controller identity checks, pipeline publication, artifact staging, and live browser verification.
- Migration: existing Demo snapshots and releases are obsolete and receive no compatibility alias or fallback.
