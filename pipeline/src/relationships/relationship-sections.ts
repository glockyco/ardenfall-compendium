import type { Database } from "bun:sqlite";

import type { PipelineDiagnostic } from "./relationship-graph.ts";
import type { RelationshipDescriptor, RelationshipTitle } from "./registry.ts";
import { relationshipRegistry } from "./registry.ts";

export { relationshipRegistry } from "./registry.ts";
export type {
  RelationshipDescriptor,
  RelationshipDirectionPresentation,
  RelationshipPagePresentation,
  RelationshipPredicate,
  RelationshipTitle,
} from "./registry.ts";

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
  /** Already disambiguated across the whole entity type, so no consumer re-derives it. */
  display_label: string | null;
  short_id: string;
  route_path: string | null;
  has_page: number;
}

interface RelationshipEdge {
  targetType: string;
  targetId: string;
  targetLabel: string | null;
  targetShortId: string;
  targetRoutePath: string | null;
  targetHasPage: boolean;
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
  /**
   * Which way the underlying edge points, relative to this section's owner.
   *
   * A predicate with both titles produces two different lists on one page, and they hold
   * different facts. `starts_opposed_to` proves it. Of 25 edges only 10 have a reciprocal
   * partner, so who a faction opposes and who opposes it are not the same set. The key and
   * stored id must carry direction and source entity type. Without that the two lists merge
   * under one title, and a mutual pair shows its peer twice.
   */
  direction: "forward" | "inverse";
  edges: RelationshipEdge[];
  sortOrder: number;
  sourceEntityType: string;
}

/**
 * Rebuilds the detail-page relationship projection from the graph edges.
 *
 * A target without a page is included, so the site can state it in plain text. Nothing is
 * hidden. This is a compendium, so a thing that exists in the game is listed, and a thing
 * with no authored name is stated as an unnamed one rather than left out.
 */
/**
 * Makes every label in one section distinguishable.
 *
 * A section lists related entries. A page-less target is rendered as plain text, while a
 * page target is a link. Duplicate labels still need distinct accessible names.
 *
 * Only collisions within a single section are ambiguous. The same label appearing on two
 * different pages is fine, so this deliberately does not globally uniquify anything.
 */
export function disambiguateLabels<T extends { label: string | null; shortId: string }>(
  edges: T[],
): void {
  const counts = new Map<string, number>();
  for (const edge of edges) {
    if (edge.label !== null) counts.set(edge.label, (counts.get(edge.label) ?? 0) + 1);
  }
  for (const edge of edges) {
    if (edge.label !== null && (counts.get(edge.label) ?? 0) > 1 && edge.shortId) {
      edge.label = `${edge.label} · ${edge.shortId}`;
    }
  }
}

