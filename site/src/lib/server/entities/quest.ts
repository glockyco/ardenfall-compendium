import { getQuestDialogue, type DialogueGroup } from "./dialogue";
import { all, get } from "../db";
import { isFiniteNumber, isRecord, parseGeneratedJson, validateRenderContext } from "../json";
import { getEntityNodeBySlug } from "./item";

interface QuestOverviewRecord {
  id: string;
  name: string;
  subname: string | null;
  disabled: number;
  hidden_in_quest_ui: number;
  route_path: string;
  short_id: string;
}

interface QuestPresentationRecord {
  id: string;
  name: string;
  subname: string | null;
  render_context: string;
  disabled: number;
  hidden_in_quest_ui: number;
  journal_on_start: string | null;
  journal_on_succeed: string | null;
  journal_on_failure: string | null;
  phases_json: string;
  rewards_json: string;
  route_path: string;
}

export interface QuestOverviewRow {
  id: string;
  name: string;
  subname: string | null;
  disabled: boolean;
  hiddenInQuestUi: boolean;
  routePath: string;
}

export interface QuestObjective {
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

export interface QuestPhase {
  phaseGameId: number;
  name: string | null;
  journalEntry: string | null;
  completedJournalEntry: string | null;
  objectives: QuestObjective[];
}

export interface QuestRewardItem {
  label: string;
  routePath: string | null;
  count: number;
}

export type QuestRewardKind =
  "gold" | "experience" | "faction-reputation" | "character-reputation" | "items";

export interface QuestReward {
  kind: QuestRewardKind;
  amount: string | null;
  targetLabel: string | null;
  targetRoutePath: string | null;
  items: QuestRewardItem[];
}

export type QuestRewardSetType = "on-success" | "on-failure" | "manual";

export interface QuestRewardSet {
  setOrdinal: number;
  setType: QuestRewardSetType;
  rewards: QuestReward[];
}

export interface QuestPresentationRow {
  id: string;
  name: string;
  subname: string | null;
  renderContext: "quest-presentation-v1";
  disabled: boolean;
  hiddenInQuestUi: boolean;
  journalOnStart: string | null;
  journalOnSucceed: string | null;
  journalOnFailure: string | null;
  phases: QuestPhase[];
  rewards: QuestRewardSet[];
  routePath: string;
  dialogue: DialogueGroup[];
}

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === "string";

const questRewardKinds: Record<QuestRewardKind, true> = {
  gold: true,
  experience: true,
  "faction-reputation": true,
  "character-reputation": true,
  items: true,
};

const questRewardSetTypes: Record<QuestRewardSetType, true> = {
  "on-success": true,
  "on-failure": true,
  manual: true,
};

const isQuestObjective = (value: unknown): value is QuestObjective =>
  isRecord(value) &&
  isFiniteNumber(value.objectiveGameId) &&
  isNullableString(value.name) &&
  isNullableString(value.info) &&
  isNullableString(value.journalEntry) &&
  isNullableString(value.successJournalEntry) &&
  isNullableString(value.failureJournalEntry) &&
  typeof value.objectiveType === "string" &&
  typeof value.hidden === "boolean" &&
  (value.attachedObjectGameId === null || isFiniteNumber(value.attachedObjectGameId)) &&
  typeof value.enableMapMarker === "boolean";

const isQuestPhase = (value: unknown): value is QuestPhase =>
  isRecord(value) &&
  isFiniteNumber(value.phaseGameId) &&
  isNullableString(value.name) &&
  isNullableString(value.journalEntry) &&
  isNullableString(value.completedJournalEntry) &&
  Array.isArray(value.objectives) &&
  value.objectives.every(isQuestObjective);

const isQuestPhaseArray = (value: unknown): value is QuestPhase[] =>
  Array.isArray(value) && value.every(isQuestPhase);

const isQuestRewardItem = (value: unknown): value is QuestRewardItem =>
  isRecord(value) &&
  typeof value.label === "string" &&
  isNullableString(value.routePath) &&
  isFiniteNumber(value.count) &&
  Number.isInteger(value.count);

const isQuestReward = (value: unknown): value is QuestReward =>
  isRecord(value) &&
  typeof value.kind === "string" &&
  questRewardKinds[value.kind as QuestRewardKind] === true &&
  isNullableString(value.amount) &&
  isNullableString(value.targetLabel) &&
  isNullableString(value.targetRoutePath) &&
  Array.isArray(value.items) &&
  value.items.every(isQuestRewardItem);

const isQuestRewardSet = (value: unknown): value is QuestRewardSet =>
  isRecord(value) &&
  isFiniteNumber(value.setOrdinal) &&
  Number.isInteger(value.setOrdinal) &&
  typeof value.setType === "string" &&
  questRewardSetTypes[value.setType as QuestRewardSetType] === true &&
  Array.isArray(value.rewards) &&
  value.rewards.every(isQuestReward);

const isQuestRewardSetArray = (value: unknown): value is QuestRewardSet[] =>
  Array.isArray(value) && value.every(isQuestRewardSet);

export const listQuests = (): QuestOverviewRow[] => {
  const rows = all<QuestOverviewRecord>(
    `SELECT p.id, n.display_label AS name, p.subname, p.disabled, p.hidden_in_quest_ui, n.route_path
     FROM quest_presentation_rows p
     JOIN entity_nodes n
       ON n.entity_type = 'quest'
      AND n.entity_id = p.id
      AND n.has_page = 1
     ORDER BY n.display_label, p.id`,
  ).map((row) => ({
    id: row.id,
    name: row.name,
    subname: row.subname,
    disabled: row.disabled === 1,
    hiddenInQuestUi: row.hidden_in_quest_ui === 1,
    routePath: row.route_path,
  }));
  return rows;
};

export const getQuestPresentation = (slug: string): QuestPresentationRow | undefined => {
  const node = getEntityNodeBySlug("quest", slug);
  if (!node) return undefined;
  const row = get<QuestPresentationRecord>(
    `SELECT p.id, n.display_label AS name, p.subname, p.render_context, p.disabled, p.hidden_in_quest_ui,
            p.journal_on_start, p.journal_on_succeed, p.journal_on_failure,
            p.phases_json, p.rewards_json, n.route_path
     FROM quest_presentation_rows p
     JOIN entity_nodes n
       ON n.entity_type = 'quest'
      AND n.entity_id = p.id
      AND n.has_page = 1
     WHERE p.id = ?`,
    [node.entityId],
  );
  if (!row) return undefined;
  return {
    id: row.id,
    name: row.name,
    subname: row.subname,
    renderContext: validateRenderContext(
      row.render_context,
      "quest",
      row.id,
      "quest-presentation-v1",
    ),
    disabled: row.disabled === 1,
    hiddenInQuestUi: row.hidden_in_quest_ui === 1,
    journalOnStart: row.journal_on_start,
    journalOnSucceed: row.journal_on_succeed,
    journalOnFailure: row.journal_on_failure,
    phases: parseGeneratedJson(row.phases_json, "quest", "phases_json", row.id, isQuestPhaseArray),
    rewards: parseGeneratedJson(
      row.rewards_json,
      "quest",
      "rewards_json",
      row.id,
      isQuestRewardSetArray,
    ),
    routePath: row.route_path,
    dialogue: getQuestDialogue(row.id),
  };
};
