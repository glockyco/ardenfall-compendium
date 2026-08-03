import type { Database } from "bun:sqlite";
import type { PipelineDiagnostic } from "../../relationships/relationship-graph.ts";
import { ENTITY_GRAPH_DDL } from "../../relationships/relationship-graph.ts";
import type { SnapshotRef } from "../../types.ts";
import { deriveEntityNodeSlug, prepareEntityNodeWriter } from "../item/read-models.ts";

export const QUEST_READ_MODEL_DDL = `
CREATE TABLE quest_presentation_rows (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  subname               TEXT,
  render_context        TEXT NOT NULL,
  disabled              INTEGER NOT NULL,
  hidden_in_quest_ui    INTEGER NOT NULL,
  journal_on_start      TEXT,
  journal_on_succeed    TEXT,
  journal_on_failure    TEXT,
  phases_json           TEXT NOT NULL,
  rewards_json          TEXT NOT NULL
);
`;

interface QuestRow {
  id: string;
  name: string | null;
  subname: string | null;
  disabled: number;
  hidden_in_quest_ui: number;
  journal_on_start: string | null;
  journal_on_succeed: string | null;
  journal_on_failure: string | null;
}

interface QuestPhaseRow {
  quest_id: string;
  phase_ordinal: number;
  phase_game_id: number;
  name: string | null;
  journal_entry: string | null;
  completed_journal_entry: string | null;
}

interface QuestObjectiveRow {
  quest_id: string;
  phase_ordinal: number;
  objective_ordinal: number;
  objective_game_id: number;
  name: string | null;
  info: string | null;
  journal_entry: string | null;
  success_journal_entry: string | null;
  failure_journal_entry: string | null;
  objective_type: string;
  hidden: number;
  attached_object_game_id: number | null;
  enable_map_marker: number;
}

interface QuestCharacterRow {
  quest_id: string;
  object_ordinal: number;
  object_game_id: number;
  object_name: string | null;
  category: string | null;
  character_ref_json: string;
}

interface QuestRewardRow {
  quest_id: string;
  set_ordinal: number;
  set_game_id: number;
  set_name: string | null;
  set_type: string;
  reward_ordinal: number;
  kind: "gold" | "experience" | "faction-reputation" | "character-reputation" | "items" | string;
  is_positive: number | null;
  amount_label: string | null;
  custom_amount: number | null;
  faction_ref_json: string | null;
  item_refs_json: string | null;
  item_list_refs_json: string | null;
  target_object_game_id: number | null;
}

interface EntityNode {
  label: string | null;
  route_path: string | null;
  has_page: number;
}

interface CharacterTarget {
  node: EntityNode;
}

interface PhasePresentation {
  phaseGameId: number;
  name: string | null;
  journalEntry: string | null;
  completedJournalEntry: string | null;
  objectives: ObjectivePresentation[];
}

interface ObjectivePresentation {
  objectiveGameId: number;
  name: string | null;
  info: string | null;
  journalEntry: string | null;
  successJournalEntry: string | null;
  failureJournalEntry: string | null;
  objectiveType: string;
  hidden: boolean;
  attachedObjectGameId: number | null;
  enableMapMarker: boolean;
}

interface RewardPresentation {
  kind: "gold" | "experience" | "faction-reputation" | "character-reputation" | "items";
  amount: string | null;
  targetLabel: string | null;
  targetRoutePath: string | null;
  items: { label: string; routePath: string | null }[];
}

