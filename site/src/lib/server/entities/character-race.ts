import { all, get } from "../db";
import { isFiniteNumber, isRecord, parseGeneratedJson, validateRenderContext } from "../json";
import { getEntityNodeBySlug } from "./item";

interface CharacterRaceOverviewRecord {
  id: string;
  name: string;
  variant_count: number;
  route_path: string;
}

interface CharacterRacePresentationRecord {
  id: string;
  name: string;
  render_context: string;
  variants_json: string;
  route_path: string;
}

interface CharacterRaceNameSetRecord {
  id: string;
  render_context: string;
  generation_order: number;
  seeds_json: string;
  seed_count: number;
}

export interface CharacterRaceSeed {
  name: string;
  weight: number;
}

export interface CharacterRaceNameSet {
  id: string;
  generationOrder: number;
  seedCount: number;
  seeds: CharacterRaceSeed[];
}

export interface CharacterRaceOverviewRow {
  id: string;
  name: string;
  variantCount: number;
  routePath: string;
}

export interface CharacterRaceVariant {
  nameSetCount: number;
  nameSets: CharacterRaceNameSet[];
}

export interface CharacterRacePresentationRow {
  id: string;
  name: string;
  renderContext: "character-race-presentation-v1";
  variantCount: number;
  variants: CharacterRaceVariant[];
  routePath: string;
}

const isCharacterRaceRefArray = (value: unknown): value is CharacterRaceRef[] =>
  Array.isArray(value) &&
  value.every(
    (ref) =>
      isRecord(ref) &&
      typeof ref.kind === "string" &&
      ((ref.kind === "lookupAsset" && typeof ref.guid === "string") ||
        (ref.kind === "namedAsset" && ref.entity === "name-set" && typeof ref.name === "string")),
  );

interface CharacterRaceRef {
  kind: "lookupAsset" | "namedAsset";
  guid?: string;
  entity?: string;
  name?: string;
}

interface CharacterRaceVariantRef {
  id: string;
  nameSetRefs: CharacterRaceRef[];
}

const isCharacterRaceVariantArray = (value: unknown): value is CharacterRaceVariantRef[] =>
  Array.isArray(value) &&
  value.every(
    (variant) =>
      isRecord(variant) &&
      typeof variant.id === "string" &&
      isCharacterRaceRefArray(variant.nameSetRefs),
  );

const isCharacterRaceSeedArray = (value: unknown): value is CharacterRaceSeed[] =>
  Array.isArray(value) &&
  value.every(
    (seed) => isRecord(seed) && typeof seed.name === "string" && isFiniteNumber(seed.weight),
  );

export const listCharacterRaces = (): CharacterRaceOverviewRow[] =>
  all<CharacterRaceOverviewRecord>(
    `SELECT o.id, n.display_label AS name, o.variant_count, n.route_path
     FROM character_race_overview_rows o
     JOIN entity_nodes n
       ON n.entity_type = 'character-race'
      AND n.entity_id = o.id
      AND n.has_page = 1
     ORDER BY o.name, o.id`,
  ).map((row) => ({
    id: row.id,
    name: row.name,
    variantCount: row.variant_count,
    routePath: row.route_path,
  }));

export const getCharacterRacePresentation = (
  slug: string,
): CharacterRacePresentationRow | undefined => {
  const node = getEntityNodeBySlug("character-race", slug);
  if (!node) return undefined;

  const row = get<CharacterRacePresentationRecord>(
    `SELECT p.id, n.display_label AS name, p.render_context,
            p.variants_json, n.route_path
     FROM character_race_presentation_rows p
     JOIN entity_nodes n
       ON n.entity_type = 'character-race'
      AND n.entity_id = p.id
      AND n.has_page = 1
     WHERE p.id = ?`,
    [node.entityId],
  );
  if (!row) return undefined;

  const variants = parseGeneratedJson(
    row.variants_json,
    "character-race",
    "variants_json",
    row.id,
    isCharacterRaceVariantArray,
  ).map((variant) => ({
    nameSetCount: variant.nameSetRefs.length,
    nameSets: readNameSets(row.id, variant.id, variant.nameSetRefs),
  }));

  return {
    id: row.id,
    name: row.name,
    renderContext: validateRenderContext(
      row.render_context,
      "character-race",
      row.id,
      "character-race-presentation-v1",
    ),
    variantCount: variants.length,
    variants,
    routePath: row.route_path,
  };
};

function readNameSets(
  raceId: string,
  variantId: string,
  refs: CharacterRaceRef[],
): CharacterRaceNameSet[] {
  const nameSets = all<CharacterRaceNameSetRecord>(
    `SELECT ns.id, ns.render_context, ns.generation_order, ns.seeds_json, ns.seed_count,
            refs.key AS position
     FROM json_each(?) refs
     JOIN name_set_presentation_rows ns
       ON ns.id = CASE
         WHEN json_extract(refs.value, '$.kind') = 'lookupAsset'
           THEN json_extract(refs.value, '$.guid')
         WHEN json_extract(refs.value, '$.kind') = 'namedAsset'
           THEN 'named;name-set;' || json_extract(refs.value, '$.name')
       END
     ORDER BY refs.key`,
    [JSON.stringify(refs)],
  ).map((nameSet) => {
    validateRenderContext(
      nameSet.render_context,
      "name-set",
      nameSet.id,
      "name-set-presentation-v1",
    );
    return {
      id: nameSet.id,
      generationOrder: nameSet.generation_order,
      seedCount: nameSet.seed_count,
      seeds: parseGeneratedJson(
        nameSet.seeds_json,
        "name-set",
        "seeds_json",
        nameSet.id,
        isCharacterRaceSeedArray,
      ),
    };
  });
  if (nameSets.length !== refs.length) {
    throw new Error(
      `character race '${raceId}' variant '${variantId}' references ${refs.length} name sets, but only ${nameSets.length} are published`,
    );
  }
  return nameSets;
}
