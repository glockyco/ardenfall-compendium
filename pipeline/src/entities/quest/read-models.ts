import type { Database } from "bun:sqlite";
import type { PipelineDiagnostic } from "../../relationships/relationship-graph.ts";
import { ENTITY_GRAPH_DDL } from "../../relationships/relationship-graph.ts";
import { translateRichTextV1 } from "../../rich-text/rich-text-v1.ts";
import type { SnapshotRef } from "../../types.ts";
import { deriveEntityNodeSlug, prepareEntityNodeWriter } from "../../relationships/entity-nodes.ts";
import {
  prepareEntityLinkResolver,
  type EntityLinkResolver,
} from "../../relationships/entity-links.ts";

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
-- Dialogue belongs to a (quest, character) pair, so neither page owns it. One row
-- set serves both: the quest page selects by quest_id, the character page by
-- character_id. Line order is baked in per quest, and the character page chooses
-- the order of the quest groups.
CREATE TABLE quest_character_dialogue_rows (
  id            TEXT PRIMARY KEY,
  quest_id      TEXT NOT NULL,
  character_id  TEXT NOT NULL,
  quest_ordinal INTEGER NOT NULL,
  kind          TEXT NOT NULL,
  text_json     TEXT NOT NULL
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
  kind: string;
  is_positive: number | null;
  amount_label: string | null;
  custom_amount: number | null;
  faction_ref_json: string | null;
  items_json: string | null;
  item_list_refs_json: string | null;
  target_object_game_id: number | null;
}

interface EntityNode {
  entity_id: string;
  label: string | null;
  has_page: number;
}

interface QuestCharacterDialogueRow {
  quest_id: string;
  object_ordinal: number;
  line_ordinal: number;
  kind: string;
  text: string;
  importance: number;
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
  items: { label: string; routePath: string | null; count: number }[];
}

interface RewardSetPresentation {
  setOrdinal: number;
  setType: "on-success" | "on-failure" | "manual";
  rewards: RewardPresentation[];
}

interface QuestRewardItemRef {
  ref: SnapshotRef;
  count: number;
}

