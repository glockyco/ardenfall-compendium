import { describe, it, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runStages } from "$pipeline/orchestrator";
import { loadDescriptors } from "$pipeline/stages/load-descriptors";
import { loadSnapshot } from "$pipeline/stages/load-snapshot";
import { validate } from "$pipeline/stages/validate";
import { emitSqlite } from "$pipeline/stages/emit-sqlite";
import type { Stage } from "$pipeline/types";

describe("end-to-end pipeline", () => {
  it("synthetic snapshot → SQLite blob with site metadata + read models", async () => {
    const out = mkdtempSync(join(tmpdir(), "ardenfall-e2e-"));
    try {
      const ctx = {
        workspaceRoot: ".",
        snapshotDir: "fixtures/synthetic/snapshot",
        outDir: out,
        log: () => undefined,
      };
      const stages = [loadDescriptors, loadSnapshot, validate, emitSqlite] as Stage<
        unknown,
        unknown
      >[];
      const result = await runStages(stages, {}, ctx);
      const v = result.validate as { countsBySeverity: { fatal: number } };
      expect(v.countsBySeverity.fatal).toBe(0);

      const dbPath = join(out, "data.sqlite");
      const db = new Database(dbPath, { readonly: true });
      try {
        // Site metadata is populated.
        const entityCount = (
          db.query("SELECT COUNT(*) c FROM site_entities").get() as { c: number }
        ).c;
        expect(entityCount).toBeGreaterThan(0);

        // Read models are populated for the synthetic three-item fixture.
        const overviewCount = (
          db.query("SELECT COUNT(*) c FROM item_overview_rows").get() as { c: number }
        ).c;
        expect(overviewCount).toBe(3);

        // Variant ancestry is consistent for the melee row.
        const orphans = db
          .query(
            `
              SELECT mw.id FROM item_melee_weapons mw
              LEFT JOIN item_primary_hand_items ph ON ph.id = mw.id
              LEFT JOIN item_hand_items         h  ON h.id  = mw.id
              LEFT JOIN item_equipment          e  ON e.id  = mw.id
              LEFT JOIN items                   i  ON i.id  = mw.id
              WHERE ph.id IS NULL OR h.id IS NULL OR e.id IS NULL OR i.id IS NULL
            `,
          )
          .all();
        expect(orphans).toEqual([]);
      } finally {
        db.close();
      }
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  it("overwrites an existing SQLite output when rerun", async () => {
    const out = mkdtempSync(join(tmpdir(), "ardenfall-e2e-rerun-"));
    try {
      const ctx = {
        workspaceRoot: ".",
        snapshotDir: "fixtures/synthetic/snapshot",
        outDir: out,
        log: () => undefined,
      };
      const stages = [loadDescriptors, loadSnapshot, validate, emitSqlite] as Stage<
        unknown,
        unknown
      >[];

      await runStages(stages, {}, ctx);
      const result = await runStages(stages, {}, ctx);

      expect((result["emit-sqlite"] as { outputPath: string }).outputPath).toBe(
        join(out, "data.sqlite"),
      );
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  it("preserves the previous SQLite output when a rerun fails", async () => {
    const out = mkdtempSync(join(tmpdir(), "ardenfall-e2e-failed-rerun-"));
    try {
      const ctx = {
        workspaceRoot: ".",
        snapshotDir: "fixtures/synthetic/snapshot",
        outDir: out,
        log: () => undefined,
      };
      const stages = [loadDescriptors, loadSnapshot, validate, emitSqlite] as Stage<
        unknown,
        unknown
      >[];
      const result = await runStages(stages, {}, ctx);
      const dbPath = join(out, "data.sqlite");

      const desc = result["load-descriptors"] as Awaited<
        ReturnType<(typeof loadDescriptors)["run"]>
      >;
      const snap = result["load-snapshot"] as Awaited<ReturnType<(typeof loadSnapshot)["run"]>>;
      const itemEnvelope = snap.envelopes.item;
      if (!itemEnvelope) throw new Error("fixture missing item envelope");
      const badSnap = {
        ...snap,
        envelopes: {
          ...snap.envelopes,
          item: {
            ...itemEnvelope,
            rows: [{ ...itemEnvelope.rows[0], variant: "unknown-variant" }],
          },
        },
      };

      expect(() =>
        emitSqlite.run({ "load-descriptors": desc, "load-snapshot": badSnap }, ctx),
      ).toThrow(/unknown variant/);

      const db = new Database(dbPath, { readonly: true });
      try {
        const overviewCount = (
          db.query("SELECT COUNT(*) c FROM item_overview_rows").get() as { c: number }
        ).c;
        expect(overviewCount).toBe(3);
      } finally {
        db.close();
      }
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});
