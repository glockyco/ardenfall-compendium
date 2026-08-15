## Context

Measured against Ardenfall Demo `0.0.10.91` on 2026-08-15, by reading `.decompiled/steam-22145060-63c576261184/` and by driving the running game over HotRepl.

**How cells work.** A cell is a `CellData` ScriptableObject with an id, a map, a grid position, neighbours and a `CellRecordTableAsset` (`Ardenfall/CellData.cs`). `MapData.cells` comes from `GeneratedAssetReferences.buildCellList`. The game loads one additively per `LoadCellTask` as `SceneManager.LoadSceneAsync("cell_" + cell.id, LoadSceneMode.Additive)`, then applies cell state and record tables (`Ardenfall/LoadCellTask.cs`).

**What exists.** 607 `CellData` assets, all loaded at rest with their record tables, split 575 overworld and 32 interior. Those record tables hold exactly the 476 records the master table already reports — 320 `NPCRecord`, 98 `VolumeRecord`, 33 `PortalRecord`, 24 `NPCTeleportPointRecord`, 1 `PlayerRecord` — so **nothing record-shaped hides in cells**.

**What is loadable.** `sceneCountInBuildSettings` is 33: 27 cell scenes plus `Boot`, `MainMenu`, `Credits`, `world_Ardenfall`, `map_overworld`, `map_interior`. `Application.CanStreamedLevelBeLoaded` is true for exactly 27 of the 607 cells. A `LoadSceneAsync` call for one of the other 580 returns null, which is how the first attempt at this spike failed.

**Cost and shape.** `Application.backgroundLoadingPriority` is `Low` in the running game, which makes an additive load crawl. With it raised, a walk of all 27 scenes at three concurrent loads finished in about two and a half minutes. Cells vary widely: `cell_overworld_0.-8` holds 6,242 objects, `cell_interior_-6.-2` holds 204.

**Payload.** 15 cells hold content. Aggregate: 553 `ItemSpawner`, 140 `SimpleUtilityInteractable`, 135 `StaticContainer`, 62 `RecordNPCSpawner`, 55 `LocalNPCSpawner`, 25 `SimpleDialogInteractable`, and one each of `PlayerSpawner`, `CombatInteractable` and `BubbleElevatorSpawner`.

**Fields worth extracting.** `ItemSpawner` carries `itemData`, `enchantments`, `durabilityRuined`, `durability`, `stackCount` and `owner`. `Container` carries `itemLists`, `additionalItems`, `level`, `owner`, `containerLock`, `containerName` and `openName`, and implements `INamedObject`. `OwnedObject` carries `factionOwners` and `characterOwners`. `LocalNPCSpawner` carries `characterDataAsset`. `SimpleDialogInteractable` carries `dialogs`, `dialogName` and `interactableText`.

**Identity.** `GuidComponent` holds a serialized `System.Guid` and exposes `GuidString`; `StaticSaveComponent` requires it and uses it as the save id. In the richest sampled cell, 140 of 142 content objects carry a non-empty GUID and 136 carry a `StaticSaveComponent`.

## Goals / Non-Goals

**Goals:**

- One traversal that harvests every authored scene object the compendium models, reproducibly and without side effects.
- Stable identity from the game's own GUIDs.
- Placed items and containers as ordinary placed entities, on the existing placement and map contracts.

**Non-Goals:**

- Terrain, foliage, lighting, or anything tile capture needs.
- Simulating loot rolls or lock picking.
- Loading the 580 sceneless cells.

## Decisions

### 1. The walk is a mod command, batched like the entity export

Additive loads complete at end of frame, so a walk cannot run inside one HotRepl evaluation; the REPL spike proved that by returning a scene handle whose `isLoaded` was false. The walk is therefore a coroutine-driven command pair, `world.plan` and `world.walkBatch`, matching the existing `entity.plan` and `entity.exportBatch` lifecycle so progress is observable, batches are resumable, and no single call has to outlive a socket timeout.

Batch size is a parameter with a default of three concurrent loads, which is what the measurement used. Cells are walked in build-index order so two exports harvest in the same sequence.

### 2. Scene inventory comes from build settings, not from cell assets

The authoritative list is `GetScenePathByBuildIndex` over `sceneCountInBuildSettings`, filtered to names beginning with `cell_`, each confirmed by `CanStreamedLevelBeLoaded`. Enumerating `CellData` instead would ask the engine for 580 scenes that do not exist and swallow the difference as failures.

A `CellData` whose scene is absent is not an error: it is a cell with no authored objects. The walk reports how many cells it skipped for that reason so the ratio stays visible.

### 3. Identity is the game's GUID

A harvested object is identified by `GuidComponent.GuidString`, expressed as `scene;<cellId>;<guid>`, which declares the mechanism the same way record and named-asset ids do. An object with no GUID, or an empty one, is diagnosed and skipped rather than given a positional or hierarchy-path identity, because a path changes whenever a designer reorders a scene and would silently rewrite ids between builds.

The 2 objects of 142 without a GUID in the sampled cell make this a real case rather than a hypothetical.

### 4. The walk restores what it touched, and proves it

`Application.backgroundLoadingPriority` is captured before the walk and restored after, including on failure. The walk unloads every scene it loaded. It writes no save state and calls no save-component `CreateState`, which is what would make `NPCRandomSpawner` spawn.

The guarantee is asserted rather than asserted-by-comment: the command records the record count per type before and after the walk, and fails the run if any changed. That closes the same class of defect as the runtime-created records found in the character work, where a session side effect reached the published data.

### 5. Placed items and containers are placed entities, not item fields

An `ItemSpawner` is a world object that references an item; it is not a property of the item. So it becomes its own entity with a placement, a map layer and a page, and the item page gains a relationship section listing where copies lie. The same holds for a container.

Modelling them as item columns was rejected because 553 spawners over 1,273 items is many-to-many, and because a container has its own name, lock, owner and loot that belong to the container rather than to any item in it.

### 6. Ownership is an edge, and it points at a character or a faction

`OwnedObject` resolves to `factionOwners` and `characterOwners`, the latter as `RecordReference`s that identify placed characters we already publish. Ownership therefore projects as edges from a placed object to a faction or to a character, which is what lets a reader ask whose house they are looting.

### 7. Scene dialogue joins the existing dialogue contract

`SimpleDialogInteractable` carries `dialogs` and an authored `dialogName`, so a scene dialogue owner is a named speaker with lines and needs no new rich-text or link machinery. It reuses the read models the quest dialogue already uses, and its owner page is the dialogue owner rather than a quest.

## Risks / Trade-offs

- **Loading a scene runs its `Awake` and `OnEnable`.** The record-count assertion is the guard, and the walk stays away from the save path. If a component turns out to spawn on enable, the assertion fails the export rather than shipping the effect.
- **Memory.** Three concurrent cells of up to about 6,000 objects each is far below what the game itself loads while playing, but the batch size stays a parameter so it can be lowered.
- **The walk needs the world loaded.** It runs after `continueFromMenu` like the rest of the export, and a cell already loaded around the player is harvested in place rather than reloaded.
- **Interior positions.** Interiors are their own map, as the projection work established, so a placed object in an interior cell gets interior coordinates rather than being anchored onto the overworld.
- **Content type coverage is a snapshot.** The walk harvests the types this change models and reports unmodelled component types it saw, so the next build's new interactable shows up as a number rather than as silence.
