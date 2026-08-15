import type { Database } from "bun:sqlite";
import type { EmitAssetsOutput } from "../stages/emit-assets.ts";
import type { LoadDescriptorsOutput } from "../stages/load-descriptors.ts";
import type { LoadSnapshotOutput } from "../stages/load-snapshot.ts";
import type { EntityDescriptor, SnapshotEnvelope, VariantDescriptor } from "../types.ts";
import type { PipelineDiagnostic } from "../relationships/relationship-graph.ts";
import { buildDDL } from "../sql/ddl";
import { ITEM_CATEGORY_DDL } from "../sql/item-category-ddl";
import { ITEM_TAG_DDL } from "../sql/item-tag-ddl";
import { CHARACTER_RACE_DDL } from "../sql/character-race-ddl";
import { NAME_SET_DDL } from "../sql/name-set-ddl";
import { LOCATION_DDL } from "../sql/location-ddl";
import { FACTION_DDL } from "../sql/faction-ddl";
import { CHARACTER_DDL } from "../sql/character-ddl";
import { PORTAL_DDL } from "../sql/portal-ddl";
import { NPC_DDL } from "../sql/npc-ddl";
import { STAT_TYPE_DDL } from "../sql/stat-type-ddl";
import { SPELL_DDL } from "../sql/spell-ddl";
import { POTION_RECIPE_DDL } from "../sql/potion-recipe-ddl";
import { ENCHANTMENT_DDL } from "../sql/enchantment-ddl";
import { STATUS_EFFECT_DDL } from "../sql/status-effect-ddl";
import { QUEST_DDL } from "../sql/quest-ddl";
import { canonicaliseItems } from "./item/canonicaliser";
import { emitItemReadModels } from "./item/read-models";
import { canonicaliseStatTypes } from "./stat-type/canonicaliser";
import { emitStatTypeReadModels } from "./stat-type/read-models";
import { canonicaliseQuests } from "./quest/canonicaliser";
import { canonicaliseSpells } from "./spell/canonicaliser";
import { emitSpellReadModels } from "./spell/read-models";
import { canonicalisePotionRecipes } from "./potion-recipe/canonicaliser";
import { emitPotionRecipeReadModels } from "./potion-recipe/read-models";
import { canonicaliseEnchantments } from "./enchantment/canonicaliser";
import { emitEnchantmentReadModels } from "./enchantment/read-models";
import { canonicaliseStatusEffects } from "./status-effect/canonicaliser";
import { emitStatusEffectReadModels } from "./status-effect/read-models";
import { canonicaliseItemCategories } from "./item-category/canonicaliser";
import { emitItemCategoryReadModels } from "./item-category/read-models";
import { canonicaliseItemTags } from "./item-tag/canonicaliser";
import { emitItemTagReadModels } from "./item-tag/read-models";
import { canonicaliseCharacterRaces } from "./character-race/canonicaliser";
import { emitCharacterRaceReadModels } from "./character-race/read-models";
import { canonicaliseNameSets } from "./name-set/canonicaliser";
import { emitNameSetReadModels } from "./name-set/read-models";
import { canonicaliseFactions } from "./faction/canonicaliser";
import { emitFactionReadModels } from "./faction/read-models";
import { canonicaliseCharacters } from "./character/canonicaliser";
import { canonicaliseLocations } from "./location/canonicaliser";
import { emitLocationReadModels, locationProjection } from "./location/read-models";
import { emitCharacterReadModels } from "./character/read-models";
import { canonicalisePortals } from "./portal/canonicaliser";
import { emitPortalReadModels } from "./portal/read-models";
import { canonicaliseNpcs } from "./npc/canonicaliser";
import { emitNpcReadModels } from "./npc/read-models";
import { emitQuestReadModels } from "./quest/read-models";

interface MapProjection {
  points: string;
  volumes?: string;
}

interface ReadModelContext {
  db: Database;
  desc: LoadDescriptorsOutput;
  snapshot: LoadSnapshotOutput;
  assets?: EmitAssetsOutput;
  entity: EntityDescriptor;
  variants: VariantDescriptor[];
  envelope: SnapshotEnvelope;
}

