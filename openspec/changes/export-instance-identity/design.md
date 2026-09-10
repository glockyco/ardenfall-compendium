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

### 1. The identity is the plugin assembly's module version id

`Assembly.GetExecutingAssembly().ManifestModule.ModuleVersionId` is a fresh GUID for every compilation, so it separates two builds of the same source. The mod reports it beside `Assembly.Location` and `File.GetLastWriteTimeUtc`, which make a mismatch legible to a reader.

Alternatives considered. A file hash means the controller reads the DLL twice and compares bytes; the MVID is already a content-derived identity and needs no reader on the game side. `Plugin.Version` is a maintained constant and cannot distinguish builds. The assembly's build timestamp is not reliable under deterministic builds.

### 2. The controller reads the MVID from the deployed file

The controller cannot compare a Windows path to a host path, so it compares identities rather than locations. It reads the MVID out of the deployed `ArdenfallCompendium.dll` under `ARDENFALL_PLUGINS_DIR`. That value lives in the CLI header's GUID heap, so the reader parses the PE and metadata headers rather than shelling out to a .NET tool the export does not otherwise need.

The reported path stays in the failure message as evidence, not as the comparison.

### 3. A missing identity fails the export

An absent field must not silently reduce the check to the product-name comparison, which `.omp/RULES.md` prohibits: an input whose absence disables a check is prohibited. Preflight without an identity is a stale plugin by definition, because every build that carries this change reports one.

## Risks / Trade-offs

- [The PE and metadata parse is a second reader of a binary format] → Keep it to the path from the COFF header to the `#GUID` heap, cover it with a test against the deployed DLL, and fail loudly rather than returning a default when a header is absent.
- [A developer who edits the mod without redeploying now sees a failed export instead of a confusing snapshot] → That is the intent. The message names `bun run hotrepl:setup` as the fix.
- [`ARDENFALL_PLUGINS_DIR` is absent in a shell that never deployed] → Fail with the missing-variable message the other scripts already use, rather than skipping the comparison.

## Migration Plan

The mod change ships first and is deployed by `bun run hotrepl:setup`. The controller check then rejects any game still running an older plugin, which is the behaviour the change exists to produce. Rollback is reverting the controller comparison; the extra preflight fields are additive and harm nothing.
