## Why

Readers need to inspect the non-demo Ardenfall world with its own terrain and placed content, but the current build, export, and publication contracts accept only the Demo. Ad hoc scene captures cannot produce a trustworthy interactive map because they bypass the canonical marker pipeline and cannot prove that the basemap and markers came from the same game build.

## What Changes

- Treat the Demo and Alpha as explicit, supported Ardenfall source profiles rather than accepting one hard-coded Unity product name.
- Build the mod against the selected install without replacing another profile's reference set or relying on temporary scripts.
- Export snapshots for either supported profile while preserving product name, build profile, build identifier, and plugin digest provenance.
- Publish release artifacts for either supported profile and make their identity visible to the site and deployment checks.
- Build and open the interactive `/map` route from an Alpha release so its markers and basemap come from the same snapshot.
- Remove the repository guidance and evidence contract that prohibit Alpha snapshots and publication. Keep rejection for unknown games, missing identity, plugin mismatches, and ambiguous HotRepl ports.
- Add no entity descriptor, public route, or relationship predicate. The existing `/map` route and descriptor-owned layers remain unchanged.

## Capabilities

### New Capabilities

- `build-profile-publication`: Defines supported game profiles, profile-specific mod builds, provenance, release selection, and the reader-visible source identity.

### Modified Capabilities

- `evidence-standard`: Replaces the Demo-only publication boundary with an explicit allowlist for supported Ardenfall products while retaining fail-fast identity checks.
- `entity-extraction`: Requires the deployed extractor to be built for the same supported source profile as the running game.

## Impact

- Affected code: `mod/ArdenfallCompendium.csproj`, mod build/deploy scripts, `controller/src/export-orchestrator.ts`, `pipeline/src/publication-identity.ts`, release staging and site metadata.
- Affected guidance: `AGENTS.md` and `.omp/skills/live-extraction/SKILL.md`.
- Affected tests: profile selection and incompatible-build failures in mod tooling, controller identity tests, pipeline publication tests, artifact staging checks, and browser verification of an Alpha map release.
- Compatibility risk: the Demo and Alpha expose different `Assembly-CSharp` APIs. Profile support must isolate those differences at compile-time or behind profile adapters; weakening type checking or reflection-based fallbacks is not acceptable.
