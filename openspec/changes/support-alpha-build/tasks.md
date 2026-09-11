## 1. Port the extractor to the main game

- [x] 1.1 Copy the main game's assemblies through the existing library command, categorize every compiler failure by API boundary, and record the current build identity and 88 overworld plus 9 interior scene census in `design.md`.
- [x] 1.2 Update each incompatible extraction call to the current typed game API while preserving DTOs, command names, entity descriptors, and required family coverage.
- [x] 1.3 Update map capture for the current game's world and scene APIs; retain the full-grid terrain composition, cloud suppression, restoration checks, and recorded inputs. (The capture now drives `WorldStreamer.OverrideUpdateStreamer` per cell and renders the world the game streams; the isolated-copy load, renderer suppression, distant-prefab instantiation and the authored-only mode are removed. The Demo layer names in the mask did not exist in Alpha and the Polaris ground lives on `NoInteriorLight`; see `probes/ground-layer-probe.md`.)
- [x] 1.4 Build the mod and run mod tests against the main-game assemblies; add behavioral tests only for changed compatibility boundaries that can plausibly regress.
- [x] 1.5 Commit the verified main-game extractor port as one atomic mod change.

## 2. Cut export and publication identity over

- [x] 2.1 Replace the controller's Demo product guard with strict `Ardenfall` validation while retaining HotRepl port ownership, deployed plugin digest, command coverage, and world readiness checks.
- [x] 2.2 Update controller tests for accepted main-game identity and rejected Demo, unknown, stale-plugin, and missing identities.
- [x] 2.3 Replace the pipeline's Demo publication guard with strict `Ardenfall` validation and update release tests for main-game acceptance and all failure cases.
- [x] 2.4 Confirm snapshot and artifact manifests carry product name, game version, build identifier, and plugin digest without adding a redundant source field.
- [x] 2.5 Commit the controller and pipeline identity cutover as one verified provenance change.

## 3. Expose source identity in the site

- [x] 3.1 Emit the artifact product name once in site metadata and load it through the shared site read model.
- [x] 3.2 Display an `Ardenfall` source label in the shared layout without adding product branches to map or entity components.
- [x] 3.3 Add a behavioral staging check that rejects stale or mixed release files and proves `/map` terrain and markers use one artifact. (`stageArtifact` replaces the slot's static root and database from one manifest and refuses a dirty-tree release; `artifact-staging.test.ts` now stages into a temporary site so the check cannot overwrite a live slot.)
- [x] 3.4 Build the synthetic fixture and verify the source label and unchanged `/map` route in a browser. (Fixture build: 297 deploy files; `/map` renders 24 markers, layer toggles and URL sync work, no page errors.)
- [x] 3.5 Commit reader-visible source attribution as one verified site change.

## 4. Remove Demo policy and obsolete tooling

- [x] 4.1 Update `.env.example`, package commands, and setup guidance so the existing first-class workflow targets the main installation with no profile selector or Demo fallback.
- [x] 4.2 Update `AGENTS.md` and `.omp/skills/live-extraction/SKILL.md` to make the main game the sole source and remove the Alpha embargo and Demo-only publication instructions.
- [x] 4.3 Remove obsolete retail capture scripts after the first-class capture path covers their output; keep generated captures, snapshots, and releases ignored. (No retail capture script is tracked; `spikes/` stays ignored.)
- [x] 4.4 Update the repository gate and command assertions for the main-game build and live verification path. (The controller test covers a game-drive output path and the Wine prefix mapping; the gate passes on 2026-09-11.)
- [x] 4.5 Commit the policy and tooling cleanup as one verified change.

## 5. Produce and verify the main-game map

- [x] 5.1 Install, build, deploy, and launch the mod through the first-class commands, then run a complete main-game export with full overworld capture. (Snapshot `0.0.10.136-20260911-2143555904880`: 1,696 items, 322 NPCs, 43 portals, 544 world spawns, 397 conversations; capture of the declared grid `[-14,-10]..[2,4]`, 255 of 255 cells, 88 authored.)
- [x] 5.2 Read the snapshot diagnostics and family counts; add synthetic structural equivalents for any new awkward shapes without copying authored values. (0 fatal, 267 diagnostics. New shapes: a `RecordID` with one guid, an item registered under `<Mod>.<Asset>`, two spawners sharing one guid in a cell, a spell whose tooltip throws in the game. The modded item joined the fixture; the others are handled at the source with a diagnostic.)
- [x] 5.3 Build and stage the release, and record snapshot identity, basemap tile count, bytes, and deploy file count against the 20,000-file limit. (Release `0.0.10.136-20260911-2143555904880`, `Ardenfall Alpha 0.0.10.136 release`; 369 tiles over 6 zoom levels, 17.3 MB of tiles, 519 assets, 19 MB; 6,537 pages; 13,741 deploy files after the build prunes 6,535 page data files of pages that never hydrate.)
- [x] 5.4 Open `/map` in a browser and verify the source label, main-game markers, main-game basemap, marker search, details, and tile transitions at three zoom levels. (Footer names `Ardenfall Alpha 0.0.10.136`; 2,805 overworld markers; terrain renders at the overview, settlement and single-cell zooms; the character layer toggle changes the count 2805 to 2564 and back; no page errors, no failed tile requests.)
- [x] 5.5 Confirm representative markers align with the terrain and that the staged artifact contains no Demo source identity or stale Demo asset. (Settlement markers sit on the settlement plates; `_release.json` records `Ardenfall Alpha`, and staging replaces the slot's assets from the manifest.)

## 6. Complete the change

- [x] 6.1 Run the full `AGENTS.md` gate: scoped tests, type checks, fixture build and smokes, entity and schema checks, lint, formatting, and diff checks. (Passes on 2026-09-11.)
- [x] 6.2 Record the live evidence and final counts in this change, sync its delta specifications, and archive `support-alpha-build`.
