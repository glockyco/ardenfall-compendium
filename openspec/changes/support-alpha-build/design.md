## Context

See `proposal.md` for the reader-facing need.

The current source identity is duplicated as a Demo-only rule in `AGENTS.md`, `.omp/skills/live-extraction/SKILL.md`, `controller/src/export-orchestrator.ts`, `pipeline/src/publication-identity.ts`, and `openspec/specs/evidence-standard/spec.md`. The controller and pipeline fail on every Unity product except `Ardenfall Demo 2025`.

The two game builds are not binary-compatible. On 2026-09-11, compiling the current mod against the Alpha `Assembly-CSharp.dll` produced 64 missing-member or changed-signature errors across extraction families. A fresh live Alpha scene capture reached 88 overworld cell scenes and 9 interior cell scenes. These observations rule out treating Alpha as only another product-name string.

The map is already artifact-driven. Its basemap metadata, marker layers, search rows, and detail links all come from the staged SQLite release and its content-hashed assets. Keeping that boundary lets one site build show one coherent source without map-specific branches.

## Goals / Non-Goals

**Goals:**

- Select Demo or Alpha once for build, deploy, export, release, staging, and browser verification.
- Keep both extractor builds and both release families available at the same time.
- Preserve compile-time checking against each game's API.
- Keep all canonical entities and map read models identical across profiles.
- Make the active source profile visible to operators and readers.

**Non-Goals:**

- Merge Demo and Alpha rows into one site build.
- Add profile branches to entity descriptors, canonical SQLite tables, map layers, or routes.
- Accept arbitrary Unity products because they happen to load the plugin.
- Hide missing Alpha support behind reflection, dynamic dispatch, skipped families, or partial exports.
- Commit game assemblies, raw snapshots, captured tiles, or release artifacts.

## Decisions

### 1. One checked-in profile registry owns supported identities

Add a repository profile registry with two ids, `demo` and `alpha`. Each entry owns the expected Unity product name, expected source/build profile, environment-variable names for the installation and HotRepl endpoint, extractor build target, snapshot namespace, artifact namespace, and site staging slot.

Commands that touch a live game require `--profile <id>`. Package scripts may provide explicit `:demo` and `:alpha` aliases, but they call the same profile-aware implementation. There is no default for export or publication: an omitted profile could silently attach to the wrong install.

The controller compares the answering product to the selected registry entry. The pipeline validates the snapshot against the selected registry entry. Unknown products remain rejected. The port process check and plugin digest check remain mandatory.

Alternative rejected: make the expected product name an arbitrary environment variable. That converts a source-of-truth allowlist into an operator assertion and would permit any instrumented game to pass.

### 2. Mod references and outputs are profile-scoped

Store copied game references under ignored `mod/libs/<profile>/` and build outputs under `mod/bin/<profile>/`. The build command supplies a required `SourceProfile` MSBuild property; the project fails when it is absent or unknown. Building Alpha cannot overwrite the Demo references or plugin output.

Shared extraction code contains only APIs common to both builds. Compile-time profile projects or conditionally included adapter files own differing game calls. Both targets emit the same DTOs, command names, snapshot schemas, and entity-family completeness checks.

The Alpha compile failure measured above affects many entity families, so the first implementation step is a categorized compatibility report. Each incompatibility must be resolved in a typed profile adapter or by updating shared code when both builds expose the same replacement. A family remains required unless the entity registry explicitly says the selected build does not contain that family and a live census proves it.

Alternative rejected: reflection helpers around missing members. They would move API errors from compile time into a two-minute live export and would allow silent empty fields.

### 3. Extractor profile is compiled into plugin identity

The selected profile id is embedded as assembly metadata and returned by `compendium.preflight`. The controller checks product name, extractor profile, deployed plugin digest, and the selected profile before it begins a run. The snapshot manifest records the extractor profile separately from the game's own product and build identifiers.

This removes the old contract that inferred acceptability from one Demo product string. It does not weaken stale-plugin or wrong-port detection.

### 4. Profile namespaces every persisted boundary

Snapshots use `snapshots/<profile>/snapshots/<id>`. Release artifacts use `pipeline/artifacts/releases/<profile>/<id>`. Site staging uses `site/.stage/release/<profile>`. Artifact ids include the profile, so equal game version strings cannot collide.

The artifact manifest carries the profile as source provenance. Staging accepts one complete release artifact and rejects copied files whose manifest names another profile. It never overlays one profile's files on another profile's stage.

The existing unqualified Demo paths receive a clean migration to the `demo` namespace. Compatibility aliases are not retained because they create two locations for one artifact.

### 5. The site renders one profile and labels it

A site build consumes exactly one staged release profile. The layout exposes its source label, and `/map` uses the release's existing basemap, layer metadata, markers, search data, and detail routes without profile-specific rendering branches.

This gives the requested Alpha terrain and Alpha markers on the current interactive map. A separate in-page profile switch is unnecessary: switching profiles means staging and building another coherent release. Supporting two profiles in one deployment can be proposed later if readers need it.

### 6. Repository policy describes provenance, not an embargo

Update `AGENTS.md`, `.omp/skills/live-extraction/SKILL.md`, and the evidence specification. Demo and Alpha become supported but distinct inputs. Guidance requires an explicit profile, source labels, isolated artifacts, and same-profile browser verification. Remove statements that prohibit Alpha snapshots or publication.

The safety rule becomes: never mix profiles and never accept an unproven or unsupported identity.

## Risks / Trade-offs

- The Alpha API can change independently. Both profile builds must run in the repository gate, so drift fails before a live export.
- Alpha may contain shapes absent from the synthetic fixture. A live Alpha export and browser pass are required, and each new shape must enter the fixture without copying Alpha-authored values.
- Two release families increase local disk usage. Generated snapshots, tiles, databases, and releases remain ignored and removable by profile.
- A single-profile site build avoids mixed-source behavior but does not provide instant switching. It is the smaller reliable contract for the requested map.
- Removing the embargo is a policy change. Provenance remains reader-visible so screenshots and shared builds can be attributed correctly.
