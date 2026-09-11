## Context

Measurements come from live exports of Ardenfall Demo `0.0.10.91`, the last being
`0.0.10.91-20260911-1149526978830`. Decompiled paths are relative to
`.decompiled/steam-22145060-63c576261184/csharp/`.

## Goals / Non-Goals

**Goals:** a reader of one conversation can tell two repeated entries apart, or learn that the game
itself does not.

**Non-Goals:** inventing a distinction the data does not carry. Where 17 topics are identical, the
page says they are identical.

## Decisions

### A port index is a reference, not a label

`CharacterGroupDialogBranchNode.RegisterPorts` adds one output per entry of the quest group's
`characterRecords` and names it `value_{i}`, so an edge carries an index. The records are the
witnesses. `QuestObjectGraphRef` resolves the group against the quest the graph belongs to, which an
asset-time read reproduces by matching `objectID` in `QuestData.objects`.

### An authored copy is presentation, not identity

The 17 copies of "Did you see anything out of the ordinary…" are byte-identical in the graph's
serialized payload apart from `$id` and `_position`. No gate, objective or speaker separates them, so
no extraction could have told them apart. They fold in the read model, which keeps one producer of
the reading order, and the page states the count.

### An entry point must start something

`TaskCondition`, `HasInteractedWithNode` and `CharacterGroupDialogSwitchNode` appear with no flow
edge at all: they feed another node's value input. The walk's entry rule was "no inbound flow edge",
which made every one of them an opening. An entry now also needs a flow edge, and the strandedness
is counted rather than hidden.

### Contraction is per option, not per node

The contraction walked through control nodes with a visited set keyed by the node it reached. Four of
five options of one choice enter the same `GoToStatement`, so three lost their edges. The set is now
keyed by the node and the port, which still breaks a cycle.

### The compendium says what it cannot read

A value chain that ends in a graph variable or a bounty lookup names no authored subject. It publishes
as an unnamed check carrying its authored chain, so a reader sees that the game checks something
rather than seeing an unconditional choice.

## Risks / Trade-offs

Folding copies hides that the graph holds 17 nodes rather than one. The count on the page is the
mitigation, and the canonical tables still carry every node.
