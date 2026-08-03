import { all } from "../db";
import { isRichTextDocument, parseGeneratedJson } from "../json";
import type { RichTextDocument } from "./item";

export type DialogueKind = "greeting" | "topic";

/** One authored line: something a character says, or a topic a reader can ask about. */
export interface DialogueLine {
  kind: DialogueKind;
  text: RichTextDocument;
}

/**
 * Dialogue belongs to a quest and a character together, so a group names whichever
 * of the pair the current page is not: characters on a quest page, quests on a
 * character page.
 */
export interface DialogueGroup {
  id: string;
  label: string;
  routePath: string | null;
  lines: DialogueLine[];
}

interface DialogueRecord {
  group_id: string;
  group_label: string;
  group_route: string | null;
  kind: string;
  text_json: string;
  ordinal: number;
}

const isDialogueKind = (value: string): value is DialogueKind =>
  value === "greeting" || value === "topic";

/**
 * Collects rows into groups. The pipeline already ordered them, so first appearance
 * decides group order and rows keep their emitted sequence within a group.
 */
const group = (rows: DialogueRecord[], rowId: string): DialogueGroup[] => {
  const groups = new Map<string, DialogueGroup>();
  for (const row of rows) {
    if (!isDialogueKind(row.kind)) {
      throw new Error(`unsupported dialogue kind '${row.kind}' for ${rowId}`);
    }
    const existing = groups.get(row.group_id);
    const entry = existing ?? {
      id: row.group_id,
      label: row.group_label,
      routePath: row.group_route,
      lines: [],
    };
    if (!existing) groups.set(row.group_id, entry);
    entry.lines.push({
      kind: row.kind,
      text: parseGeneratedJson(
        row.text_json,
        "quest_character_dialogue_rows",
        "text_json",
        rowId,
        isRichTextDocument,
      ),
    });
  }
  return [...groups.values()];
};

/** What each character says on this quest. */
export const getQuestDialogue = (questId: string): DialogueGroup[] =>
  group(
    all<DialogueRecord>(
      `SELECT character_id AS group_id, character_label AS group_label,
              character_route AS group_route, kind, text_json, ordinal
       FROM quest_character_dialogue_rows
       WHERE quest_id = ?
       ORDER BY ordinal`,
      [questId],
    ),
    questId,
  );

/** What this character says, on each quest that gives them lines. */
export const getCharacterDialogue = (characterId: string): DialogueGroup[] =>
  group(
    all<DialogueRecord>(
      `SELECT quest_id AS group_id, quest_label AS group_label,
              quest_route AS group_route, kind, text_json, ordinal
       FROM quest_character_dialogue_rows
       WHERE character_id = ?
       ORDER BY quest_label, ordinal`,
      [characterId],
    ),
    characterId,
  );
