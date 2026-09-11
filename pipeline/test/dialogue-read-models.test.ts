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
  const out = mkdtempSync(join(tmpdir(), "ardenfall-dialogue-"));
  const stages = [
    loadDescriptors,
    loadSnapshot,
    validateDescriptorFields,
    validate,
    emitAssets,
    emitSqlite,
  ] as Stage<unknown, unknown>[];
  await runStages(
    stages,
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

describe("conversations", () => {
  it("keeps two graphs of one name apart, and names each after what holds it", async () => {
    const { db, dispose } = await buildFixtureDatabase();
    try {
      const rows = db
        .query<{ id: string; label: string; route_path: string }, []>(
          `SELECT p.id, p.label, n.route_path
             FROM dialogue_presentation_rows p
             JOIN entity_nodes n ON n.entity_type = 'dialogue' AND n.entity_id = p.id
            WHERE p.graph_name = 'questdialog_quest-giver'
            ORDER BY p.label`,
        )
        .all();

      expect(rows.map((row) => row.label)).toEqual(["Ember Keeper", "Tide Warden"]);
      expect(new Set(rows.map((row) => row.route_path)).size).toBe(2);
    } finally {
      dispose();
    }
  });

  it("publishes the checks a composite gate holds", async () => {
    const { db, dispose } = await buildFixtureDatabase();
    try {
      const gate = db
        .query<{ kind: string; child_mode: string; children_json: string }, []>(
          `SELECT kind, child_mode, children_json FROM dialogue_conditions WHERE child_mode IS NOT NULL`,
        )
        .get();

      expect(gate?.child_mode).toBe("all");
      const children = JSON.parse(gate?.children_json ?? "[]") as { kind: string }[];
      expect(children.map((child) => child.kind).sort()).toEqual(["faction", "quest-state"]);

      // The reader-facing script carries the same nesting, so a page can state the requirement.
      const script = db
        .query<{ script_json: string }, []>(
          `SELECT script_json FROM dialogue_presentation_rows WHERE id = 'named;dialog;dia_fixture_harbour-watch'`,
        )
        .get();
      expect(script?.script_json).toContain('"childMode":"all"');
    } finally {
      dispose();
    }
  });
});
