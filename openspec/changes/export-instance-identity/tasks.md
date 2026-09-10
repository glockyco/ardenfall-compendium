## 1. Mod reports its identity

- [ ] 1.1 Report `Assembly.Location`, `ManifestModule.ModuleVersionId` and the assembly's last write time from `compendium.preflight`.
- [ ] 1.2 Cover the identity fields in `mod-tests`, asserting the module version id is non-empty and the location names the loaded assembly.

## 2. Controller rejects a stale instance

- [ ] 2.1 Read the module version id from the deployed plugin under `ARDENFALL_PLUGINS_DIR`, parsing the PE and CLI metadata headers to reach the `#GUID` heap.
- [ ] 2.2 Compare it against the identity preflight reported, and fail the export before extraction when they differ, naming both identities and the deployed path.
- [ ] 2.3 Fail when preflight reports no identity, rather than falling back to the product-name comparison.
- [ ] 2.4 Fail with the missing-variable message when `ARDENFALL_PLUGINS_DIR` is absent.
- [ ] 2.5 Keep `assertExpectedProductName`, which catches a different game.

## 3. Snapshot names the mod

- [ ] 3.1 Record the plugin identity in the snapshot manifest beside the game build.
- [ ] 3.2 Require it in `controller/src/validate-snapshot.ts`, and update the fixture manifest.

## 4. Tests and documentation

- [ ] 4.1 Cover the match, the mismatch, the missing identity and the missing variable in `controller/test`.
- [ ] 4.2 Reword the backend-identity gotcha in `skill://live-extraction` to point at this automated gate, keeping the manual product-name read as guidance for ad-hoc CLI probing only.
- [ ] 4.3 Run the scoped gates in `AGENTS.md`, then one live export against the deployed plugin, and one against a deliberately stale plugin to see the failure.