interface EntityModule {
  ddl: string | ((entity: EntityDescriptor, variants: VariantDescriptor[]) => string);
  canonicalise: (context: {
    db: Database;
    entity: EntityDescriptor;
    variants: VariantDescriptor[];
    envelope: SnapshotEnvelope;
  }) => void;
  readModel?: (context: ReadModelContext) => PipelineDiagnostic[] | void;
  readModelPhase?: "entity" | "after-map";
  mapProjection?: MapProjection;
  site?: {
    overviewRenderer?: (field: string) => string;
    emitVariants?: boolean;
  };
  requiredSnapshot?: {
    error: string;
    readModelError?: string;
    variants?: boolean;
  };
}

const portalProjection: MapProjection = {
  // `portals.friendly_name` is nullable because the game genuinely ships portals with an
  // empty `friendlyName`. The extractor records that as a diagnostic rather than
  // inventing a value. A map label cannot be null, so presentation supplies a
  // visibly placeholder one here instead of letting an id masquerade as a name.
  points: `
      INSERT INTO map_points (
        id, entity_id, instance_id, name, map_id, map_x, map_y, elevation,
        enabled, show_on_map_debug_only, allow_fast_travel
      )
      SELECT 'portal:' || p.id, 'portal', p.id, COALESCE(p.friendly_name, 'Unnamed portal'),
             pl.map_id, pl.map_x, pl.map_y, pl.elevation,
             1, 0, 0 -- portals have no authored availability flag; they are available

      FROM portals p
      JOIN placements pl ON pl.entity_id = 'portal' AND pl.instance_id = p.id
      ORDER BY COALESCE(p.friendly_name, 'Unnamed portal'), p.id;
    `,
};

const npcProjection: MapProjection = {
  points: `
      INSERT INTO map_points (
        id, entity_id, instance_id, name, map_id, map_x, map_y, elevation,
        enabled, show_on_map_debug_only, allow_fast_travel
      )
      SELECT 'npc:' || n.id, 'npc', n.id,
             COALESCE(NULLIF(TRIM(n.display_name), ''), 'Unnamed character'),
             p.map_id, p.map_x, p.map_y, p.elevation,
             1, 0, 0 -- NPCs have no authored availability flag; they are available

      FROM npcs n
      JOIN placements p ON p.entity_id = 'npc' AND p.instance_id = n.id
      ORDER BY COALESCE(NULLIF(TRIM(n.display_name), ''), 'Unnamed character'), n.id;
    `,
};

/**
 * The sole dispatch registry. Its insertion order is pipeline order for the
 * canonical tables and entity read models.
 */
