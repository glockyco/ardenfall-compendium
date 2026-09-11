## 1. Port the extractor to the main game

- [ ] 1.1 Copy the main game's assemblies through the existing library command, categorize every compiler failure by API boundary, and record the current build identity and 88 overworld plus 9 interior scene census in `design.md`.
- [ ] 1.2 Update each incompatible extraction call to the current typed game API while preserving DTOs, command names, entity descriptors, and required family coverage.
- [ ] 1.3 Update map capture for the current game's world and scene APIs; retain the full-grid terrain composition, cloud suppression, restoration checks, and recorded inputs.
- [ ] 1.4 Build the mod and run mod tests against the main-game assemblies; add behavioral tests only for changed compatibility boundaries that can plausibly regress.
- [ ] 1.5 Commit the verified main-game extractor port as one atomic mod change.

## 2. Cut export and publication identity over

- [ ] 2.1 Replace the controller's Demo product guard with strict `Ardenfall` validation while retaining HotRepl port ownership, deployed plugin digest, command coverage, and world readiness checks.
- [ ] 2.2 Update controller tests for accepted main-game identity and rejected Demo, unknown, stale-plugin, and missing identities.
- [ ] 2.3 Replace the pipeline's Demo publication guard with strict `Ardenfall` validation and update release tests for main-game acceptance and all failure cases.
- [ ] 2.4 Confirm snapshot and artifact manifests carry product name, game version, build identifier, and plugin digest without adding a redundant source field.
- [ ] 2.5 Commit the controller and pipeline identity cutover as one verified provenance change.

## 3. Expose source identity in the site

- [ ] 3.1 Emit the artifact product name once in site metadata and load it through the shared site read model.
- [ ] 3.2 Display an `Ardenfall` source label in the shared layout without adding product branches to map or entity components.
- [ ] 3.3 Add a behavioral staging check that rejects stale or mixed release files and proves `/map` terrain and markers use one artifact.
- [ ] 3.4 Build the synthetic fixture and verify the source label and unchanged `/map` route in a browser.
- [ ] 3.5 Commit reader-visible source attribution as one verified site change.

## 4. Remove Demo policy and obsolete tooling

- [ ] 4.1 Update `.env.example`, package commands, and setup guidance so the existing first-class workflow targets the main installation with no profile selector or Demo fallback.
- [ ] 4.2 Update `AGENTS.md` and `.omp/skills/live-extraction/SKILL.md` to make the main game the sole source and remove the Alpha embargo and Demo-only publication instructions.
- [ ] 4.3 Remove obsolete retail capture scripts after the first-class capture path covers their output; keep generated captures, snapshots, and releases ignored.
- [ ] 4.4 Update the repository gate and command assertions for the main-game build and live verification path.
- [ ] 4.5 Commit the policy and tooling cleanup as one verified change.

## 5. Produce and verify the main-game map

- [ ] 5.1 Install, build, deploy, and launch the mod through the first-class commands, then run a complete main-game export with full overworld capture.
- [ ] 5.2 Read the snapshot diagnostics and family counts; add synthetic structural equivalents for any new awkward shapes without copying authored values.
- [ ] 5.3 Build and stage the release, and record snapshot identity, basemap tile count, bytes, and deploy file count against the 20,000-file limit.
- [ ] 5.4 Open `/map` in a browser and verify the source label, main-game markers, main-game basemap, marker search, details, and tile transitions at three zoom levels.
- [ ] 5.5 Confirm representative markers align with the terrain and that the staged artifact contains no Demo source identity or stale Demo asset.

## 6. Complete the change

- [ ] 6.1 Run the full `AGENTS.md` gate: scoped tests, type checks, fixture build and smokes, entity and schema checks, lint, formatting, and diff checks.
- [ ] 6.2 Record the live evidence and final counts in this change, sync its delta specifications, and archive `support-alpha-build`.
