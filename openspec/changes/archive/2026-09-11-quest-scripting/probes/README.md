# Probes for the quest scripting change

The node census came from a read-only HotRepl probe over every loaded `QuestData`, before any code
was written, and it decided the design: the quest vocabulary overlaps the dialogue vocabulary, so the
shipped graph walk reads a quest graph rather than a second walk being written.

## Measured, against export `0.0.10.91-20260911-1300226367980`

| Measure                                   | Value |
| ----------------------------------------- | ----- |
| Quests                                    | 38    |
| Quests holding a logic graph              | 33    |
| Published logic nodes                     | 1,537 |
| … triggers                                | 190   |
| … effects                                 | 756   |
| … node types the walk does not model      | 224   |
| Authored node types counted in the census | 155   |
| `quest_watches` edges                     | 27    |
| `quest_changes` edges                     | 52    |

A quest that holds no graph publishes no logic, which the export distinguishes from a graph that
yielded no recognised node.

## Read in a browser, against that export

- `/quests/dying-light--7602ce0c` states what the quest watches for, including "When a character
  acquires Raw Moon Crystal", and what it changes, including "Sets an objective's state Speak with
  Ishi (started)".
- `/items/raw-moon-crystal--c083dd62` carries the inbound section "Watched by quest: Dying Light".
