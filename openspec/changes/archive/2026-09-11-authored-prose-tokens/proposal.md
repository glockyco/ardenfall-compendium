## Why

Two thirds of the compendium's diagnostics were about prose the page then printed as code. A reader of
Saya Sako's conversation met `<player_shortrace = elf ? "You have forgotten ..." : "Ugh. The memory of
dwarves ...">`, and 783 statements carried a diagnostic blaming a tooltip dictionary this build does
not ship.

## What Changes

- A conditional token publishes as a `conditionalText` rich-text node carrying both alternatives, the
  subject and the comparison, and the page renders both sides and names the deciding state.
- A brace token publishes as authored text when the build ships no tooltip dictionary, and the
  diagnostic survives only for a build that ships one.
- Both alternatives reach the plain text that feeds search.

## Non-Goals

- No choosing a side. A page cannot know a reader's save, so it shows both.
- No repair of authored typos. Six conditional tokens are missing a closing quote and stay diagnosed.
