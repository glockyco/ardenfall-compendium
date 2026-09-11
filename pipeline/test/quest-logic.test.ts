import { describe, it, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runStages } from "$pipeline/orchestrator";
import { loadDescriptors } from "$pipeline/stages/load-descriptors";
import { loadSnapshot } from "$pipeline/stages/load-snapshot";
import { validate } from "$pipeline/stages/validate";
import { validateDescriptorFields } from "$pipeline/stages/validate-descriptor-fields";
import { emitSqlite } from "$pipeline/stages/emit-sqlite";
import { emitAssets } from "$pipeline/stages/emit-assets";
import type { Stage } from "$pipeline/types";

async function buildFixtureDatabase(): Promise<{ db: Database; dispose: () => void }> {
  const out = mkdtempSync(join(tmpdir(), "ardenfall-quest-logic-"));
  await runStages(
    [
      loadDescriptors,
      loadSnapshot,
      validateDescriptorFields,
      validate,
      emitAssets,
      emitSqlite,
    ] as Stage<unknown, unknown>[],
    {},
    {
      workspaceRoot: ".",
      snapshotDir: "fixtures/synthetic/snapshot",
      outDir: out,
      log: () => undefined,
    },
  );
  const db = new Database(join(out, "data.sqlite"), { readonly: true });
  return {
    db,
    dispose: () => {
      db.close();
      rmSync(out, { recursive: true, force: true });
    },
  };
}

describe("quest logic", () => {
  it("publishes what a quest watches for and what it changes", async () => {
    const { db, dispose } = await buildFixtureDatabase();
    try {
      const logic = JSON.parse(
        db
          .query<{ logic_json: string }, []>(
            `SELECT logic_json FROM quest_presentation_rows WHERE id = 'named;quest;quest_supply-run'`,
          )
          .get()?.logic_json ?? "{}",
      ) as {
        triggers: { kind: string; subjects: { label: string }[] }[];
        effects: { kind: string; amountLabel: string | null }[];
        unmodelled: { authoredType: string; count: number }[];
      };

      expect(logic.triggers.map((trigger) => trigger.kind)).toEqual(["acquires-item"]);
      expect(logic.triggers[0]?.subjects[0]?.label).toBeTruthy();
      expect(logic.effects.map((effect) => effect.kind)).toEqual(["quest-objective"]);
      // A node type the walk does not model is counted rather than dropped.
      expect(logic.unmodelled).toEqual([{ authoredType: "QuestDebugPointNode", count: 3 }]);
    } finally {
      dispose();
    }
  });

  it("reaches the item a quest watches for through the graph", async () => {
    const { db, dispose } = await buildFixtureDatabase();
    try {
      const edge = db
        .query<{ target_type: string; predicate: string }, []>(
          `SELECT target_type, predicate FROM entity_edges
            WHERE source_type = 'quest' AND predicate = 'quest_watches'`,
        )
        .get();

      expect(edge).toEqual({ target_type: "item", predicate: "quest_watches" });
    } finally {
      dispose();
    }
  });
});
