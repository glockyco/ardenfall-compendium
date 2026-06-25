---
title: "Location Source Audit"
type: audit
status: implemented
created: 2026-06-02
parent:
superseded_by:
archived: 2026-06-25
---

# Location Source Audit

Date: 2026-06-02
Status: Accepted for Slice 5 implementation

## Sources and hashes

Game version: `0.0.10.91`

Assembly audited:

```text
mod/libs/Assembly-CSharp.dll
sha256 63c57626118485d98c8f78614fe77f14723ad57e663c4055b8989a8cb82147c3
```

Local decompile output, ignored by git:

```text
.decompiled/0.0.10.91-63c576261184/
```

Official API references used for geometry decisions:

- Unity `Vector3`: https://docs.unity3d.com/ScriptReference/Vector3.html
- Unity `Bounds`: https://docs.unity3d.com/ScriptReference/Bounds.html
- Unity `Bounds.Contains`: https://docs.unity3d.com/ScriptReference/Bounds.Contains.html
- deck.gl `OrthographicView`: https://deck.gl/docs/api-reference/core/orthographic-view
- deck.gl `TileLayer`: https://deck.gl/docs/api-reference/geo-layers/tile-layer

## Authoritative runtime source

`MapLocationManager.GetLocations()` is the runtime location inventory. It lazily
loads `BuiltLookupTable.GetAssetsOfType<LocationAsset>()`, filters to
`loc.enabled`, and caches the result. Slice 5 follows this source order through a
`BuiltLookupTableLocationAssetSource` so disabled locations do not silently enter
public map data.

`LocationAsset` is the location content asset. Relevant fields:

| Field                  | Meaning in compendium                                              |
| ---------------------- | ------------------------------------------------------------------ |
| `locationName`         | public display name                                                |
| `locationID`           | game state key, captured as `gameLocationId`                       |
| `map`                  | source map asset; captured as asset ref plus `map.id`              |
| `showOnMap`            | marker should appear on game map                                   |
| `showOnMapDebugOnly`   | marker is debug-only in game; keep as data, do not show by default |
| `icon`                 | future marker icon asset; no asset export in Slice 5               |
| `mapPosition`          | point marker source position                                       |
| `allowFastTravel`      | fast-travel flag                                                   |
| `fastTravelPosition`   | fast-travel source position                                        |
| `displayOnEnterVolume` | discovery banner behavior flag                                     |
| `volumes`              | axis-aligned enter/discovery volumes                               |

## Identity decision

The compendium row id is the `BuiltLookupTable` GUID for the `LocationAsset`.
`locationID` remains a captured field because game state and FlowCanvas nodes use
it, but it is not the compendium primary key. A GUID-missing location emits
`lookupAssetGuidMissing` on field `id` and no row.

## Geometry decision

Unity `Vector3` source coordinates are preserved in snapshot fields. Pipeline
canonicalisation emits compendium map coordinates once:

```text
map_x = source.x
map_y = -source.z
elevation = source.y
```

`LocationAsset.Volume` is converted as an axis-aligned box because game behavior
uses `new Bounds { center = volume.center, size = volume.size }.Contains(...)`.
Negative size components are invalid because Unity documents that negative
`Bounds.extents` make `Bounds.Contains` always false. Zero horizontal size is a
degenerate map area and is diagnostic-only; the row remains available for audit.

## Slice 5 exclusions

- no public `/map` route;
- no public `/locations` route;
- no deck.gl dependency;
- no tile capture;
- no marker icon export;
- no map-supporting entities.
