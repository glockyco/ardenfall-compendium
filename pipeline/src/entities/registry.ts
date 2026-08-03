import type { Database } from "bun:sqlite";
import type { EmitAssetsOutput } from "../stages/emit-assets.ts";
import type { LoadDescriptorsOutput } from "../stages/load-descriptors.ts";
import type { LoadSnapshotOutput } from "../stages/load-snapshot.ts";
import type { EntityDescriptor, SnapshotEnvelope, VariantDescriptor } from "../types.ts";
import type { PipelineDiagnostic } from "../relationships/relationship-graph.ts";
import { buildDDL } from "../sql/ddl";
import { ITEM_CATEGORY_DDL } from "../sql/item-category-ddl";
import { ITEM_TAG_DDL } from "../sql/item-tag-ddl";
import { LOCATION_DDL } from "../sql/location-ddl";
import { CHARACTER_DDL } from "../sql/character-ddl";
import { PORTAL_DDL } from "../sql/portal-ddl";
import { STAT_TYPE_DDL } from "../sql/stat-type-ddl";
import { SPELL_DDL } from "../sql/spell-ddl";
import { STATUS_EFFECT_DDL } from "../sql/status-effect-ddl";
import { canonicaliseItems } from "./item/canonicaliser";
import { emitItemReadModels } from "./item/read-models";
import { canonicaliseStatTypes } from "./stat-type/canonicaliser";
import { emitStatTypeReadModels } from "./stat-type/read-models";
import { canonicaliseSpells } from "./spell/canonicaliser";
import { emitSpellReadModels } from "./spell/read-models";
import { canonicaliseStatusEffects } from "./status-effect/canonicaliser";
import { emitStatusEffectReadModels } from "./status-effect/read-models";
import { canonicaliseItemCategories } from "./item-category/canonicaliser";
import { emitItemCategoryReadModels } from "./item-category/read-models";
import { canonicaliseItemTags } from "./item-tag/canonicaliser";
import { emitItemTagReadModels } from "./item-tag/read-models";
import { canonicaliseLocations } from "./location/canonicaliser";
import { canonicaliseCharacters } from "./character/canonicaliser";
import { emitCharacterReadModels } from "./character/read-models";
import { canonicalisePortals } from "./portal/canonicaliser";
import { emitPortalReadModels } from "./portal/read-models";

export interface MapProjection {
  points: string;
  volumes?: string;
}

export interface ReadModelContext {
  db: Database;
  desc: LoadDescriptorsOutput;
  snapshot: LoadSnapshotOutput;
  assets?: EmitAssetsOutput;
  entity: EntityDescriptor;
  variants: VariantDescriptor[];
  envelope: SnapshotEnvelope;
}

export interface SiteReadModelRegistration {
  readModelId: string;
  physicalName: string;
  purpose: string;
}

export interface EntityModule {
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
    readModels?: readonly SiteReadModelRegistration[];
    emitVariants?: boolean;
  };
  requiredSnapshot?: {
    error: string;
    readModelError?: string;
    variants?: boolean;
  };
}

const locationProjection: MapProjection = {
  points: `
      INSERT INTO map_points (
        id, entity_id, instance_id, name, map_id, map_x, map_y, elevation,
        show_on_map_debug_only, allow_fast_travel
      )
      SELECT 'location:' || l.id, 'location', l.id, l.name, p.map_id, p.map_x, p.map_y, p.elevation,
             l.show_on_map_debug_only, l.allow_fast_travel
      FROM locations l
      JOIN placements p ON p.entity_id = 'location' AND p.instance_id = l.id
      WHERE l.enabled = 1 AND l.show_on_map = 1
      ORDER BY l.name;
    `,
  volumes: `
      INSERT INTO map_volumes (
        id, entity_id, instance_id, name, map_id, geometry_json, elevation_min, elevation_max
      )
      SELECT v.id, 'location', v.location_id, l.name, p.map_id, v.geometry_json,
             v.elevation_min, v.elevation_max
      FROM location_volumes v
      JOIN locations l ON l.id = v.location_id
      JOIN placements p ON p.entity_id = 'location' AND p.instance_id = l.id
      WHERE l.enabled = 1
        AND v.geometry_json IS NOT NULL
      ORDER BY l.name, v.volume_index;
    `,
};

const portalProjection: MapProjection = {
  // `portals.name` is nullable because the game genuinely ships portals with an
  // empty `friendlyName`. The extractor records that as a diagnostic rather than
  // inventing a value. A map label cannot be null, so presentation supplies a
  // visibly placeholder one here instead of letting an id masquerade as a name.
  points: `
      INSERT INTO map_points (
        id, entity_id, instance_id, name, map_id, map_x, map_y, elevation,
        show_on_map_debug_only, allow_fast_travel
      )
      SELECT 'portal:' || p.id, 'portal', p.id, COALESCE(p.name, 'Unnamed portal'),
             pl.map_id, pl.map_x, pl.map_y, pl.elevation,
             0, 0
      FROM portals p
      JOIN placements pl ON pl.entity_id = 'portal' AND pl.instance_id = p.id
      ORDER BY COALESCE(p.name, 'Unnamed portal'), p.id;
    `,
};

const itemSiteReadModels: readonly SiteReadModelRegistration[] = [
  {
    readModelId: "item_overview_rows",
    physicalName: "item_overview_rows",
    purpose: "overview",
  },
  {
    readModelId: "item_presentation_rows",
    physicalName: "item_presentation_rows",
    purpose: "detail",
  },
];

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
      readModels: itemSiteReadModels,
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
  spell: {
    ddl: SPELL_DDL,
    canonicalise: ({ db, envelope }) => canonicaliseSpells(db, envelope),
    readModel: ({ db, entity, snapshot }) =>
      emitSpellReadModels(db, entity.site?.route, snapshot.masterTooltip),
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
  character: {
    ddl: CHARACTER_DDL,
    canonicalise: ({ db, envelope }) => canonicaliseCharacters(db, envelope),
    readModel: ({ db, entity }) => emitCharacterReadModels(db, entity.site?.route),
    site: {
      overviewRenderer: () => "text",
      readModels: [
        {
          readModelId: "character_overview_rows",
          physicalName: "character_overview_rows",
          purpose: "overview",
        },
        {
          readModelId: "character_presentation_rows",
          physicalName: "character_presentation_rows",
          purpose: "detail",
        },
      ],
    },
  },
  location: {
    ddl: LOCATION_DDL,
    canonicalise: ({ db, envelope }) => canonicaliseLocations(db, envelope),
    mapProjection: locationProjection,
  },
  portal: {
    ddl: PORTAL_DDL,
    canonicalise: ({ db, envelope }) => canonicalisePortals(db, envelope),
    readModelPhase: "after-map",
    readModel: ({ db }) => emitPortalReadModels(db),
    mapProjection: portalProjection,
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
        `descriptor '${entityId}' has no read-model emitter for public route '${entity.site.route}'`,
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