export const entityRegistry: Record<string, EntityModule> = {
  item: {
    ddl: buildDDL,
    canonicalise: ({ db, entity, variants, envelope }) =>
      canonicaliseItems(db, entity, variants, envelope),
    readModel: ({ db, desc, snapshot, assets, envelope }) =>
      emitItemReadModels(
        db,
        desc,
        assets?.itemIconMetadata ?? [],
        envelope,
        snapshot.masterTooltip,
      ),
    site: {
      overviewRenderer: (field: string) => (field === "name" ? "itemNameWithIcon" : "text"),
      emitVariants: true,
    },
    requiredSnapshot: {
      error: "emit-sqlite: missing item descriptor or envelope",
      readModelError: "emit-read-models: missing item envelope",
      variants: true,
    },
  },
  "stat-type": {
    ddl: STAT_TYPE_DDL,
    canonicalise: ({ db, envelope }) => canonicaliseStatTypes(db, envelope),
    readModel: ({ db, snapshot, entity }) =>
      emitStatTypeReadModels(db, snapshot.masterTooltip, entity.site?.route),
  },
  "status-effect": {
    ddl: STATUS_EFFECT_DDL,
    canonicalise: ({ db, envelope }) => canonicaliseStatusEffects(db, envelope),
    readModel: ({ db, entity, snapshot }) =>
      emitStatusEffectReadModels(db, entity.site?.route, snapshot.masterTooltip),
  },
  "item-category": {
    ddl: ITEM_CATEGORY_DDL,
    canonicalise: ({ db, envelope }) => canonicaliseItemCategories(db, envelope),
    readModel: ({ db, entity }) => emitItemCategoryReadModels(db, entity.site?.route),
  },
  "item-tag": {
    ddl: ITEM_TAG_DDL,
    canonicalise: ({ db, envelope }) => canonicaliseItemTags(db, envelope),
    readModel: ({ db, entity }) => emitItemTagReadModels(db, entity.site?.route),
  },
  "name-set": {
    ddl: NAME_SET_DDL,
    canonicalise: ({ db, envelope }) => canonicaliseNameSets(db, envelope),
    readModel: ({ db }) => emitNameSetReadModels(db),
  },
  "character-race": {
    ddl: CHARACTER_RACE_DDL,
    canonicalise: ({ db, envelope }) => canonicaliseCharacterRaces(db, envelope),
    readModel: ({ db, entity }) => emitCharacterRaceReadModels(db, entity.site?.route),
  },
  spell: {
    ddl: SPELL_DDL,
    canonicalise: ({ db, envelope }) => canonicaliseSpells(db, envelope),
    readModel: ({ db, entity, snapshot }) =>
      emitSpellReadModels(db, entity.site?.route, snapshot.masterTooltip),
  },
  "potion-recipe": {
    ddl: POTION_RECIPE_DDL,
    canonicalise: ({ db, envelope }) => canonicalisePotionRecipes(db, envelope),
    readModel: ({ db, entity }) => emitPotionRecipeReadModels(db, entity.site?.route),
  },
  enchantment: {
    ddl: ENCHANTMENT_DDL,
    canonicalise: ({ db, envelope }) => canonicaliseEnchantments(db, envelope),
    readModel: ({ db, entity, snapshot }) =>
      emitEnchantmentReadModels(db, entity.site?.route, snapshot.masterTooltip),
  },
  faction: {
    ddl: FACTION_DDL,
    canonicalise: ({ db, envelope }) => canonicaliseFactions(db, envelope),
    readModel: ({ db, entity }) => emitFactionReadModels(db, entity.site?.route),
    site: {
      overviewRenderer: () => "text",
    },
  },
  character: {
    ddl: CHARACTER_DDL,
    canonicalise: ({ db, envelope }) => canonicaliseCharacters(db, envelope),
    readModel: ({ db, entity }) => emitCharacterReadModels(db, entity.site?.route),
    site: {
      overviewRenderer: () => "text",
    },
  },
  location: {
    ddl: LOCATION_DDL,
    canonicalise: ({ db, envelope }) => canonicaliseLocations(db, envelope),
    readModel: ({ db }) => emitLocationReadModels(db),
    mapProjection: locationProjection,
  },
  portal: {
    ddl: PORTAL_DDL,
    canonicalise: ({ db, envelope }) => canonicalisePortals(db, envelope),
    readModelPhase: "after-map",
    readModel: ({ db }) => emitPortalReadModels(db),
    mapProjection: portalProjection,
  },
  npc: {
    ddl: NPC_DDL,
    canonicalise: ({ db, envelope }) => canonicaliseNpcs(db, envelope),
    readModelPhase: "after-map",
    readModel: ({ db }) => emitNpcReadModels(db),
    mapProjection: npcProjection,
  },
  quest: {
    ddl: QUEST_DDL,
    canonicalise: ({ db, envelope }) => canonicaliseQuests(db, envelope),
    readModelPhase: "after-map",
    readModel: ({ db, entity }) => emitQuestReadModels(db, entity.site?.route),
  },
};

export function validateDescriptorCoverage(desc: LoadDescriptorsOutput): void {
  const errors: string[] = [];
  for (const [entityId, entity] of Object.entries(desc.entities)) {
    const module = entityRegistry[entityId];
    if (!module) {
      errors.push(`descriptor '${entityId}' has no pipeline canonicalizer`);
    }
    if (entity.site && !module?.readModel) {
      errors.push(
        `descriptor '${entityId}' has no read-model emitter for route '${entity.site.route}'`,
      );
    }
    if (entity.map && !module?.mapProjection) {
      errors.push(
        `descriptor '${entityId}' has no map read-model emitter for layer '${entity.map.layer}'`,
      );
    }
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
}