export function emitRelationshipSections(
  db: Database,
  registry: Readonly<Record<string, RelationshipDescriptor>> = relationshipRegistry,
): PipelineDiagnostic[] {
  const nodes = new Map<string, NodeRow>();
  for (const node of db
    .query<NodeRow, []>(
      "SELECT entity_type, entity_id, display_label, short_id, route_path, has_page FROM entity_nodes",
    )
    .all()) {
    nodes.set(nodeKey(node.entity_type, node.entity_id), node);
  }

  const sections = new Map<string, RelationshipSection>();
  const diagnostics: PipelineDiagnostic[] = [];
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
    if (sourceNode === undefined || targetNode === undefined) {
      if (sourceNode === undefined) {
        diagnostics.push({
          severity: "diagnostic",
          source: "relationship-graph",
          code: "relationshipEdgeNodeMissing",
          message: `Relationship edge '${edge.edge_id}' with predicate '${edge.predicate}' is missing source node '${edge.source_type}:${edge.source_id}'.`,
          entityType: edge.source_type,
          entityId: edge.source_id,
          field: "entity_edges.source_id",
          evidence: {
            edgeId: edge.edge_id,
            predicate: edge.predicate,
            missingNodeType: edge.source_type,
            missingNodeId: edge.source_id,
          },
        });
      }
      if (targetNode === undefined) {
        diagnostics.push({
          severity: "diagnostic",
          source: "relationship-graph",
          code: "relationshipEdgeNodeMissing",
          message: `Relationship edge '${edge.edge_id}' with predicate '${edge.predicate}' is missing target node '${edge.target_type}:${edge.target_id}'.`,
          entityType: edge.source_type,
          entityId: edge.source_id,
          field: "entity_edges.target_id",
          evidence: {
            edgeId: edge.edge_id,
            predicate: edge.predicate,
            missingNodeType: edge.target_type,
            missingNodeId: edge.target_id,
          },
        });
      }
      continue;
    }

    if (descriptor.pagePresentation?.forward !== "inline") {
      const forwardTitle = resolveTitle(
        descriptor.forwardTitle,
        edge.source_type,
        edge.predicate,
        "forward",
      );
      if (forwardTitle !== null && sourceNode.has_page === 1) {
        appendSection(
          sections,
          {
            sourceType: edge.source_type,
            sourceId: edge.source_id,
            title: forwardTitle,
            predicate: edge.predicate,
            direction: "forward",
            edges: [],
            sortOrder: sectionSortOrder(descriptor, edge.predicate),
            sourceEntityType: edge.source_type,
          },
          {
            targetType: edge.target_type,
            targetId: edge.target_id,
            targetLabel: targetNode.display_label,
            targetShortId: targetNode.short_id,
            targetRoutePath: targetNode.route_path,
            targetHasPage: targetNode.has_page === 1,
            predicate: edge.predicate,
            label: edge.label,
            weight: edge.weight,
            anchor: edge.anchor,
          },
        );
      }
    }
    if (descriptor.pagePresentation?.inverse !== "inline") {
      const inverseTitle = resolveTitle(
        descriptor.inverseTitle,
        edge.source_type,
        edge.predicate,
        "inverse",
      );
      if (inverseTitle !== null && targetNode.has_page === 1) {
        appendSection(
          sections,
          {
            sourceType: edge.target_type,
            sourceId: edge.target_id,
            title: inverseTitle,
            predicate: edge.predicate,
            direction: "inverse",
            edges: [],
            sortOrder: sectionSortOrder(descriptor, edge.predicate),
            sourceEntityType: edge.source_type,
          },
          {
            targetType: edge.source_type,
            targetId: edge.source_id,
            targetLabel: sourceNode.display_label,
            targetShortId: sourceNode.short_id,
            targetRoutePath: sourceNode.route_path,
            targetHasPage: sourceNode.has_page === 1,
            predicate: edge.predicate,
            label: edge.label,
            weight: edge.weight,
            anchor: edge.anchor,
          },
        );
      }
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
        (left.targetLabel ?? "").localeCompare(right.targetLabel ?? "") ||
        left.targetId.localeCompare(right.targetId),
    );
    insert.run(
      `${section.sourceId}:${section.predicate}:${section.direction}:${section.sourceEntityType}`,
      section.sourceType,
      section.sourceId,
      section.title,
      section.predicate,
      JSON.stringify(section.edges),
      section.sortOrder,
    );
  }
  return diagnostics;
}

function appendSection(
  sections: Map<string, RelationshipSection>,
  section: RelationshipSection,
  edge: RelationshipEdge,
): void {
  const key = `${section.sourceType}\u0000${section.sourceId}\u0000${section.predicate}\u0000${section.direction}\u0000${section.sourceEntityType}`;
  const existing = sections.get(key);
  if (existing) {
    existing.edges.push(edge);
    return;
  }
  section.edges.push(edge);
  sections.set(key, section);
}

function sectionSortOrder(descriptor: RelationshipDescriptor, predicate: string): number {
  if (descriptor.sortOrder === undefined) {
    throw new Error(`relationship predicate '${predicate}' has titles but no sort order`);
  }
  return descriptor.sortOrder;
}

function resolveTitle(
  title: RelationshipTitle | null,
  sourceEntityType: string,
  predicate: string,
  direction: "forward" | "inverse",
): string | null {
  if (title === null || typeof title === "string") return title;
  const resolved = title[sourceEntityType];
  if (resolved === undefined) {
    throw new Error(
      `relationship predicate '${predicate}' has no ${direction} title for source entity type '${sourceEntityType}'`,
    );
  }
  return resolved;
}

function nodeKey(entityType: string, entityId: string): string {
  return `${entityType}\u0000${entityId}`;
}
