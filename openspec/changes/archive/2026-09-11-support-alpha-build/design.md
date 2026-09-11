## Context

See `proposal.md` for the reader-facing need.

The repository currently compiles against and accepts only `Ardenfall Demo 2025`. That identity is duplicated in `AGENTS.md`, `.omp/skills/live-extraction/SKILL.md`, `controller/src/export-orchestrator.ts`, `pipeline/src/publication-identity.ts`, and `openspec/specs/evidence-standard/spec.md`.

The main game is not binary-compatible with the Demo. On 2026-09-11, compiling the current mod against the main game's `Assembly-CSharp.dll` produced 64 missing-member or changed-signature errors across extraction families. A fresh live scene capture reached 88 overworld cell scenes and 9 interior cell scenes. The main game therefore requires a typed source migration, not a product-name exception.

The site is already artifact-driven. Its basemap, marker layers, search rows, and detail links come from one staged SQLite release and its content-hashed assets. The clean cutover can preserve that boundary unchanged.

## Goals / Non-Goals

**Goals:**

- Compile and deploy the extraction mod against the current main game.
- Export a complete canonical snapshot and full overworld capture from that game.
- Publish one release and build the interactive site from it.
- Preserve strict product, port, and plugin provenance checks.
- Delete Demo-specific support and guidance.

**Non-Goals:**

- Build or publish the Demo.
- Carry two source profiles, assembly sets, snapshot namespaces, or site stages.
- Add product branches to descriptors, canonical tables, map layers, or routes.
- Hide incompatible APIs behind reflection, dynamic dispatch, skipped families, or partial exports.
- Commit game assemblies, snapshots, captured tiles, databases, or releases.

## Decisions

### 1. Replace the source instead of adding profiles

`ARDENFALL_GAME_DIR` and its derived managed and plugin paths now identify the main `Ardenfall` installation. Existing setup, launch, export, release, and staging commands remain the single first-class path. No `--profile` option, profile registry, command aliases, or parallel artifact tree is added.

The controller's expected Unity product becomes `Ardenfall Alpha`. The pipeline publication guard accepts `Ardenfall Alpha` and rejects the Demo, unknown products, and missing identity. Snapshot and artifact manifests continue carrying product name, game version, build identifier, and plugin digest, so no second source-profile field is needed.

Alternative rejected: retain the dual-profile design. It doubles build and verification boundaries for a source the user no longer wants.

### 2. Port shared extraction code directly to the current API

Copy main-game assemblies into the existing ignored `mod/libs/` directory and compile the existing project output. The 64 failures grouped into removed record-table fields, renamed or removed parameter fields, and changed value types. Update each extraction boundary to the current typed member or signature.

The canonical DTOs, descriptor registry, command names, completeness checks, SQLite tables, and public routes do not change. If a current-game concept genuinely disappeared, the extractor must prove that through a live census and update the canonical contract explicitly; it must not return an empty value merely to compile.

Alternative rejected: conditional Demo and Alpha adapters. A clean cutover has one implementation and lets the compiler expose obsolete assumptions.

### 3. Keep identity checks independent

Before a run starts, the controller verifies:

1. one process owns the configured HotRepl port;
2. the Unity product is `Ardenfall`;
3. the running plugin digest equals the plugin deployed under the configured main-game plugin directory;
4. required commands and world readiness pass.

Changing the allowed product does not weaken stale-process detection. The error text names the expected main game rather than an obsolete publication embargo.

### 4. Reuse the existing snapshot, release, and site boundaries

The main-game snapshot uses the current atomic writer and validator. The pipeline builds the current release artifact shape. Site staging remains a replacement operation from one manifest-backed artifact; it must reject stale files and expose the artifact's product identity to the layout.

The `/map` route receives terrain and markers from that same release. No separate alpha viewer, static HTML, spike script, or alternate map data loader survives.

Existing ignored Demo snapshots and releases are obsolete local output. Code and documentation receive no compatibility alias for their paths.

### 5. Show the source identity to readers

Add the artifact's product name to generated site metadata and render a concise `Ardenfall` source label in the shared layout. This is one producer and one read model. Map components do not inspect product identity.

### 6. Rewrite policy around the main game

Update `AGENTS.md`, `.omp/skills/live-extraction/SKILL.md`, `.env.example`, and command examples. Remove the Alpha embargo, Demo-only instructions, dual-install warnings that prescribe the Demo, and read-only retail capture workflow. Retain the general warning about multiple HotRepl processes and the requirement to verify live reader-facing changes in the browser.

## Risks / Trade-offs

- The current API migration spans many extraction families. Compile success is necessary but insufficient; a live export must prove family coverage and diagnostics.
- Main-game data can carry shapes absent from the synthetic fixture. Add structural equivalents to the fixture without copying authored values.
- The full map has 88 authored overworld scenes instead of the Demo's 24. Capture time and deploy file count must be measured against the 20,000-file gate.
- Removing Demo support is intentionally breaking. Restoring it later would require a new change with its own compatibility and provenance design.
