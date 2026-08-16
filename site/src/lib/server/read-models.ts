import { all, get } from "./db";

export interface SiteEntity {
  entity_id: string;
  singular_label: string;
  plural_label: string;
  route_path: string;
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

/**
 * Which section each route belongs to, for labelling a search result.
 *
 * The pipeline already emits a route and a plural label for every entity with a page, so this
 * reads that rather than keeping a second list that goes stale when a tenth entity arrives.
 * The longest route comes first, so a nested route wins over the route it sits under.
 */
export const listRouteSections = (): { prefix: string; label: string }[] =>
  all<{ route_path: string; plural_label: string }>(
    "SELECT route_path, plural_label FROM site_entities",
  )
    .map((row) => ({ prefix: row.route_path, label: row.plural_label }))
    .sort((a, b) => b.prefix.length - a.prefix.length || a.prefix.localeCompare(b.prefix));

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
  listItemSlugs,
  listItemOverviewCategories,
  listItemOverviewFilters,
  listItemsByCategory,
  listItemsByTag,
  listItemsByVariant,
  listItemsOverview,
  listTermIds,
} from "./entities/item";
export { listRelationshipSections } from "./entities/relationship";

export type {
  CharacterLocationLink,
  CharacterOverviewRow,
  CharacterPresentationRow,
  CharacterTypeLink,
} from "./entities/character";
export { getCharacterPresentation, listCharacters } from "./entities/character";
export type {
  CharacterDrop,
  CharacterTypeOverviewRow,
  CharacterTypePresentationRow,
} from "./entities/character-type";
export { getCharacterTypePresentation, listCharacterTypes } from "./entities/character-type";
export type {
  CharacterRaceNameSet,
  CharacterRaceOverviewRow,
  CharacterRacePresentationRow,
  CharacterRaceSeed,
} from "./entities/character-race";
export { getCharacterRacePresentation, listCharacterRaces } from "./entities/character-race";
export type {
  StatusEffectOverviewRow,
  StatusEffectPresentationRow,
} from "./entities/status-effect";
export { getStatusEffectPresentation, listStatusEffects } from "./entities/status-effect";

export type {
  QuestOverviewRow,
  QuestPresentationRow,
  QuestPhase,
  QuestObjective,
  QuestReward,
  QuestRewardItem,
} from "./entities/quest";
export { getQuestPresentation, listQuests } from "./entities/quest";

export type {
  PotionRecipeIngredient,
  PotionRecipeOverviewRow,
  PotionRecipePresentationRow,
  PotionRecipeProduct,
  PotionRecipeProductForm,
} from "./entities/potion-recipe";
export { getPotionRecipePresentation, listPotionRecipes } from "./entities/potion-recipe";

export type {
  EnchantmentEffect,
  EnchantmentItemRef,
  EnchantmentOverviewRow,
  EnchantmentPresentationRow,
} from "./entities/enchantment";
export { getEnchantmentPresentation, listEnchantments } from "./entities/enchantment";

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
  LocationElevation,
  LocationExtent,
  LocationOverviewRow,
  LocationPresentationRow,
} from "./entities/location";
export { getLocationPresentation, listLocations } from "./entities/location";

export type {
  PortalOverviewRow,
  PortalPresentationRow,
  ConnectedPortalLink,
} from "./entities/portal";
export { getPortalPresentation, listPortals } from "./entities/portal";

export type { FactionOverviewRow, FactionPresentationRow } from "./entities/faction";
export { getFactionPresentation, listFactions } from "./entities/faction";
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
