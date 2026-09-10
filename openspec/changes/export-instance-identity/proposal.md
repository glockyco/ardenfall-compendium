## Why

`openspec/specs/evidence-standard/spec.md:114` requires that an export name the build and the mod that produced it, and that an export fail when more than one instrumented game can answer. The controller does not satisfy that requirement. Its only guard is `assertExpectedProductName` in `controller/src/export-orchestrator.ts:446`, which compares the Unity product name reported by whichever instance answered against `Ardenfall Demo 2025`.

That guard catches a different game. It cannot catch the case the requirement was written for. The spec cites it directly: during the identity slice a stale instance answered an export, and the snapshot then lacked fields the deployed mod emits, so the absence looked like a data defect.

A stale instance passes today because every signal the guard reads is identical between builds. `Application.productName` is a property of the game, and `Plugin.Version` in `mod/src/Plugin.cs:14` is the hard-coded string `0.1.0`, which no build step changes. The port guard at `controller/src/export-orchestrator.ts:427` rejects a second listener, so the gap is narrower than the requirement suggests: one process, running an old build of this mod. A session on 2026-09-10 met the same class of failure from the other side: a MelonLoader game named `ancientkingdoms` answered every probe on the shared port and returned errors that read like defects in this repository, and only the HotRepl handshake's loader name revealed it.

## What Changes

- Report an **instance identity** from `compendium.preflight`: the running plugin assembly's location, the SHA-256 of its bytes, and its last write time. A rebuild changes the digest, so two builds are never confused.
- **Fail the export** when the running plugin's identity does not match the plugin deployed at `ARDENFALL_PLUGINS_DIR`. The controller already knows that directory, because `controller/src/deploy.ts` writes it.
- **Name the mod in the snapshot manifest**, through the same digest, so a published snapshot states which plugin produced it rather than only which game.
- Keep the product-name guard and the port guard. `assertSingleHotReplProcess` already fails when more than one process holds the port, and the product name still catches a different game; neither can see an old build of this mod.

## Capabilities

### Modified Capabilities

- `openspec/specs/entity-extraction`: the export contract gains an instance-identity precondition, and the manifest gains the mod identity that the evidence standard already requires an export to name.

## Impact

- `mod/src/Plugin.cs` and the preflight command, which gain the identity fields.
- `controller/src/export-orchestrator.ts`, which compares them against the deployed plugin and fails the run on a mismatch.
- `controller/src/validate-snapshot.ts` and the snapshot manifest, which gain the mod identity.
- `controller/test`, which covers the mismatch and the match.
- `skill://live-extraction`, whose backend-identity gotcha currently tells a reader to check the product name by hand.
