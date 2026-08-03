import type { Database } from "bun:sqlite";
import type {
  QuestCharacterSnapshot,
  QuestJournalSnapshot,
  QuestObjectiveSnapshot,
  QuestPhaseSnapshot,
  QuestRewardSetSnapshot,
  QuestRewardSnapshot,
  QuestSnapshotFields,
  SnapshotEnvelope,
  SnapshotRef,
} from "../../types.ts";
import { entityRows, snapshotRefKey } from "../../types.ts";

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareNumbers(left: number, right: number): number {
  return left - right;
}

function boolOrNull(value: boolean | null | undefined): number | null {
  return value === undefined || value === null ? null : value ? 1 : 0;
}

function jsonOrNull(value: unknown): string | null {
  return value === undefined || value === null ? null : JSON.stringify(value);
}

function sortedRefs(refs: SnapshotRef[]): SnapshotRef[] {
  return [...refs].sort((left, right) =>
    compareStrings(snapshotRefKey(left), snapshotRefKey(right)),
  );
}

function comparePhases(left: QuestPhaseSnapshot, right: QuestPhaseSnapshot): number {
  const byGameId = compareNumbers(left.phaseGameId, right.phaseGameId);
  if (byGameId !== 0) return byGameId;
  return compareStrings(JSON.stringify(left), JSON.stringify(right));
}

function compareObjectives(left: QuestObjectiveSnapshot, right: QuestObjectiveSnapshot): number {
  const byGameId = compareNumbers(left.objectiveGameId, right.objectiveGameId);
  if (byGameId !== 0) return byGameId;
  return compareStrings(JSON.stringify(left), JSON.stringify(right));
}

function compareCharacters(left: QuestCharacterSnapshot, right: QuestCharacterSnapshot): number {
  const byGameId = compareNumbers(left.objectGameId, right.objectGameId);
  if (byGameId !== 0) return byGameId;
  const byReference = compareStrings(
    snapshotRefKey(left.characterRef),
    snapshotRefKey(right.characterRef),
  );
  if (byReference !== 0) return byReference;
  return compareStrings(JSON.stringify(left), JSON.stringify(right));
}

function compareJournalEntries(left: QuestJournalSnapshot, right: QuestJournalSnapshot): number {
  const byGameId = compareNumbers(left.objectGameId, right.objectGameId);
  if (byGameId !== 0) return byGameId;
  return compareStrings(JSON.stringify(left), JSON.stringify(right));
}

function rewardSortKey(reward: QuestRewardSnapshot): string {
  return [
    reward.kind,
    reward.targetObjectGameId ?? "",
    reward.amountLabel ?? "",
    reward.customAmount ?? "",
    reward.isPositive === null ? "" : reward.isPositive ? "1" : "0",
    snapshotRefKeys(reward.factionRef ? [reward.factionRef] : []),
    snapshotRefKeys(reward.itemRefs),
    snapshotRefKeys(reward.itemListRefs),
  ].join("\u0000");
}

function snapshotRefKeys(refs: SnapshotRef[]): string {
  return sortedRefs(refs).map(snapshotRefKey).join("\u0001");
}

function compareRewards(left: QuestRewardSnapshot, right: QuestRewardSnapshot): number {
  return compareStrings(rewardSortKey(left), rewardSortKey(right));
}

function compareRewardSets(left: QuestRewardSetSnapshot, right: QuestRewardSetSnapshot): number {
  const byGameId = compareNumbers(left.setGameId, right.setGameId);
  if (byGameId !== 0) return byGameId;
  return compareStrings(JSON.stringify(left), JSON.stringify(right));
}

