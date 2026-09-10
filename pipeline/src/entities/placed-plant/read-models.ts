import type { Database } from "bun:sqlite";
import { deriveEntityNodeSlug, prepareEntityNodeWriter } from "../../relationships/entity-nodes.ts";
import type { PipelineDiagnostic } from "../../relationships/relationship-graph.ts";
import type { SnapshotRef } from "../../types.ts";

interface PlantRow {
  id: string;
  cell: string;
  map_id: string | null;
  item_ref_json: string;
  item_count: number;
  regrow_days: number;
  harvest_xp: number;
  interaction_text: string;
}

/**
 * Publishes pickable plants: one node and presentation row per placement, and an edge to the item
 * a harvest yields.
 *
 * The edge is what answers the reader's question on the item page — where this ingredient grows,
 * and what harvesting it awards. The experience travels on the placement, because two plants of
 * one species can carry different values.
 *
 * Must run after the map read models, which create the graph tables.
 */
export function emitPlacedPlantReadModels(
  db: Database,
  routeBase = "/pickable-plants",
): PipelineDiagnostic[] {
  const diagnostics: PipelineDiagnostic[] = [];
  const rows = db
    .query<PlantRow, []>(
      `SELECT id, cell, map_id, item_ref_json, item_count, regrow_days, harvest_xp, interaction_text
       FROM placed_plants ORDER BY id`,
    )
    .all();

  const itemNames = new Map(
    db
      .query<{ id: string; name: string | null }, []>(`SELECT id, name FROM items`)
      .all()
      .map((row) => [row.id, row.name]),
  );

  const writeNode = prepareEntityNodeWriter(db);
  const presentationInsert = db.prepare(
    `INSERT INTO placed_plant_presentation_rows (
      id, name, render_context, cell, map_id, map_x, map_y, elevation,
      item_id, item_name, item_count, regrow_days, harvest_xp, interaction_text
    ) VALUES (?, ?, 'placed-plant-presentation-v1', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const edgeInsert = db.prepare(
    `INSERT OR IGNORE INTO entity_edges (
      edge_id, source_type, source_id, target_type, target_id, predicate, label, weight,
      evidence_json, anchor
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const tx = db.transaction(() => {
    for (const row of rows) {
      const itemId = itemReferenceId(row.item_ref_json);
      const itemName = itemId === null ? null : (itemNames.get(itemId) ?? null);
      // A plant has no authored name. Naming it by what it yields is what a reader looks for, and
      // the cell keeps two placements of one species apart.
      const label = `${itemName ?? "Unnamed plant"} (${row.cell})`;
      const slug = deriveEntityNodeSlug(label, row.id);
      writeNode({
        entityType: "placed-plant",
        entityId: row.id,
        label,
        routePath: `${routeBase}/${slug.canonicalSlug}`,
        canonicalSlug: slug.canonicalSlug,
        shortId: slug.shortId,
        hasPage: true,
      });

      const point = db
        .query<{ map_x: number | null; map_y: number | null; elevation: number | null }, [string]>(
          `SELECT map_x, map_y, elevation FROM placements
           WHERE entity_id = 'placed-plant' AND instance_id = ?`,
        )
        .get(row.id);
      presentationInsert.run(
        row.id,
        label,
        row.cell,
        row.map_id,
        point?.map_x ?? null,
        point?.map_y ?? null,
        point?.elevation ?? null,
        itemId,
        itemName,
        row.item_count,
        row.regrow_days,
        row.harvest_xp,
        row.interaction_text,
      );

      if (itemId === null) {
        diagnostics.push({
          severity: "diagnostic",
          source: "relationship-graph",
          code: "plantItemUnresolved",
          message: `Pickable plant '${row.id}' has an unresolvable item reference.`,
          entityType: "placed-plant",
          entityId: row.id,
          field: "item_ref_json",
          evidence: { cell: row.cell },
        });
        continue;
      }
      if (!itemNames.has(itemId)) {
        diagnostics.push({
          severity: "diagnostic",
          source: "relationship-graph",
          code: "plantItemUnresolved",
          message: `Pickable plant '${row.id}' yields item '${itemId}', which the snapshot does not carry.`,
          entityType: "placed-plant",
          entityId: row.id,
          field: "item_ref_json",
          evidence: { itemId },
        });
        continue;
      }

      edgeInsert.run(
        `placed-plant:${row.id}|yields_item|item:${itemId}`,
        "placed-plant",
        row.id,
        "item",
        itemId,
        "yields_item",
        row.harvest_xp > 0 ? `${row.harvest_xp} XP per harvest` : "No experience per harvest",
        row.item_count,
        JSON.stringify({ cell: row.cell, harvestXp: row.harvest_xp, regrowDays: row.regrow_days }),
        null,
      );
    }
  });
  tx();

  return diagnostics;
}

function itemReferenceId(json: string): string | null {
  const ref = JSON.parse(json) as Partial<SnapshotRef>;
  if (ref.kind === "lookupAsset" && typeof ref.guid === "string") return ref.guid;
  if (ref.kind === "namedAsset" && ref.entity === "item" && typeof ref.name === "string") {
    return `named;item;${ref.name}`;
  }
  return null;
}
