## Context

See proposal.md — Why. Three constraints shape the approach.

`compendium.preflight` is a sync control command whose output the controller already reads at `controller/src/export-orchestrator.ts:146` and `:159`, so the identity travels on a channel that exists. The controller already resolves the deployment target: `bun run hotrepl:deploy` passes `ARDENFALL_PLUGINS_DIR` to `controller/src/deploy.ts`, and the same variable is available to the export. The game runs inside a CrossOver bottle, so the plugin path the mod reports is a Windows path while the controller holds the host path for the same file.

## Goals / Non-Goals

**Goals:**

- One comparison that separates the deployed plugin from any other, including an earlier build of itself.
- A failure that names what answered and what was expected, because the incident this prevents presented as missing snapshot fields.

**Non-Goals:**

- Detecting a second listener on the port. Only one client is connected at a time, and a second instrumented game answering first is already caught once the identity of the answering plugin is compared.
- Authenticating the connection. Loopback remains the authority boundary.
- Reporting a semantic mod version. A version string that a human maintains does not change per build, which is the reason the current guard fails.

## Decisions

### 1. The identity is the SHA-256 of the plugin assembly file

The mod hashes the bytes of its own assembly, found through `typeof(Plugin).Assembly.Location`, and reports the digest with the path and the file's last write time. The controller hashes the deployed `ArdenfallCompendium/ArdenfallCompendium.dll` under `ARDENFALL_PLUGINS_DIR` and compares digests. Equal bytes are the same build, and a rebuild changes them.

**The digest is read while the plugin loads, not when preflight runs.** The first implementation read it lazily and a live test passed when it had to fail: a deploy into a running game replaces the file at `Assembly.Location`, so the running plugin hashed the new build and reported itself as current. The plugin now constructs one identity in `Awake` and every command shares it, which is also what the log line at startup prints.

Alternatives considered. `Assembly.ManifestModule.ModuleVersionId` is also per-compilation, and an earlier draft of this design chose it, but reading a GUID out of a deployed file means parsing the PE header, the CLI header, the metadata root, the stream headers and the Module table to reach the `#GUID` heap. That is a second reader of a binary format on the critical path of every export, for no additional guarantee over a hash of the same bytes. `Plugin.Version` is a maintained constant and cannot distinguish builds. The assembly's build timestamp is not reliable under deterministic builds.

The path and the write time stay in the failure message as evidence for a reader; only the digest is compared, because the game reports a Windows path for a file the controller holds by its host path.

### 2. The port guard already covers the second half of the requirement

`assertSingleHotReplProcess` in `controller/src/export-orchestrator.ts:427` already fails when zero or more than one process holds the HotRepl port, so "more than one instrumented game can answer" is caught before the connection. What remains unguarded is one process running an old build of this mod, which is what the digest comparison adds.

### 3. A missing identity fails the export

An absent field must not silently reduce the check to the product-name comparison, which `.omp/RULES.md` prohibits: an input whose absence disables a check is prohibited. Preflight without an identity is a stale plugin by definition, because every build that carries this change reports one.

## Risks / Trade-offs

- [`Assembly.Location` is empty when a loader loads a plugin from bytes rather than from a file] → BepInEx 5 loads plugins from disk, so the location is present. Report the absence as a failed export rather than as a skipped comparison, which is what makes the case visible if a loader ever changes.
- [A developer who edits the mod without redeploying now sees a failed export instead of a confusing snapshot] → That is the intent. The message names `bun run hotrepl:setup` as the fix.
- [`ARDENFALL_PLUGINS_DIR` is absent in a shell that never deployed] → Fail with the missing-variable message the other scripts already use, rather than skipping the comparison.

## Migration Plan

The mod change ships first and is deployed by `bun run hotrepl:setup`. The controller check then rejects any game still running an older plugin, which is the behaviour the change exists to produce. Rollback is reverting the controller comparison; the extra preflight fields are additive and harm nothing.
