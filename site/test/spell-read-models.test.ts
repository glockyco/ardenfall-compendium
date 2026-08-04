import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const seed = () => {
  const root = mkdtempSync(join(tmpdir(), "ardenfall-site-spell-models-"));
  mkdirSync(join(root, ".data"), { recursive: true });
  const db = new Database(join(root, ".data", "data.sqlite"));
  db.exec(`
    CREATE TABLE spell_overview_rows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      skill TEXT,
      mana_cost REAL,
      is_illegal INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE spell_presentation_rows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      render_context TEXT NOT NULL,
      skill TEXT,
      skill_id TEXT,
      mana_cost REAL,
      is_illegal INTEGER NOT NULL DEFAULT 0,
      tooltip_source TEXT,
      tooltip_rich_text_json TEXT,
      effects_json TEXT NOT NULL,
      display_icon_hash TEXT
    );
    CREATE TABLE entity_nodes (
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      label TEXT NOT NULL,
      display_label TEXT NOT NULL,
      route_path TEXT NOT NULL,
      canonical_slug TEXT NOT NULL,
      short_id TEXT NOT NULL,
      has_page INTEGER NOT NULL,
      PRIMARY KEY (entity_type, entity_id)
    );
    INSERT INTO spell_overview_rows VALUES
      ('named;spell;spell_fire-shield', 'Fire Shield', 'Destruction', 12.5, 0),
      ('named;spell;spell_shadow-step', 'Shadow Step', NULL, 4, 1);
    INSERT INTO spell_presentation_rows VALUES
      ('named;spell;spell_fire-shield', 'Fire Shield', 'spell-presentation-v1', 'Destruction', 'named;stat-type;destruction', 12.5, 0,
       '<color=#86FF86>10</color> damage',
       '{"schemaVersion":1,"sourceHash":"fixture-spell-tooltip","nodes":[{"type":"text","text":"Deals "},{"type":"color","token":null,"color":"#86FF86","children":[{"type":"text","text":"10"}]},{"type":"text","text":" damage"}],"diagnostics":[]}',
       '[{"kind":"apply-status-to-self","statusEffectId":"status-speed","statusEffectLabel":"Attack Speed","statusEffectRoutePath":"/status-effects/attack-speed--abc12345","sampleLevel":1,"sampleLifetimeSeconds":5,"appliesToSelf":true,"damage":null,"damageType":null},{"kind":"projectile","statusEffectId":null,"statusEffectLabel":null,"statusEffectRoutePath":null,"sampleLevel":null,"sampleLifetimeSeconds":null,"appliesToSelf":null,"damage":10,"damageType":"Fire"},{"kind":"area-of-effect","statusEffectId":null,"statusEffectLabel":null,"statusEffectRoutePath":null,"sampleLevel":null,"sampleLifetimeSeconds":null,"appliesToSelf":null,"damage":null,"damageType":null}]',
       'spell-icon-hash'),
      ('named;spell;spell_shadow-step', 'Shadow Step', 'spell-presentation-v1', NULL, NULL, 4, 1, NULL, NULL, '[]', NULL);
    INSERT INTO entity_nodes (entity_type, entity_id, label, display_label, route_path, canonical_slug, short_id, has_page) VALUES
      ('spell', 'named;spell;spell_fire-shield', 'Fire Shield', 'Fire Shield', '/spells/fire-shield--abc12345', 'fire-shield--abc12345', 'abc12345', 1),
      ('spell', 'named;spell;spell_shadow-step', 'Shadow Step', 'Shadow Step', '/spells/shadow-step--def67890', 'shadow-step--def67890', 'def67890', 1),
      ('stat-type', 'named;stat-type;destruction', 'Destruction', 'Destruction', '/stats/destruction--fedcba98', 'destruction--fedcba98', 'fedcba98', 1),
      ('item', 'item-sword', 'Iron Sword', 'Iron Sword', '/items/iron-sword--11111111', 'iron-sword--11111111', '11111111', 1);
  `);
  db.close();
  return root;
};

describe("spell read-model accessors", () => {
  it("lists spells with skill and mana cost", async () => {
    const originalCwd = process.cwd();
    const root = seed();
    try {
      process.chdir(root);
      const readModels = await import("../src/lib/server/read-models");
      expect(readModels.listSpells()).toEqual([
        {
          id: "named;spell;spell_fire-shield",
          name: "Fire Shield",
          skill: "Destruction",
          manaCost: 12.5,
          isIllegal: false,
          routePath: "/spells/fire-shield--abc12345",
        },
        {
          id: "named;spell;spell_shadow-step",
          name: "Shadow Step",
          skill: null,
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

  it("resolves a spell with several effects and a status effect link", async () => {
    const originalCwd = process.cwd();
    const root = seed();
    try {
      process.chdir(root);
      const readModels = await import("../src/lib/server/read-models");
      expect(readModels.getSpellPresentation("fire-shield--abc12345")).toEqual({
        id: "named;spell;spell_fire-shield",
        name: "Fire Shield",
        renderContext: "spell-presentation-v1",
        skill: "Destruction",
        skillRoutePath: "/stats/destruction--fedcba98",
        manaCost: 12.5,
        isIllegal: false,
        description: {
          schemaVersion: 1,
          sourceHash: "fixture-spell-tooltip",
          nodes: [
            { type: "text", text: "Deals " },
            {
              type: "color",
              token: null,
              color: "#86FF86",
              children: [{ type: "text", text: "10" }],
            },
            { type: "text", text: " damage" },
          ],
          diagnostics: [],
        },
        descriptionText: "Deals 10 damage",
        effects: [
          {
            kind: "apply-status-to-self",
            statusEffectId: "status-speed",
            statusEffectLabel: "Attack Speed",
            statusEffectRoutePath: "/status-effects/attack-speed--abc12345",
            sampleLevel: 1,
            sampleLifetimeSeconds: 5,
            appliesToSelf: true,
            damage: null,
            damageType: null,
          },
          {
            kind: "projectile",
            statusEffectId: null,
            statusEffectLabel: null,
            statusEffectRoutePath: null,
            sampleLevel: null,
            sampleLifetimeSeconds: null,
            appliesToSelf: null,
            damage: 10,
            damageType: "Fire",
          },
          {
            kind: "area-of-effect",
            statusEffectId: null,
            statusEffectLabel: null,
            statusEffectRoutePath: null,
            sampleLevel: null,
            sampleLifetimeSeconds: null,
            appliesToSelf: null,
            damage: null,
            damageType: null,
          },
        ],
        displayIconSrc: "/assets/spell-icon-hash.webp",
        routePath: "/spells/fire-shield--abc12345",
      });
      expect(readModels.getSpellPresentation("missing--00000000")).toBeUndefined();
    } finally {
      process.chdir(originalCwd);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("resolves a spell without a stat type or effects", async () => {
    const originalCwd = process.cwd();
    const root = seed();
    try {
      process.chdir(root);
      const readModels = await import("../src/lib/server/read-models");
      expect(readModels.getSpellPresentation("shadow-step--def67890")).toEqual({
        id: "named;spell;spell_shadow-step",
        name: "Shadow Step",
        renderContext: "spell-presentation-v1",
        skill: null,
        skillRoutePath: null,
        manaCost: 4,
        isIllegal: true,
        description: null,
        descriptionText: null,
        effects: [],
        displayIconSrc: null,
        routePath: "/spells/shadow-step--def67890",
      });
    } finally {
      process.chdir(originalCwd);
      rmSync(root, { recursive: true, force: true });
    }
  });
});
