import type { Database } from "bun:sqlite";

import type { RelationshipDescriptor } from "./registry.ts";
import { relationshipRegistry } from "./registry.ts";

export { relationshipRegistry } from "./registry.ts";
export type { RelationshipDescriptor, RelationshipPredicate } from "./registry.ts";

interface EdgeRow {
  edge_id: string;
  source_type: string;
  source_id: string;
  target_type: string;
  target_id: string;
  predicate: string;
  label: string;
  weight: number;
  anchor: string | null;
}

interface NodeRow {
  entity_type: string;
  entity_id: string;
  label: string;
  short_id: string;
  route_path: string;
  is_public: number;
}

interface RelationshipEdge {
  targetType: string;
  targetId: string;
  targetLabel: string;
  targetShortId: string;
  targetRoutePath: string;
  predicate: string;
  label: string;
  weight: number;
  anchor: string | null;
}

interface RelationshipSection {
  sourceType: string;
  sourceId: string;
  title: string;
  predicate: string;
  edges: RelationshipEdge[];
  sortOrder: number;
}

/**
 * Rebuilds the detail-page relationship projection from the graph edges.
 * Edges to private or missing nodes are intentionally omitted from sections.
 */
/**
 * Makes every label in one section distinguishable.
 *
 * A section is a list of links, so two entries reading the same thing are two links with
 * the same accessible name pointing somewhere different, which fails WCAG 2.4.4 and leaves
 * a sighted reader no way to choose either. It happens for real reasons: 59 characters have
 * no stored name, 18 status effects have none, and nine separate items are all called
 * Mysterious Fossil.
 *
 * Only collisions within a single section are ambiguous. The same label appearing on two
 * different pages is fine, so this deliberately does not globally uniquify anything.
 */
function disambiguateLabels(edges: RelationshipEdge[]): void {
  const counts = new Map<string, number>();
  for (const edge of edges) counts.set(edge.targetLabel, (counts.get(edge.targetLabel) ?? 0) + 1);
  for (const edge of edges) {
    if ((counts.get(edge.targetLabel) ?? 0) > 1) {
      edge.targetLabel = `${edge.targetLabel} \u00b7 ${edge.targetShortId}`;
    }
  }
}

export function emitRelationshipSections(
  db: Database,
  registry: Readonly<Record<string, RelationshipDescriptor>> = relationshipRegistry,
): void {
  const nodes = new Map<string, NodeRow>();
  for (const node of db
    .query<NodeRow, []>(
      "SELECT entity_type, entity_id, label, short_id, route_path, is_public FROM entity_nodes",
    )
    .all()) {
    nodes.set(nodeKey(node.entity_type, node.entity_id), node);
  }

  const sections = new Map<string, RelationshipSection>();
  const edges = db
    .query<EdgeRow, []>(
      `SELECT edge_id, source_type, source_id, target_type, target_id,
              predicate, label, weight, anchor
       FROM entity_edges
       ORDER BY source_type, source_id, predicate, target_type, target_id, edge_id`,
    )
    .all();

  for (const edge of edges) {
    const descriptor = registry[edge.predicate];
    if (descriptor === undefined) {
      throw new Error(`unregistered relationship predicate '${edge.predicate}'`);
    }
    const sourceNode = nodes.get(nodeKey(edge.source_type, edge.source_id));
    const targetNode = nodes.get(nodeKey(edge.target_type, edge.target_id));
    if (sourceNode?.is_public !== 1 || targetNode?.is_public !== 1) continue;

    if (descriptor.forwardTitle !== null) {
      appendSection(
        sections,
        {
          sourceType: edge.source_type,
          sourceId: edge.source_id,
          title: descriptor.forwardTitle,
          predicate: edge.predicate,
          edges: [],
          sortOrder: descriptor.sortOrder,
        },
        {
          targetType: edge.target_type,
          targetId: edge.target_id,
          targetLabel: targetNode.label,
          targetShortId: targetNode.short_id,
          targetRoutePath: targetNode.route_path,
          predicate: edge.predicate,
          label: edge.label,
          weight: edge.weight,
          anchor: edge.anchor,
        },
      );
    }
    if (descriptor.inverseTitle !== null) {
      appendSection(
        sections,
        {
          sourceType: edge.target_type,
          sourceId: edge.target_id,
          title: descriptor.inverseTitle,
          predicate: edge.predicate,
          edges: [],
          sortOrder: descriptor.sortOrder,
        },
        {
          targetType: edge.source_type,
          targetId: edge.source_id,
          targetLabel: sourceNode.label,
          targetShortId: sourceNode.short_id,
          targetRoutePath: sourceNode.route_path,
          predicate: edge.predicate,
          label: edge.label,
          weight: edge.weight,
          anchor: edge.anchor,
        },
      );
    }
  }

  db.exec("DELETE FROM entity_relationship_sections");
  const insert = db.prepare(
    `INSERT INTO entity_relationship_sections
      (section_id, source_type, source_id, title, predicate, edges_json, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const section of sections.values()) {
    section.edges.sort(
      (left, right) =>
        left.targetLabel.localeCompare(right.targetLabel) ||
        left.targetId.localeCompare(right.targetId),
    );
    disambiguateLabels(section.edges);
    insert.run(
      `${section.sourceId}:${section.predicate}`,
      section.sourceType,
      section.sourceId,
      section.title,
      section.predicate,
      JSON.stringify(section.edges),
      section.sortOrder,
    );
  }
}

function appendSection(
  sections: Map<string, RelationshipSection>,
  section: RelationshipSection,
  edge: RelationshipEdge,
): void {
  const key = `${section.sourceType}\u0000${section.sourceId}\u0000${section.predicate}`;
  const existing = sections.get(key);
  if (existing) {
    existing.edges.push(edge);
    return;
  }
  section.edges.push(edge);
  sections.set(key, section);
}

function nodeKey(entityType: string, entityId: string): string {
  return `${entityType}\u0000${entityId}`;
}