export function emitQuestReadModels(db: Database, routeBase = "/quests"): PipelineDiagnostic[] {
  db.exec(QUEST_READ_MODEL_DDL);
  db.exec(ENTITY_GRAPH_DDL);

  const presentationInsert = db.prepare(
    `INSERT INTO quest_presentation_rows (
       id, name, subname, render_context, disabled, hidden_in_quest_ui,
       journal_on_start, journal_on_succeed, journal_on_failure, phases_json, rewards_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const edgeInsert = db.prepare(
    `INSERT OR IGNORE INTO entity_edges (
       edge_id, source_type, source_id, target_type, target_id, predicate,
       label, weight, evidence_json, anchor
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const writeNode = prepareEntityNodeWriter(db);
  const questRows = db
    .query<QuestRow, []>(
      `SELECT id, name, subname, disabled, hidden_in_quest_ui,
              journal_on_start, journal_on_succeed, journal_on_failure
       FROM quests
       ORDER BY COALESCE(NULLIF(TRIM(name), ''), 'Unnamed quest'), id`,
    )
    .all();
  const phases = db
    .query<QuestPhaseRow, []>(
      `SELECT quest_id, phase_ordinal, phase_game_id, name, journal_entry, completed_journal_entry
       FROM quest_phases ORDER BY quest_id, phase_ordinal`,
    )
    .all();
  const objectives = db
    .query<QuestObjectiveRow, []>(
      `SELECT quest_id, phase_ordinal, objective_ordinal, objective_game_id, name, info,
              journal_entry, success_journal_entry, failure_journal_entry, objective_type,
              hidden, attached_object_game_id, enable_map_marker
       FROM quest_objectives ORDER BY quest_id, phase_ordinal, objective_ordinal`,
    )
    .all();
  const characters = db
    .query<QuestCharacterRow, []>(
      `SELECT quest_id, object_ordinal, object_game_id, object_name, category, character_ref_json
       FROM quest_characters ORDER BY quest_id, object_ordinal`,
    )
    .all();
  const rewards = db
    .query<QuestRewardRow, []>(
      `SELECT quest_id, set_ordinal, set_game_id, set_name, set_type, reward_ordinal, kind,
              is_positive, amount_label, custom_amount, faction_ref_json, item_refs_json,
              item_list_refs_json, target_object_game_id
       FROM quest_rewards ORDER BY quest_id, set_ordinal, reward_ordinal`,
    )
    .all();

  const nodesByType = new Map<string, Map<string, EntityNode>>();
  for (const node of db
    .query<
      {
        entity_type: string;
        entity_id: string;
        label: string | null;
        route_path: string | null;
        has_page: number;
      },
      []
    >(`SELECT entity_type, entity_id, label, route_path, has_page FROM entity_nodes`)
    .all()) {
    const nodes = nodesByType.get(node.entity_type) ?? new Map<string, EntityNode>();
    nodes.set(node.entity_id, {
      label: node.label,
      route_path: node.route_path,
      has_page: node.has_page,
    });
    nodesByType.set(node.entity_type, nodes);
  }

  const objectivesByPhase = new Map<string, QuestObjectiveRow[]>();
  for (const objective of objectives) {
    const key = `${objective.quest_id}:${objective.phase_ordinal}`;
    const list = objectivesByPhase.get(key) ?? [];
    list.push(objective);
    objectivesByPhase.set(key, list);
  }
  const phasesByQuest = new Map<string, QuestPhaseRow[]>();
  for (const phase of phases) {
    const list = phasesByQuest.get(phase.quest_id) ?? [];
    list.push(phase);
    phasesByQuest.set(phase.quest_id, list);
  }
  const charactersByQuest = new Map<string, QuestCharacterRow[]>();
  for (const character of characters) {
    const list = charactersByQuest.get(character.quest_id) ?? [];
    list.push(character);
    charactersByQuest.set(character.quest_id, list);
  }
  const rewardsByQuest = new Map<string, QuestRewardRow[]>();
  for (const reward of rewards) {
    const list = rewardsByQuest.get(reward.quest_id) ?? [];
    list.push(reward);
    rewardsByQuest.set(reward.quest_id, list);
  }

  const diagnostics: PipelineDiagnostic[] = [];
  const tx = db.transaction(() => {
    for (const quest of questRows) {
      const label = quest.name?.trim() || "Unnamed quest";
      const slug = deriveEntityNodeSlug(label, quest.id);
      writeNode({
        entityType: "quest",
        entityId: quest.id,
        label,
        routePath: `${routeBase}/${slug.canonicalSlug}`,
        canonicalSlug: slug.canonicalSlug,
        shortId: slug.shortId,
      });

      const phasePresentation: PhasePresentation[] = (phasesByQuest.get(quest.id) ?? []).map(
        (phase) => ({
          phaseGameId: phase.phase_game_id,
          name: phase.name,
          journalEntry: phase.journal_entry,
          completedJournalEntry: phase.completed_journal_entry,
          objectives: (objectivesByPhase.get(`${quest.id}:${phase.phase_ordinal}`) ?? []).map(
            (objective) => ({
              objectiveGameId: objective.objective_game_id,
              name: objective.name,
              info: objective.info,
              journalEntry: objective.journal_entry,
              successJournalEntry: objective.success_journal_entry,
              failureJournalEntry: objective.failure_journal_entry,
              objectiveType: objective.objective_type,
              hidden: objective.hidden === 1,
              attachedObjectGameId: objective.attached_object_game_id,
              enableMapMarker: objective.enable_map_marker === 1,
            }),
          ),
        }),
      );

      const questCharacters = new Map<number, CharacterTarget>();
      for (const character of charactersByQuest.get(quest.id) ?? []) {
        const targetId = resolveCharacterId(character.character_ref_json);
        const node = targetId === null ? undefined : nodesByType.get("npc")?.get(targetId);
        if (targetId === null || node === undefined) {
          diagnostics.push(
            unresolvedCharacterDiagnostic(
              quest.id,
              character,
              targetId,
              "quest_characters.character_ref_json",
            ),
          );
          continue;
        }
        questCharacters.set(character.object_game_id, { node });
        if (node.has_page !== 1) continue;
        edgeInsert.run(
          `${quest.id}:features_character:npc:${targetId}:${character.object_ordinal}`,
          "quest",
          quest.id,
          "npc",
          targetId,
          "features_character",
          "Characters",
          1,
          JSON.stringify({
            source: "quests.objects",
            objectOrdinal: character.object_ordinal,
            objectGameId: character.object_game_id,
            objectName: character.object_name,
            category: character.category,
            characterRef: parseReference(character.character_ref_json),
          }),
          null,
        );
      }

      const rewardPresentation: RewardPresentation[] = [];
      for (const reward of rewardsByQuest.get(quest.id) ?? []) {
        const target = rewardTarget(
          reward,
          questCharacters,
          nodesByType,
          diagnostics,
          quest.id,
          edgeInsert,
        );
        const items =
          reward.kind === "items"
            ? resolveItemRewards(reward, nodesByType.get("item"), diagnostics, quest.id, edgeInsert)
            : [];
        rewardPresentation.push({
          kind: normalizeRewardKind(reward.kind),
          amount: readerAmount(reward),
          targetLabel: target?.label ?? null,
          targetRoutePath: target?.routePath ?? null,
          items,
        });
      }

      presentationInsert.run(
        quest.id,
        label,
        quest.subname,
        "quest-presentation-v1",
        quest.disabled,
        quest.hidden_in_quest_ui,
        quest.journal_on_start,
        quest.journal_on_succeed,
        quest.journal_on_failure,
        JSON.stringify(phasePresentation),
        JSON.stringify(rewardPresentation),
      );
    }
  });
  tx();
  return diagnostics;
}

function normalizeRewardKind(kind: string): RewardPresentation["kind"] {
  if (
    kind === "gold" ||
    kind === "experience" ||
    kind === "faction-reputation" ||
    kind === "character-reputation" ||
    kind === "items"
  ) {
    return kind;
  }
  throw new Error(`quest reward has unsupported kind '${kind}'`);
}

function resolveCharacterId(value: string): string | null {
  const ref = parseReference(value);
  if (
    ref.kind !== "record" ||
    ref.table !== "instances" ||
    ref.subtable !== "characters" ||
    ref.id.trim() === ""
  ) {
    return null;
  }
  return `instances;characters;${ref.id}`;
}

function parseReference(value: string): SnapshotRef {
  try {
    return JSON.parse(value) as SnapshotRef;
  } catch {
    return { kind: "missing", reason: "invalid JSON", source: "quest-read-model" };
  }
}

function unresolvedCharacterDiagnostic(
  questId: string,
  row: QuestCharacterRow,
  targetId: string | null,
  field: string,
): PipelineDiagnostic {
  return {
    severity: "diagnostic",
    source: "relationship-graph",
    code: "questCharacterUnresolved",
    message: `Quest '${questId}' has an unresolvable character reference for object '${row.object_game_id}'.`,
    entityType: "quest",
    entityId: questId,
    field,
    evidence: {
      objectOrdinal: row.object_ordinal,
      objectGameId: row.object_game_id,
      characterRef: parseReference(row.character_ref_json),
      targetId,
    },
  };
}

function rewardTarget(
  reward: QuestRewardRow,
  questCharacters: Map<number, CharacterTarget>,
  nodesByType: Map<string, Map<string, EntityNode>>,
  diagnostics: PipelineDiagnostic[],
  questId: string,
  edgeInsert: ReturnType<Database["prepare"]>,
): { label: string | null; routePath: string | null } | null {
  if (reward.kind === "faction-reputation") {
    const targetId = resolveNamedOrLookupId(reward.faction_ref_json, "faction");
    const node = targetId === null ? undefined : nodesByType.get("faction")?.get(targetId);
    if (targetId === null || node === undefined) {
      diagnostics.push(
        unresolvedRewardDiagnostic(
          questId,
          reward,
          "questFactionUnresolved",
          "faction_ref_json",
          targetId,
        ),
      );
      return null;
    }
    if (node.has_page === 1) {
      edgeInsert.run(
        `${questId}:rewards_faction_reputation:faction:${targetId}:${reward.set_ordinal}:${reward.reward_ordinal}`,
        "quest",
        questId,
        "faction",
        targetId,
        "rewards_faction_reputation",
        "Faction reputation",
        1,
        JSON.stringify({
          source: "quests.rewardSets.questRewards",
          setOrdinal: reward.set_ordinal,
          setGameId: reward.set_game_id,
          rewardOrdinal: reward.reward_ordinal,
          factionRef: parseReference(reward.faction_ref_json ?? "null"),
        }),
        null,
      );
    }
    return {
      label: node.label,
      routePath: node.has_page === 1 ? node.route_path : null,
    };
  }
  if (reward.kind === "character-reputation") {
    const target =
      reward.target_object_game_id === null
        ? undefined
        : questCharacters.get(reward.target_object_game_id);
    if (!target) {
      diagnostics.push(
        unresolvedRewardDiagnostic(
          questId,
          reward,
          "questCharacterUnresolved",
          "target_object_game_id",
          null,
        ),
      );
      return null;
    }
    return {
      label: target.node.label,
      routePath: target.node.has_page === 1 ? target.node.route_path : null,
    };
  }
  return null;
}

function resolveItemRewards(
  reward: QuestRewardRow,
  itemNodes: Map<string, EntityNode> | undefined,
  diagnostics: PipelineDiagnostic[],
  questId: string,
  edgeInsert: ReturnType<Database["prepare"]>,
): { label: string; routePath: string | null }[] {
  const refs = parseReferenceArray(reward.item_refs_json);
  const itemListRefs = parseReferenceArray(reward.item_list_refs_json);
  if (itemListRefs.length > 0) {
    diagnostics.push({
      severity: "diagnostic",
      source: "relationship-graph",
      code: "questItemListUnresolved",
      message: `Quest '${questId}' has a reward that references an item list the compendium does not publish.`,
      entityType: "quest",
      entityId: questId,
      field: "quest_rewards.item_list_refs_json",
      evidence: {
        setOrdinal: reward.set_ordinal,
        setGameId: reward.set_game_id,
        rewardOrdinal: reward.reward_ordinal,
        itemListRefs,
      },
    });
  }
  return refs.map((ref, itemOrdinal) => {
    const targetId = resolveNamedOrLookupId(JSON.stringify(ref), "item");
    const node = targetId === null ? undefined : itemNodes?.get(targetId);
    if (targetId === null || node === undefined) {
      diagnostics.push(
        unresolvedRewardDiagnostic(
          questId,
          reward,
          "questItemUnresolved",
          "item_refs_json",
          targetId,
        ),
      );
    }
    if (node?.has_page === 1) {
      edgeInsert.run(
        `${questId}:rewards_item:item:${targetId}:${reward.set_ordinal}:${reward.reward_ordinal}:${itemOrdinal}`,
        "quest",
        questId,
        "item",
        targetId,
        "rewards_item",
        "Item rewards",
        1,
        JSON.stringify({
          source: "quests.rewardSets.questRewards",
          setOrdinal: reward.set_ordinal,
          setGameId: reward.set_game_id,
          rewardOrdinal: reward.reward_ordinal,
          itemRef: ref,
        }),
        null,
      );
    }
    return {
      label: node?.label ?? "Unnamed item",
      routePath: node?.has_page === 1 ? node.route_path : null,
    };
  });
}

function parseReferenceArray(value: string | null): SnapshotRef[] {
  if (value === null) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as SnapshotRef[]) : [];
  } catch {
    return [];
  }
}

