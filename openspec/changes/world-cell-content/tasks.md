## 1. Walk mechanism

- [x] 1.1 Add a cell-scene inventory that enumerates build-settings scenes, filters `cell_` names, confirms each with `Application.CanStreamedLevelBeLoaded`, and reports cells with no scene.
- [x] 1.2 Add `world.plan` and `world.walkBatch` commands driven by a coroutine, loading a bounded number of scenes additively in build-index order, harvesting, and unloading.
- [x] 1.3 Capture and restore `Application.backgroundLoadingPriority`, including on failure, and unload every scene the walk loaded.
- [x] 1.4 Assert record counts per type are unchanged across the walk, and fail the run when they differ.
- [x] 1.5 Identify harvested objects from `GuidComponent.GuidString`, and diagnose an object with none instead of publishing it.
- [x] 1.6 Report per-cell object and harvested counts, plus component types seen but not modelled.
- [x] 1.7 Cover the inventory, the identity rule and the unchanged-records assertion in `mod-tests`.

## 2. Placed items

- [x] 2.1 Add a placed-item descriptor with the `sceneObject` identity mechanism and a map layer.
- [x] 2.2 Extract `ItemSpawner` with its item reference, enchantments, durability, ruined state, stack count and owner.
- [x] 2.3 Canonicalise placed items, project their placements and map points, and link each to its item.
- [x] 2.4 Add the item-page section listing where copies lie, with map deep links.

## 3. Containers

- [x] 3.1 Add a container descriptor with the `sceneObject` identity mechanism and a map layer.
- [x] 3.2 Extract `StaticContainer` with its name, item lists, additional items, level, lock and owner.
- [x] 3.3 Canonicalise containers, project placements and map points, and resolve their loot to items.
- [x] 3.4 Add the container page, and name containers as a source on each item page.

## 4. Ownership

- [x] 4.1 Extract `OwnedObject` faction and character owners for placed items and containers.
- [x] 4.2 Register the ownership predicate, project edges, and render owner sections on character and faction pages.
- [x] 4.3 Diagnose an owner reference that does not resolve, and emit no edge for it.

## 5. Pickable plants

- [x] 5.1 Add a pickable-plant descriptor with the `sceneObject` identity mechanism and a map layer.
- [x] 5.2 Extract `PickablePlant` with its item reference, item count, regrow days and `giveXP`.
- [x] 5.3 Canonicalise pickable plants, project placements and map points, and link each to the item it yields.
- [x] 5.4 Add the ingredient-page section naming where a plant grows and what a harvest awards, reading each value from its placement.
- [x] 5.5 Carry `spikes/plant-xp-runtime.sh` and its rows into this change, since the measurement that justifies the family belongs with it.

## 6. World spawns

- [x] 6.1 Extract `LocalNPCSpawner` with its character definition reference and position.
- [x] 6.2 Extract `RecordNPCSpawner` and resolve it to the record it refers to.
- [x] 6.3 State on a character definition page how the world reaches it, and report the counts per category in the manifest.

## 7. Scene dialogue

- [x] 7.1 Add a scene-dialogue descriptor identified by the dialogue graph asset, with a map layer per placement. A placement carries no `GuidComponent` in 8 of 27 cases, so it cannot own the identity.
- [x] 7.2 Extract the graphs `SimpleDialogInteractable` holds, with every placement that starts one, reusing the quest dialogue graph walk and read models.
- [x] 7.3 Render a scene dialogue page with its lines through the shared rich-text contract, and with the places a reader can start it.

## 8. Fixtures and gate

- [ ] 8.1 Extend the synthetic snapshot with a cell holding a placed item, a container with loot and a lock, an owned object, a local spawner, a scene dialogue owner, and two plants of one species whose harvest XP differs, so a species-level constant cannot pass the gate.
- [ ] 8.2 Update pipeline, site and fixture tests for the new families, layers and relationship sections.
- [ ] 8.3 Run the full gate in `AGENTS.md`, then a live export including the walk, and record per-cell counts, diagnostics and walk duration.
- [ ] 8.4 Verify the walk is side-effect free by exporting twice in one session and asserting equal counts.

## 9. Documentation and cleanup

- [ ] 9.1 Record the measured walk cost in this change, so a later change prices its own traversal against a measurement rather than an estimate.
- [ ] 9.2 State in `tile-capture-basemap` that content harvesting and tile capture share the streaming mechanism and not the traversal cost.
- [ ] 9.3 Archive this change after the gate passes.
