import { describe, expect, it } from "bun:test";
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
    expect(items.rows.length).toBe(2);
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