function resolveNamedOrLookupId(value: string | null, entity: string): string | null {
  if (value === null) return null;
  const ref = parseReference(value);
  if (ref.kind === "lookupAsset" && typeof ref.guid === "string") return ref.guid;
  if (ref.kind === "namedAsset" && ref.entity === entity && typeof ref.name === "string") {
    return `named;${entity};${ref.name}`;
  }
  return null;
}

function unresolvedRewardDiagnostic(
  questId: string,
  reward: QuestRewardRow,
  code: "questFactionUnresolved" | "questItemUnresolved" | "questCharacterUnresolved",
  field: string,
  targetId: string | null,
): PipelineDiagnostic {
  const subject =
    code === "questFactionUnresolved"
      ? "faction"
      : code === "questItemUnresolved"
        ? "item"
        : "character";
  return {
    severity: "diagnostic",
    source: "relationship-graph",
    code,
    message: `Quest '${questId}' has an unresolvable ${subject} reward reference.`,
    entityType: "quest",
    entityId: questId,
    field: `quest_rewards.${field}`,
    evidence: {
      setOrdinal: reward.set_ordinal,
      setGameId: reward.set_game_id,
      rewardOrdinal: reward.reward_ordinal,
      targetId,
    },
  };
}

function readerAmount(reward: QuestRewardRow): string | null {
  if (reward.kind === "gold") {
    return reward.custom_amount === null ? null : `${reward.custom_amount} gold`;
  }
  if (reward.kind === "experience") {
    const amount = reward.amount_label?.replace(/[^a-zA-Z]/g, "").toLowerCase();
    if (amount === "custom") {
      return reward.custom_amount === null ? null : `${reward.custom_amount} experience`;
    }
    if (amount === "low" || amount === "medium" || amount === "high") {
      return `${amount[0]?.toUpperCase()}${amount.slice(1)} experience`;
    }
    return null;
  }
  if (reward.kind !== "faction-reputation" && reward.kind !== "character-reputation") return null;
  const amount = reward.amount_label?.replace(/[^a-zA-Z]/g, "").toLowerCase();
  const value =
    amount === "verylow"
      ? 5
      : amount === "low"
        ? 10
        : amount === "medium"
          ? 30
          : amount === "high"
            ? 50
            : amount === "custom"
              ? reward.custom_amount
              : null;
  if (value === null || value === undefined) return null;
  const signed = reward.is_positive === 0 ? `-${value}` : `+${value}`;
  return `${signed} reputation`;
}
