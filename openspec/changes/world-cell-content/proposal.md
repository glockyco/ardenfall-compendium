## Why

The roadmap defers container loot, item spawners, scene dialogue and world spawn provenance behind "the same 683-cell streamed traversal", and prices tile capture against the same figure. That traversal was never measured. On 2026-08-15 it was, against Ardenfall Demo `0.0.10.91`:

- `SceneManager.sceneCountInBuildSettings` is **33**, of which **27 are cell scenes**: 24 overworld and 3 interior. The other 580 `CellData` assets carry no scene, and `Application.CanStreamedLevelBeLoaded` confirms 27.
- Walking all 27 — additive load, harvest, unload, three concurrent — took about **two and a half minutes**.
- **15 of the 27 cells hold content**, and the payload is the entire deferred backlog:

| component                   | count | what it holds                                                                            |
| --------------------------- | ----: | ---------------------------------------------------------------------------------------- |
| `ItemSpawner`               |   553 | a direct `ItemData` reference, enchantments, durability, stack count, owner              |
| `StaticContainer`           |   135 | `itemLists`, `additionalItems`, level, owner, lock, and a player-visible `containerName` |
| `SimpleUtilityInteractable` |   140 | world interactables                                                                      |
| `RecordNPCSpawner`          |    62 | a `RecordReference` to a record we already extract                                       |
| `LocalNPCSpawner`           |    55 | a direct `CharacterData` reference                                                       |
| `SimpleDialogInteractable`  |    25 | `dialogs` and an authored `dialogName`                                                   |

Two documented conclusions are wrong as a result. `docs/plans/2026-08-03-extraction-coverage.md` records `SimpleDialogInteractable.dialogs` as measuring **0 at rest** and treats that as evidence the content sits behind an expensive traversal; there are 25, and they measured zero only because the scenes were not loaded. The same document prices the remaining item provenance — 278 items behind 182 lists — against a 683-cell walk that does not exist.

Identity is not a problem either. Of 142 content objects in the richest sampled cell, **140 carry a `GuidComponent` with a non-empty GUID** and 136 also carry a `StaticSaveComponent`, which is the third source mechanism `docs/plans/2026-06-04-compendium-data-architecture.md` already names and has never used.

So the largest remaining gap in reader value — where an item lies in the world, what a chest holds, who owns it, and who speaks in a room — is a two-minute walk behind a mechanism the repository already describes.

## What Changes

- Add a **cell walk** to the mod as a coroutine-driven, batched command in the existing export lifecycle: enumerate cell scenes from build settings, guard each with `CanStreamedLevelBeLoaded`, load additively a few at a time, harvest, unload, and report per cell.
- Identify harvested objects by `GuidComponent.GuidString`, and diagnose an object that has none rather than inventing one.
- Extract **placed items** from `ItemSpawner`, with the item reference, enchantments, durability, stack count and owner, as placements on the map.
- Extract **containers** from `StaticContainer`, with their loot lists, additional items, level, lock, player-visible name and owner, as placements on the map.
- Extract **scene dialogue** from `SimpleDialogInteractable`, with its authored `dialogName` and its dialogue graphs, through the existing dialogue read models.
- Extract **world spawns** from `LocalNPCSpawner` and `RecordNPCSpawner`, which is what shows that a character definition is instantiated in the world.
- Project **ownership** from `OwnedObject`, whose `factionOwners` and `characterOwners` connect an item or a container to a faction or to a specific placed character.
- Guarantee the walk changes nothing: restore `Application.backgroundLoadingPriority`, create no records, write no save state, and assert record counts are unchanged across the walk.

### Goals

- An item page can say where copies of that item lie in the world and who owns them.
- A container is a first-class placed object with its loot, its lock and its owner.
- A character definition's encounterability is data, so the compendium stops guessing from at-rest placements.
- The walk is reproducible and side-effect free, and its cost is reported.

### Non-goals

- Tile capture. It shares the streaming mechanism but renders terrain rather than harvesting components, and it is specified separately.
- Runtime loot rolls. `ItemListAsset` resolution is authored structure; what a container yields on a given playthrough is not.
- The 580 cells with no scene. They carry terrain, and nothing in them is authored content.

## Capabilities

### New Capabilities

- `world-cell-walk`: the traversal, its identity mechanism, its side-effect guarantees, and its reporting.
- `world-placed-objects`: placed items and containers as canonical rows, placements and pages.
- `world-ownership`: faction and character ownership of placed objects.
- `world-spawns`: what the world instantiates, and how that reaches a character definition.
- `world-dialogue`: scene dialogue owners and their lines.

## Impact

- `mod/src/Entities/World` and the export lifecycle commands, which gain a walk phase alongside `entity.plan` and `entity.exportBatch`.
- New descriptors for placed items, containers and scene dialogue owners, each declaring the `sceneObject` identity mechanism and a map layer.
- `pipeline/src/entities/*` for the new families, `pipeline/src/map/read-models.ts` for their layers, and the relationship registry for ownership and provenance predicates.
- `site` item, container, location, character and faction pages.
- `fixtures/synthetic/snapshot`, which gains a cell with a spawner, a container, an owner and a dialogue owner.
- `docs/plans/2026-08-03-extraction-coverage.md` and `2026-08-02-item-obtainability.md`, whose cell-count and at-rest figures are wrong.
