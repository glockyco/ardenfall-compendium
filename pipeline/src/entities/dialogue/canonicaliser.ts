import type { Database } from "bun:sqlite";
import type { DialogueFieldName, DialogueSnapshotFields } from "../../../dist/entity-fields.mjs";
import type {
  DialogueEdgeSnapshot,
  DialogueHolderSnapshot,
  DialogueNodeSnapshot,
  SnapshotEnvelope,
} from "../../types.ts";
import { entityRows } from "../../types.ts";

export function dialogueField<K extends DialogueFieldName & keyof DialogueSnapshotFields>(
  fields: DialogueSnapshotFields,
  key: K,
): DialogueSnapshotFields[K] {
  return fields[key];
}

interface MergedDialogue {
  graphName: string;
  nodes: DialogueNodeSnapshot[];
  edges: DialogueEdgeSnapshot[];
  entryNodes: number[];
  holders: DialogueHolderSnapshot[];
}

/**
 * Writes one conversation per dialogue graph, and indexes its parts.
 *
 * A conversation arrives once per producer: the cell walk reads the graphs a scene places, and the
 * extraction reads the graphs the loaded assets hold. The rows are merged here on the shared id,
 * because the nodes are the same asset whichever object points at it. Two rows that disagree on the
 * nodes would mean two graph assets share a name, so that fails rather than picking one.
 */
export function canonicaliseDialogues(db: Database, envelope: SnapshotEnvelope): void {
  const merged = new Map<string, MergedDialogue>();

  for (const row of entityRows<DialogueSnapshotFields>(envelope)) {
    const fields = row.fields;
    const nodes = dialogueField(fields, "nodes") ?? [];
    const existing = merged.get(row.id);
    if (existing === undefined) {
      merged.set(row.id, {
        graphName: dialogueField(fields, "graphName"),
        nodes,
        edges: dialogueField(fields, "edges") ?? [],
        entryNodes: dialogueField(fields, "entryNodes") ?? [],
        holders: [...(dialogueField(fields, "holders") ?? [])],
      });
      continue;
    }

    if (existing.nodes.length !== nodes.length) {
      throw new Error(
        `conversation '${row.id}' arrived with ${existing.nodes.length} and ${nodes.length} nodes, so two graph assets share the name '${existing.graphName}'`,
      );
    }

    existing.holders.push(...(dialogueField(fields, "holders") ?? []));
  }

  const dialogueInsert = db.prepare(
    `INSERT INTO dialogues (id, graph_name, nodes_json, edges_json, entry_nodes_json, holders_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const nodeInsert = db.prepare(
    `INSERT INTO dialogue_nodes (
      id, dialogue_id, node_id, role, authored_type, importance, single_screen, is_entry,
      jump_target, speaker_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const edgeInsert = db.prepare(
    `INSERT INTO dialogue_edges (id, dialogue_id, from_node, to_node, ordinal, port)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const statementInsert = db.prepare(
    `INSERT INTO dialogue_statements (id, dialogue_id, node_id, screen_ordinal, text)
     VALUES (?, ?, ?, ?, ?)`,
  );
  const optionInsert = db.prepare(
    `INSERT INTO dialogue_options (id, dialogue_id, node_id, ordinal, port, text, gate_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const conditionInsert = db.prepare(
    `INSERT INTO dialogue_conditions (
      id, dialogue_id, node_id, option_port, kind, compare, value, invert, authored_type,
      subjects_json, participants_json, child_mode, children_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const effectInsert = db.prepare(
    `INSERT INTO dialogue_effects (
      id, dialogue_id, node_id, ordinal, kind, amount, amount_label, authored_type, target_json,
      participant_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const holderInsert = db.prepare(
    `INSERT INTO dialogue_holders (id, dialogue_id, ordinal, kind, label, ref_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );

  const tx = db.transaction(() => {
    for (const id of [...merged.keys()].sort(compare)) {
      const dialogue = merged.get(id)!;
      const entries = new Set(dialogue.entryNodes);
      dialogueInsert.run(
        id,
        dialogue.graphName,
        JSON.stringify(dialogue.nodes),
        JSON.stringify(dialogue.edges),
        JSON.stringify(dialogue.entryNodes),
        JSON.stringify(dialogue.holders),
      );

      for (const node of dialogue.nodes) {
        nodeInsert.run(
          `${id}#${node.id}`,
          id,
          node.id,
          node.role,
          node.authoredType,
          node.importance,
          node.singleScreen ? 1 : 0,
          entries.has(node.id) ? 1 : 0,
          node.jumpTarget,
          node.speaker === null ? null : JSON.stringify(node.speaker),
        );

        for (const statement of node.statements) {
          statementInsert.run(
            `${id}#${node.id}:${statement.screenOrdinal}`,
            id,
            node.id,
            statement.screenOrdinal,
            statement.text,
          );
        }

        node.options.forEach((option, ordinal) => {
          optionInsert.run(
            `${id}#${node.id}:option:${ordinal}`,
            id,
            node.id,
            ordinal,
            option.port,
            option.text,
            option.gate === null ? null : JSON.stringify(option.gate),
          );
          if (option.gate !== null) {
            conditionInsert.run(
              `${id}#${node.id}:gate:${option.port}`,
              id,
              node.id,
              option.port,
              option.gate.kind,
              option.gate.compare,
              option.gate.value,
              option.gate.invert ? 1 : 0,
              option.gate.authoredType,
              JSON.stringify(option.gate.subjects),
              JSON.stringify(option.gate.participants),
              option.gate.childMode,
              JSON.stringify(option.gate.children),
            );
          }
        });

        if (node.gate !== null) {
          conditionInsert.run(
            `${id}#${node.id}:gate`,
            id,
            node.id,
            null,
            node.gate.kind,
            node.gate.compare,
            node.gate.value,
            node.gate.invert ? 1 : 0,
            node.gate.authoredType,
            JSON.stringify(node.gate.subjects),
            JSON.stringify(node.gate.participants),
            node.gate.childMode,
            JSON.stringify(node.gate.children),
          );
        }

        node.effects.forEach((effect, ordinal) => {
          effectInsert.run(
            `${id}#${node.id}:effect:${ordinal}`,
            id,
            node.id,
            ordinal,
            effect.kind,
            effect.amount,
            effect.amountLabel,
            effect.authoredType,
            effect.target === null ? null : JSON.stringify(effect.target),
            effect.participant === null ? null : JSON.stringify(effect.participant),
          );
        });
      }

      dialogue.edges.forEach((edge, ordinal) => {
        edgeInsert.run(`${id}#edge:${ordinal}`, id, edge.from, edge.to, edge.ordinal, edge.port);
      });

      dialogue.holders.forEach((holder, ordinal) => {
        holderInsert.run(
          `${id}#holder:${ordinal}`,
          id,
          ordinal,
          holder.kind,
          holder.label,
          holder.ref === null ? null : JSON.stringify(holder.ref),
        );
      });
    }
  });
  tx();
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
