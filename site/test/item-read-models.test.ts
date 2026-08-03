import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const richText = JSON.stringify({ schemaVersion: 1, sourceHash: "", nodes: [], diagnostics: [] });

const seed = () => {
  const root = mkdtempSync(join(tmpdir(), "ardenfall-site-item-models-"));
  mkdirSync(join(root, ".data"), { recursive: true });
  const db = new Database(join(root, ".data", "data.sqlite"));
  db.exec(`
    CREATE TABLE item_presentation_rows (
      id TEXT PRIMARY KEY,
      name TEXT,
      variant TEXT,
      item_type TEXT,
      render_context TEXT NOT NULL,
      display_icon_hash TEXT,
      display_icon_color TEXT,
      description_source TEXT NOT NULL,
      description_rich_text_json TEXT NOT NULL,
      effects_source TEXT NOT NULL,
      effects_source_rich_text_json TEXT NOT NULL,
      effect_facts_json TEXT NOT NULL,
      stat_rows_json TEXT NOT NULL,
      requirements_json TEXT NOT NULL,
      durability_json TEXT,
      state_facts_json TEXT NOT NULL,
      value INTEGER,
      weight REAL
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
    CREATE TABLE entity_relationship_sections (
      section_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      title TEXT NOT NULL,
      predicate TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      edges_json TEXT NOT NULL
    );
    INSERT INTO item_presentation_rows VALUES (
      'item-sword', 'Sword', 'weapon', 'Melee weapon', 'item-presentation-v1', NULL, NULL,
      '', '${richText}', '', '${richText}',
      '[
        {"kind":"status-effect","label":"Attack Speed I","targetType":"status-effect","targetId":"status-speed","level":1,"source":"items.statusEffectRef"},
        {"kind":"status-effect","label":"Unknown Effect I","targetType":null,"targetId":null,"level":1,"source":"items.statusEffectRef"},
        {"kind":"spell","label":"Fire Shield","targetType":"spell","targetId":"named;spell;spell_fire-shield","level":2,"source":"items.spellRef"},
        {"kind":"spell","label":"Unknown Spell","targetType":"spell","targetId":"named;spell;spell_missing","level":1,"source":"items.spellRef"}
      ]',
      '[]', '[]', NULL, '[]', 10, 1.5
    );
    INSERT INTO entity_nodes VALUES
      ('status-effect', 'status-speed', 'Attack Speed',
       '/status-effects/attack-speed--abc12345', 'attack-speed--abc12345', 'abc12345', 1),
      ('spell', 'named;spell;spell_fire-shield', 'Fire Shield',
       '/spells/fire-shield--abc12345', 'fire-shield--abc12345', 'abc12345', 1);
    INSERT INTO entity_relationship_sections VALUES
      ('item-sword:variant_of', 'item', 'item-sword', 'Variant', 'variant_of', 0,
       '[{"targetType":"item","targetId":"item-base","targetLabel":"Base Sword","targetRoutePath":"/items/base-sword--22222222","predicate":"variant_of","label":"Variant","weight":1,"anchor":null}]');
  `);
  db.close();
  return root;
};

describe("item effect read-model accessors", () => {
  it("joins resolved effect routes while leaving unresolved effects without one", async () => {
    const originalCwd = process.cwd();
    const root = seed();
    try {
      process.chdir(root);
      const readModels = await import("../src/lib/server/read-models");
      expect(readModels.getItemPresentation("item-sword")?.effects).toEqual([
        {
          kind: "status-effect",
          label: "Attack Speed I",
          targetType: "status-effect",
          targetId: "status-speed",
          targetRoutePath: "/status-effects/attack-speed--abc12345",
          level: 1,
          source: "items.statusEffectRef",
        },
        {
          kind: "status-effect",
          label: "Unknown Effect I",
          targetType: null,
          targetId: null,
          targetRoutePath: null,
          level: 1,
          source: "items.statusEffectRef",
        },
        {
          kind: "spell",
          label: "Fire Shield",
          targetType: "spell",
          targetId: "named;spell;spell_fire-shield",
          targetRoutePath: "/spells/fire-shield--abc12345",
          level: 2,
          source: "items.spellRef",
        },
        {
          kind: "spell",
          label: "Unknown Spell",
          targetType: "spell",
          targetId: "named;spell;spell_missing",
          targetRoutePath: null,
          level: 1,
          source: "items.spellRef",
        },
      ]);
    } finally {
      process.chdir(originalCwd);
      rmSync(root, { recursive: true, force: true });
    }
  });
  it("lists populated relationship sections and returns no sections for an empty entity", async () => {
    const originalCwd = process.cwd();
    const root = seed();
    try {
      process.chdir(root);
      const readModels = await import("../src/lib/server/read-models");
      expect(readModels.listRelationshipSections("item", "item-sword")).toEqual([
        {
          id: "item-sword:variant_of",
          title: "Variant",
          predicate: "variant_of",
          edges: [
            {
              targetType: "item",
              targetId: "item-base",
              targetLabel: "Base Sword",
              targetRoutePath: "/items/base-sword--22222222",
              predicate: "variant_of",
              label: "Variant",
              weight: 1,
              anchor: null,
            },
          ],
        },
      ]);
      expect(readModels.listRelationshipSections("item", "item-without-relationships")).toEqual([]);
    } finally {
      process.chdir(originalCwd);
      rmSync(root, { recursive: true, force: true });
    }
  });
});
