export type EntityId = string & { readonly __brand: "EntityId" };
export type VariantId = string & { readonly __brand: "VariantId" };

export interface EntityDescriptor {
  $schema?: string;
  id: string;
  kind: "definition" | "instance";
  label: { singular: string; plural: string };
  extraction: {
    source: "lookupAsset" | "namedAsset" | "record" | "scene";
    root: string;
    walker?: string;
    options?: Record<string, unknown>;
  };
  canonicalTable: string;
  definition?: { entity: string; via: string };
  placement?: { kind: "point" | "volume" | "point+volume"; from: string };
  presentationContext?: { renderContext: string };
  fields: FieldSpec[];
  variants?: { dir: string; registry?: string };
  denormalise?: OperationRef[];
  site?: { route: string; overview?: SiteOverview; detail?: SiteDetail };
  map?: SiteMap | null;
}

export interface VariantDescriptor {
  $schema?: string;
  variantId: string;
  label: string;
  unityType: string;
  canonicalTable: string;
  parentVariantId?: string;
  hasPage?: boolean;
  position?: number;
  fields: FieldSpec[];
}

export type FieldType =
  | "id"
  | "string"
  | "integer"
  | "number"
  | "boolean"
  | "json"
  | "ref:asset"
  | "ref:asset[]"
  | "ref:record";

export interface FieldSpec {
  name: string;
  type: FieldType;
  from: string;
  operation?: string;
  missingPolicy?: "fatal" | "diagnostic" | "optional-empty";
  storage?: "column" | "unstored";
  column?: string;
  projects?: string;
  reason?: string;
  label?: string;
  description?: string;
}

export interface OperationRef {
  op: string;
  from?: string;
  as?: string;
}

export interface SiteOverview {
  columns: string[];
  search?: string[];
  filters?: SiteFilter[];
}

export interface SiteDetail {
  sections: SiteSection[];
}

export interface SiteFilter {
  field: string;
  kind: "categorical" | "range" | "boolean";
}

export type SiteSection =
  | { id: string; kind: "fieldList"; title: string; fields: string[] }
  | {
      id: string;
      kind: "custom";
      title: string;
      renderer: string;
      props?: Record<string, unknown>;
    };

export interface SiteMap {
  layer: string;
  renderKind:
    "point" | "polygon" | "point-or-polygon" | "arc" | "radius" | "relation-overlay" | "custom";
  icon?: string;
  color?: number[];
  radius?: number;
  filters?: SiteFilter[];
  tooltip?: string[];
  legendLabel?: string;
  zOrder?: number;
}

export type SnapshotSource =
  { kind: "live-game-export" } | { kind: "synthetic-fixture"; fixtureName: string };

export interface SnapshotManifest {
  schemaVersion: number;
  gameVersion?: string;
  buildIdentifier?: string;
  extractorVersion: string;
  extractedAt: string;
  source: SnapshotSource;
  preflight: {
    passed: boolean;
    completedAt: string;
    checks: { name: string; ok: boolean; reason?: string | null }[];
  };
  counts: Record<string, number>;
  diagnostics: { fatal: number; diagnostic: number };
  hashes: Record<string, string>;
}

export interface FinalizeTiming {
  phase: string;
  elapsedMs: number;
  totalElapsedMs: number;
}

export interface SnapshotEnvelope<F = Record<string, unknown>> {
  entityId: string;
  schemaVersion: number;
  rows: SnapshotRow<F>[];
}

export interface SnapshotRow<F = Record<string, unknown>> {
  id: string;
  variant?: string;
  fields: F;
  tags?: string[];
  provenance?: Record<string, FieldProvenance>;
  diagnostics?: SnapshotDiagnostic[];
  presentation?: ItemPresentationSnapshot;
}

/**
 * Narrows a loaded envelope's rows to a specific entity's field shape.
 *
 * `stages/load-snapshot` is entity-agnostic, so it yields rows whose `fields`
 * are `Record<string, unknown>`. `stages/validate` then checks every row
 * against that entity's JSON Schema, so by the time a canonicaliser runs the
 * field shape is established. This function is the single place that
 * post-validation knowledge is expressed as a type assertion; canonicalisers
 * must not re-assert it inline.
 */
export function entityRows<F>(envelope: SnapshotEnvelope): SnapshotRow<F>[] {
  return envelope.rows as SnapshotRow<F>[];
}

