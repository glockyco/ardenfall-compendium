# Probes for the cell walk

These probes measured the walk this change specifies, against Ardenfall Demo `0.0.10.91`. They
target that build and decay with it.

- `plant-xp-runtime.sh` reads `PickablePlant` out of every cell scene through HotRepl, one cell at
  a time, and reconciles each dump against a count.
- `walk-all-cells.sh` drives the shipped commands instead: `world.plan`, then `world.walkBatch` for
  every batch, and prints the per-cell report.
- `placed-plant-census.csv` is the published result, read out of the release artifact built from
  the live export `0.0.10.91-20260910-2036574095640`.

Three producers agree on 140 placements across 12 cell scenes: an offline enumeration of
`data.unity3d`, the ad-hoc probe, and the walk the export runs. 38 of those placements award
experience. Harvest experience is uniform per species in this build, which is why the specification
requires the published value to come from each placement rather than from its species.
