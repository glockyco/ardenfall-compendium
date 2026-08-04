import { describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { canonicaliseQuests } from "../src/entities/quest/canonicaliser.ts";
import { QUEST_DDL } from "../src/sql/quest-ddl.ts";
import type { QuestSnapshotFields, SnapshotEnvelope } from "../src/types.ts";

const characterRef = {
  kind: "record",
  table: "instances",
  subtable: "characters",
  id: "11111111111111111111111111111111",
  recordType: "CharacterRecord",
} as const;

const itemRef = {
  kind: "lookupAsset",
  guid: "item-guid",
  unityType: "Ardenfall.ItemData",
  name: "Test item",
} as const;

function envelope(): SnapshotEnvelope<QuestSnapshotFields> {
  return {
    entityId: "quest",
    schemaVersion: 1,
    rows: [
      {
        id: "named;quest;quest-alpha",
        fields: {
          id: "named;quest;quest-alpha",
          questGameId: "alpha",
          name: "Alpha",
          subname: null,
          disabled: false,
          hiddenInQuestUi: false,
          journalOnStart: null,
          journalOnSucceed: null,
          journalOnFailure: null,
          requiredCharacterRefs: [characterRef],
          phases: [
            {
              phaseGameId: 20,
              name: "Second",
              journalEntry: "Second journal",
              completedJournalEntry: "Second complete",
              objectives: [
                {
                  objectiveGameId: 200,
                  name: "Second objective",
                  info: "Info 2",
                  journalEntry: "Journal 2",
                  successJournalEntry: "Success 2",
                  failureJournalEntry: "Failure 2",
                  objectiveType: "Character",
                  hidden: false,
                  attachedObjectGameId: null,
                  enableMapMarker: false,
                },
              ],
            },
            {
              phaseGameId: 10,
              name: "First",
              journalEntry: "First journal",
              completedJournalEntry: "First complete",
              objectives: [
                {
                  objectiveGameId: 100,
                  name: "First objective",
                  info: "Info 1",
                  journalEntry: "Journal 1",
                  successJournalEntry: "Success 1",
                  failureJournalEntry: "Failure 1",
                  objectiveType: "Location",
                  hidden: true,
                  attachedObjectGameId: 4,
                  enableMapMarker: true,
                },
              ],
            },
          ],
          characters: [
            {
              objectGameId: 7,
              objectName: "Giver",
              category: "Giver",
              characterRef,
              dialogue: [],
            },
          ],
          journalEntries: [{ objectGameId: 9, objectName: "Journal", journalEntry: "Entry" }],
          rewardSets: [
            {
              setGameId: 1,
              setName: "Rewards",
              setType: "Success",
              rewards: [
                {
                  kind: "items",
                  isPositive: null,
                  amountLabel: null,
                  customAmount: null,
                  factionRef: null,
                  items: [{ ref: itemRef, count: 5 }],
                  itemListRefs: [],
                  targetObjectGameId: null,
                },
              ],
            },
          ],
        },
      },
      {
        id: "named;quest;quest-disabled",
        fields: {
          id: "named;quest;quest-disabled",
          questGameId: "disabled",
          name: "Disabled",
          subname: null,
          disabled: true,
          hiddenInQuestUi: true,
          journalOnStart: null,
          journalOnSucceed: null,
          journalOnFailure: null,
          requiredCharacterRefs: [],
          phases: [],
          characters: [],
          journalEntries: [],
          rewardSets: [],
        },
      },
    ],
  };
}

function canonicalRows(source: SnapshotEnvelope<QuestSnapshotFields>) {
  const db = new Database(":memory:");
  db.exec(QUEST_DDL);
  // The canonicaliser reads fields by name, so its input models them as unknown. The
  // fixture states them, and this is the one place the two views meet.
  canonicaliseQuests(db, source as unknown as SnapshotEnvelope);
  const rows = {
    quests: db.query<Record<string, unknown>, []>("SELECT * FROM quests ORDER BY id").all(),
    phases: db.query<Record<string, unknown>, []>("SELECT * FROM quest_phases ORDER BY id").all(),
    objectives: db
      .query<Record<string, unknown>, []>("SELECT * FROM quest_objectives ORDER BY id")
      .all(),
    characters: db
      .query<Record<string, unknown>, []>("SELECT * FROM quest_characters ORDER BY id")
      .all(),
    journalEntries: db
      .query<Record<string, unknown>, []>("SELECT * FROM quest_journal_entries ORDER BY id")
      .all(),
    rewards: db.query<Record<string, unknown>, []>("SELECT * FROM quest_rewards ORDER BY id").all(),
  };
  db.close();
  return rows;
}

describe("Quest canonicaliser", () => {
  it("uses game ids for stable phase and objective ordinals", () => {
    const rows = canonicalRows(envelope());
    expect(rows.phases.map((row) => [row.phase_ordinal, row.phase_game_id])).toEqual([
      [0, 10],
      [1, 20],
    ]);
    expect(
      rows.objectives.map((row) => [
        row.phase_ordinal,
        row.objective_ordinal,
        row.objective_game_id,
      ]),
    ).toEqual([
      [0, 0, 100],
      [1, 0, 200],
    ]);
  });

  it("stores counted reward items as items_json", () => {
    const rows = canonicalRows(envelope());
    expect(rows.rewards[0]?.items_json).toBe(JSON.stringify([{ ref: itemRef, count: 5 }]));
  });

  it("produces byte-identical rows when collections arrive in another order", () => {
    const source = envelope();
    const reordered: SnapshotEnvelope<QuestSnapshotFields> = {
      ...source,
      rows: [...source.rows].reverse().map((row) => ({
        ...row,
        fields: {
          ...row.fields,
          phases: [...row.fields.phases].reverse().map((phase) => ({
            ...phase,
            objectives: [...phase.objectives].reverse(),
          })),
          requiredCharacterRefs: [...row.fields.requiredCharacterRefs].reverse(),
          characters: [...row.fields.characters].reverse(),
          journalEntries: [...row.fields.journalEntries].reverse(),
          rewardSets: [...row.fields.rewardSets].reverse().map((rewardSet) => ({
            ...rewardSet,
            rewards: [...rewardSet.rewards].reverse(),
          })),
        },
      })),
    };
    expect(canonicalRows(reordered)).toEqual(canonicalRows(source));
  });

  it("stores disabled quests with no rewards", () => {
    const rows = canonicalRows(envelope());
    expect(rows.quests).toContainEqual(
      expect.objectContaining({ id: "named;quest;quest-disabled", disabled: 1 }),
    );
    expect(rows.rewards).toHaveLength(1);
  });
});
