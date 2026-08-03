import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const seed = () => {
  const root = mkdtempSync(join(tmpdir(), "ardenfall-site-quest-models-"));
  mkdirSync(join(root, ".data"), { recursive: true });
  const db = new Database(join(root, ".data", "data.sqlite"));
  db.exec(`
    CREATE TABLE quest_presentation_rows (
      id TEXT PRIMARY KEY,
      name TEXT,
      subname TEXT,
      render_context TEXT NOT NULL,
      disabled INTEGER NOT NULL,
      hidden_in_quest_ui INTEGER NOT NULL,
      journal_on_start TEXT,
      journal_on_succeed TEXT,
      journal_on_failure TEXT,
      phases_json TEXT NOT NULL,
      rewards_json TEXT NOT NULL
    );
    CREATE TABLE quest_character_dialogue_rows (
      id TEXT PRIMARY KEY,
      quest_id TEXT NOT NULL,
      quest_label TEXT NOT NULL,
      quest_route TEXT,
      character_id TEXT NOT NULL,
      character_label TEXT NOT NULL,
      character_route TEXT,
      ordinal INTEGER NOT NULL,
      kind TEXT NOT NULL,
      text_json TEXT NOT NULL
    );
    CREATE TABLE entity_nodes (
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      label TEXT NOT NULL,
      route_path TEXT NOT NULL,
      canonical_slug TEXT NOT NULL,
      short_id TEXT NOT NULL,
      has_page INTEGER NOT NULL,
      PRIMARY KEY (entity_type, entity_id)
    );
    INSERT INTO quest_presentation_rows VALUES
      ('named;quest;quest-ash', 'Ashes at Dawn', 'A first task', 'quest-presentation-v1', 1, 0,
       'Begin at dawn.', 'The ashes settle.', NULL,
       '[{"phaseGameId":10,"name":"Arrival","journalEntry":"Reach the gate.","completedJournalEntry":"The gate opens.","objectives":[{"objectiveGameId":20,"name":"Find the gate","info":"Follow the road.","journalEntry":"The road is quiet.","successJournalEntry":"You found it.","failureJournalEntry":null,"objectiveType":"Reach","hidden":false,"attachedObjectGameId":null,"enableMapMarker":true}]},{"phaseGameId":30,"name":"Return","journalEntry":null,"completedJournalEntry":null,"objectives":[]}]',
       '[{"kind":"faction-reputation","amount":"+5 reputation","targetLabel":"Dawnkeepers","targetRoutePath":"/factions/dawnkeepers--22222222","items":[]},{"kind":"items","amount":null,"targetLabel":null,"targetRoutePath":null,"items":[{"label":"Ash Token","routePath":"/items/ash-token--33333333"}]}]'),
      ('named;quest;quest-unnamed', '', NULL, 'quest-presentation-v1', 0, 1,
       NULL, NULL, NULL, '[]', '[]');
    INSERT INTO quest_character_dialogue_rows VALUES
      ('r0', 'named;quest;quest-ash', 'Ashes at Dawn', '/quests/ashes-at-dawn--11111111',
       'instances;characters;aaa', 'Harbour Guard', '/placed-characters/harbour-guard--aaa',
       0, 'greeting', '{"schemaVersion":1,"sourceHash":"h","nodes":[{"type":"text","text":"You reek of booze."}],"diagnostics":[]}'),
      ('r1', 'named;quest;quest-ash', 'Ashes at Dawn', '/quests/ashes-at-dawn--11111111',
       'instances;characters;aaa', 'Harbour Guard', '/placed-characters/harbour-guard--aaa',
       1, 'topic', '{"schemaVersion":1,"sourceHash":"h","nodes":[{"type":"text","text":"Who do you guard this port for?"}],"diagnostics":[]}'),
      ('r2', 'named;quest;quest-ash', 'Ashes at Dawn', '/quests/ashes-at-dawn--11111111',
       'instances;characters;bbb', 'Silent Watcher', NULL,
       2, 'greeting', '{"schemaVersion":1,"sourceHash":"h","nodes":[{"type":"text","text":"..."}],"diagnostics":[]}');
    INSERT INTO entity_nodes VALUES
      ('quest', 'named;quest;quest-ash', 'Ashes at Dawn', '/quests/ashes-at-dawn--11111111', 'ashes-at-dawn--11111111', '11111111', 1),
      ('quest', 'named;quest;quest-unnamed', 'Unnamed quest', '/quests/unnamed-quest--44444444', 'unnamed-quest--44444444', '44444444', 1),
      ('faction', 'named;faction;dawnkeepers', 'Dawnkeepers', '/factions/dawnkeepers--22222222', 'dawnkeepers--22222222', '22222222', 1),
      ('item', 'named;item;ash-token', 'Ash Token', '/items/ash-token--33333333', 'ash-token--33333333', '33333333', 1);
  `);
  db.close();
  return root;
};

