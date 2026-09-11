# Probes for the dialogue flow

These probes measured the dialogue corpus this change publishes, against Ardenfall Demo `0.0.10.91`.
They target that build and decay with it.

- `scene-dialogue-runtime.sh` reads `SimpleDialogInteractable` out of a cell scene and prints the
  graphs each one holds, with the node types inside them. It carried over from the cell walk, and it
  is what first showed that the graph rather than the placement owns the dialogue.
- `graph-shape.sh` reads the whole `DialogFlowGraph` population: node types, node roles, the two
  planes of connection, and the shapes that decide the data model.

## What the graphs are

Measured at the main menu, where 231 graph objects are loaded. The same probe in a loaded world
reports 276 objects, because the game copies a graph per speaking character; 239 of them are
authored assets and the rest are those copies.

| Measure                                    | Value                       |
| ------------------------------------------ | --------------------------- |
| Nodes                                      | 11,010                      |
| Authored edges                             | 10,399                      |
| Distinct node types                        | 147                         |
| Types appearing three times or less        | 53, holding 95 nodes        |
| Nodes with more than one inbound edge      | 1,383                       |
| Nodes with more than one outbound edge     | 1,077                       |
| Jump nodes                                 | 949                         |
| Speech nodes carrying continuation screens | 1,092                       |
| Nodes per graph                            | median 29, p90 111, max 396 |
| Topics per graph                           | median 3, max 26            |
| Graphs with no topic                       | 50                          |

Those numbers decided three things. A role vocabulary rather than a case per node type, because of
the long tail. A graph rather than a tree, because of the joins and the jumps. A script with
disclosure rather than a diagram, because of the size.

## What the export publishes

From the live export `0.0.10.91-20260911-0949260632930`:

| Measure                      | Value     |
| ---------------------------- | --------- |
| Conversations                | 219       |
| Statements                   | 4,771     |
| Authored characters of prose | 458,188   |
| Options                      | 2,161     |
| Published nodes              | 8,254     |
| Published edges              | 6,793     |
| Gates                        | 2,798     |
| Outcomes                     | 854 nodes |

Nodes per role: speech 3,358, end 1,290, condition 1,074, choice 1,057, effect 854, branch 425,
jump 188, unmodelled 8.

Holders: 82 quest characters, 17 quest scene objects, 13 scene placements, 8 quest character groups,
1 character definition. 131 conversations name no holder the extraction can read, because the game
attaches a graph to a character at runtime.

Edges to other entities: 143 outcomes, 108 holders, 106 gates, 8 scene starts.

## What the earlier survey got wrong

`spikes/graph-survey.json` recorded 271 `DialogFlowGraph` on `CharacterData.characterGraphs`. That
counted runtime clones. The registry holds 212 character definitions and exactly **one** of them
carries a dialogue graph; the rest of the 271 were copies the world made. The corpus is no smaller
for it: the same graphs reach a reader through the quest holders, the scene placements, and the
graphs' own attached quest.
