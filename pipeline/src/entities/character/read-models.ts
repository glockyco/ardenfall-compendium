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
  render_context TEXT NOT NULL,
  drop_refs_json TEXT NOT NULL
);
`;

interface CharacterRow {
  id: string;
  character_name: string | null;
  parent_ref_json: string | null;
  drop_refs_json: string;
}

interface CharacterFactionRefRow {
  id: string;
  character_id: string;
  target_faction_id: string | null;
}
export function emitCharacterReadModels(
  db: Database,
  routeBase = "/characters",
): PipelineDiagnostic[] {
  db.exec(CHARACTER_READ_MODEL_DDL);
  db.exec(ENTITY_GRAPH_DDL);

  const overviewInsert = db.prepare(`INSERT INTO character_overview_rows (id, name) VALUES (?, ?)`);
  const presentationInsert = db.prepare(
    `INSERT INTO character_presentation_rows (id, name, render_context, drop_refs_json)
     VALUES (?, ?, ?, ?)`,
  );
  const edgeInsert = db.prepare(
    `INSERT OR IGNORE INTO entity_edges (
       edge_id, source_type, source_id, target_type, target_id, predicate,
       label, weight, evidence_json, anchor
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const writeNode = prepareEntityNodeWriter(db);
  const itemNodes = new Map(
    db
      .query<
        {
          entity_id: string;
          label: string | null;
          route_path: string | null;
          has_page: number;
          name_is_placeholder: number | null;
        },
        []
      >(
        `SELECT n.entity_id, n.label, n.route_path, n.has_page, p.name_is_placeholder
         FROM entity_nodes n
         LEFT JOIN item_presentation_rows p ON p.id = n.entity_id
         WHERE n.entity_type = 'item'`,
      )
      .all()
      .map(
        (row) =>
          [
            row.entity_id,
            {
              label: row.label?.trim() || "Unnamed item",
              routePath: row.has_page === 1 ? row.route_path : null,
              hasPage: row.has_page === 1,
              hasPresentation: row.name_is_placeholder !== null,
              isPlaceholder: row.name_is_placeholder === 1,
            },
          ] as const,
      ),
  );
  const itemIds = new Set(itemNodes.keys());
  const factionPages = new Set(
    db
      .query<{ entity_id: string }, []>(
        `SELECT entity_id FROM entity_nodes WHERE entity_type = 'faction' AND has_page = 1`,
      )
      .all()
      .map((row) => row.entity_id),
  );
  const factionRefsByCharacter = new Map<string, CharacterFactionRefRow[]>();
  for (const ref of db
    .query<CharacterFactionRefRow, []>(
      `SELECT id, character_id, target_faction_id
       FROM character_faction_refs ORDER BY id`,
    )
    .all()) {
    const refs = factionRefsByCharacter.get(ref.character_id) ?? [];
    refs.push(ref);
    factionRefsByCharacter.set(ref.character_id, refs);
  }
  const rows = db
    .query<CharacterRow, []>(
      `SELECT id, character_name, parent_ref_json, drop_refs_json
       FROM characters
       ORDER BY COALESCE(NULLIF(TRIM(character_name), ''), 'Unnamed character'), id`,
    )
    .all();

  const diagnostics: PipelineDiagnostic[] = [];
  const tx = db.transaction(() => {
    for (const row of rows) {
      const presentationName = row.character_name?.trim() || "Unnamed character";
      overviewInsert.run(row.id, presentationName);
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
        presentationInsert.run(
          row.id,
          presentationName,
          "character-presentation-v1",
          JSON.stringify([]),
        );
        continue;
      }
      if (!Array.isArray(refs)) {
        diagnostics.push(unresolvedDropDiagnostic(row, "reference list is not an array"));
        presentationInsert.run(
          row.id,
          presentationName,
          "character-presentation-v1",
          JSON.stringify([]),
        );
        continue;
      }
      const drops = refs.map((value) => {
        const targetId = resolveItemId(value, itemIds);
        const target = targetId === null ? null : itemNodes.get(targetId);
        return {
          label: target?.label ?? "Unnamed item",
          routePath: target?.routePath ?? null,
        };
      });
      presentationInsert.run(
        row.id,
        presentationName,
        "character-presentation-v1",
        JSON.stringify(drops),
      );
      for (const value of refs) {
        const targetId = resolveItemId(value, itemIds);
        const target = targetId === null ? null : itemNodes.get(targetId);
        if (targetId === null || !target) {
          diagnostics.push(unresolvedDropDiagnostic(row, "reference does not identify an item"));
          continue;
        }
        if (!target.hasPresentation) {
          diagnostics.push({
            severity: "diagnostic",
            source: "relationship-graph",
            code: "itemLootPresentationMissing",
            message: `Character '${row.id}' loot references item '${targetId}' without a presentation row.`,
            entityType: "character",
            entityId: row.id,
            field: "characters.drop_refs_json",
            evidence: { itemId: targetId },
          });
        }
        if (target.isPlaceholder) {
          diagnostics.push({
            severity: "diagnostic",
            source: "relationship-graph",
            code: "itemLootReferencesPrototype",
            message: `Character '${row.id}' loot references prototype item '${targetId}'.`,
            entityType: "character",
            entityId: row.id,
            field: "characters.drop_refs_json",
            evidence: { itemId: targetId },
          });
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

      for (const ref of factionRefsByCharacter.get(row.id) ?? []) {
        const targetId = ref.target_faction_id;
        if (targetId === null || !factionPages.has(targetId)) {
          diagnostics.push(
            unresolvedFactionDiagnostic(row, "reference does not identify a faction with a page"),
          );
          continue;
        }
        edgeInsert.run(
          `${row.id}:starts_in_faction:faction:${targetId}`,
          "character",
          row.id,
          "faction",
          targetId,
          "starts_in_faction",
          "Starts in faction",
          1,
          JSON.stringify({ source: "characters.startingFactions" }),
          null,
        );
      }
    }
  });
  tx();

  const characterNodes = new Map(
    db
      .query<{ entity_id: string; has_page: number }, []>(
        `SELECT entity_id, has_page FROM entity_nodes WHERE entity_type = 'character'`,
      )
      .all()
      .map((node) => [node.entity_id, node] as const),
  );
  for (const row of rows) {
    const parentId = resolveCharacterRefJson(row.parent_ref_json);
    if (parentId === null) {
      if (row.parent_ref_json !== null && !isMissingParentRefJson(row.parent_ref_json)) {
        diagnostics.push({
          severity: "diagnostic",
          source: "relationship-graph",
          code: "characterParentReferenceUnresolved",
          message: `Character '${row.id}' has an invalid parent reference.`,
          entityType: "character",
          entityId: row.id,
          field: "characters.parent_ref_json",
          evidence: { parentRefJson: row.parent_ref_json },
        });
      }
      continue;
    }
    const parent = characterNodes.get(parentId);
    if (!parent || parent.has_page !== 1) {
      diagnostics.push({
        severity: "diagnostic",
        source: "relationship-graph",
        code: "characterParentReferenceUnresolved",
        message: `Character '${row.id}' has an unresolvable parent reference '${parentId}'.`,
        entityType: "character",
        entityId: row.id,
        field: "characters.parent_ref_json",
        evidence: { parentId },
      });
      continue;
    }
    edgeInsert.run(
      `${row.id}:derives_from:character:${parentId}`,
      "character",
      row.id,
      "character",
      parentId,
      "derives_from",
      "Derives from",
      1,
      JSON.stringify({ source: "characters.parent_ref_json" }),
      null,
    );
  }
  return diagnostics;
}

function resolveCharacterRefJson(value: string | null): string | null {
  if (value === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const ref = parsed as Partial<SnapshotRef>;
  if (ref.kind === "lookupAsset" && typeof ref.guid === "string") return ref.guid;
  if (ref.kind === "namedAsset" && ref.entity === "character" && typeof ref.name === "string") {
    return `named;character;${ref.name}`;
  }
  return null;
}

function isMissingParentRefJson(value: string): boolean {
  try {
    const parsed = JSON.parse(value) as { kind?: unknown };
    return typeof parsed === "object" && parsed !== null && parsed.kind === "missing";
  } catch {
    return false;
  }
}

function unresolvedFactionDiagnostic(row: CharacterRow, reason: string): PipelineDiagnostic {
  return {
    severity: "diagnostic",
    source: "relationship-graph",
    code: "characterStartingFactionUnresolved",
    message: `Character '${row.id}' has an unresolvable starting faction reference: ${reason}.`,
    entityType: "character",
    entityId: row.id,
    field: "character_faction_refs.target_faction_id",
    evidence: { reason },
  };
}

function resolveItemId(value: unknown, knownItems: ReadonlySet<string>): string | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const ref = value as Partial<SnapshotRef>;
  let targetId: string | null = null;
  if (ref.kind === "lookupAsset" && typeof ref.guid === "string") targetId = ref.guid;
  if (ref.kind === "namedAsset" && ref.entity === "item" && typeof ref.name === "string") {
    targetId = `named;item;${ref.name}`;
  }
  return targetId !== null && knownItems.has(targetId) ? targetId : null;
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
