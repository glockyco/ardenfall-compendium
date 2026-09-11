import type { Database } from "bun:sqlite";
import { deriveEntityNodeSlug, prepareEntityNodeWriter } from "../../relationships/entity-nodes.ts";
import type { PipelineDiagnostic } from "../../relationships/relationship-graph.ts";
import type { PlacedEnchantmentSnapshot, SnapshotRef } from "../../types.ts";

interface PlacedItemRow {
  id: string;
  cell: string;
  map_id: string | null;
  item_ref_json: string;
  stack_count: number;
  durability: number;
  durability_ruined: number;
  enchantments_json: string;
}

/**
 * Publishes placed items: one node and presentation row per placement, and an edge to the item the
 * world places there.
 *
 * The edge is what lets an item page say where copies lie. The authored modifiers stay on the
 * placement, because a ruined or enchanted copy is a property of that copy and not of the item.
 *
 * Must run after the map read models, which create the graph tables.
 */
export function emitPlacedItemReadModels(
  db: Database,
  routeBase = "/placed-items",
): PipelineDiagnostic[] {
  const diagnostics: PipelineDiagnostic[] = [];
  const rows = db
    .query<PlacedItemRow, []>(
      `SELECT id, cell, map_id, item_ref_json, stack_count, durability, durability_ruined,
              enchantments_json
       FROM placed_items ORDER BY id`,
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
    `INSERT INTO placed_item_presentation_rows (
      id, name, render_context, cell, map_id, map_x, map_y, elevation,
      item_id, item_name, stack_count, durability, durability_ruined, enchantment_count
    ) VALUES (?, ?, 'placed-item-presentation-v1', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const edgeInsert = db.prepare(
    `INSERT OR IGNORE INTO entity_edges (
      edge_id, source_type, source_id, target_type, target_id, predicate, label, weight,
      evidence_json, anchor
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const pointQuery = db.query<
    { map_x: number | null; map_y: number | null; elevation: number | null },
    [string]
  >(
    `SELECT map_x, map_y, elevation FROM placements
     WHERE entity_id = 'placed-item' AND instance_id = ?`,
  );

  const tx = db.transaction(() => {
    for (const row of rows) {
      const itemId = assetReferenceId(row.item_ref_json);
      const itemName = itemId === null ? null : (itemNames.get(itemId) ?? null);
      const enchantments = JSON.parse(row.enchantments_json) as PlacedEnchantmentSnapshot[];
      // A spawner has no authored name, so the copy is named by what it places and where.
      const label = `${itemName ?? "Unnamed item"} (${row.cell})`;
      const slug = deriveEntityNodeSlug(label, row.id);
      writeNode({
        entityType: "placed-item",
        entityId: row.id,
        label,
        routePath: `${routeBase}/${slug.canonicalSlug}`,
        canonicalSlug: slug.canonicalSlug,
        shortId: slug.shortId,
        hasPage: true,
      });

      const point = pointQuery.get(row.id);
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
        row.stack_count,
        row.durability,
        row.durability_ruined,
        enchantments.length,
      );

      if (itemId === null || !itemNames.has(itemId)) {
        diagnostics.push({
          severity: "diagnostic",
          source: "relationship-graph",
          code: "placedItemUnresolved",
          message:
            itemId === null
              ? `Placed item '${row.id}' has an unresolvable item reference.`
              : `Placed item '${row.id}' places item '${itemId}', which the snapshot does not carry.`,
          entityType: "placed-item",
          entityId: row.id,
          field: "item_ref_json",
          evidence: { cell: row.cell },
        });
        continue;
      }

      edgeInsert.run(
        `placed-item:${row.id}|places_item|item:${itemId}`,
        "placed-item",
        row.id,
        "item",
        itemId,
        "places_item",
        row.stack_count > 1 ? `Stack of ${row.stack_count}` : "One copy",
        row.stack_count,
        JSON.stringify({
          cell: row.cell,
          durabilityRuined: row.durability_ruined === 1,
          enchantments: enchantments.length,
        }),
        null,
      );
    }
  });
  tx();

  return diagnostics;
}

function assetReferenceId(json: string): string | null {
  const ref = JSON.parse(json) as Partial<SnapshotRef>;
  if (ref.kind === "lookupAsset" && typeof ref.guid === "string") return ref.guid;
  if (ref.kind === "namedAsset" && ref.entity === "item" && typeof ref.name === "string") {
    return `named;item;${ref.name}`;
  }
  return null;
}
