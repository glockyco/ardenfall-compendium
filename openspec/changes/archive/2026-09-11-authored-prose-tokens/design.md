## Context

`Ardenfall/Dialog/Statement.cs` shows the whole substitution vocabulary. `ApplyModifiers` calls
`NameReplace` and `BlackboardReplace`, and both replace `[subject]` and `<subject = value ? "a" :
"b">` only. No brace is touched. `Ardenfall/StringTooltip.cs` replaces `{index}` in tooltip templates
and iterates `ArdenfallMasterData.tooltipCodes`, which this build ships empty.

## Decisions

### A substitution is data, and both sides publish

The game picks a side from the player, the speaker or the world at runtime. Publishing one side would
state something the data does not; publishing the token would print code. The node carries both sides,
the subject and the comparison, so the page can show both and say what chooses.

### A diagnostic must be able to be true

Blaming an empty dictionary for 783 statements sent a reader looking for a vocabulary entry that never
existed. The check now runs only when the build carries a dictionary.

## Measured

Against export `0.0.10.91-20260911-1149526978830`: diagnostics fall from 995 to 139.
`unresolvedTooltipCode` 783 to 0, `unsupportedRichTextTag` 79 to 6, the remainder being authored typos.