interface PendingRewardEdge {
  targetType: string;
  targetId: string;
  predicate: string;
  label: string;
  occurrences: Record<string, unknown>[];
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
  const dialogueRowInsert = db.prepare(
    `INSERT INTO quest_character_dialogue_rows (
       id, quest_id, character_id, quest_ordinal, kind, text_json
     ) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const edgeInsert = db.prepare(
    `INSERT OR IGNORE INTO entity_edges (
       edge_id, source_type, source_id, target_type, target_id, predicate,
       label, weight, evidence_json, anchor
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const writeNode = prepareEntityNodeWriter(db);
  const resolveLink = prepareEntityLinkResolver(db);
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
  // Presentation order, decided here so every consumer renders the same sequence:
  // greetings before topics, then the game's own importance descending, then walk order.
  const dialogue = db
    .query<QuestCharacterDialogueRow, []>(
      `SELECT quest_id, object_ordinal, line_ordinal, kind, text, importance
       FROM quest_character_dialogue
       ORDER BY quest_id, object_ordinal, kind = 'topic', importance DESC, line_ordinal`,
    )
    .all();
  const rewards = db
    .query<QuestRewardRow, []>(
      `SELECT quest_id, set_ordinal, set_game_id, set_name, set_type, reward_ordinal, kind,
              is_positive, amount_label, custom_amount, faction_ref_json, items_json,
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
        has_page: number;
      },
      []
    >(`SELECT entity_type, entity_id, label, has_page FROM entity_nodes`)
    .all()) {
    const nodes = nodesByType.get(node.entity_type) ?? new Map<string, EntityNode>();
    nodes.set(node.entity_id, {
      entity_id: node.entity_id,
      label: node.label,
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
  const dialogueByQuestObject = new Map<string, QuestCharacterDialogueRow[]>();
  for (const line of dialogue) {
    const key = `${line.quest_id}:${line.object_ordinal}`;
    const list = dialogueByQuestObject.get(key) ?? [];
    list.push(line);
    dialogueByQuestObject.set(key, list);
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
      const questRoute = `${routeBase}/${slug.canonicalSlug}`;
      writeNode({
        entityType: "quest",
        entityId: quest.id,
        label,
        routePath: questRoute,
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

      const questCharacters = new Map<number, EntityNode>();
      let dialogueOrdinal = 0;
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
        questCharacters.set(character.object_game_id, node);
        if (node.has_page !== 1) continue;

        const lines = dialogueByQuestObject.get(`${quest.id}:${character.object_ordinal}`) ?? [];
        for (const line of lines) {
          const text = translateRichTextV1(line.text);
          dialogueRowInsert.run(
            `${quest.id}:dialogue:${character.object_ordinal}:${line.line_ordinal}`,
            quest.id,
            targetId,
            dialogueOrdinal++,
            line.kind,
            JSON.stringify(text),
          );
          for (const diagnostic of text.diagnostics) {
            diagnostics.push({
              severity: diagnostic.severity,
              source: "rich-text",
              code: diagnostic.code,
              message: diagnostic.message,
              entityType: "quest",
              entityId: quest.id,
              field: diagnostic.field,
            });
          }
        }
        if (lines.length > 0) {
          // One edge per (character, quest) pair. A character can appear as several
          // quest objects, so per-object counts would describe only whichever object
          // happened to be walked first.
          edgeInsert.run(
            `${targetId}:speaks_about_quest:quest:${quest.id}`,
            "npc",
            targetId,
            "quest",
            quest.id,
            "speaks_about_quest",
            "Dialogue",
            1,
            JSON.stringify({ source: "quests.objects.CharacterQuestObject.dialogGraph" }),
            null,
          );
        }
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

      const rewardSets = new Map<number, RewardSetPresentation>();
      const rewardEdges = new Map<string, PendingRewardEdge>();
      for (const reward of rewardsByQuest.get(quest.id) ?? []) {
        const setType = normalizeRewardSetType(reward.set_type);
        let rewardSet = rewardSets.get(reward.set_ordinal);
        if (rewardSet === undefined) {
          rewardSet = {
            setOrdinal: reward.set_ordinal,
            setType,
            rewards: [],
          };
          rewardSets.set(reward.set_ordinal, rewardSet);
        } else if (rewardSet.setType !== setType) {
          throw new Error(`quest reward set '${reward.set_ordinal}' has inconsistent types`);
        }
        const target = rewardTarget(
          reward,
          questCharacters,
          nodesByType,
          diagnostics,
          quest.id,
          rewardEdges,
          resolveLink,
        );
        const items =
          reward.kind === "items"
            ? resolveItemRewards(
                reward,
                nodesByType.get("item"),
                diagnostics,
                quest.id,
                rewardEdges,
                resolveLink,
              )
            : [];
        rewardSet.rewards.push({
          kind: normalizeRewardKind(reward.kind),
          amount: readerAmount(reward),
          targetLabel: target?.label ?? null,
          targetRoutePath: target?.routePath ?? null,
          items,
        });
      }
      for (const [edgeId, edge] of rewardEdges) {
        edgeInsert.run(
          edgeId,
          "quest",
          quest.id,
          edge.targetType,
          edge.targetId,
          edge.predicate,
          edge.label,
          1,
          JSON.stringify(edge.occurrences),
          null,
        );
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
        JSON.stringify([...rewardSets.values()]),
      );
    }
  });
  tx();
  return diagnostics;
}

function normalizeRewardSetType(setType: string): RewardSetPresentation["setType"] {
  if (setType === "OnSuccess") return "on-success";
  if (setType === "OnFailure") return "on-failure";
  if (setType === "Manual") return "manual";
  throw new Error(`quest reward set has unsupported type '${setType}'`);
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
  questCharacters: Map<number, EntityNode>,
  nodesByType: Map<string, Map<string, EntityNode>>,
  diagnostics: PipelineDiagnostic[],
  questId: string,
  rewardEdges: Map<string, PendingRewardEdge>,
  resolveLink: EntityLinkResolver,
): { label: string | null; routePath: string | null } | null {
  if (reward.kind === "faction-reputation") {
    const factionRef =
      reward.faction_ref_json === null ? null : parseReference(reward.faction_ref_json);
    const targetId = resolveNamedOrLookupId(factionRef, "faction");
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
      const edgeId = `${questId}:rewards_faction_reputation:faction:${targetId}`;
      const pending = rewardEdges.get(edgeId) ?? {
        targetType: "faction",
        targetId,
        predicate: "rewards_faction_reputation",
        label: "Faction reputation",
        occurrences: [],
      };
      pending.occurrences.push({
        source: "quests.rewardSets.questRewards",
        setOrdinal: reward.set_ordinal,
        setGameId: reward.set_game_id,
        rewardOrdinal: reward.reward_ordinal,
        factionRef,
      });
      rewardEdges.set(edgeId, pending);
    }
    const link = resolveLink("faction", targetId);
    if (link === null) {
      throw new Error(`entity node 'faction:${targetId}' has no link label`);
    }
    return {
      label: link.label,
      routePath: link.routePath,
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
    const link = resolveLink("npc", target.entity_id);
    if (link === null) {
      throw new Error(`entity node 'npc:${target.entity_id}' has no link label`);
    }
    return {
      label: link.label,
      routePath: link.routePath,
    };
  }
  return null;
}

function resolveItemRewards(
  reward: QuestRewardRow,
  itemNodes: Map<string, EntityNode> | undefined,
  diagnostics: PipelineDiagnostic[],
  questId: string,
  rewardEdges: Map<string, PendingRewardEdge>,
  resolveLink: EntityLinkResolver,
): { label: string; routePath: string | null; count: number }[] {
  const itemRefs = parseReferenceArray(
    reward.items_json,
    diagnostics,
    questId,
    reward,
    "items_json",
  );
  const itemListRefs = parseReferenceArray(
    reward.item_list_refs_json,
    diagnostics,
    questId,
    reward,
    "item_list_refs_json",
  );
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

  const items: { label: string; routePath: string | null; count: number }[] = [];
  for (const [itemOrdinal, rawItem] of itemRefs.entries()) {
    if (
      typeof rawItem !== "object" ||
      rawItem === null ||
      !("ref" in rawItem) ||
      !("count" in rawItem) ||
      typeof rawItem.ref !== "object" ||
      rawItem.ref === null ||
      typeof rawItem.count !== "number" ||
      !Number.isInteger(rawItem.count)
    ) {
      diagnostics.push(malformedItemRefsDiagnostic(questId, reward, "items_json"));
      continue;
    }
    const item = rawItem as QuestRewardItemRef;
    const targetId = resolveNamedOrLookupId(item.ref, "item");
    const node = targetId === null ? undefined : itemNodes?.get(targetId);
    if (targetId === null || node === undefined) {
      diagnostics.push(
        unresolvedRewardDiagnostic(questId, reward, "questItemUnresolved", "items_json", targetId),
      );
      continue;
    }
    if (node.has_page === 1) {
      const edgeId = `${questId}:rewards_item:item:${targetId}`;
      const pending = rewardEdges.get(edgeId) ?? {
        targetType: "item",
        targetId,
        predicate: "rewards_item",
        label: "Item rewards",
        occurrences: [],
      };
      pending.occurrences.push({
        source: "quests.rewardSets.questRewards",
        setOrdinal: reward.set_ordinal,
        setGameId: reward.set_game_id,
        rewardOrdinal: reward.reward_ordinal,
        itemOrdinal,
        itemRef: item.ref,
        count: item.count,
      });
      rewardEdges.set(edgeId, pending);
    }
    const link = resolveLink("item", targetId);
    if (link === null) {
      throw new Error(`entity node 'item:${targetId}' has no link label`);
    }
    items.push({
      label: link.label,
      routePath: link.routePath,
      count: item.count,
    });
  }
  return items;
}

function parseReferenceArray(
  value: string | null,
  diagnostics: PipelineDiagnostic[],
  questId: string,
  reward: QuestRewardRow,
  field: "items_json" | "item_list_refs_json",
): unknown[] {
  if (value === null) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Fall through to the shared malformed-reference diagnostic.
  }
  diagnostics.push(malformedItemRefsDiagnostic(questId, reward, field));
  return [];
}

function malformedItemRefsDiagnostic(
  questId: string,
  reward: QuestRewardRow,
  field: "items_json" | "item_list_refs_json",
): PipelineDiagnostic {
  return {
    severity: "diagnostic",
    source: "relationship-graph",
    code: "questItemRefsMalformed",
    message: `Quest '${questId}' has a malformed item reference array.`,
    entityType: "quest",
    entityId: questId,
    field: `quest_rewards.${field}`,
    evidence: {
      setOrdinal: reward.set_ordinal,
      setGameId: reward.set_game_id,
      rewardOrdinal: reward.reward_ordinal,
    },
  };
}

function resolveNamedOrLookupId(value: string | null, entity: string): string | null;
function resolveNamedOrLookupId(value: SnapshotRef | null, entity: string): string | null;
function resolveNamedOrLookupId(value: string | SnapshotRef | null, entity: string): string | null {
  if (value === null) return null;
  const ref = typeof value === "string" ? parseReference(value) : value;
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
    return reward.custom_amount === null ? null : `${reward.custom_amount}`;
  }
  if (reward.kind === "experience") {
    const amount = reward.amount_label?.replace(/[^a-zA-Z]/g, "").toLowerCase();
    if (amount === "custom") {
      return reward.custom_amount === null ? null : `${reward.custom_amount}`;
    }
    if (amount === "low" || amount === "medium" || amount === "high") {
      return `${amount[0]?.toUpperCase()}${amount.slice(1)}`;
    }
    return null;
  }
  if (reward.kind !== "faction-reputation" && reward.kind !== "character-reputation") return null;
  const amount = reward.amount_label?.replace(/[^a-zA-Z]/g, "").toLowerCase();
  // Magnitudes are game facts from .decompiled/0.0.10.91-63c576261184/csharp/Ardenfall/Nodes/RelationshipModAmountContainer.cs:31-40.
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
  if (amount === "custom") return `${value > 0 ? "+" : ""}${value}`;
  return `${reward.is_positive === 0 ? "-" : "+"}${value}`;
}
