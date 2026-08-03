---
title: Location Pages and the Publicity Rule
type: spec
status: implemented
created: 2026-08-03
parent: 2026-04-29-ardenfall-compendium-roadmap
superseded_by:
archived: 2026-08-03
---

# Location Pages and the Publicity Rule

Give every location a page, and make one rule decide what a page is.

## The problem

Search reaches a page. It cannot reach an entity that has no page. 67 entities have none.

A location's `route_path` is `/map?map=overworld&sel=<shortId>`. No HTML holds a location name, so Pagefind cannot index one and a crawler cannot read one. The string `Akaga Workshop` appears in no built page.

Two separate mistakes produce this.

### The gate reads an in-game display flag

`pipeline/src/entities/registry.ts:88` publishes a location only when `l.enabled = 1 AND l.show_on_map = 1`. That withholds 14 of 48 locations, all enabled, all named: `Shisivi Wood`, `Arawasi Crags`, `Wahasi Forest`, `Nakibani Forest`, `Bisawa Island 1` and nine more.

The game does not use `showOnMap` to mean the place exists. In `Ardenfall/LocationAsset.cs:25` the field sits under a literal `[Header("In-game Map")]`, beside the icon, the map position and the fast-travel position. `Ardenfall/UI/PlayerWorldMapUI.cs:85` reads it to decide whether the player's map draws a marker, and it ANDs the flag with whether the player found the place:

```csharp
if (location.showOnMap && (!location.showOnMapDebugOnly || Debug.isDebugBuild)
    && (IsLocationDiscovered(location) || IsMapMarkerForceEnabled(location)))
```

`Ardenfall/MapLocationManager.cs:58` filters live content with `where loc.enabled`. So `enabled` is the content gate and `showOnMap` is a marker detail.

A compendium documents what a player has not found. It already ignores the discovery half of that condition. It must ignore the marker half for the same reason.

The rule contradicts itself twice today:

- `map_volumes` filters on `enabled` alone, so the map already draws **18 volume polygons for the 14 withheld locations**. Their shape ships and their name does not.
- `showOnMapDebugOnly` was deliberately kept, because a debug-only marker still marks a real place. `showOnMap` is the same kind of flag and gets the opposite treatment.

### Identity comes from placement

`pipeline/src/map/read-models.ts` writes `entity_nodes` from `map_points`. An entity that no map point places therefore has no identity at all, and an entity that a map point does place gets a map query for a route.

That is backwards. The canonical table is the entity. A placement is a projection of it. Every other entity derives its node from its canonical row, which is why every other entity has a page.

## What changes

### One rule for a page

A location is public when the game counts it as live content, which is `enabled = 1`. All 48 locations qualify. `show_on_map` and `show_on_map_debug_only` stay what the game means: inputs to the map layer, not to publication.

### Nodes come from canonical rows

`location` and `portal` nodes come from the `locations` and `portals` tables, like the other seven entities. Map projection stops deciding who exists.

A location's route becomes `/locations/<slug>`. A portal's route stays the map query, because that is honestly where a reader can see a portal.

### Portals get no page

29 of 32 portal names are authoring identifiers: `garkai_sheru-tombs_outside_1`, `sc_tutcave_ext`, `akaga.lighthouse.entrance`. Only `Underground Preservium`, `Ladder Door` and `Food Preserve` read as prose. The extractor is not at fault, it reads the game's own `friendlyName` and records a diagnostic when that is empty. The game simply authored identifiers there.

This project removed asset-name fallbacks once already, because they put `itemcat_weapons` in front of readers. Publishing 33 pages titled `sc_tutcave_ext` repeats that defect. Portals keep an identity and a map route with `is_public = 0`.

### `is_public` means one thing

`is_public` means the entity has a page. Nothing else.

`site/src/lib/server/entities/location.ts:125` joins `entity_nodes` with `AND n.is_public = 1` to read `short_id`, which the map uses for deep links. A selectable marker is not a page, so that join must not test publicity. Without this change, marking portals non-public breaks portal deep links on the map.

### The sitemap lists pages

`site/src/routes/sitemap.xml/+server.ts` selects every public node, which is not the set of pages. It publishes 1,852 URLs when 1,795 pages exist, and omits all ten listing pages including the home page.

The sitemap lists public entity pages plus the listing pages. After this change the two sets agree, because no public node lacks a page.

### Two routes gain a meta description

`items/[id]` and `terms/[id]` ship none. `items` is 1,273 pages, the largest section. The other six detail routes already have one.

## What a location page holds

Name, which map it belongs to, whether fast travel is allowed, its extent, and its elevation range. The `locations` and `location_volumes` tables already carry all of it.

The page renders no relationship section, because locations have no edges yet. The 30 `leads_to` edges connect a portal to a portal.

## Rejected: attributing portals to locations by position

A "connects to" section on a location page needs to know which location holds a portal. Nothing in the data says so, and position does not settle it. Measured against the release database, of 33 portals:

| containing location volumes | portals |
| ---: | ---: |
| 0 | 21 |
| 1 | 7 |
| 2 | 4 |
| 3 | 1 |

Two thirds fall inside no location, and five fall inside more than one. A containment join would invent a relationship for 7 portals and guess for 5. That fails the rule against guessed identifiers, so it waits for a world traversal that records the link.

## Acceptance

- All 48 locations have a page under `/locations/`, and a `/locations` listing page exists.
- `Akaga Workshop` and `Shisivi Wood` are both findable by search. The second is one of the 14 that the marker flag withheld.
- No portal has a public page, and portal deep links on the map still resolve.
- The sitemap URL set equals the built page set exactly, verified by comparing it against the prerendered files.
- Every detail route ships a meta description.
- A location's page states its map, extent and elevation without showing a raw coordinate that means nothing to a reader.
- `show_on_map` and `show_on_map_debug_only` change no page's existence.
