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
      weight REAL,
      name_is_placeholder INTEGER NOT NULL
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
        {"kind":"status-effect","label":"Hidden Effect I","targetType":"status-effect","targetId":"status-hidden","level":1,"source":"items.statusEffectRef"},
        {"kind":"spell","label":"Fire Shield","targetType":"spell","targetId":"named;spell;spell_fire-shield","level":2,"source":"items.spellRef"},
        {"kind":"spell","label":"Unknown Spell","targetType":"spell","targetId":"named;spell;spell_missing","level":1,"source":"items.spellRef"}
      ]',
      '[]', '[]', NULL, '[]', 10, 1.5, 1
    );
    INSERT INTO entity_nodes (entity_type, entity_id, label, display_label, route_path, canonical_slug, short_id, has_page) VALUES
      ('status-effect', 'status-speed', 'Attack Speed', 'Attack Speed', '/status-effects/attack-speed--abc12345', 'attack-speed--abc12345', 'abc12345', 1),
      ('status-effect', 'status-hidden', 'Hidden Effect', 'Hidden Effect', '/status-effects/hidden-effect--def67890', 'hidden-effect--def67890', 'def67890', 0),
      ('spell', 'named;spell;spell_fire-shield', 'Fire Shield', 'Fire Shield', '/spells/fire-shield--abc12345', 'fire-shield--abc12345', 'abc12345', 1),
      ('item', 'item-sword', 'Sword', 'Unnamed item — Melee Weapon', '/items/item-sword', 'item-sword', 'item-sword', 1);
    INSERT INTO entity_relationship_sections VALUES
      ('item-sword:variant_of', 'item', 'item-sword', 'Variant', 'variant_of', 0,
       '[{"targetType":"item","targetId":"item-base","targetLabel":"Base Sword","targetRoutePath":"/items/base-sword--22222222","predicate":"variant_of","label":"Variant","weight":1,"anchor":null}]');
  `);
  db.close();
  return root;
};

describe("item effect read-model accessors", () => {
  it("joins resolved effect routes while leaving page-less and unresolved effects without one", async () => {
    const originalCwd = process.cwd();
    const root = seed();
    try {
      process.chdir(root);
      const readModels = await import("../src/lib/server/read-models");
      expect(readModels.getItemPresentation("item-sword")).toMatchObject({
        name: "Unnamed item — Melee Weapon",
        nameIsPlaceholder: true,
      });
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
          kind: "status-effect",
          label: "Hidden Effect I",
          targetType: "status-effect",
          targetId: "status-hidden",
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
  it("fails with the item, column, and row when rich text is malformed", async () => {
    const originalCwd = process.cwd();
    const root = seed();
    try {
      const db = new Database(join(root, ".data", "data.sqlite"));
      db.run("UPDATE item_presentation_rows SET description_rich_text_json = ? WHERE id = ?", [
        "{}",
        "item-sword",
      ]);
      db.close();
      process.chdir(root);
      const readModels = await import("../src/lib/server/read-models");
      expect(() => readModels.getItemPresentation("item-sword")).toThrow(
        "invalid generated JSON shape for item.description_rich_text_json row item-sword",
      );
    } finally {
      process.chdir(originalCwd);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails with the item, column, and row when an effect shape is malformed", async () => {
    const originalCwd = process.cwd();
    const root = seed();
    try {
      const db = new Database(join(root, ".data", "data.sqlite"));
      db.run("UPDATE item_presentation_rows SET effect_facts_json = ? WHERE id = ?", [
        '[{"kind":"spell"}]',
        "item-sword",
      ]);
      db.close();
      process.chdir(root);
      const readModels = await import("../src/lib/server/read-models");
      expect(() => readModels.getItemPresentation("item-sword")).toThrow(
        "invalid generated JSON shape for item.effect_facts_json row item-sword",
      );
    } finally {
      process.chdir(originalCwd);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails rather than rendering an unknown item context", async () => {
    const originalCwd = process.cwd();
    const root = seed();
    try {
      const db = new Database(join(root, ".data", "data.sqlite"));
      db.run("UPDATE item_presentation_rows SET render_context = ? WHERE id = ?", [
        "item-presentation-v9",
        "item-sword",
      ]);
      db.close();
      process.chdir(root);
      const readModels = await import("../src/lib/server/read-models");
      expect(() => readModels.getItemPresentation("item-sword")).toThrow(
        "unknown render_context 'item-presentation-v9' for item row item-sword",
      );
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
