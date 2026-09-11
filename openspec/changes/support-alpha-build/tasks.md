## 1. Profile registry and commands

- [ ] 1.1 Add the checked-in `demo` and `alpha` profile registry with product identity, environment keys, build target, HotRepl endpoint, and artifact namespaces; test missing and unknown profile failures.
- [ ] 1.2 Replace environment-dependent setup, launch, export, release, and site-stage entry points with one `--profile` selector plus explicit Demo and Alpha package-script aliases; prove both resolve without machine paths in committed files.
- [ ] 1.3 Move copied game references and mod outputs into ignored profile-specific directories; build Demo, build Alpha, then rebuild Demo and confirm neither build changes the other profile's references or output digest.
- [ ] 1.4 Commit the profile registry and command boundary as one verified tooling change.

## 2. Typed extractor compatibility

- [ ] 2.1 Capture and categorize the Alpha compiler failures by game API boundary, and record the live Alpha build identity and the 88 overworld plus 9 interior scene census in this design.
- [ ] 2.2 Add the compile-time profile contract and embed the selected profile in the plugin assembly and `compendium.preflight`; test absent, unknown, and mismatched profiles.
- [ ] 2.3 Move each differing game API behind a typed Demo or Alpha adapter while keeping shared DTOs, command names, entity descriptors, and completeness checks unchanged.
- [ ] 2.4 Build and run mod tests against both profile targets; fail if either profile skips a registered entity family or depends on another profile's assemblies.
- [ ] 2.5 Commit the profile-isolated extractor as one verified mod change.

## 3. Export identity and namespaces

- [ ] 3.1 Replace the controller's hard-coded Demo product check with selected-profile validation of Unity product, extractor profile, deployed plugin digest, and HotRepl port ownership.
- [ ] 3.2 Add `sourceProfile` to snapshot schemas and manifests, and namespace snapshot output by profile; regenerate validators and test Alpha acceptance, wrong-profile rejection, unknown-game rejection, and missing identity.
- [ ] 3.3 Route full-map capture through the selected profile with no special Alpha command path; test that capture and entity extraction share one run and one source identity.
- [ ] 3.4 Commit the controller and snapshot identity cutover as one verified change.

## 4. Release and staging provenance

- [ ] 4.1 Replace the Demo-only publication guard with the supported profile registry; require an explicit release profile and reject mismatched or unproven snapshots.
- [ ] 4.2 Add `sourceProfile` to artifact schemas, release ids, diagnostics, and profile-specific release directories; regenerate validators and test that Demo and Alpha artifacts cannot collide.
- [ ] 4.3 Make site staging profile-specific and reject an artifact or staged file tree whose source profile differs from the selected slot.
- [ ] 4.4 Extend synthetic fixtures with distinct Demo and Alpha provenance without copying Alpha-authored content; verify release and staging behavior from both fixtures.
- [ ] 4.5 Commit the release and staging provenance boundary as one verified pipeline change.

## 5. Reader-visible source profile

- [ ] 5.1 Load the staged release identity into the site read model and display its Demo or Alpha label in the shared layout without adding profile branches to entity or map rendering.
- [ ] 5.2 Verify `/map` takes its basemap, marker layers, search rows, and details from one staged profile; add a behavioral staging or browser check that fails on mixed profiles.
- [ ] 5.3 Build both fixture profiles and open each in a browser to confirm the source label and unchanged routes.
- [ ] 5.4 Commit reader-visible profile attribution as one verified site change.

## 6. Policy and operator guidance

- [ ] 6.1 Update `AGENTS.md` and `.omp/skills/live-extraction/SKILL.md` to describe Demo and Alpha as supported, separate profiles; remove the Alpha export and publication prohibition while retaining provenance and no-mixing rules.
- [ ] 6.2 Update command examples, environment templates, and the repository gate for explicit profiles and both mod builds; remove obsolete unqualified artifact paths and aliases.
- [ ] 6.3 Commit the policy and guidance cutover as one documentation change.

## 7. Live Alpha map

- [ ] 7.1 Install and deploy the Alpha-profile extractor through the first-class command, then run a complete Alpha export with overworld capture; no spike script or temporary file may participate.
- [ ] 7.2 Build an Alpha release and Alpha site stage, and record snapshot identity, entity counts, basemap tile count, bytes, and deploy file count.
- [ ] 7.3 Open the Alpha `/map` route in a browser and verify the Alpha label, Alpha markers, Alpha basemap, marker search, details, and tile transitions at three zoom levels.
- [ ] 7.4 Confirm representative markers align with the Alpha terrain and that the artifact contains no Demo source identity or staged Demo asset.
- [ ] 7.5 Commit any synthetic awkward shapes exposed by the live Alpha export, without copying authored Alpha values.

## 8. Verification and cleanup

- [ ] 8.1 Remove the obsolete retail capture scripts and their code paths after the first-class Alpha export reproduces their only useful output; keep generated captures and releases ignored.
- [ ] 8.2 Run the full `AGENTS.md` gate, including both profile builds, both fixture stages, all smokes, type checks, schema checks, lint, formatting, and diff checks.
- [ ] 8.3 Sync the delta specifications and archive `support-alpha-build` after every task and live browser check passes.
