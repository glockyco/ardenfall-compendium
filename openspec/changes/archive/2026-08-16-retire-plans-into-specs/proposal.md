## Why

`docs/plans/` holds ten active documents, a roadmap of 76 kilobytes, an index, and 37 archived plans. It predates OpenSpec, and it now duplicates the change tracker, the specs, and the emitted artifacts. The measured cost is drift: "683 cells" appeared in three plan documents until a probe measured 27 loadable scenes, and the same plans still claim that 73 items cannot be published, which the archived change `player-facing-entity-identity` reversed.

One document in the directory is not a plan. `2026-06-04-compendium-data-architecture.md` states about fifteen contracts that the pipeline obeys today and no spec holds: the one-way flow from descriptors to the site, typed domain-shaped storage without an entity-attribute-value table, the identity domains, the relationship graph, descriptor-owned map layers, and the coordinate transform performed exactly once. Deleting the directory without that migration removes the only written record of rules the code enforces.

## What Changes

- Move the architecture contracts into `openspec/specs/`, one requirement per contract, each verified against the implementation that already obeys it.
- Extend `entity-identity` with the identity domains and the missing-reference policy the architecture document states.
- Convert each planned slice and each open finding into a change under `openspec/changes/`, with the design decisions the plan documents hold.
- Delete `docs/`. Repoint each citation in `.omp/RULES.md`, `AGENTS.md`, the subsystem guides, the README, and the live-extraction skill.
- Accept one loss: the delivered-slice evidence for about twenty pre-OpenSpec slices has no archived change. Git history keeps it, and no reader consults it.

## Capabilities

### New Capabilities

- `entity-extraction`: how the snapshot is produced, which source is authoritative, and what a run must fail on.
- `canonical-data`: how the pipeline stores what it extracted, and what the site is allowed to read.
- `relationship-graph`: how a durable link between two entities is produced and audited.
- `placement-map`: how a position in the world becomes a marker a reader can open.

### Modified Capabilities

- `entity-identity`: add the concrete identity domains and the policy for a reference that resolves to nothing.
