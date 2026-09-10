## 1. Mod reports its identity

- [x] 1.1 Report `Assembly.Location`, the SHA-256 of the assembly file and its last write time from `compendium.preflight`, capturing the digest in `Plugin.Awake` and failing when the location is empty or the file is absent.
- [x] 1.2 Cover the identity source and the preflight fields in `mod-tests`.

## 2. Controller rejects a stale instance

- [x] 2.1 Hash the deployed plugin under `ARDENFALL_PLUGINS_DIR/ArdenfallCompendium/ArdenfallCompendium.dll`.
- [x] 2.2 Compare it against the digest preflight reported, and fail the export before extraction when they differ, naming both digests, the reported path and its write time.
- [x] 2.3 Fail when preflight reports no identity, rather than falling back to the product-name comparison.
- [x] 2.4 Fail with the missing-variable message when `ARDENFALL_PLUGINS_DIR` is absent.
- [x] 2.5 Keep `assertExpectedProductName`, which catches a different game.

## 3. Snapshot names the mod

- [x] 3.1 Record the plugin digest in the snapshot manifest beside the game build, and no plugin path.
- [x] 3.2 Require it in `controller/src/validate-snapshot.ts`, and update the fixture manifest.

## 4. Tests and documentation

- [x] 4.1 Cover the match, the mismatch, the missing identity and the missing variable in `controller/test`.
- [x] 4.2 Reword the backend-identity gotcha in `skill://live-extraction` to point at this automated gate, keeping the manual product-name read as guidance for ad-hoc CLI probing only.
- [x] 4.3 Run the scoped gates in `AGENTS.md`, then one live export against the deployed plugin, and one against a deliberately stale plugin to see the failure.
