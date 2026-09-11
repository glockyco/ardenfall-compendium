# Probes for the cell walk

These probes measured the walk this change specifies, against Ardenfall Demo `0.0.10.91`. They
target that build and decay with it.

- `plant-xp-runtime.sh` reads `PickablePlant` out of every cell scene through HotRepl, one cell at
  a time, and reconciles each dump against a count.
- `walk-all-cells.sh` drives the shipped commands instead: `world.plan`, then `world.walkBatch` for
  every batch, and prints the per-cell report.
- `placed-plant-census.csv` is the published result, read out of the release artifact built from
  the live export `0.0.10.91-20260910-2036574095640`.
- `scene-dialogue-runtime.sh` reads `SimpleDialogInteractable` out of a cell scene and prints the
  graphs each one holds, with the node types inside them. It exists because 14 of 27 placements
  publish no line, and only the running game can say whether that is authored silence or a misread
  graph. It is authored silence: those placements hold no graph at all.

Three producers agree on 140 placements across 12 cell scenes: an offline enumeration of
`data.unity3d`, the ad-hoc probe, and the walk the export runs. 38 of those placements award
experience. Harvest experience is uniform per species in this build, which is why the specification
requires the published value to come from each placement rather than from its species.

## What the walk measured

From the live export `0.0.10.91-20260911-0801042533550`, over 27 cell scenes of the 33 in build
settings:

| Family                         | Published                        |
| ------------------------------ | -------------------------------- |
| Placed items                   | 560                              |
| Characters (record placements) | 292                              |
| Containers                     | 154                              |
| Pickable plants                | 140                              |
| World spawners                 | 140                              |
| Locations                      | 48                               |
| Portals                        | 33                               |
| Scene dialogue                 | 8 conversations in 13 placements |

Ownership resolves 555 edges, 516 from placed items and 39 from containers, with no unresolved
owner. Definition reachability: 63 character definitions reached by a placement, 12 by a spawner
only, 10 by both, and 127 by neither. That last number counts an absence of authored references,
not a claim that a player cannot meet them: a random spawner group chooses at runtime.

## What the walk costs

An export that includes the walk takes about 150 seconds from launch, and about 55 seconds when the
world is already loaded. Finalization is 59 seconds of that, and 55 of those 59 are
`assets.write`, so the walk itself is a small part of an export rather than its cost centre.

## The walk leaves no trace

Two exports in one session, `0.0.10.91-20260911-0801042533550` and
`0.0.10.91-20260911-0802361213640`, produce identical manifest counts, and the five walked family
files are byte-identical between them.
