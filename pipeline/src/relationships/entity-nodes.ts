import type { Database } from "bun:sqlite";
import { deriveShortId, deriveSlug } from "../slug/derive-slug.ts";

// This module owns graph node writing and slug derivation for every entity family.

export interface EntityNodeInput {
  entityType: string;
  entityId: string;
  label: string | null;
  routePath: string | null;
  canonicalSlug?: string;
  shortId?: string;
  hasPage?: boolean;
}

export type EntityNodeWriter = (node: EntityNodeInput) => void;

export function prepareEntityNodeWriter(db: Database): EntityNodeWriter {
  const insert = db.prepare(
    `INSERT INTO entity_nodes (entity_type, entity_id, label, display_label, route_path, canonical_slug, short_id, has_page) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(entity_type, entity_id) DO NOTHING`,
  );

  return (node) => {
    const explicitCanonicalSlug = node.canonicalSlug;
    const explicitShortId = node.shortId;
    if ((explicitCanonicalSlug === undefined) !== (explicitShortId === undefined)) {
      throw new Error("entity node canonicalSlug and shortId must be provided together");
    }

    const slug =
      explicitCanonicalSlug === undefined
        ? deriveEntityNodeSlug(node.label ?? "", node.entityId)
        : { canonicalSlug: explicitCanonicalSlug, shortId: explicitShortId as string };
    const existing = db
      .query<{ entity_id: string }, [string, string, string]>(
        `SELECT entity_id FROM entity_nodes
         WHERE entity_type = ? AND canonical_slug = ? AND entity_id <> ?`,
      )
      .get(node.entityType, slug.canonicalSlug, node.entityId);
    if (existing) {
      throw new Error(
        `entity node slug collision: entities '${existing.entity_id}' and '${node.entityId}' resolve to canonical slug '${slug.canonicalSlug}'`,
      );
    }
    insert.run(
      node.entityType,
      node.entityId,
      node.label,
      node.label,
      node.routePath,
      slug.canonicalSlug,
      slug.shortId,
      (node.hasPage ?? true) ? 1 : 0,
    );
  };
}

export function deriveEntityNodeSlug(
  displayName: string,
  entityId: string,
): { canonicalSlug: string; shortId: string } {
  return {
    canonicalSlug: deriveSlug({ displayName, assetId: entityId }),
    shortId: deriveShortId(entityId),
  };
}
