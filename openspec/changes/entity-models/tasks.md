## 0. Gate

- [ ] 0.1 Obtain the developer's written permission to publish extracted geometry, and record it in this
      change. No task below starts before this one closes.
- [ ] 0.2 Record the decision on whether a reader may download a model file, defaulting to view only.

## 1. Asset path widening

- [ ] 1.1 Widen `schemas/asset-manifest.schema.json`: add a model kind, and accept a `.glb` source path
      beside `.png`.
- [ ] 1.2 Widen `SnapshotAssetEntry.kind` and `EmittedAssetRef.assetKind` in `pipeline/src/types.ts` from
      the literal image to a union.
- [ ] 1.3 Add the model branch to `pipeline/src/stages/emit-assets.ts`, which hashes and copies a GLB and
      never routes it through `sharp`.
- [ ] 1.4 Regenerate the validators and confirm `asset_refs` needs no DDL change.
- [ ] 1.5 Test that an image asset still emits exactly as before, and that a GLB emits without conversion.

## 2. Geometry export in the mod

- [ ] 2.1 Add a mesh reader that takes a vertex layout from the mesh's attribute table and decodes
      positions, normals, tangents and texture coordinates by that layout, including half-precision
      attributes.
- [ ] 2.2 Read geometry through the mesh's vertex and index buffers, so a mesh the runtime marks
      unreadable still exports.
- [ ] 2.3 Verify each decoded mesh against the source mesh's declared bounds and index range, and emit a
      diagnostic instead of a row when either fails.
- [ ] 2.4 Add the GLB writer: 12-byte header, JSON chunk and BIN chunk, each padded to 4 bytes, accessor
      component types per attribute, and buffer views that do not mix indices with attributes.
- [ ] 2.5 Convert Unity's coordinate system to glTF's, applying it to positions, normals, tangents and node
      transforms, and reverse triangle winding so faces stay outward.
- [ ] 2.6 Export the base colour texture per material, reusing the existing GPU readback, and write the
      material factors the game's shaders expose.
- [ ] 2.7 Record the source mesh asset name and the build identity on every model row.
- [ ] 2.8 Cover with tests: two different strides, a half-precision attribute, an empty read, an
      out-of-range index, and the axis conversion.

## 3. Item models

- [ ] 3.1 Resolve each item's pickup prefab through the prototype chain, and export one model per unique
      mesh so a shared mesh is exported once.
- [ ] 3.2 Attach the model to the item rows that reference it.
- [ ] 3.3 Report models exported, models recovered from unreadable meshes, and failures, per family.

## 4. Avatar models

- [ ] 4.1 Measure the avatar variant count across races, genders and avatar forms, and record the number in
      this change before exporting anything.
- [ ] 4.2 Compose an avatar through the game's own avatar and pose it as the mannequin does.
- [ ] 4.3 Bake the composed geometry and export it, naming the variant each model was composed for.
- [ ] 4.4 Attach avatar models to their character and armour rows.

## 5. Posters

- [ ] 5.1 Capture a still image of each model's subject from the same scene, reusing the existing capture
      and image asset path.
- [ ] 5.2 Attach the poster to the same entity row as the model.

## 6. Presentation

- [ ] 6.1 Add the model surface, rendering the poster from prerendered output with no viewer code.
- [ ] 6.2 Load the viewer on demand only, and keep it out of the bundles of routes that show no model.
- [ ] 6.3 Give the viewer alternative text, keyboard operation and a visible failure state.
- [ ] 6.4 Apply `meshopt` compression and self-host its decoder.

## 7. Fixtures and gates

- [ ] 7.1 Add synthetic fixtures: a static model, a composed avatar model, a shared mesh referenced by two
      rows, a model that fails bounds verification, and an entity with no model.
- [ ] 7.2 Run the scoped mod, pipeline and site suites.
- [ ] 7.3 Run the repository gate in `AGENTS.md` - Commands.

## 8. Live verification

- [ ] 8.1 Export from the running game and record coverage against the 176 unique item meshes and 48
      armour meshes.
- [ ] 8.2 Build the site from that export and open an item page and a character page in a browser, with
      scripting enabled and disabled.
- [ ] 8.3 Record the deployed file count and total asset size against the 20,000-file limit.
- [ ] 8.4 Add any live-only shape to the synthetic fixture.
