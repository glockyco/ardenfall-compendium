import { all, get } from "../db";
import { isFiniteNumber, isRecord, parseGeneratedJson, validateRenderContext } from "../json";
import { getEntityNodeBySlug } from "./item";

interface CharacterRaceOverviewRecord {
  id: string;
  name: string;
  name_set_count: number;
  route_path: string;
}

interface CharacterRacePresentationRecord {
  id: string;
  name: string;
  render_context: string;
  name_set_refs_json: string;
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
  nameSetCount: number;
  routePath: string;
}

export interface CharacterRacePresentationRow {
  id: string;
  name: string;
  renderContext: "character-race-presentation-v1";
  nameSetCount: number;
  nameSets: CharacterRaceNameSet[];
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

const isCharacterRaceSeedArray = (value: unknown): value is CharacterRaceSeed[] =>
  Array.isArray(value) &&
  value.every(
    (seed) => isRecord(seed) && typeof seed.name === "string" && isFiniteNumber(seed.weight),
  );

export const listCharacterRaces = (): CharacterRaceOverviewRow[] =>
  all<CharacterRaceOverviewRecord>(
    `SELECT o.id, n.display_label AS name, o.name_set_count, n.route_path
     FROM character_race_overview_rows o
     JOIN entity_nodes n
       ON n.entity_type = 'character-race'
      AND n.entity_id = o.id
      AND n.has_page = 1
     ORDER BY o.name, o.id`,
  ).map((row) => ({
    id: row.id,
    name: row.name,
    nameSetCount: row.name_set_count,
    routePath: row.route_path,
  }));

export const getCharacterRacePresentation = (
  slug: string,
): CharacterRacePresentationRow | undefined => {
  const node = getEntityNodeBySlug("character-race", slug);
  if (!node) return undefined;

  const row = get<CharacterRacePresentationRecord>(
    `SELECT p.id, n.display_label AS name, p.render_context,
            p.name_set_refs_json, n.route_path
     FROM character_race_presentation_rows p
     JOIN entity_nodes n
       ON n.entity_type = 'character-race'
      AND n.entity_id = p.id
      AND n.has_page = 1
     WHERE p.id = ?`,
    [node.entityId],
  );
  if (!row) return undefined;

  const refs = parseGeneratedJson(
    row.name_set_refs_json,
    "character-race",
    "name_set_refs_json",
    row.id,
    isCharacterRaceRefArray,
  );
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
    [row.name_set_refs_json],
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
      `character race '${row.id}' references ${refs.length} name sets, but only ${nameSets.length} are published`,
    );
  }

  return {
    id: row.id,
    name: row.name,
    renderContext: validateRenderContext(
      row.render_context,
      "character-race",
      row.id,
      "character-race-presentation-v1",
    ),
    nameSetCount: refs.length,
    nameSets,
    routePath: row.route_path,
  };
};