describe("quest read-model accessors", () => {
  it("lists every quest, including disabled and nameless quests", async () => {
    const originalCwd = process.cwd();
    const root = seed();
    try {
      process.chdir(root);
      const readModels = await import("../src/lib/server/read-models");
      expect(readModels.listQuests()).toEqual([
        {
          id: "named;quest;quest-ash",
          name: "Ashes at Dawn",
          subname: "A first task",
          disabled: true,
          hiddenInQuestUi: false,
          routePath: "/quests/ashes-at-dawn--11111111",
        },
        {
          id: "named;quest;quest-unnamed",
          name: "Unnamed quest",
          subname: null,
          disabled: false,
          hiddenInQuestUi: true,
          routePath: "/quests/unnamed-quest--44444444",
        },
      ]);
    } finally {
      process.chdir(originalCwd);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("preserves phase and objective order and resolves reward links", async () => {
    const originalCwd = process.cwd();
    const root = seed();
    try {
      process.chdir(root);
      const readModels = await import("../src/lib/server/read-models");
      const quest = readModels.getQuestPresentation("ashes-at-dawn--11111111");
      expect(quest?.phases.map((phase) => phase.phaseGameId)).toEqual([10, 30]);
      expect(quest?.phases[0]?.objectives.map((objective) => objective.objectiveGameId)).toEqual([
        20,
      ]);
      expect(quest?.rewards).toEqual([
        {
          kind: "faction-reputation",
          amount: "+5 reputation",
          targetLabel: "Dawnkeepers",
          targetRoutePath: "/factions/dawnkeepers--22222222",
          items: [],
        },
        {
          kind: "items",
          amount: null,
          targetLabel: null,
          targetRoutePath: null,
          items: [{ label: "Ash Token", routePath: "/items/ash-token--33333333" }],
        },
      ]);
    } finally {
      process.chdir(originalCwd);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("groups quest dialogue by speaker and keeps a group without a page unlinked", async () => {
    const root = seed();
    const originalCwd = process.cwd();
    try {
      process.chdir(root);
      const readModels = await import("../src/lib/server/read-models");
      const quest = readModels.getQuestPresentation("ashes-at-dawn--11111111");
      expect(quest?.dialogue).toEqual([
        {
          id: "instances;characters;aaa",
          label: "Harbour Guard",
          routePath: "/placed-characters/harbour-guard--aaa",
          lines: [
            { kind: "greeting", text: expect.objectContaining({ schemaVersion: 1 }) },
            { kind: "topic", text: expect.objectContaining({ schemaVersion: 1 }) },
          ],
        },
        {
          id: "instances;characters;bbb",
          label: "Silent Watcher",
          // A character the snapshot never gave a page still gets their line shown,
          // just without a link a reader could follow nowhere.
          routePath: null,
          lines: [{ kind: "greeting", text: expect.objectContaining({ schemaVersion: 1 }) }],
        },
      ]);
    } finally {
      process.chdir(originalCwd);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("gives a quest with no dialogue an empty list", async () => {
    const root = seed();
    const originalCwd = process.cwd();
    try {
      process.chdir(root);
      const readModels = await import("../src/lib/server/read-models");
      expect(readModels.getQuestPresentation("unnamed-quest--44444444")?.dialogue).toEqual([]);
    } finally {
      process.chdir(originalCwd);
      rmSync(root, { recursive: true, force: true });
    }
  });
});