export interface ItemPresentationSnapshot {
  schemaVersion: 1;
  renderContext: "item-presentation-v1";
  displayName: string | null;
  displayNameSourceMethod: string;
  itemType: string | null;
  itemTypeSourceMethod: string | null;
  descriptionSource: string;
  effectsSource: string;
  effects: ItemPresentationEffect[];
  statRows: ItemPresentationStatRow[];
  requirements: ItemPresentationRequirement[];
  durability: ItemPresentationDurability | null;
  stateFacts: ItemPresentationStateFact[];
  value: number | null;
  weight: number | null;
  diagnostics: ItemPresentationDiagnostic[];
}

export interface ItemPresentationStatRow {
  id: string;
  label: string;
  value: number | null;
  valueText: string;
  suffix: string | null;
  size: string;
  indent: number;
  comparison: string | null;
  source: string;
}

export interface ItemPresentationRequirement {
  id: string;
  label: string;
  valueText: string;
  source: string;
}

export interface ItemPresentationEffect {
  kind: string;
  label: string;
  targetType: string | null;
  targetId: string | null;
  targetRef: SnapshotRef | null;
  level: number | null;
  source: string;
}

export interface ItemPresentationDurability {
  kind: string;
  max: number;
  source: string;
}

export interface ItemPresentationStateFact {
  kind: string;
  label: string;
  description: string;
}

export interface ItemPresentationDiagnostic {
  severity: "fatal" | "diagnostic";
  code: string;
  field: string;
  message: string;
}

export interface MasterTooltipVocabulary {
  schemaVersion: 2;
  tooltipCodes: Record<string, string>;
  tooltipColors: Record<string, MasterTooltipColorToken>;
  tooltipTargetColor: SnapshotColor;
  tooltipDurationColor: SnapshotColor;
  positiveColor: SnapshotColor;
  negativeColor: SnapshotColor;
  spellSubEffectColor: SnapshotColor;
  enchantmentItemColor: SnapshotColor;
  primarySpellTooltip: string;
  secondarySpellTooltip: string;
  unmetSkillMessage: string;
  brokenDurabilityMessage: string;
  ruinedDurabilityMessage: string;
  statBookMessage: string;
  termSetColors: MasterTooltipTermSetColor[];
  globalTermSets: MasterTooltipTermSet[];
  termColorMatch: string;
  potionRecipeDescription: string;
  allAttributes: string[];
  allSkills: string[];
  allTraits: string[];
}

export interface MasterTooltipColorToken {
  color: string;
  text: string;
}

export interface MasterTooltipTermSetColor {
  categoryId: string;
  replaceWithStart: string;
  replaceWithEnd: string;
  enableJournalOverride: boolean;
  replaceWithStartJournal: string;
  replaceWithEndJournal: string;
  start: string;
  end: string;
}

export interface MasterTooltipTermSet {
  setId: string;
  categoryId: string;
  tooltipFormat: string;
  terms: MasterTooltipTerm[];
}

export interface MasterTooltipTerm {
  value: string;
  definition: string;
}

export type FieldProvenance =
  | {
      kind: "parameter";
      source: string;
      isSet: boolean;
      inherited: boolean;
      parent?: SnapshotRefBrief | null;
    }
  | {
      kind: "smartListParameter";
      source: string;
      isSet: boolean;
      inherited: boolean;
      parent?: SnapshotRefBrief | null;
    }
  | {
      kind: "lookupAsset";
      source: string;
      isSet: boolean;
      inherited: boolean;
      parent?: SnapshotRefBrief | null;
    }
  | {
      kind: "record";
      source: string;
      isSet: boolean;
      inherited: boolean;
      parent?: SnapshotRefBrief | null;
    }
  | {
      kind: "runtimeObject";
      source: string;
      isSet: boolean;
      inherited: boolean;
      parent?: SnapshotRefBrief | null;
    }
  | {
      kind: "missing";
      source: string;
      isSet: false;
      inherited: boolean;
      parent?: SnapshotRefBrief | null;
    };

export interface SnapshotRefBrief {
  kind: string;
  guid?: string;
  unityType?: string;
}

export interface SnapshotDiagnostic {
  severity: "fatal" | "diagnostic";
  code: string;
  field: string;
  message?: string;
}

export interface SnapshotVector3 {
  x: number;
  y: number;
  z: number;
}

export interface LocationSnapshotVolume {
  index: number;
  center: SnapshotVector3;
  size: SnapshotVector3;
}

