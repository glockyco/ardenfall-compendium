import { describe, it, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { buildDDL } from "$pipeline/sql/ddl";
import { canonicaliseItems } from "$pipeline/entities/item/canonicaliser";
import { emitItemReadModels } from "$pipeline/stages/emit-read-models";
import { loadDescriptors } from "$pipeline/stages/load-descriptors";
import { loadSnapshot } from "$pipeline/stages/load-snapshot";

const ctx = {
  workspaceRoot: ".",
  snapshotDir: "fixtures/synthetic/snapshot",
  outDir: ".",
  log: () => undefined,
};

describe("emitItemReadModels", () => {
  it("builds item_overview_rows and item_presentation_rows without legacy fields_json", async () => {
    const desc = await loadDescriptors.run({}, ctx);
    const snap = await loadSnapshot.run({}, ctx);
    const itemEntity = desc.entities.item;
    const itemVariants = desc.variants.item;
    const itemEnvelope = snap.envelopes.item;
    if (!itemEntity || !itemVariants || !itemEnvelope) {
      throw new Error("fixture missing item entity/variants/envelope");
    }
    const db = new Database(":memory:");
    db.exec(buildDDL(itemEntity, itemVariants));
    canonicaliseItems(db, itemEntity, itemVariants, itemEnvelope);
    db.exec(`
      CREATE TABLE asset_refs (
        entity_id TEXT NOT NULL,
        entity_row_id TEXT NOT NULL,
        slot TEXT NOT NULL,
        asset_kind TEXT NOT NULL,
        asset_hash TEXT NOT NULL,
        PRIMARY KEY (entity_id, entity_row_id, slot)
      );
    `);
    db.run(
      "INSERT INTO asset_refs (entity_id, entity_row_id, slot, asset_kind, asset_hash) VALUES (?, ?, ?, ?, ?)",
      "item",
      "fixture-iron-sword",
      "displayIcon",
      "image",
      "a".repeat(64),
    );
    const iconMetadata = [
      {
        entityId: "item",
        rowId: "fixture-iron-sword",
        displayIconColor: { r: 1, g: 1, b: 1, a: 1 },
        secondaryIconColor: null,
      },
      {
        entityId: "item",
        rowId: "fixture-leather-tunic",
        displayIconColor: { r: 0.25, g: 0.2, b: 0.15, a: 1 },
        secondaryIconColor: null,
      },
    ];
    emitItemReadModels(db, desc, iconMetadata, itemEnvelope, snap.masterTooltip);

    const overview = db
      .query(
        "SELECT id, name, variant, display_icon_hash, display_icon_color FROM item_overview_rows ORDER BY name",
      )
      .all() as {
      id: string;
      name: string;
      variant: string;
      display_icon_hash: string | null;
      display_icon_color: string | null;
    }[];
    expect(overview.map((r) => r.name)).toEqual([
      "Fire Flask",
      "Iron Sword",
      "Leather Tunic",
      "Spark Slate",
      "Stamina Draught",
    ]);
    expect(overview.find((r) => r.id === "fixture-iron-sword")?.display_icon_hash).toBe(
      "a".repeat(64),
    );
    expect(overview.find((r) => r.id === "fixture-leather-tunic")?.display_icon_hash).toBeNull();
    expect(overview.find((r) => r.id === "fixture-iron-sword")?.display_icon_color).toBe(
      JSON.stringify({ r: 1, g: 1, b: 1, a: 1 }),
    );
    expect(overview.find((r) => r.id === "fixture-leather-tunic")?.display_icon_color).toBe(
      JSON.stringify({ r: 0.25, g: 0.2, b: 0.15, a: 1 }),
    );

    const legacyDetail = db
      .query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'item_detail_rows'")
      .get();
    expect(legacyDetail).toBeNull();

    const presentationIcon = db
      .query(
        "SELECT display_icon_hash, display_icon_color FROM item_presentation_rows WHERE id = 'fixture-iron-sword'",
      )
      .get() as { display_icon_hash: string | null; display_icon_color: string | null };
    expect(presentationIcon.display_icon_hash).toBe("a".repeat(64));
    expect(presentationIcon.display_icon_color).toBe(JSON.stringify({ r: 1, g: 1, b: 1, a: 1 }));

    const presentation = db
      .query(
        "SELECT id, render_context, description_rich_text_json, stat_rows_json, effect_facts_json FROM item_presentation_rows WHERE id = 'fixture-stamina-draught'",
      )
      .get() as {
      id: string;
      render_context: string;
      description_rich_text_json: string;
      stat_rows_json: string;
      effect_facts_json: string;
    };
    expect(presentation.render_context).toBe("item-presentation-v1");
    expect(JSON.parse(presentation.description_rich_text_json)).toEqual(
      expect.objectContaining({
        schemaVersion: 1,
        nodes: expect.arrayContaining([expect.objectContaining({ type: "strong" })]),
      }),
    );
    expect(JSON.parse(presentation.stat_rows_json)).toEqual([]);
    expect(JSON.parse(presentation.effect_facts_json)).toContainEqual(
      expect.objectContaining({ kind: "status-effect", label: "Status effects" }),
    );
  });
});
