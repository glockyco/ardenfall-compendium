## Why

A reader who finds a character's dialogue immediately asks why that character says it to them and not
something else. The game answers in authored data: a line is reached behind faction checks, race-group
checks and relationship thresholds. None of it is published.

A read-only probe of Ardenfall Demo `0.0.10.91` measured it. Numbers come from
`spikes/graph-survey.json` under `conditions`.

- The conditions are declarations, not computations. `FactionCheck` holds `List<Faction>` plus a
  `ListCompareMethod`; `RaceCheck` holds `List<RaceGroup>` plus the same vocabulary; `RelationshipCheck`
  holds a source and target character, a `CompareMethod`, and a `RelationshipRange` tier.
- Sampled values read as sentences already: `factions=[faction_region_northern-coast,
faction_region_plains-of-gan, faction_region_southern-coast] compare=containsAny`, and
  `amount=Neutral compare=GreaterThan`.
- The comparison vocabulary is closed: `containsAny`, `containsAll`, `notContainsAny`, `notContainsAll`.
  The game renders it as prose itself, in `ListCompareMethodUtility.GetText`, as "Is X" and "Is Not X".
- The subjects resolve to entities the compendium already publishes. `faction_region_wetlands` is the
  asset name of "Garako Wetlands Region", one of 48 published factions, so a condition becomes an
  inbound link rather than a string.
- `BranchRelationshipNode` splits dialogue across five named tiers, Honored, Accepted, Neutral, Disliked
  and Despised, and a probe found it as a direct source of `SpeakFlowNode`.

A first plan pruned this work, claiming the conditions needed interpretation the data could not support.
That claim was wrong and this proposal replaces it. The measured constraint is narrower and lies
elsewhere: two link planes carry these graphs.

- The flow plane is `Connection` objects. `BranchRelationshipNode` reaches a line across it in one hop.
- The value plane is FlowCanvas ports. `FactionCheck`, `RelationshipCheck` and `RaceCheck` feed
  `SwitchBool` in 400 of 400 sampled cases, and a breadth-first walk over `Connection` objects reached no
  line within six hops, because those bindings are ports rather than connections.

So a condition can be published now against the graph that declares it, and binding a value-plane
condition to one specific line needs the port model first.

## What Changes

- Extract authored conditions from dialogue graphs: faction checks, race-group checks and relationship
  thresholds.
- Resolve each condition's subjects to published entities, so a faction condition links to the faction
  page and a race-group condition links to its group.
- Publish each condition against the dialogue holder that declares it, and render it as an authored
  declaration in the game's own vocabulary.
- Attribute a condition to a specific line only where the flow plane already carries that link, which is
  the relationship-tier branch, and mark the tier the branch selects.
- Report, per holder, how many conditions were read and how many could not be bound to a line, so the
  unbound remainder is a measured number rather than an assumption.

**BREAKING** for nothing. Conditions are additive rows and an additive section.

## Capabilities

### New Capabilities

- `dialogue-conditions`: the authored conditions on dialogue graphs, their resolved subjects, the tier
  vocabulary, the holder-level attribution, and the boundary at per-line binding on the value plane.

### Modified Capabilities

None. `content-availability` forbids a reachability conclusion, and a published condition states what the
game checks rather than what a reader can reach.

## Impact

- `mod/src/Entities/`: the shared graph walk from `authored-dialogue` gains condition DTOs.
- `pipeline/src/entities/`: canonical condition rows, read models, and edges to factions and race groups.
- `pipeline/src/relationships/registry.ts`: predicates for condition subjects.
- `site/src/lib/components/content/`: a condition surface beside the dialogue surface.
- `fixtures/synthetic/snapshot`: a faction condition, a relationship threshold, a race-group condition, a
  tier branch bound to a line, and a condition that binds to no line.
- `authored-dialogue` must land first; this change reuses its walk and its holder attribution.
- Race groups may need publishing as a small vocabulary. `RaceGroup` carries `groupID`, `groupName` and an
  icon; whether it becomes a page or a label is open.
- The Alpha build is unmeasured. Every count above describes the Demo.
