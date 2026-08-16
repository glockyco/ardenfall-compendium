import type { Database } from "bun:sqlite";

// This module owns graph link resolution and the reader-facing display-label rule.

export interface EntityLink {
  entityId: string;
  label: string;
  routePath: string | null;
  hasPage: boolean;
}

interface EntityNodeLinkRow {
  entity_type: string;
  entity_id: string;
  label: string | null;
  short_id: string;
  route_path: string | null;
  has_page: number;
  label_count: number;
}

export type EntityLinkResolver = (entityType: string, entityId: string) => EntityLink | null;

/** Apply the graph's one reader-facing label rule. */
export function disambiguateEntityLabel(
  label: string,
  shortId: string,
  hasPage: boolean,
  labelCount: number,
): string {
  return hasPage && labelCount > 1 ? `${label} · ${shortId}` : label;
}

/**
 * Resolve links from graph nodes. The resolver computes the same label as the final
 * display-label pass, so consumers do not depend on that pass's execution order.
 */
export function prepareEntityLinkResolver(db: Database): EntityLinkResolver {
  const links = new Map<string, EntityLink>();
  for (const node of db
    .query<EntityNodeLinkRow, []>(
      `SELECT entity_type, entity_id, label, short_id, route_path, has_page,
              COUNT(*) FILTER (WHERE has_page = 1)
                OVER (PARTITION BY entity_type, label) AS label_count
       FROM entity_nodes`,
    )
    .all()) {
    if (node.label === null) {
      throw new Error(
        `entity node '${node.entity_type}:${node.entity_id}' has no label for link resolution`,
      );
    }
    links.set(`${node.entity_type}:${node.entity_id}`, {
      entityId: node.entity_id,
      label: disambiguateEntityLabel(
        node.label,
        node.short_id,
        node.has_page === 1,
        node.label_count,
      ),
      routePath: node.has_page === 1 ? node.route_path : null,
      hasPage: node.has_page === 1,
    });
  }
  return (entityType, entityId) => links.get(`${entityType}:${entityId}`) ?? null;
}