export interface LocationSnapshotFields {
  id: string;
  name: string;
  enabled: boolean;
  mapId: string | null;
  mapRef?: SnapshotRef | null;
  showOnMap: boolean;
  showOnMapDebugOnly: boolean;
  iconRef?: SnapshotRef | null;
  mapPosition: SnapshotVector3;
  allowFastTravel: boolean;
  fastTravelPosition: SnapshotVector3 | null;
  volumes: LocationSnapshotVolume[];
}

export interface SpellSnapshotFields {
  id: string;
  spellName: string | null;
  statTypeRef?: SnapshotRef | null;
  manaCost?: number;
  isIllegal?: boolean | null;
  tooltipSource?: string | null;
  iconRef?: SnapshotRef | null;
}

export interface FactionSnapshotRelationship {
  faction: SnapshotRef | null;
  relationship: number;
  isEnemy: boolean;
}

export interface FactionSnapshotFields {
  id: string;
  name: string | null;
  factionId: string | null;
  description: string;
  iconRef?: SnapshotRef | null;
  alliable: boolean;
  enableReputation: boolean;
  alwaysShowInUI: boolean;
  canBeDisguised: boolean;
  enableBounty: boolean;
  interFactionRelationships: FactionSnapshotRelationship[];
}

export interface CharacterSnapshotFields {
  id: string;
  name: string | null;
  dropRefs: SnapshotRef[];
  startingFactions?: SnapshotRef[];
}

export interface StatusEffectSnapshotFields {
  id: string;
  statusEffectName: string | null;
  tooltipSource?: string | null;
  iconRef?: SnapshotRef | null;
  isHostile?: boolean | null;
}

export interface PortalSnapshotFields {
  id: string;
  recordRef: SnapshotRef;
  friendlyName: string | null;
  mapId: string | null;
  position: SnapshotVector3;
  connectedPortalRef?: SnapshotRef | null;
}

export interface SnapshotDiagnosticArtifactEntry extends SnapshotDiagnostic {
  rowId: string | null;
}

export interface SnapshotAssetManifest {
  schemaVersion: number;
  assets: SnapshotAssetEntry[];
  itemIconMetadata: SnapshotItemIconMetadata[];
}

export interface SnapshotAssetEntry {
  entityId: string;
  rowId: string;
  slot: string;
  kind: "image";
  pngHash: string;
  sourcePath: string;
}

export interface SnapshotColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface SnapshotItemIconMetadata {
  entityId: string;
  rowId: string;
  displayIconColor: SnapshotColor;
  secondaryIconColor: SnapshotColor | null;
}

export interface EmittedAssetRef {
  entityId: string;
  entityRowId: string;
  slot: string;
  assetKind: "image";
  assetHash: string;
  outputPath: string;
}

export type ArtifactKind = "fixture" | "release";

export interface ArtifactManifest {
  schemaVersion: number;
  artifactKind: ArtifactKind;
  artifactId: string;
  createdAt: string;
  source: {
    kind: "live-game-export" | "synthetic-fixture";
    fixtureName?: string;
    snapshotId: string;
    gameVersion: string;
    buildIdentifier: string;
    extractorVersion: string;
    snapshotManifestSha256: string;
  };
  git: {
    repository: string;
    commit: string;
    branch: string;
    dirty: boolean;
  };
  toolchain?: Record<string, string>;
  diagnostics: { fatal: number; diagnostic: number };
  counts: Record<string, number>;
  outputs: {
    sqlite: { path: "data.sqlite"; bytes: number; sha256: string };
    assets: { path: "assets"; count: number; treeSha256: string };
  };
  probes: { items: { id: string; name: string; displayIconHash: string | null }[] };
}

// Snapshot refs (canonical)

export type SnapshotRef =
  | { kind: "lookupAsset"; guid: string; unityType?: string; name?: string }
  | { kind: "namedAsset"; entity: string; name: string }
  | { kind: "record"; table: string; subtable: string; id: string; recordType?: string | null }
  | { kind: "runtimeObject"; extractionId: string; unityType?: string; stable: false }
  | { kind: "missing"; reason: string; source: string };

// Stages

export interface StageContext {
  workspaceRoot: string;
  snapshotDir: string;
  outDir: string;
  log: (level: "info" | "warn" | "error", msg: string) => void;
}

export interface Stage<I, O> {
  id: string;
  inputs: readonly string[];
  run: (inputs: I, ctx: StageContext) => Promise<O> | O;
}
