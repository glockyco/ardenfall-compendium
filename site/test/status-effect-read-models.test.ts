import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const richText = JSON.stringify({
  schemaVersion: 1,
  sourceHash: "fixture-status-tooltip",
  nodes: [{ type: "text", text: "Adds 1% Bleed Damage Resistance" }],
  diagnostics: [],
});

const seed = () => {
  const root = mkdtempSync(join(tmpdir(), "ardenfall-site-status-effect-models-"));
  mkdirSync(join(root, ".data"), { recursive: true });
  const db = new Database(join(root, ".data", "data.sqlite"));
  db.exec(`
    CREATE TABLE status_effect_overview_rows (
      id TEXT PRIMARY KEY,
      name TEXT,
      is_hostile INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE status_effect_presentation_rows (
      id TEXT PRIMARY KEY,
      name TEXT,
      render_context TEXT NOT NULL,
      is_hostile INTEGER NOT NULL DEFAULT 0,
      tooltip_source TEXT,
      tooltip_rich_text_json TEXT
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
    INSERT INTO status_effect_overview_rows VALUES
      ('guid-bleed-resistance', 'Bleed Resistance', 0),
      ('guid-hostile-curse', 'Unnamed status effect', 1);
    INSERT INTO status_effect_presentation_rows VALUES
      ('guid-bleed-resistance', 'Bleed Resistance', 'status-effect-presentation-v1', 0,
       'Adds 1% Bleed Damage Resistance to Target over 1 Seconds', '${richText}'),
      ('guid-hostile-curse', 'Unnamed status effect', 'status-effect-presentation-v1', 1, NULL, NULL);
    INSERT INTO entity_nodes VALUES
      ('status-effect', 'guid-bleed-resistance', 'Bleed Resistance',
       '/status-effects/bleed-resistance--abc12345', 'bleed-resistance--abc12345', 'abc12345', 1),
      ('status-effect', 'guid-hostile-curse', 'Hostile Curse',
       '/status-effects/hostile-curse--def67890', 'hostile-curse--def67890', 'def67890', 1),
      ('item', 'item-sword', 'Iron Sword',
       '/items/iron-sword--11111111', 'iron-sword--11111111', '11111111', 1),
      ('item', 'item-bow', 'Hunter Bow',
       '/items/hunter-bow--22222222', 'hunter-bow--22222222', '22222222', 1);
  `);
  db.close();
  return root;
};

const withSeed = async (
  callback: (readModels: typeof import("../src/lib/server/read-models")) => void,
) => {
  const originalCwd = process.cwd();
  const root = seed();
  try {
    process.chdir(root);
    const readModels = await import("../src/lib/server/read-models");
    callback(readModels);
  } finally {
    process.chdir(originalCwd);
    rmSync(root, { recursive: true, force: true });
  }
};

describe("status-effect read-model accessors", () => {
  it("lists status effects with their names", async () => {
    await withSeed((readModels) => {
      expect(readModels.listStatusEffects()).toEqual([
        {
          id: "guid-bleed-resistance",
          name: "Bleed Resistance",
          descriptionSummary: "Adds 1% Bleed Damage Resistance",
          displayName: "Bleed Resistance",
          isHostile: false,
          routePath: "/status-effects/bleed-resistance--abc12345",
        },
        {
          id: "guid-hostile-curse",
          name: "Unnamed status effect",
          descriptionSummary: null,
          displayName: "Unnamed status effect · guid-hostile-curse",
          isHostile: true,
          routePath: "/status-effects/hostile-curse--def67890",
        },
      ]);
    });
  });

  it("resolves one status effect by slug and returns its rich-text nodes", async () => {
    await withSeed((readModels) => {
      expect(readModels.getStatusEffectPresentation("bleed-resistance--abc12345")).toEqual({
        id: "guid-bleed-resistance",
        name: "Bleed Resistance",
        renderContext: "status-effect-presentation-v1",
        description: {
          schemaVersion: 1,
          sourceHash: "fixture-status-tooltip",
          nodes: [{ type: "text", text: "Adds 1% Bleed Damage Resistance" }],
          diagnostics: [],
        },
        descriptionText: "Adds 1% Bleed Damage Resistance",
        displayName: "Bleed Resistance",
        isHostile: false,
        routePath: "/status-effects/bleed-resistance--abc12345",
      });
    });
  });

  it("resolves an effect with no description", async () => {
    await withSeed((readModels) => {
      expect(readModels.getStatusEffectPresentation("hostile-curse--def67890")).toEqual({
        id: "guid-hostile-curse",
        name: "Unnamed status effect",
        renderContext: "status-effect-presentation-v1",
        description: null,
        descriptionText: null,
        displayName: "Unnamed status effect · guid-hostile-curse",
        isHostile: true,
        routePath: "/status-effects/hostile-curse--def67890",
      });
    });
  });
});
