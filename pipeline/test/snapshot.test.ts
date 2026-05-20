import { describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadDescriptors } from "$pipeline/stages/load-descriptors";
import { loadSnapshot } from "$pipeline/stages/load-snapshot";
import { validate } from "$pipeline/stages/validate";
import type { StageContext } from "$pipeline/types";

const ctx: StageContext = {
  workspaceRoot: ".",
  snapshotDir: "fixtures/synthetic/snapshot",
  outDir: "pipeline/test/.tmp",
  log: () => undefined,
};

describe("loadSnapshot", () => {
  it("loads manifest + per-entity envelopes", async () => {
    const out = await loadSnapshot.run({}, ctx);
    expect(out.manifest.preflight.passed).toBe(true);
    const items = out.envelopes["item"];
    if (!items) throw new Error("item envelope not loaded");
    expect(items.rows.length).toBe(5);
  });

  it("requires every item row to carry item-presentation-v1", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ardenfall-missing-presentation-"));
    try {
      writeFileSync(
        join(dir, "manifest.json"),
        readFileSync("fixtures/synthetic/snapshot/manifest.json", "utf8"),
      );
      writeFileSync(
        join(dir, "asset-manifest.json"),
        readFileSync("fixtures/synthetic/snapshot/asset-manifest.json", "utf8"),
      );
      const items = JSON.parse(readFileSync("fixtures/synthetic/snapshot/items.json", "utf8")) as {
        rows: { presentation?: unknown }[];
      };
      delete items.rows[0].presentation;
      writeFileSync(join(dir, "items.json"), `${JSON.stringify(items, null, 2)}\n`);

      const snap = await loadSnapshot.run({}, { ...ctx, snapshotDir: dir });
      const desc = await loadDescriptors.run({}, ctx);
      const result = await validate.run({ "load-snapshot": snap, "load-descriptors": desc }, ctx);

      expect(result.countsBySeverity.fatal).toBeGreaterThan(0);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          entity: "item",
          row: "fixture-iron-sword",
          field: "presentation",
          code: "missingItemPresentation",
        }),
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("loads synthetic item presentations with schema version 2", async () => {
    const out = await loadSnapshot.run({}, ctx);
    const items = out.envelopes.item;
    if (!items) throw new Error("item envelope not loaded");

    expect(items.schemaVersion).toBe(2);
    expect(
      items.rows.every((row) => row.presentation?.renderContext === "item-presentation-v1"),
    ).toBe(true);
  });

  it("loads the master tooltip vocabulary at schemaVersion 2", async () => {
    const out = await loadSnapshot.run({}, ctx);
    const v = out.masterTooltip;
    if (!v) throw new Error("master tooltip vocabulary missing");
    expect(v.schemaVersion).toBe(2);
    expect(v.tooltipColors.p?.text).toBe("positive");
    expect(v.positiveColor.r).toBeGreaterThan(0);
    expect(v.primarySpellTooltip.length).toBeGreaterThan(0);
    expect(v.potionRecipeDescription).toContain("{0}");
  });

  it("rejects a v1 master tooltip dictionary as unsupported", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ardenfall-v1-mt-"));
    try {
      writeFileSync(
        join(dir, "manifest.json"),
        readFileSync("fixtures/synthetic/snapshot/manifest.json", "utf8"),
      );
      writeFileSync(
        join(dir, "asset-manifest.json"),
        readFileSync("fixtures/synthetic/snapshot/asset-manifest.json", "utf8"),
      );
      writeFileSync(
        join(dir, "items.json"),
        readFileSync("fixtures/synthetic/snapshot/items.json", "utf8"),
      );
      writeFileSync(
        join(dir, "master-tooltip.json"),
        JSON.stringify({ schemaVersion: 1, tooltipCodes: {}, tooltipColors: {} }),
      );
      expect(() => loadSnapshot.run({}, { ...ctx, snapshotDir: dir })).toThrow(
        /master tooltip.*schemaVersion/,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("loads sibling diagnostics artifact and validation counts its entries", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ardenfall-snapshot-"));
    try {
      writeFileSync(
        join(dir, "manifest.json"),
        readFileSync("fixtures/synthetic/snapshot/manifest.json", "utf8"),
      );
      writeFileSync(
        join(dir, "items.json"),
        readFileSync("fixtures/synthetic/snapshot/items.json", "utf8"),
      );
      writeFileSync(
        join(dir, "diagnostics.json"),
        JSON.stringify([
          {
            rowId: null,
            severity: "diagnostic",
            code: "walkerDiagnostic",
            field: "refs",
            message: "walker diagnostic",
          },
        ]),
      );

      const snap = await loadSnapshot.run({}, { ...ctx, snapshotDir: dir });
      expect(snap.diagnostics).toHaveLength(1);

      const desc = await loadDescriptors.run({}, ctx);
      const result = await validate.run({ "load-snapshot": snap, "load-descriptors": desc }, ctx);
      expect(result.countsBySeverity.diagnostic).toBe(3);
      expect(result.errors).toContainEqual({
        entity: "snapshot",
        code: "walkerDiagnostic",
        field: "refs",
        message: "walker diagnostic",
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("validate", () => {
  it("passes the synthetic snapshot without fatal errors", async () => {
    const snap = await loadSnapshot.run({}, ctx);
    const desc = await loadDescriptors.run({}, ctx);
    const result = await validate.run({ "load-snapshot": snap, "load-descriptors": desc }, ctx);
    // The synthetic fixture has one row-level diagnostic
    // (lookupAssetGuidMissing for fixture-leather-tunic.iconRef),
    // not zero. Validate that non-fatal diagnostics surface but no
    // fatal errors did.
    expect(result.countsBySeverity.fatal).toBe(0);
    expect(result.errors.every((e) => e.code !== "missingFatalField")).toBe(true);
  });
});
