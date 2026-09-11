import { all, get } from "../db";
import { parseGeneratedJson, validateRenderContext } from "../json";
import type { RichTextDocument } from "./item";
import { getEntityNodeBySlug } from "./item";

/** An entity a gate reads or an outcome acts on. */
export interface DialogueEntityLink {
  entityType: string;
  entityId: string;
  label: string;
  routePath: string | null;
}

/** Whose state a gate reads, or whom an outcome applies to. */
export interface DialogueParticipant {
  /** `player`, `speaker`, `quest-object`, `named`, or `unnamed`. */
  role: string;
}

/** What the game reads before it offers an opener or an option. Never a result. */
export interface DialogueGate {
  kind: string;
  compare: string | null;
  value: string | null;
  invert: boolean;
  authoredType: string;
  subjects: DialogueEntityLink[];
  participants: DialogueParticipant[];
}

/** What a conversation changes when a reader takes this path. */
export interface DialogueOutcome {
  kind: string;
  amount: number | null;
  amountLabel: string | null;
  authoredType: string;
  target: DialogueEntityLink | null;
  participant: DialogueParticipant | null;
}

export interface DialogueScriptOption {
  port: string;
  text: string;
  gate: DialogueGate | null;
  next: DialogueScriptStep[];
}

export interface DialogueScriptAlternative {
  label: string | null;
  next: DialogueScriptStep[];
}

/**
 * One step of the script.
 *
 * The pipeline computes the reading order of a cyclic graph, so a page renders this and walks no
 * edges. `loop` names a node already on the path, and `reference` names one printed elsewhere.
 */
export type DialogueScriptStep =
  | {
      kind: "speech";
      nodeId: number;
      statements: RichTextDocument[];
      singleScreen: boolean;
      gate: DialogueGate | null;
      next: DialogueScriptStep[];
    }
  | { kind: "choice"; nodeId: number; options: DialogueScriptOption[] }
  | {
      kind: "branch";
      nodeId: number;
      authoredType: string;
      gate: DialogueGate | null;
      alternatives: DialogueScriptAlternative[];
    }
  | { kind: "condition"; nodeId: number; gate: DialogueGate; next: DialogueScriptStep[] }
  | { kind: "effects"; nodeId: number; effects: DialogueOutcome[]; next: DialogueScriptStep[] }
  | { kind: "end"; nodeId: number }
  | { kind: "jump"; nodeId: number; targetNodeId: number | null }
  | { kind: "loop"; targetNodeId: number }
  | { kind: "reference"; targetNodeId: number }
  | { kind: "unmodelled"; nodeId: number; authoredType: string; next: DialogueScriptStep[] };

export interface DialogueScript {
  /** Greetings, in the order the game prefers them. They are alternatives, not a sequence. */
  openers: DialogueScriptStep[];
  /** What the player can raise once the conversation is open. */
  topics: DialogueScriptStep[];
  /** Every other entry point: a quest event, or another conversation. */
  starts: DialogueScriptStep[];
}

/** One object that reaches this conversation. */
export interface DialogueHolder {
  kind: string;
  label: string | null;
  link: DialogueEntityLink | null;
}

export interface DialogueOverviewRow {
  id: string;
  name: string;
  routePath: string;
  /** The graph asset's name. An internal identifier, shown when no holder names the speaker. */
  graphName: string;
  statementCount: number;
  optionCount: number;
  nodeCount: number;
}

export interface DialoguePresentationRow extends DialogueOverviewRow {
  renderContext: "dialogue-presentation-v1";
  script: DialogueScript;
  holders: DialogueHolder[];
}

interface DialogueOverviewRecord {
  id: string;
  name: string;
  route_path: string;
  graph_name: string;
  statement_count: number;
  option_count: number;
  node_count: number;
}

interface DialoguePresentationRecord extends DialogueOverviewRecord {
  render_context: string;
  script_json: string;
  holders_json: string;
}

const OVERVIEW_COLUMNS = `d.id, n.display_label AS name, n.route_path, d.graph_name,
   d.statement_count, d.option_count, d.node_count`;

const toOverviewRow = (row: DialogueOverviewRecord): DialogueOverviewRow => ({
  id: row.id,
  name: row.name,
  routePath: row.route_path,
  graphName: row.graph_name,
  statementCount: row.statement_count,
  optionCount: row.option_count,
  nodeCount: row.node_count,
});

const isScript = (value: unknown): value is DialogueScript =>
  typeof value === "object" &&
  value !== null &&
  "openers" in value &&
  Array.isArray(value.openers) &&
  "topics" in value &&
  Array.isArray(value.topics) &&
  "starts" in value &&
  Array.isArray(value.starts);

const isHolderArray = (value: unknown): value is DialogueHolder[] =>
  Array.isArray(value) &&
  value.every(
    (holder) =>
      typeof holder === "object" &&
      holder !== null &&
      "kind" in holder &&
      typeof holder.kind === "string",
  );

export const listDialogues = (): DialogueOverviewRow[] =>
  all<DialogueOverviewRecord>(
    `SELECT ${OVERVIEW_COLUMNS}
     FROM dialogue_presentation_rows d
     JOIN entity_nodes n ON n.entity_type = 'dialogue' AND n.entity_id = d.id
     ORDER BY n.display_label, d.id`,
  ).map(toOverviewRow);

export const getDialoguePresentation = (slug: string): DialoguePresentationRow | undefined => {
  const node = getEntityNodeBySlug("dialogue", slug);
  if (!node) return undefined;
  const row = get<DialoguePresentationRecord>(
    `SELECT ${OVERVIEW_COLUMNS}, d.render_context, d.script_json, d.holders_json
     FROM dialogue_presentation_rows d
     JOIN entity_nodes n ON n.entity_type = 'dialogue' AND n.entity_id = d.id
     WHERE d.id = ?`,
    [node.entityId],
  );
  if (!row) return undefined;
  return {
    ...toOverviewRow(row),
    renderContext: validateRenderContext(
      row.render_context,
      "dialogue",
      row.id,
      "dialogue-presentation-v1",
    ),
    script: parseGeneratedJson(row.script_json, "dialogue", "script_json", row.id, isScript),
    holders: parseGeneratedJson(
      row.holders_json,
      "dialogue",
      "holders_json",
      row.id,
      isHolderArray,
    ),
  };
};

/** The conversations one entity holds, for the page of a character or a quest. */
export const listDialoguesForHolder = (
  entityType: string,
  entityId: string,
): { id: string; label: string; routePath: string; holderKind: string }[] =>
  all<{ id: string; label: string; route_path: string; evidence_json: string }>(
    `SELECT e.target_id AS id, n.display_label AS label, n.route_path, e.evidence_json
     FROM entity_edges e
     JOIN entity_nodes n ON n.entity_type = 'dialogue' AND n.entity_id = e.target_id
     WHERE e.predicate = 'holds_dialogue' AND e.source_type = ? AND e.source_id = ?
     ORDER BY n.display_label, e.target_id`,
    [entityType, entityId],
  ).map((row) => ({
    id: row.id,
    label: row.label,
    routePath: row.route_path,
    holderKind: holderKind(row.evidence_json),
  }));

/** Which mechanism reaches the conversation, as the edge recorded it. */
function holderKind(evidence: string): string {
  const parsed: unknown = JSON.parse(evidence);
  if (typeof parsed === "object" && parsed !== null && "holder" in parsed) {
    const { holder } = parsed;
    if (typeof holder === "string") return holder;
  }

  return "unknown";
}