export function canonicaliseQuests(db: Database, envelope: SnapshotEnvelope): void {
  const questInsert = db.prepare(
    `INSERT INTO quests (
       id, quest_game_id, name, subname, disabled, hidden_in_quest_ui,
       journal_on_start, journal_on_succeed, journal_on_failure, required_character_refs_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const phaseInsert = db.prepare(
    `INSERT INTO quest_phases (
       id, quest_id, phase_ordinal, phase_game_id, name, journal_entry, completed_journal_entry
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const objectiveInsert = db.prepare(
    `INSERT INTO quest_objectives (
       id, quest_id, phase_ordinal, objective_ordinal, objective_game_id, name, info,
       journal_entry, success_journal_entry, failure_journal_entry, objective_type,
       hidden, attached_object_game_id, enable_map_marker
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const characterInsert = db.prepare(
    `INSERT INTO quest_characters (
       id, quest_id, object_ordinal, object_game_id, object_name, category, character_ref_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const dialogueInsert = db.prepare(
    `INSERT INTO quest_character_dialogue (
       id, quest_id, object_ordinal, line_ordinal, kind, text, importance
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const journalInsert = db.prepare(
    `INSERT INTO quest_journal_entries (
       id, quest_id, object_ordinal, object_game_id, object_name, journal_entry
     ) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const rewardInsert = db.prepare(
    `INSERT INTO quest_rewards (
       id, quest_id, set_ordinal, set_game_id, set_name, set_type, reward_ordinal,
       kind, is_positive, amount_label, custom_amount, faction_ref_json,
       item_refs_json, item_list_refs_json, target_object_game_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const tx = db.transaction(() => {
    const rows = [...entityRows<QuestSnapshotFields>(envelope)].sort((left, right) =>
      compareStrings(left.id, right.id),
    );
    for (const row of rows) {
      const fields = row.fields;
      questInsert.run(
        row.id,
        fields.questGameId,
        fields.name ?? null,
        fields.subname ?? null,
        fields.disabled ? 1 : 0,
        fields.hiddenInQuestUi ? 1 : 0,
        fields.journalOnStart ?? null,
        fields.journalOnSucceed ?? null,
        fields.journalOnFailure ?? null,
        jsonOrNull(sortedRefs(fields.requiredCharacterRefs)),
      );

      // Phases use phaseGameId because it is the game's intrinsic phase key.
      const phases = [...fields.phases].sort(comparePhases);
      for (const [phaseOrdinal, phase] of phases.entries()) {
        phaseInsert.run(
          `${row.id}:phase:${phaseOrdinal}`,
          row.id,
          phaseOrdinal,
          phase.phaseGameId,
          phase.name ?? null,
          phase.journalEntry ?? null,
          phase.completedJournalEntry ?? null,
        );
        // Objectives use objectiveGameId because it is the game's intrinsic objective key.
        const objectives = [...phase.objectives].sort(compareObjectives);
        for (const [objectiveOrdinal, objective] of objectives.entries()) {
          objectiveInsert.run(
            `${row.id}:phase:${phaseOrdinal}:objective:${objectiveOrdinal}`,
            row.id,
            phaseOrdinal,
            objectiveOrdinal,
            objective.objectiveGameId,
            objective.name ?? null,
            objective.info ?? null,
            objective.journalEntry ?? null,
            objective.successJournalEntry ?? null,
            objective.failureJournalEntry ?? null,
            objective.objectiveType,
            objective.hidden ? 1 : 0,
            objective.attachedObjectGameId ?? null,
            objective.enableMapMarker ? 1 : 0,
          );
        }
      }

      // Character and journal objects use objectGameId because it is their intrinsic key.
      const characters = [...fields.characters].sort(compareCharacters);
      for (const [objectOrdinal, character] of characters.entries()) {
        characterInsert.run(
          `${row.id}:character:${objectOrdinal}`,
          row.id,
          objectOrdinal,
          character.objectGameId,
          character.objectName ?? null,
          character.category ?? null,
          JSON.stringify(character.characterRef),
        );

        // The mod emits graph walk order. Sorting is the read model's job, so the
        // canonical row keeps line_ordinal exactly as the walk produced it.
        for (const line of character.dialogue ?? []) {
          dialogueInsert.run(
            `${row.id}:character:${objectOrdinal}:dialogue:${line.lineOrdinal}`,
            row.id,
            objectOrdinal,
            line.lineOrdinal,
            line.kind,
            line.text,
            line.importance,
          );
        }
      }

      // Journal objects use objectGameId because it is their intrinsic key.
      const journalEntries = [...fields.journalEntries].sort(compareJournalEntries);
      for (const [objectOrdinal, entry] of journalEntries.entries()) {
        journalInsert.run(
          `${row.id}:journal:${objectOrdinal}`,
          row.id,
          objectOrdinal,
          entry.objectGameId,
          entry.objectName ?? null,
          entry.journalEntry ?? null,
        );
      }

      // Reward sets use setGameId. Rewards use a stable field key because they have no game id.
      const rewardSets = [...fields.rewardSets].sort(compareRewardSets);
      for (const [setOrdinal, rewardSet] of rewardSets.entries()) {
        const rewards = [...rewardSet.rewards].sort(compareRewards);
        for (const [rewardOrdinal, reward] of rewards.entries()) {
          rewardInsert.run(
            `${row.id}:reward:${setOrdinal}:${rewardOrdinal}`,
            row.id,
            setOrdinal,
            rewardSet.setGameId,
            rewardSet.setName ?? null,
            rewardSet.setType,
            rewardOrdinal,
            reward.kind,
            boolOrNull(reward.isPositive),
            reward.amountLabel ?? null,
            reward.customAmount ?? null,
            jsonOrNull(reward.factionRef),
            jsonOrNull(sortedRefs(reward.itemRefs)),
            jsonOrNull(sortedRefs(reward.itemListRefs)),
            reward.targetObjectGameId ?? null,
          );
        }
      }
    }
  });
  tx();
}
