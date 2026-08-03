import { all, get } from "./db";

export interface SiteEntity {
  entity_id: string;
  singular_label: string;
  plural_label: string;
  route_path: string;
  canonical_table: string;
}

export interface SiteOverviewColumn {
  entity_id: string;
  column_id: string;
  field_id: string;
  position: number;
  renderer: "text" | "itemNameWithIcon";
  sortable: number;
}

export interface SiteEntityField {
  entity_id: string;
  field_id: string;
  source_table: string;
  source_column: string;
  label: string;
  value_kind: string;
  formatter: string | null;
  null_policy: string;
  link_target: string | null;
}

export const getEntity = (id: string): SiteEntity | undefined =>
  get<SiteEntity>("SELECT * FROM site_entities WHERE entity_id = ?", [id]);

export const listOverviewColumns = (id: string): SiteOverviewColumn[] =>
  all<SiteOverviewColumn>(
    "SELECT * FROM site_overview_columns WHERE entity_id = ? ORDER BY position",
    [id],
  );

export const getEntityField = (entityId: string, fieldId: string): SiteEntityField | undefined =>
  get<SiteEntityField>("SELECT * FROM site_entity_fields WHERE entity_id = ? AND field_id = ?", [
    entityId,
    fieldId,
  ]);

export type {
  EntityNode,
  EntityNodeRow,
  ItemOverviewCategory,
  ItemOverviewFilter,
  ItemOverviewRow,
  ItemPresentationDiagnostic,
  ItemPresentationDurability,
  ItemPresentationEffect,
  ItemPresentationRequirement,
  ItemPresentationRow,
  ItemPresentationStateFact,
  ItemPresentationStatRow,
  RichTextDocument,
  RichTextNode,
} from "./entities/item";
export type { RelationshipEdge, RelationshipSection } from "./entities/relationship";
export {
  getEntityNodeByShortId,
  getEntityNodeBySlug,
  getItemPresentation,
  getTerm,
  listItemIds,
  listItemOverviewCategories,
  listItemOverviewFilters,
  listItemsByCategory,
  listItemsByTag,
  listItemsByVariant,
  listItemsOverview,
  listTermIds,
} from "./entities/item";
export { listRelationshipSections } from "./entities/relationship";

export type { CharacterOverviewRow, CharacterPresentationRow } from "./entities/character";
export { getCharacterPresentation, listCharacters } from "./entities/character";
export type {
  StatusEffectOverviewRow,
  StatusEffectPresentationRow,
} from "./entities/status-effect";
export { getStatusEffectPresentation, listStatusEffects } from "./entities/status-effect";

export type { SpellOverviewRow, SpellPresentationRow } from "./entities/spell";
export { getSpellPresentation, listSpells } from "./entities/spell";

export type {
  StatTypeOverviewRow,
  StatTypePresentationRow,
  StatTypeReference,
} from "./entities/stat-type";
export { getStatTypePresentation, listStatTypes } from "./entities/stat-type";

export type {
  ItemCategoryOverviewRow,
  ItemCategoryPresentationRow,
} from "./entities/item-category";
export { getItemCategoryPresentation, listItemCategories } from "./entities/item-category";

export type { ItemTagOverviewRow, ItemTagPresentationRow } from "./entities/item-tag";
export { getItemTagPresentation, listItemTags } from "./entities/item-tag";

export type {
  MapBounds,
  MapLayerConfig,
  MapPointRow,
  MapSummary,
  MapView,
  MapVolumeRow,
  RenderKind,
} from "../map/types";
export { getMapView } from "./entities/location";
