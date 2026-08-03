import type { RelationshipEdge } from "./entities/relationship";
import type { StatTypeReference } from "./entities/stat-type";
import type {
  ItemOverviewFilter,
  ItemPresentationDurability,
  ItemPresentationEffect,
  ItemPresentationRequirement,
  ItemPresentationStateFact,
  ItemPresentationStatRow,
  RichTextDocument,
} from "./entities/item";

export type JsonGuard<T> = (value: unknown) => value is T;

export function parseGeneratedJson<T>(
  json: string,
  entity: string,
  column: string,
  rowId: string,
  guard: JsonGuard<T>,
): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json) as unknown;
  } catch (error) {
    throw new Error(`invalid generated JSON for ${entity}.${column} row ${rowId}`, {
      cause: error,
    });
  }
  if (!guard(parsed)) {
    throw new Error(`invalid generated JSON shape for ${entity}.${column} row ${rowId}`);
  }
  return parsed;
}

export function validateRenderContext<T extends string>(
  value: string,
  entity: string,
  rowId: string,
  expected: T,
): T {
  if (value !== expected) {
    throw new Error(
      `unknown render_context '${value}' for ${entity} row ${rowId}, expected '${expected}'`,
    );
  }
  return expected;
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

export const isStringRecord = (value: unknown): value is Record<string, string> => {
  if (!isRecord(value)) return false;
  for (const key in value) {
    if (typeof value[key] !== "string") return false;
  }
  return true;
};

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === "string";

const isRichTextNode = (value: unknown): boolean => {
  if (!isRecord(value) || typeof value.type !== "string") return false;
  if (value.type === "text") return typeof value.text === "string";
  if (value.type === "lineBreak") return true;
  if (value.type === "sprite") return typeof value.name === "string";
  if (value.type === "termLink") {
    return (
      typeof value.termId === "string" &&
      typeof value.label === "string" &&
      (value.targetType === undefined || typeof value.targetType === "string") &&
      (value.targetId === undefined || typeof value.targetId === "string") &&
      (value.targetLabel === undefined || typeof value.targetLabel === "string") &&
      (value.targetRoutePath === undefined || typeof value.targetRoutePath === "string") &&
      (value.targetHasPage === undefined || typeof value.targetHasPage === "boolean")
    );
  }
  if (value.type === "color") {
    return (
      isNullableString(value.token) &&
      isNullableString(value.color) &&
      Array.isArray(value.children) &&
      value.children.every(isRichTextNode)
    );
  }
  if (value.type === "strong" || value.type === "emphasis" || value.type === "strike") {
    return Array.isArray(value.children) && value.children.every(isRichTextNode);
  }
  return false;
};

export const isRichTextDocument: JsonGuard<RichTextDocument> = (value): value is RichTextDocument =>
  isRecord(value) &&
  value.schemaVersion === 1 &&
  typeof value.sourceHash === "string" &&
  Array.isArray(value.nodes) &&
  value.nodes.every(isRichTextNode) &&
  Array.isArray(value.diagnostics) &&
  value.diagnostics.every(
    (diagnostic) =>
      isRecord(diagnostic) &&
      (diagnostic.severity === "fatal" || diagnostic.severity === "diagnostic") &&
      typeof diagnostic.code === "string" &&
      typeof diagnostic.field === "string" &&
      typeof diagnostic.message === "string",
  );

export const isEffectArray: JsonGuard<
  Array<Omit<ItemPresentationEffect, "targetRoutePath" | "level"> & { level?: number | null }>
> = (
  value,
): value is Array<
  Omit<ItemPresentationEffect, "targetRoutePath" | "level"> & { level?: number | null }
> =>
  Array.isArray(value) &&
  value.every(
    (effect) =>
      isRecord(effect) &&
      typeof effect.kind === "string" &&
      typeof effect.label === "string" &&
      isNullableString(effect.targetType) &&
      isNullableString(effect.targetId) &&
      (effect.level === undefined || effect.level === null || isFiniteNumber(effect.level)) &&
      typeof effect.source === "string",
  );

export const isStatRowArray: JsonGuard<ItemPresentationStatRow[]> = (
  value,
): value is ItemPresentationStatRow[] =>
  Array.isArray(value) &&
  value.every(
    (row) =>
      isRecord(row) &&
      typeof row.id === "string" &&
      typeof row.label === "string" &&
      (row.value === null || isFiniteNumber(row.value)) &&
      typeof row.valueText === "string" &&
      isNullableString(row.suffix) &&
      typeof row.size === "string" &&
      isFiniteNumber(row.indent) &&
      isNullableString(row.comparison) &&
      typeof row.source === "string",
  );

export const isRequirementArray: JsonGuard<ItemPresentationRequirement[]> = (
  value,
): value is ItemPresentationRequirement[] =>
  Array.isArray(value) &&
  value.every(
    (requirement) =>
      isRecord(requirement) &&
      typeof requirement.id === "string" &&
      typeof requirement.label === "string" &&
      typeof requirement.valueText === "string" &&
      typeof requirement.source === "string",
  );

export const isDurability: JsonGuard<ItemPresentationDurability> = (
  value,
): value is ItemPresentationDurability =>
  isRecord(value) &&
  typeof value.kind === "string" &&
  isFiniteNumber(value.max) &&
  typeof value.source === "string";

export const isStateFactArray: JsonGuard<ItemPresentationStateFact[]> = (
  value,
): value is ItemPresentationStateFact[] =>
  Array.isArray(value) &&
  value.every(
    (fact) =>
      isRecord(fact) &&
      typeof fact.kind === "string" &&
      typeof fact.label === "string" &&
      typeof fact.description === "string",
  );

export const isOptionsArray: JsonGuard<ItemOverviewFilter["options"]> = (
  value,
): value is ItemOverviewFilter["options"] =>
  Array.isArray(value) &&
  value.every(
    (option) =>
      isRecord(option) &&
      typeof option.value === "string" &&
      typeof option.label === "string" &&
      isFiniteNumber(option.count),
  );

export const isColorArray: JsonGuard<number[]> = (value): value is number[] =>
  Array.isArray(value) && (value.length === 3 || value.length === 4) && value.every(isFiniteNumber);

export const isGeometry: JsonGuard<{ ring: [number, number][] }> = (
  value,
): value is { ring: [number, number][] } =>
  isRecord(value) &&
  Array.isArray(value.ring) &&
  value.ring.every(
    (point): point is [number, number] =>
      Array.isArray(point) && point.length === 2 && point.every(isFiniteNumber),
  );

export const isRelationshipEdgeArray: JsonGuard<RelationshipEdge[]> = (
  value,
): value is RelationshipEdge[] =>
  Array.isArray(value) &&
  value.every(
    (edge) =>
      isRecord(edge) &&
      typeof edge.targetType === "string" &&
      typeof edge.targetId === "string" &&
      typeof edge.targetLabel === "string" &&
      typeof edge.targetRoutePath === "string" &&
      typeof edge.predicate === "string" &&
      typeof edge.label === "string" &&
      isFiniteNumber(edge.weight) &&
      isNullableString(edge.anchor),
  );

export const isStatReferenceArray: JsonGuard<StatTypeReference[]> = (
  value,
): value is StatTypeReference[] =>
  Array.isArray(value) &&
  value.every(
    (reference) =>
      isRecord(reference) &&
      typeof reference.label === "string" &&
      isNullableString(reference.routePath),
  );

export const isRecordArray: JsonGuard<Record<string, unknown>[]> = (
  value,
): value is Record<string, unknown>[] => Array.isArray(value) && value.every(isRecord);

export const isColorObject: JsonGuard<{ r?: unknown; g?: unknown; b?: unknown; a?: unknown }> = (
  value,
): value is { r?: unknown; g?: unknown; b?: unknown; a?: unknown } => isRecord(value);
