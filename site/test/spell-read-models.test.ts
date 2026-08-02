import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const seed = () => {
  const root = mkdtempSync(join(tmpdir(), "ardenfall-site-spell-models-"));
  mkdirSync(join(root, "static"), { recursive: true });
  const db = new Database(join(root, "static", "data.sqlite"));
  db.exec(`
    CREATE TABLE spell_overview_rows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      school TEXT,
      mana_cost REAL,
      is_illegal INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE spell_presentation_rows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      render_context TEXT NOT NULL,
      school TEXT,
      school_id TEXT,
      mana_cost REAL,
      is_illegal INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE entity_nodes (
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      label TEXT NOT NULL,
      route_path TEXT NOT NULL,
      canonical_slug TEXT NOT NULL,
      short_id TEXT NOT NULL,
      is_public INTEGER NOT NULL,
      PRIMARY KEY (entity_type, entity_id)
    );
    INSERT INTO spell_overview_rows VALUES
      ('named;spell;spell_fire-shield', 'Fire Shield', 'Destruction', 12.5, 0),
      ('named;spell;spell_shadow-step', 'Shadow Step', NULL, 4, 1);
    INSERT INTO spell_presentation_rows VALUES
      ('named;spell;spell_fire-shield', 'Fire Shield', 'spell-presentation-v1', 'Destruction', 'named;stat-type;destruction', 12.5, 0),
      ('named;spell;spell_shadow-step', 'Shadow Step', 'spell-presentation-v1', NULL, NULL, 4, 1);
    INSERT INTO entity_nodes VALUES
      ('spell', 'named;spell;spell_fire-shield', 'Fire Shield', '/spells/fire-shield--abc12345', 'fire-shield--abc12345', 'abc12345', 1),
      ('spell', 'named;spell;spell_shadow-step', 'Shadow Step', '/spells/shadow-step--def67890', 'shadow-step--def67890', 'def67890', 1),
      ('stat-type', 'named;stat-type;destruction', 'Destruction', '/stats/destruction--fedcba98', 'destruction--fedcba98', 'fedcba98', 1);
  `);
  db.close();
  return root;
};

describe("spell read-model accessors", () => {
  it("lists spells with school and mana cost", async () => {
    const originalCwd = process.cwd();
    const root = seed();
    try {
      process.chdir(root);
      const readModels = await import("../src/lib/server/read-models");
      expect(readModels.listSpells()).toEqual([
        {
          id: "named;spell;spell_fire-shield",
          name: "Fire Shield",
          school: "Destruction",
          manaCost: 12.5,
          isIllegal: false,
          routePath: "/spells/fire-shield--abc12345",
        },
        {
          id: "named;spell;spell_shadow-step",
          name: "Shadow Step",
          school: null,
          manaCost: 4,
          isIllegal: true,
          routePath: "/spells/shadow-step--def67890",
        },
      ]);
    } finally {
      process.chdir(originalCwd);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("resolves one spell by its canonical slug", async () => {
    const originalCwd = process.cwd();
    const root = seed();
    try {
      process.chdir(root);
      const readModels = await import("../src/lib/server/read-models");
      expect(readModels.getSpellPresentation("fire-shield--abc12345")).toEqual({
        id: "named;spell;spell_fire-shield",
        name: "Fire Shield",
        renderContext: "spell-presentation-v1",
        school: "Destruction",
        schoolRoutePath: "/stats/destruction--fedcba98",
        manaCost: 12.5,
        isIllegal: false,
      });
      expect(readModels.getSpellPresentation("missing--00000000")).toBeUndefined();
    } finally {
      process.chdir(originalCwd);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("resolves a spell without a stat type and leaves its school unlinked", async () => {
    const originalCwd = process.cwd();
    const root = seed();
    try {
      process.chdir(root);
      const readModels = await import("../src/lib/server/read-models");
      expect(readModels.getSpellPresentation("shadow-step--def67890")).toEqual({
        id: "named;spell;spell_shadow-step",
        name: "Shadow Step",
        renderContext: "spell-presentation-v1",
        school: null,
        schoolRoutePath: null,
        manaCost: 4,
        isIllegal: true,
      });
    } finally {
      process.chdir(originalCwd);
      rmSync(root, { recursive: true, force: true });
    }
  });
});
