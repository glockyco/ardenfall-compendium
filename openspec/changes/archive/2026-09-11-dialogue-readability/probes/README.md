# Probes for the dialogue readability change

Every defect this change fixed was found by reading a published page and then reading the game.
Nothing here was found by a test.

## How the copies were proved identical

`GetSerializedJsonData()` on the loaded `questdialog_potential-witnesses` graph returns the authored
payload. The 17 copies of "Did you see anything out of the ordinary…" differ only in `$id` and
`_position`, which is what made folding them the honest presentation.

The same read proved that the option of node 202 that looked like a defect is authored that way: the
graph holds connections from three of its four output ports and none from the fourth.

## Measured, against export `0.0.10.91-20260911-1149526978830`

| Measure                                  | Before this change | After        |
| ---------------------------------------- | ------------------ | ------------ |
| Conversations                            | 225                | 225          |
| Statements                               | 5,276              | 5,276        |
| Options                                  | 2,398              | 2,398        |
| Published edges                          | 7,473              | 7,718        |
| Checks the compendium cannot name        | 270 of 3,119       | 79 of 3,119  |
| Branch outputs naming what they select   | 0                  | 251          |
| Options with no continuation             | 292                | 138 of 2,370 |
| Entry points of the witness conversation | 48                 | 27           |
| Topics of the witness conversation       | 26                 | 10           |

The remaining 79 unnamed checks are chains of value getters that read live state, such as a
graph variable or a bounty lookup. No asset-time read can name them, so they publish with their
authored chain and the page says the game checks something it cannot name.

The 138 options with no continuation are authored dead ends. The page states that the graph
connects them to nothing.
