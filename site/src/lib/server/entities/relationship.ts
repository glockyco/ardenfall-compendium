import { all } from "../db";

export interface RelationshipSection {
  id: string;
  title: string;
  predicate: string;
  edges: RelationshipEdge[];
}

export interface RelationshipEdge {
  targetType: string;
  targetId: string;
  targetLabel: string;
  targetRoutePath: string;
  predicate: string;
  label: string;
  weight: number;
  anchor: string | null;
}

export const listRelationshipSections = (
  sourceType: string,
  sourceId: string,
): RelationshipSection[] =>
  all<{
    section_id: string;
    title: string;
    predicate: string;
    edges_json: string;
  }>(
    "SELECT section_id, title, predicate, edges_json FROM entity_relationship_sections WHERE source_type = ? AND source_id = ? ORDER BY sort_order, title",
    [sourceType, sourceId],
  ).map((row) => ({
    id: row.section_id,
    title: row.title,
    predicate: row.predicate,
    edges: JSON.parse(row.edges_json) as RelationshipEdge[],
  }));
