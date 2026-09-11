## Why

A reader opened the conversations the `dialogue-flow` change published and could not read them. The
witness conversation of `Like Moths to a Flame` printed the same question 26 times, a fork offered
`If VALUE_0` through `If VALUE_16`, 21 openings held no line, seven identical return links stacked
under one question, and four choices showed the line a player says and nothing after it.

Every one of those was a fact the extraction held and threw away, or a fact it never read. None was
found by a test: each came from reading a published page and then reading the game.

## What Changes

- A branch on a quest's character group names the character each output speaks to, instead of the
  index the port carries.
- A quest objective check names its objective and the state it reads.
- A topic publishes its own requirement, and topics the author copied per character fold into one
  entry that states how many copies the graph holds.
- A node with no flow edge at all stops publishing as an entry point: it feeds another node's value
  input and starts nothing.
- Every option that shares a control node keeps its edge, so a choice no longer reads as a dead end
  because a sibling reached the same jump first.
- An option the graph really leaves unconnected says so.
- A repeated return link prints once, a random fork reads as random, and a relationship tier, an
  objective and a blackboard flag read as words rather than as enumeration names.
- A condition task held by a FlowCanvas wrapper is read, and two miskeyed entries of the check table
  are repaired.

## Non-Goals

- No graph evaluation. The page still states what the game reads, never whether a reader passes it.
- No diagram. The script stays the primary representation, as `dialogue-flow` decided.
- No naming of live state. A value chain that reads a graph variable or a bounty lookup publishes as
  an unnamed check with its authored chain, because no asset-time read can resolve it.
