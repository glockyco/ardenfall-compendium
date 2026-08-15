import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const source = (relativePath: string) => readFileSync(join(import.meta.dir, relativePath), "utf8");
const availabilityNoticeSource = source("../src/lib/components/content/AvailabilityNotice.svelte");
const overviewSource = source("../src/routes/quests/+page.svelte");
const detailSource = source("../src/routes/quests/[slug]/+page.svelte");

const seed = () => {
  const root = mkdtempSync(join(tmpdir(), "ardenfall-site-quest-availability-"));
  mkdirSync(join(root, ".data"), { recursive: true });
  const db = new Database(join(root, ".data", "data.sqlite"));
  db.exec(`
    CREATE TABLE quest_presentation_rows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
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
      character_id TEXT NOT NULL,
      quest_ordinal INTEGER NOT NULL,
      kind TEXT NOT NULL,
      text_json TEXT NOT NULL
    );
    CREATE TABLE entity_nodes (
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      label TEXT NOT NULL,
      display_label TEXT,
      route_path TEXT NOT NULL,
      canonical_slug TEXT NOT NULL,
      short_id TEXT NOT NULL,
      has_page INTEGER NOT NULL,
      PRIMARY KEY (entity_type, entity_id)
    );
    INSERT INTO quest_presentation_rows VALUES
      ('quest-disabled', 'Disabled quest', NULL, 'quest-presentation-v1', 1, 0,
       NULL, NULL, NULL, '[]', '[]'),
      ('quest-hidden', 'Hidden quest', NULL, 'quest-presentation-v1', 0, 1,
       NULL, NULL, NULL, '[]', '[]'),
      ('quest-both', 'Disabled hidden quest', NULL, 'quest-presentation-v1', 1, 1,
       NULL, NULL, NULL, '[]', '[]'),
      ('quest-available', 'Available quest', NULL, 'quest-presentation-v1', 0, 0,
       NULL, NULL, NULL, '[]', '[]');
    INSERT INTO entity_nodes VALUES
      ('quest', 'quest-disabled', 'Disabled quest', 'Disabled quest',
       '/quests/disabled-quest--11111111', 'disabled-quest--11111111', '11111111', 1),
      ('quest', 'quest-hidden', 'Hidden quest', 'Hidden quest',
       '/quests/hidden-quest--22222222', 'hidden-quest--22222222', '22222222', 1),
      ('quest', 'quest-both', 'Disabled hidden quest', 'Disabled hidden quest',
       '/quests/disabled-hidden-quest--33333333', 'disabled-hidden-quest--33333333', '33333333', 1),
      ('quest', 'quest-available', 'Available quest', 'Available quest',
       '/quests/available-quest--44444444', 'available-quest--44444444', '44444444', 1);
  `);
  db.close();
  return root;
};

describe("quest availability notice", () => {
  it("carries disabled, hidden, both, and available flags through the read model", async () => {
    const originalCwd = process.cwd();
    const root = seed();
    try {
      process.chdir(root);
      const readModels = await import("../src/lib/server/read-models");
      expect(readModels.listQuests()).toEqual([
        {
          id: "quest-available",
          name: "Available quest",
          subname: null,
          disabled: false,
          hiddenInQuestUi: false,
          routePath: "/quests/available-quest--44444444",
        },
        {
          id: "quest-both",
          name: "Disabled hidden quest",
          subname: null,
          disabled: true,
          hiddenInQuestUi: true,
          routePath: "/quests/disabled-hidden-quest--33333333",
        },
        {
          id: "quest-disabled",
          name: "Disabled quest",
          subname: null,
          disabled: true,
          hiddenInQuestUi: false,
          routePath: "/quests/disabled-quest--11111111",
        },
        {
          id: "quest-hidden",
          name: "Hidden quest",
          subname: null,
          disabled: false,
          hiddenInQuestUi: true,
          routePath: "/quests/hidden-quest--22222222",
        },
      ]);

      expect(readModels.getQuestPresentation("disabled-quest--11111111")).toMatchObject({
        disabled: true,
        hiddenInQuestUi: false,
      });
      expect(readModels.getQuestPresentation("hidden-quest--22222222")).toMatchObject({
        disabled: false,
        hiddenInQuestUi: true,
      });
      expect(readModels.getQuestPresentation("disabled-hidden-quest--33333333")).toMatchObject({
        disabled: true,
        hiddenInQuestUi: true,
      });
      expect(readModels.getQuestPresentation("available-quest--44444444")).toMatchObject({
        disabled: false,
        hiddenInQuestUi: false,
      });
    } finally {
      process.chdir(originalCwd);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("renders one shared notice only when either authored flag is set", () => {
    expect(availabilityNoticeSource).toContain("{#if disabled || hiddenInQuestUi}");
    expect(availabilityNoticeSource).toContain(
      "The game has this quest disabled. Other content may still reference it.",
    );
    expect(availabilityNoticeSource).toContain(
      "The game marks this quest as hidden in the in-game quest log.",
    );
    expect(availabilityNoticeSource).not.toContain("cannot be started");
    expect(availabilityNoticeSource).not.toContain("cannot be completed");
    expect(overviewSource).toContain("<AvailabilityNotice");
    expect(detailSource).toContain("<AvailabilityNotice");
    expect(overviewSource).not.toContain("Disabled in game.");
    expect(detailSource).not.toContain('"No"');
    expect(detailSource).not.toContain(">Disabled</dt>");
  });
});
