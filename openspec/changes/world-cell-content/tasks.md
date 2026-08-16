## 1. Walk mechanism

- [ ] 1.1 Add a cell-scene inventory that enumerates build-settings scenes, filters `cell_` names, confirms each with `Application.CanStreamedLevelBeLoaded`, and reports cells with no scene.
- [ ] 1.2 Add `world.plan` and `world.walkBatch` commands driven by a coroutine, loading a bounded number of scenes additively in build-index order, harvesting, and unloading.
- [ ] 1.3 Capture and restore `Application.backgroundLoadingPriority`, including on failure, and unload every scene the walk loaded.
- [ ] 1.4 Assert record counts per type are unchanged across the walk, and fail the run when they differ.
- [ ] 1.5 Identify harvested objects from `GuidComponent.GuidString`, and diagnose an object with none instead of publishing it.
- [ ] 1.6 Report per-cell object and harvested counts, plus component types seen but not modelled.
- [ ] 1.7 Cover the inventory, the identity rule and the unchanged-records assertion in `mod-tests`.

## 2. Placed items

- [ ] 2.1 Add a placed-item descriptor with the `sceneObject` identity mechanism and a map layer.
- [ ] 2.2 Extract `ItemSpawner` with its item reference, enchantments, durability, ruined state, stack count and owner.
- [ ] 2.3 Canonicalise placed items, project their placements and map points, and link each to its item.
- [ ] 2.4 Add the item-page section listing where copies lie, with map deep links.

## 3. Containers

- [ ] 3.1 Add a container descriptor with the `sceneObject` identity mechanism and a map layer.
- [ ] 3.2 Extract `StaticContainer` with its name, item lists, additional items, level, lock and owner.
- [ ] 3.3 Canonicalise containers, project placements and map points, and resolve their loot to items.
- [ ] 3.4 Add the container page, and name containers as a source on each item page.

## 4. Ownership

- [ ] 4.1 Extract `OwnedObject` faction and character owners for placed items and containers.
- [ ] 4.2 Register the ownership predicate, project edges, and render owner sections on character and faction pages.
- [ ] 4.3 Diagnose an owner reference that does not resolve, and emit no edge for it.

## 5. World spawns

- [ ] 5.1 Extract `LocalNPCSpawner` with its character definition reference and position.
- [ ] 5.2 Extract `RecordNPCSpawner` and resolve it to the record it refers to.
- [ ] 5.3 State on a character definition page how the world reaches it, and report the counts per category in the manifest.

## 6. Scene dialogue

- [ ] 6.1 Add a scene-dialogue-owner descriptor with the `sceneObject` identity mechanism and a map layer.
- [ ] 6.2 Extract `SimpleDialogInteractable` with its name, interaction text and dialogue graphs, reusing the quest dialogue read models.
- [ ] 6.3 Render a scene dialogue owner page with its lines through the shared rich-text contract.

## 7. Fixtures and gate

- [ ] 7.1 Extend the synthetic snapshot with a cell holding a placed item, a container with loot and a lock, an owned object, a local spawner and a scene dialogue owner.
- [ ] 7.2 Update pipeline, site and fixture tests for the new families, layers and relationship sections.
- [ ] 7.3 Run the full gate in `AGENTS.md`, then a live export including the walk, and record per-cell counts, diagnostics and walk duration.
- [ ] 7.4 Verify the walk is side-effect free by exporting twice in one session and asserting equal counts.

## 8. Documentation and cleanup

- [ ] 8.1 Record the measured walk cost in this change, so a later change prices its own traversal against a measurement rather than an estimate.
- [ ] 8.2 State in `tile-capture-basemap` that content harvesting and tile capture share the streaming mechanism and not the traversal cost.
- [ ] 8.3 Archive this change after the gate passes.
