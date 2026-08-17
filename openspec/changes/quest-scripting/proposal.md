## Why

A reader looking at a quest page learns its name, its phases, its objectives and some of its dialogue,
and learns nothing about what makes any of it happen. A reader looking at an item page often learns
nothing at all about where the item comes from. Both answers are authored, in graphs the compendium
already loads and never opens.

A read-only probe of Ardenfall Demo `0.0.10.91` measured what is there. Every number below comes from
`spikes/graph-survey.json` and `spikes/quest-graphs.json`.

- 38 quest assets hold 36 logic graphs with **2,127 nodes across 155 distinct node types**. The
  extractor opens none of them; `LoadedQuestAssetSource` reads `CharacterQuestObject.dialogGraph` only.
- The nodes answer reader questions directly. `AddItemListNode` appears 33 times and names the items a
  quest hands over. `OnEnterQuestLocation` appears 57 times over 139 `LocationQuestObject` subjects.
  `AddJournalEntryNode` appears 38 times. `SetQuestObjectiveStateNode` 108, `SetQuestStateNode` 98,
  `SetObjectiveHidden` 64, `SetQuestPhaseNode` 46, `OnGetItemNode` 29, `OnCharacterDeath` 22, and
  `TriggerSteamAchievementNode` 18.
- The nodes name their subjects with resolvable references rather than prose.
  `OnEnterQuestLocation` holds `locationObject: QuestObjectGraphRef` and `character: CharacterGraphRef`.
  `OnGetItemNode` holds `itemFilterList: ItemFilter`.
- `AddItemListNode` attacks a recorded gap. `docs/plans/2026-08-02-item-obtainability.md` measures 726 of
  2,266 published pages with no inbound link, and quest item grants are inbound links to item pages that
  no current extractor can produce.
- The same graphs hold the build's own content gate. `quest_bisawa_clear-ogobi` contains the single
  `SendMessageNode` in the build, reading
  `MessageReference{messageName=Ardenfall.UI.DemoTriggerEndMessage}`. `GameGUIManager` opens
  `demoEndLayer` on that message and `DemoEndUILayer.AllowEscape()` returns false, so arriving at one
  place ends the build's content. Nothing published says so.
- Achievement ids are authored strings, and they read as answers: `ENTER_BISAWA`, `VISIT_ALL_ISLANDS`,
  `GO_AROUND`, and five `BEAST_ENDING_*` ids.

## What Changes

- Walk each quest's logic graph and extract the authored triggers and effects it declares.
- Publish a bounded, typed set: location-entry triggers, item-acquisition triggers, item grants,
  journal additions, quest-state effects, objective-state effects, phase effects, and achievement ids.
- Resolve each subject through the existing reference mechanisms, so an item grant points at item
  entities and a location trigger points at the location entity.
- Emit relationship edges only where both ends are published entities, and register every predicate.
- Count every node type the walk meets and report an unmodelled type as a diagnostic, so a build that
  adds authoring vocabulary makes that visible instead of silently publishing less.
- State an authored trigger as an authored fact. The compendium answers no reachability question.

No entity descriptor changes and no new public route. Quest, item and location pages gain sections fed
by the new tables.

## Capabilities

### New Capabilities

- `quest-scripting`: the authored triggers and effects read from quest logic graphs, their resolved
  subjects, the node-type census that proves coverage, and the boundary against reachability claims.

### Modified Capabilities

None. `content-availability` already forbids a reachability conclusion, `relationship-graph` already
requires one registry entry per predicate, and `authored-content` already requires reproducible counts.
This change complies with all three rather than changing them.

## Impact

- `mod/src/Entities/Quest/`: a logic-graph walk beside the dialogue walk, and new snapshot rows.
- `pipeline/src/entities/quest/`: canonical tables, read models and relationship edges.
- `pipeline/src/relationships/registry.ts`: predicates for quest-to-item and quest-to-location triggers.
- `site/src/lib/components/`: quest, item and location sections that render authored triggers.
- `fixtures/synthetic/snapshot`: an item grant, a location trigger, an achievement id, and an unmodelled
  node type.
- `authored-dialogue` proposes the shared graph walk this change reuses. Sequence that change first.
- The Alpha build is unmeasured. Every count above describes the Demo.
