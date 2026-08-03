import type { Database } from "bun:sqlite";
import type { PipelineDiagnostic } from "../../relationships/relationship-graph.ts";
import { ENTITY_GRAPH_DDL } from "../../relationships/relationship-graph.ts";
import type { SnapshotRef } from "../../types.ts";
import { deriveEntityNodeSlug, prepareEntityNodeWriter } from "../item/read-models.ts";

export const CHARACTER_READ_MODEL_DDL = `
CREATE TABLE character_overview_rows (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL
);
CREATE TABLE character_presentation_rows (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  render_context TEXT NOT NULL
);
`;

interface CharacterRow {
  id: string;
  character_name: string | null;
  drop_refs_json: string;
}

export function emitCharacterReadModels(
  db: Database,
  routeBase = "/characters",
): PipelineDiagnostic[] {
  db.exec(CHARACTER_READ_MODEL_DDL);
  db.exec(ENTITY_GRAPH_DDL);

  const overviewInsert = db.prepare(`INSERT INTO character_overview_rows (id, name) VALUES (?, ?)`);
  const presentationInsert = db.prepare(
    `INSERT INTO character_presentation_rows (id, name, render_context) VALUES (?, ?, ?)`,
  );
  const edgeInsert = db.prepare(
    `INSERT OR IGNORE INTO entity_edges (
       edge_id, source_type, source_id, target_type, target_id, predicate,
       label, weight, evidence_json, anchor
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const writeNode = prepareEntityNodeWriter(db);
  const pageItems = new Set(
    db
      .query<{ entity_id: string }, []>(
        `SELECT entity_id FROM entity_nodes WHERE entity_type = 'item' AND has_page = 1`,
      )
      .all()
      .map((row) => row.entity_id),
  );
  const rows = db
    .query<CharacterRow, []>(
      `SELECT id, character_name, drop_refs_json
       FROM characters
       ORDER BY COALESCE(character_name, 'Unnamed character'), id`,
    )
    .all();

  const diagnostics: PipelineDiagnostic[] = [];
  const tx = db.transaction(() => {
    for (const row of rows) {
      const presentationName = row.character_name ?? "Unnamed character";
      overviewInsert.run(row.id, presentationName);
      presentationInsert.run(row.id, presentationName, "character-presentation-v1");
      const slug = deriveEntityNodeSlug(presentationName, row.id);
      writeNode({
        entityType: "character",
        entityId: row.id,
        label: presentationName,
        routePath: `${routeBase}/${slug.canonicalSlug}`,
        canonicalSlug: slug.canonicalSlug,
        shortId: slug.shortId,
      });

      let refs: unknown;
      try {
        refs = JSON.parse(row.drop_refs_json) as unknown;
      } catch {
        diagnostics.push(unresolvedDropDiagnostic(row, "reference list is not valid JSON"));
        continue;
      }
      if (!Array.isArray(refs)) {
        diagnostics.push(unresolvedDropDiagnostic(row, "reference list is not an array"));
        continue;
      }
      for (const value of refs) {
        const targetId = resolveItemId(value, pageItems);
        if (targetId === null) {
          diagnostics.push(
            unresolvedDropDiagnostic(row, "reference does not identify an item with a page"),
          );
          continue;
        }
        edgeInsert.run(
          `${row.id}:can_drop:item:${targetId}`,
          "character",
          row.id,
          "item",
          targetId,
          "can_drop",
          "Can drop",
          1,
          JSON.stringify({ source: "characters.itemLists" }),
          null,
        );
      }
    }
  });
  tx();
  return diagnostics;
}

function resolveItemId(value: unknown, pageItems: ReadonlySet<string>): string | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const ref = value as Partial<SnapshotRef>;
  let targetId: string | null = null;
  if (ref.kind === "lookupAsset" && typeof ref.guid === "string") targetId = ref.guid;
  if (ref.kind === "namedAsset" && ref.entity === "item" && typeof ref.name === "string") {
    targetId = `named;item;${ref.name}`;
  }
  return targetId !== null && pageItems.has(targetId) ? targetId : null;
}

function unresolvedDropDiagnostic(row: CharacterRow, reason: string): PipelineDiagnostic {
  return {
    severity: "diagnostic",
    source: "relationship-graph",
    code: "characterDropUnresolved",
    message: `Character '${row.id}' has an unresolvable drop reference: ${reason}.`,
    entityType: "character",
    entityId: row.id,
    field: "drop_refs_json",
    evidence: { reason },
  };
}
