import type { Database } from "bun:sqlite";
import { deriveEntityNodeSlug, prepareEntityNodeWriter } from "../../relationships/entity-nodes.ts";
import type { PipelineDiagnostic } from "../../relationships/relationship-graph.ts";
import { emitOwnershipEdges } from "../ownership.ts";
import type {
  PlacedCountedItemSnapshot,
  PlacedLevelSnapshot,
  PlacedLockSnapshot,
  PlacedLootListSnapshot,
  SnapshotRef,
} from "../../types.ts";

interface PlacedContainerRow {
  id: string;
  cell: string;
  map_id: string | null;
  container_name: string;
  interaction_text: string;
  loot_lists_json: string;
  additional_items_json: string;
  possible_item_refs_json: string;
  level_json: string;
  lock_json: string;
}

/** The container name the game ships when a designer authored none. */
const DEFAULT_CONTAINER_NAME = "Container";

/**
 * Publishes containers: what each one holds, what opens it, and how it is locked.
 *
 * A container holds items two ways, and both become `holds_item` edges: an item it carries
 * outright, and every item its authored lists can yield. The lists are not rolled here — a
 * playthrough rolls one outcome, while the compendium publishes the authored set — so the edge
 * says which of the two mechanisms reached the item.
 *
 * Must run after the map read models, which create the graph tables.
 */
export function emitPlacedContainerReadModels(
  db: Database,
  routeBase = "/containers",
): PipelineDiagnostic[] {
  const diagnostics: PipelineDiagnostic[] = [];
  const rows = db
    .query<PlacedContainerRow, []>(
      `SELECT id, cell, map_id, container_name, interaction_text, loot_lists_json,
              additional_items_json, possible_item_refs_json, level_json, lock_json
       FROM placed_containers ORDER BY id`,
    )
    .all();
  const knownItems = new Set(
    db
      .query<{ id: string }, []>(`SELECT id FROM items`)
      .all()
      .map((row) => row.id),
  );

  const writeNode = prepareEntityNodeWriter(db);
  const presentationInsert = db.prepare(
    `INSERT INTO placed_container_presentation_rows (
      id, name, render_context, cell, map_id, map_x, map_y, elevation, interaction_text,
      lock_mode, lock_level, allow_lockpick, loot_list_count, additional_count,
      possible_item_count, level_automatic, level_value
    ) VALUES (?, ?, 'placed-container-presentation-v1', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
     WHERE entity_id = 'placed-container' AND instance_id = ?`,
  );

  const tx = db.transaction(() => {
    for (const row of rows) {
      const lootLists = JSON.parse(row.loot_lists_json) as PlacedLootListSnapshot[];
      const additional = JSON.parse(row.additional_items_json) as PlacedCountedItemSnapshot[];
      const possible = JSON.parse(row.possible_item_refs_json) as SnapshotRef[];
      const lock = JSON.parse(row.lock_json) as PlacedLockSnapshot;
      const level = JSON.parse(row.level_json) as PlacedLevelSnapshot;

      // A container with no authored name keeps the game's default; the cell tells two apart.
      const label = `${row.container_name || DEFAULT_CONTAINER_NAME} (${row.cell})`;
      if (row.container_name === DEFAULT_CONTAINER_NAME || row.container_name === "") {
        diagnostics.push({
          severity: "diagnostic",
          source: "placed-container-presentation-read-model",
          code: "containerNameNotAuthored",
          message: `Container '${row.id}' carries the default name rather than an authored one.`,
          entityType: "placed-container",
          entityId: row.id,
          field: "container_name",
          evidence: { cell: row.cell },
        });
      }

      const slug = deriveEntityNodeSlug(label, row.id);
      writeNode({
        entityType: "placed-container",
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
        row.interaction_text,
        lock.mode,
        lock.level,
        lock.allowLockpick ? 1 : 0,
        lootLists.length,
        additional.length,
        possible.length,
        level.automatic ? 1 : 0,
        level.value,
      );

      for (const [itemId, via, count] of heldItems(additional, possible)) {
        if (!knownItems.has(itemId)) {
          diagnostics.push({
            severity: "diagnostic",
            source: "relationship-graph",
            code: "containerItemUnresolved",
            message: `Container '${row.id}' holds item '${itemId}', which the snapshot does not carry.`,
            entityType: "placed-container",
            entityId: row.id,
            field: via === "list" ? "possible_item_refs_json" : "additional_items_json",
            evidence: { itemId, via },
          });
          continue;
        }
        edgeInsert.run(
          `placed-container:${row.id}|holds_item|item:${itemId}`,
          "placed-container",
          row.id,
          "item",
          itemId,
          "holds_item",
          via === "list" ? "From a loot list" : count > 1 ? `Holds ${count}` : "Held outright",
          count,
          JSON.stringify({ cell: row.cell, via }),
          null,
        );
      }

      for (const keyRef of lock.keyRefs) {
        const keyId = assetReferenceId(keyRef);
        if (keyId === null || !knownItems.has(keyId)) {
          diagnostics.push({
            severity: "diagnostic",
            source: "relationship-graph",
            code: "containerKeyUnresolved",
            message: `Container '${row.id}' names a key the snapshot does not carry.`,
            entityType: "placed-container",
            entityId: row.id,
            field: "lock_json",
            evidence: { cell: row.cell },
          });
          continue;
        }
        edgeInsert.run(
          `placed-container:${row.id}|opened_by_item|item:${keyId}`,
          "placed-container",
          row.id,
          "item",
          keyId,
          "opened_by_item",
          "Key",
          1,
          JSON.stringify({ cell: row.cell, lockMode: lock.mode }),
          null,
        );
      }
    }
  });
  tx();

  diagnostics.push(...emitOwnershipEdges(db, "placed-container", "placed_containers"));

  return diagnostics;
}

/**
 * Items the container holds, with the mechanism that reached each one. An item carried outright and
 * also reachable through a list appears once, as the outright holding.
 */
function heldItems(
  additional: PlacedCountedItemSnapshot[],
  possible: SnapshotRef[],
): Array<[string, "outright" | "list", number]> {
  const held = new Map<string, [string, "outright" | "list", number]>();
  for (const entry of additional) {
    const id = assetReferenceId(entry.itemRef);
    if (id !== null) held.set(id, [id, "outright", entry.count]);
  }
  for (const ref of possible) {
    const id = assetReferenceId(ref);
    if (id !== null && !held.has(id)) held.set(id, [id, "list", 1]);
  }
  return [...held.values()];
}

function assetReferenceId(ref: Partial<SnapshotRef>): string | null {
  if (ref.kind === "lookupAsset" && typeof ref.guid === "string") return ref.guid;
  if (ref.kind === "namedAsset" && ref.entity === "item" && typeof ref.name === "string") {
    return `named;item;${ref.name}`;
  }
  return null;
}
