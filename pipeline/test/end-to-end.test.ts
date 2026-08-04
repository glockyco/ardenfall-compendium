import { describe, it, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
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
      const stages = [
        loadDescriptors,
        loadSnapshot,
        validateDescriptorFields,
        validate,
        emitAssets,
        emitSqlite,
      ] as Stage<unknown, unknown>[];
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

        // The overview lists only items a reader can open, so the two synthetic
        // prototypes are absent from the nine canonical rows.
        const overviewCount = (
          db.query("SELECT COUNT(*) c FROM item_overview_rows").get() as { c: number }
        ).c;
        expect(overviewCount).toBe(7);
        const assetRefCount = (db.query("SELECT COUNT(*) c FROM asset_refs").get() as { c: number })
          .c;
        expect(assetRefCount).toBe(7);

        const statTypeCount = (db.query("SELECT COUNT(*) c FROM stat_types").get() as { c: number })
          .c;
        expect(statTypeCount).toBe(2);
        const itemCategoryCount = (
          db.query("SELECT COUNT(*) c FROM item_categories").get() as { c: number }
        ).c;
        expect(itemCategoryCount).toBe(1);
        const itemTagCount = (db.query("SELECT COUNT(*) c FROM item_tags").get() as { c: number })
          .c;
        expect(itemTagCount).toBe(2);
        const itemTagOverviewCount = (
          db.query("SELECT COUNT(*) c FROM item_tag_overview_rows").get() as { c: number }
        ).c;
        expect(itemTagOverviewCount).toBe(2);

        const locationCount = (db.query("SELECT COUNT(*) c FROM locations").get() as { c: number })
          .c;
        expect(locationCount).toBe(2);
        // Both enabled, on-map locations are present, including the debug-only one
        // (the map UI hides it by default and reveals it via the debug filter).
        const locationPointCount = (
          db.query("SELECT COUNT(*) c FROM map_points WHERE entity_id = 'location'").get() as {
            c: number;
          }
        ).c;
        expect(locationPointCount).toBe(2);
        const debugPointCount = (
          db
            .query(
              "SELECT COUNT(*) c FROM map_points WHERE entity_id = 'location' AND show_on_map_debug_only = 1",
            )
            .get() as { c: number }
        ).c;
        expect(debugPointCount).toBe(1);
        const mapLayer = db
          .query(
            "SELECT layer_id, source_table, source_tables_json FROM map_layers WHERE layer_id = 'locations'",
          )
          .get() as { layer_id: string; source_table: string; source_tables_json: string };
        expect(mapLayer).toEqual({
          layer_id: "locations",
          source_table: "map_points",
          source_tables_json: JSON.stringify(["map_points", "map_volumes"]),
        });

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
        expect(existsSync(join(out, "assets"))).toBe(true);
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
      const stages = [
        loadDescriptors,
        loadSnapshot,
        validateDescriptorFields,
        validate,
        emitAssets,
        emitSqlite,
      ] as Stage<unknown, unknown>[];

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
      const stages = [
        loadDescriptors,
        loadSnapshot,
        validateDescriptorFields,
        validate,
        emitAssets,
        emitSqlite,
      ] as Stage<unknown, unknown>[];
      const result = await runStages(stages, {}, ctx);
      const dbPath = join(out, "data.sqlite");

      const desc = result["load-descriptors"] as Awaited<
        ReturnType<(typeof loadDescriptors)["run"]>
      >;
      const snap = result["load-snapshot"] as Awaited<ReturnType<(typeof loadSnapshot)["run"]>>;
      const itemEnvelope = snap.envelopes.item;
      if (!itemEnvelope) throw new Error("fixture missing item envelope");
      const firstItemRow = itemEnvelope.rows[0];
      if (!firstItemRow) throw new Error("fixture missing first item row");
      const badSnap = {
        ...snap,
        envelopes: {
          ...snap.envelopes,
          item: {
            ...itemEnvelope,
            rows: [{ ...firstItemRow, variant: "unknown-variant" }],
          },
        },
      };

      const passingValidation = { errors: [], countsBySeverity: { fatal: 0, diagnostic: 0 } };

      expect(() =>
        emitSqlite.run(
          { "load-descriptors": desc, "load-snapshot": badSnap, validate: passingValidation },
          ctx,
        ),
      ).toThrow(/unknown variant/);

      const locationEnvelope = snap.envelopes.location;
      if (!locationEnvelope) throw new Error("fixture missing location envelope");
      const { location: _omittedLocation, ...envelopesWithoutLocation } = snap.envelopes;
      const missingLocationSnap = {
        ...snap,
        envelopes: envelopesWithoutLocation,
      };

      expect(() =>
        emitSqlite.run(
          {
            "load-descriptors": desc,
            "load-snapshot": missingLocationSnap,
            validate: passingValidation,
          },
          ctx,
        ),
      ).toThrow(
        /descriptor 'location' has map metadata but snapshot envelope 'location' is missing/,
      );

      const db = new Database(dbPath, { readonly: true });
      try {
        const overviewCount = (
          db.query("SELECT COUNT(*) c FROM item_overview_rows").get() as { c: number }
        ).c;
        expect(overviewCount).toBe(7);
      } finally {
        db.close();
      }
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});
