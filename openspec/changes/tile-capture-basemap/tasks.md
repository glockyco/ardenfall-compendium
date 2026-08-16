## 1. Prove the capture against real terrain

- [ ] 1.1 Confirm that `world-cell-content` delivers a walk this change can call. State in this change which of its commands loads a map and a cell, and which unloads them. Do not start until that walk exists.
- [ ] 1.2 Reach one authored overworld cell through that walk, and record the loaded scene list and the sun intensity the session reports.
- [ ] 1.3 Establish capture lighting explicitly: sun direction, sun intensity, ambient value, fog off, post-processing off. Capture one cell and read the plate in this session. A dark plate fails this task.
- [ ] 1.4 Capture the same cell at two resolutions, and compare both against the game's own imagery at 1.667 pixels per unit. Record the comparison and close the resolution decision in `design.md`.
- [ ] 1.5 Capture one interior cell, and settle the ceiling question. Record which option worked and what it changed.
- [ ] 1.6 Capture one cell that has no authored scene, so the distant-cell fidelity difference is visible rather than assumed. Close the coverage decision in `design.md`.

## 2. Capture command in the mod

- [ ] 2.1 Add a capture handler to the mod's command registry beside the existing entity commands, taking a map, a cell range, and a pixels-per-unit value.
- [ ] 2.2 Render each cell with an orthographic camera whose bounds come from the declared grid, using a culling mask for suppression. Mutate no world state.
- [ ] 2.3 Write each tile as a PNG named by the hash of its content, in the staging layout the icon exporter already uses.
- [ ] 2.4 Record the capture inputs and the loaded cell inventory in the capture output.
- [ ] 2.5 Add mod tests for bounds derivation, tile positioning, and the recorded inputs. Do not test the render itself.

## 3. Controller phase

- [ ] 3.1 Add a capture phase to `controller/src/export-orchestrator.ts` after the world is ready and before finalize, and expose it as its own command so an export can run without a capture.
- [ ] 3.2 Fail the phase when the capture reports a mutation it could not restore.
- [ ] 3.3 Add controller tests for the phase order and for a capture that reports a partial cell inventory.

## 4. Pipeline ingest

- [ ] 4.1 Convert captured PNG tiles to WebP through the existing asset stage, so each tile becomes a content-hashed asset in the artifact manifest.
- [ ] 4.2 Emit the tile index that resolves map, zoom, and position to an asset hash and byte size, and record empty positions.
- [ ] 4.3 Build the zoom pyramid by combining finer tiles, and take the finest level from the map's maximum zoom so one producer owns that number.
- [ ] 4.4 Fail the slice when a published placement lies outside the captured bounds, when a position inside the bounds is unresolved, or when the capture's game build differs from the snapshot's.
- [ ] 4.5 Emit basemap metadata per map on the map view: bounds, pixels per unit, zoom range, tile size, and index reference.
- [ ] 4.6 Report tile count, total bytes, bounds, pixels per unit, and game build per map.
- [ ] 4.7 Add pipeline tests for the index, the pyramid, the empty-position record, and each failure above.

## 5. Site rendering

- [ ] 5.1 Decide the renderer: `TileLayer` from `@deck.gl/geo-layers`, which is not installed, or a tile selector over the installed `BitmapLayer`. Record the measurement that decided it, including bundle cost on the map route.
- [ ] 5.2 Render the basemap beneath the marker layers from the published metadata, with no coordinate transform and no branch on layer identity.
- [ ] 5.3 Keep the map working when a map publishes no basemap.
- [ ] 5.4 Add site tests for basemap ordering, for a map without a basemap, and for tile requests resolving through the index.

## 6. Fixture and gate

- [ ] 6.1 Add a small captured tile set to `fixtures/synthetic/snapshot`, including one empty position and one map without a basemap, so CI exercises both paths.
- [ ] 6.2 Extend the map smoke to assert that a basemap tile reaches the built page, selected by state rather than by a fixture name.
- [ ] 6.3 Report the deploy file count against the 20,000 limit after the first full capture, and record it.

## 7. Verification

- [ ] 7.1 Run a live export with a capture, build a release, and open the map in a browser. Read the plate under the markers at three zoom levels.
- [ ] 7.2 Confirm alignment against the game's own imagery, which shares the grid, and record the result.
- [ ] 7.3 Run the full gate in `AGENTS.md`.
- [ ] 7.4 Decide whether to publish the game's imagery as an alternative layer, and either open a change for it or record the rejection.
- [ ] 7.5 Archive this change after the gate passes.
