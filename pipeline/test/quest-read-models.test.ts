import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { emitQuestReadModels } from "../src/entities/quest/read-models.ts";
import { ENTITY_GRAPH_DDL } from "../src/relationships/relationship-graph.ts";
import { QUEST_DDL } from "../src/sql/quest-ddl.ts";

const questId = "named;quest;alpha";
const npcId = "instances;characters;11111111111111111111111111111111";
const factionId = "named;faction;faction_guard";
const itemId = "named;item;item_sword";
const recordRef = {
  kind: "record",
  table: "instances",
  subtable: "characters",
  id: "11111111111111111111111111111111",
};

function seedDatabase(): Database {
  const db = new Database(":memory:");
  db.exec(QUEST_DDL);
  db.exec(ENTITY_GRAPH_DDL);
  db.prepare(
    `INSERT INTO quests (
       id, quest_game_id, name, subname, disabled, hidden_in_quest_ui,
       journal_on_start, journal_on_succeed, journal_on_failure, required_character_refs_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(questId, "42", "Alpha", "A test quest", 0, 0, "Start", "Success", "Failure", "[]");
  db.prepare(
    `INSERT INTO quest_phases (
       id, quest_id, phase_ordinal, phase_game_id, name, journal_entry, completed_journal_entry
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run("phase", questId, 0, 10, "First", "Journal", "Complete");
  db.prepare(
    `INSERT INTO quest_objectives (
       id, quest_id, phase_ordinal, objective_ordinal, objective_game_id, name, info,
       journal_entry, success_journal_entry, failure_journal_entry, objective_type,
       hidden, attached_object_game_id, enable_map_marker
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    "objective",
    questId,
    0,
    0,
    20,
    "Objective",
    "Info",
    "Journal",
    "Success",
    "Failure",
    "Character",
    1,
    7,
    1,
  );
  db.prepare(
    `INSERT INTO quest_characters (
       id, quest_id, object_ordinal, object_game_id, object_name, category, character_ref_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run("character", questId, 0, 7, "Giver", "Giver", JSON.stringify(recordRef));
  db.prepare(
    `INSERT INTO quest_rewards (
       id, quest_id, set_ordinal, set_game_id, set_name, set_type, reward_ordinal,
       kind, is_positive, amount_label, custom_amount, faction_ref_json,
       items_json, item_list_refs_json, target_object_game_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    "faction-reward",
    questId,
    0,
    1,
    "Rewards",
    "OnSuccess",
    0,
    "faction-reputation",
    1,
    "Custom",
    17,
    JSON.stringify({ kind: "namedAsset", entity: "faction", name: "faction_guard" }),
    "[]",
    "[]",
    null,
  );
  db.prepare(
    `INSERT INTO quest_rewards (
       id, quest_id, set_ordinal, set_game_id, set_name, set_type, reward_ordinal,
       kind, is_positive, amount_label, custom_amount, faction_ref_json,
       items_json, item_list_refs_json, target_object_game_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    "item-reward",
    questId,
    0,
    1,
    "Rewards",
    "OnSuccess",
    1,
    "items",
    null,
    null,
    null,
    null,
    JSON.stringify([{ ref: { kind: "namedAsset", entity: "item", name: "item_sword" }, count: 1 }]),
    "[]",
    null,
  );
  for (const [entityType, entityId, label, routePath] of [
    ["npc", npcId, "Giver", "/characters/giver--11111111"],
    ["faction", factionId, "Guard", "/factions/guard--faction-guard"],
    ["item", itemId, "Sword", "/items/sword--item-sword"],
  ]) {
    db.prepare(
      `INSERT INTO entity_nodes (
         entity_type, entity_id, label, route_path, canonical_slug, short_id, has_page
       ) VALUES (?, ?, ?, ?, ?, ?, 1)`,
    ).run(
      entityType ?? "",
      entityId ?? "",
      label ?? "",
      routePath ?? "",
      `${entityType ?? ""}-${entityId ?? ""}`,
      (entityId ?? "").slice(-8),
    );
  }
  return db;
}

/** Flattens a stored rich-text document back to its words, so a test can assert on prose. */
function plainText(json: string): string {
  const parsed: unknown = JSON.parse(json);
  if (typeof parsed !== "object" || parsed === null || !("nodes" in parsed)) return "";
  const { nodes } = parsed;
  if (!Array.isArray(nodes)) return "";
  return nodes
    .map((node: unknown) =>
      typeof node === "object" && node !== null && "text" in node && typeof node.text === "string"
        ? node.text
        : "",
    )
    .join("");
}

describe("quest read models", () => {
  it("emits a page, ordered presentation, and all quest edge kinds", () => {
    const db = seedDatabase();
    expect(emitQuestReadModels(db)).toEqual([]);

    expect(
      db.query(`SELECT COUNT(*) AS count FROM entity_nodes WHERE entity_type = 'quest'`).get(),
    ).toEqual({ count: 1 });
    expect(
      db
        .query(`SELECT route_path FROM entity_nodes WHERE entity_type = 'quest' AND entity_id = ?`)
        .get(questId),
    ).toEqual({ route_path: "/quests/alpha--alpha" });
    const presentation = db
      .query<{ phases_json: string; rewards_json: string }, [string]>(
        `SELECT phases_json, rewards_json FROM quest_presentation_rows WHERE id = ?`,
      )
      .get(questId);
    expect(JSON.parse(presentation?.phases_json ?? "null")).toEqual([
      {
        phaseGameId: 10,
        name: "First",
        journalEntry: "Journal",
        completedJournalEntry: "Complete",
        objectives: [
          {
            objectiveGameId: 20,
            name: "Objective",
            info: "Info",
            journalEntry: "Journal",
            successJournalEntry: "Success",
            failureJournalEntry: "Failure",
            objectiveType: "Character",
            hidden: true,
            attachedObjectGameId: 7,
            enableMapMarker: true,
          },
        ],
      },
    ]);
    expect(JSON.parse(presentation?.rewards_json ?? "null")).toEqual([
      {
        setOrdinal: 0,
        setType: "on-success",
        rewards: [
          {
            kind: "faction-reputation",
            amount: "+17",
            targetLabel: "Guard",
            targetRoutePath: "/factions/guard--faction-guard",
            items: [],
          },
          {
            kind: "items",
            amount: null,
            targetLabel: null,
            targetRoutePath: null,
            items: [{ label: "Sword", routePath: "/items/sword--item-sword", count: 1 }],
          },
        ],
      },
    ]);
    expect(db.query(`SELECT predicate FROM entity_edges ORDER BY predicate`).all()).toEqual([
      { predicate: "features_character" },
      { predicate: "rewards_faction_reputation" },
      { predicate: "rewards_item" },
    ]);
    db.close();
  });

  it("keeps success and failure reward sets separate", () => {
    const db = seedDatabase();
    db.prepare(
      `INSERT INTO quest_rewards (
         id, quest_id, set_ordinal, set_game_id, set_name, set_type, reward_ordinal,
         kind, is_positive, amount_label, custom_amount, faction_ref_json,
         items_json, item_list_refs_json, target_object_game_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "failure-reward",
      questId,
      1,
      2,
      "Failure",
      "OnFailure",
      0,
      "gold",
      null,
      null,
      25,
      null,
      null,
      "[]",
      null,
    );

    expect(emitQuestReadModels(db)).toEqual([]);
    expect(
      JSON.parse(
        db
          .query<{ rewards_json: string }, [string]>(
            `SELECT rewards_json FROM quest_presentation_rows WHERE id = ?`,
          )
          .get(questId)?.rewards_json ?? "null",
      ),
    ).toEqual([
      expect.objectContaining({ setOrdinal: 0, setType: "on-success" }),
      expect.objectContaining({
        setOrdinal: 1,
        setType: "on-failure",
        rewards: [expect.objectContaining({ kind: "gold", amount: "25" })],
      }),
    ]);
    db.close();
  });

  it("renders a custom negative reputation amount with one sign", () => {
    const db = seedDatabase();
    db.run(`UPDATE quest_rewards SET is_positive = 0, custom_amount = -50 WHERE id = ?`, [
      "faction-reward",
    ]);

    expect(emitQuestReadModels(db)).toEqual([]);
    const rewards = JSON.parse(
      db
        .query<{ rewards_json: string }, [string]>(
          `SELECT rewards_json FROM quest_presentation_rows WHERE id = ?`,
        )
        .get(questId)?.rewards_json ?? "null",
    );
    expect(rewards[0].rewards[0].amount).toBe("-50");
    expect(rewards[0].rewards[0].amount).not.toContain("--");
    db.close();
  });

  it("ignores is_positive for a positive custom reputation amount", () => {
    const db = seedDatabase();
    db.run(`UPDATE quest_rewards SET is_positive = 0, custom_amount = 200 WHERE id = ?`, [
      "faction-reward",
    ]);

    expect(emitQuestReadModels(db)).toEqual([]);
    const rewards = JSON.parse(
      db
        .query<{ rewards_json: string }, [string]>(
          `SELECT rewards_json FROM quest_presentation_rows WHERE id = ?`,
        )
        .get(questId)?.rewards_json ?? "null",
    );
    expect(rewards[0].rewards[0].amount).toBe("+200");
    db.close();
  });

  it("collapses repeated faction reward edges and preserves occurrences", () => {
    const db = seedDatabase();
    db.prepare(
      `INSERT INTO quest_rewards (
         id, quest_id, set_ordinal, set_game_id, set_name, set_type, reward_ordinal,
         kind, is_positive, amount_label, custom_amount, faction_ref_json,
         items_json, item_list_refs_json, target_object_game_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "faction-reward-failure",
      questId,
      1,
      2,
      "Failure",
      "OnFailure",
      0,
      "faction-reputation",
      0,
      "High",
      null,
      JSON.stringify({ kind: "namedAsset", entity: "faction", name: "faction_guard" }),
      null,
      "[]",
      null,
    );

    expect(emitQuestReadModels(db)).toEqual([]);
    expect(
      db
        .query(
          `SELECT COUNT(*) AS count FROM entity_edges WHERE predicate = 'rewards_faction_reputation'`,
        )
        .get(),
    ).toEqual({ count: 1 });
    const evidence = db
      .query<{ evidence_json: string }, [string]>(
        `SELECT evidence_json FROM entity_edges WHERE edge_id = ?`,
      )
      .get(`${questId}:rewards_faction_reputation:faction:${factionId}`);
    expect(JSON.parse(evidence?.evidence_json ?? "null")).toHaveLength(2);
    db.close();
  });

  it("omits unresolved items from presentation while diagnosing them", () => {
    const db = seedDatabase();
    db.run(`UPDATE quest_rewards SET items_json = ? WHERE id = ?`, [
      JSON.stringify([
        { ref: { kind: "namedAsset", entity: "item", name: "missing_item" }, count: 1 },
      ]),
      "item-reward",
    ]);

    const diagnostics = emitQuestReadModels(db);
    expect(diagnostics).toEqual([
      expect.objectContaining({ code: "questItemUnresolved", entityId: questId }),
    ]);
    const rewards = JSON.parse(
      db
        .query<{ rewards_json: string }, [string]>(
          `SELECT rewards_json FROM quest_presentation_rows WHERE id = ?`,
        )
        .get(questId)?.rewards_json ?? "null",
    );
    expect(rewards[0].rewards[1].items).toEqual([]);
    db.close();
  });

  it("diagnoses a malformed item reference array", () => {
    const db = seedDatabase();
    db.run(`UPDATE quest_rewards SET items_json = ? WHERE id = ?`, ["{}", "item-reward"]);

    const diagnostics = emitQuestReadModels(db);
    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "questItemRefsMalformed",
        entityType: "quest",
        entityId: questId,
      }),
    ]);
    db.close();
  });

  it("emits disabled quests as pages", () => {
    const db = seedDatabase();
    db.run(`UPDATE quests SET disabled = 1, hidden_in_quest_ui = 1 WHERE id = ?`, [questId]);
    expect(emitQuestReadModels(db)).toEqual([]);
    expect(
      db
        .query(`SELECT disabled, hidden_in_quest_ui FROM quest_presentation_rows WHERE id = ?`)
        .get(questId),
    ).toEqual({ disabled: 1, hidden_in_quest_ui: 1 });
    expect(
      db
        .query(`SELECT has_page FROM entity_nodes WHERE entity_type = 'quest' AND entity_id = ?`)
        .get(questId),
    ).toEqual({ has_page: 1 });
    db.close();
  });

  it("diagnoses one unresolvable character reference", () => {
    const db = seedDatabase();
    db.run(`UPDATE quest_characters SET character_ref_json = ? WHERE quest_id = ?`, [
      JSON.stringify({ kind: "record", table: "instances", subtable: "characters", id: "missing" }),
      questId,
    ]);
    const diagnostics = emitQuestReadModels(db);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toEqual(
      expect.objectContaining({
        code: "questCharacterUnresolved",
        entityType: "quest",
        entityId: questId,
      }),
    );
    expect(
      db
        .query(`SELECT COUNT(*) AS count FROM entity_edges WHERE predicate = 'features_character'`)
        .get(),
    ).toEqual({ count: 0 });
    db.close();
  });

  it("orders dialogue with greetings first, then importance, then walk order", () => {
    const db = seedDatabase();
    const insert = db.prepare(
      `INSERT INTO quest_character_dialogue (
         id, quest_id, object_ordinal, line_ordinal, kind, text, importance
       ) VALUES (?, ?, 0, ?, ?, ?, ?)`,
    );
    // Deliberately inserted out of presentation order, and with an importance tie
    // that only walk order can break.
    insert.run("d0", questId, 0, "topic", "Low topic", 1);
    insert.run("d1", questId, 1, "topic", "Tied later", 5);
    insert.run("d2", questId, 2, "greeting", "Spoken first", 0);
    insert.run("d3", questId, 3, "topic", "Tied earlier", 5);

    emitQuestReadModels(db);

    expect(
      db
        .query<{ kind: string; text_json: string }, []>(
          `SELECT kind, text_json FROM quest_character_dialogue_rows ORDER BY quest_ordinal`,
        )
        .all()
        .map((row) => ({ kind: row.kind, text: plainText(row.text_json) })),
    ).toEqual([
      { kind: "greeting", text: "Spoken first" },
      { kind: "topic", text: "Tied later" },
      { kind: "topic", text: "Tied earlier" },
      { kind: "topic", text: "Low topic" },
    ]);
    db.close();
  });

  it("emits one dialogue edge per character even when a quest names them twice", () => {
    const db = seedDatabase();
    // A second quest object naming the same character: real quests do this.
    db.prepare(
      `INSERT INTO quest_characters (
         id, quest_id, object_ordinal, object_game_id, object_name, category, character_ref_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run("character-2", questId, 1, 8, "Giver again", null, JSON.stringify(recordRef));
    const insert = db.prepare(
      `INSERT INTO quest_character_dialogue (
         id, quest_id, object_ordinal, line_ordinal, kind, text, importance
       ) VALUES (?, ?, ?, 0, 'greeting', ?, 0)`,
    );
    insert.run("d0", questId, 0, "From the first object");
    insert.run("d1", questId, 1, "From the second object");

    emitQuestReadModels(db);

    expect(
      db
        .query(`SELECT COUNT(*) AS count FROM entity_edges WHERE predicate = 'speaks_about_quest'`)
        .get(),
    ).toEqual({ count: 1 });
    // Both objects still contribute their lines.
    expect(db.query(`SELECT COUNT(*) AS count FROM quest_character_dialogue_rows`).get()).toEqual({
      count: 2,
    });
    db.close();
  });

  it("writes no dialogue row and no edge for a character without lines", () => {
    const db = seedDatabase();

    emitQuestReadModels(db);

    expect(db.query(`SELECT COUNT(*) AS count FROM quest_character_dialogue_rows`).get()).toEqual({
      count: 0,
    });
    expect(
      db
        .query(`SELECT COUNT(*) AS count FROM entity_edges WHERE predicate = 'speaks_about_quest'`)
        .get(),
    ).toEqual({ count: 0 });
    db.close();
  });
});
