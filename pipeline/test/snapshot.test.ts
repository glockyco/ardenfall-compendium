import { describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emitSqlite } from "$pipeline/stages/emit-sqlite";
import { loadDescriptors } from "$pipeline/stages/load-descriptors";
import { loadSnapshot } from "$pipeline/stages/load-snapshot";
import type {
  EntityDescriptor,
  ItemPresentationSnapshot,
  MasterTooltipVocabulary,
  SnapshotDiagnostic,
  SnapshotDiagnosticArtifactEntry,
  SnapshotManifest,
  SnapshotRow,
  StageContext,
} from "$pipeline/types";
import { validate } from "$pipeline/stages/validate";
import type { ValidateInputs } from "$pipeline/stages/validate";

const ctx: StageContext = {
  workspaceRoot: ".",
  snapshotDir: "fixtures/synthetic/snapshot",
  outDir: "pipeline/test/.tmp",
  log: () => undefined,
};

const testColor = { r: 0, g: 0, b: 0, a: 1 };

const testManifest: SnapshotManifest = {
  schemaVersion: 1,
  extractorVersion: "test",
  extractedAt: "2026-01-01T00:00:00.000Z",
  source: { kind: "synthetic-fixture", fixtureName: "validation-test" },
  preflight: { passed: true, completedAt: "2026-01-01T00:00:00.000Z", checks: [] },
  counts: {},
  diagnostics: { fatal: 0, diagnostic: 0 },
  hashes: {},
};

const testMasterTooltip = (): MasterTooltipVocabulary => ({
  schemaVersion: 2,
  tooltipCodes: {},
  tooltipColors: {},
  tooltipTargetColor: testColor,
  tooltipDurationColor: testColor,
  positiveColor: testColor,
  negativeColor: testColor,
  spellSubEffectColor: testColor,
  enchantmentItemColor: testColor,
  primarySpellTooltip: "",
  secondarySpellTooltip: "",
  unmetSkillMessage: "",
  brokenDurabilityMessage: "",
  ruinedDurabilityMessage: "",
  statBookMessage: "",
  termSetColors: [],
  globalTermSets: [],
  termColorMatch: "",
  potionRecipeDescription: "",
  allAttributes: [],
  allSkills: [],
  allTraits: [],
});

const makeEntity = (id: string, fields: EntityDescriptor["fields"]): EntityDescriptor => ({
  id,
  kind: "definition",
  label: { singular: id, plural: `${id}s` },
  extraction: { source: "record", root: "Test.Record" },
  fields,
});

const makeItemPresentation = (): ItemPresentationSnapshot => ({
  schemaVersion: 1,
  renderContext: "item-presentation-v1",
  displayName: "Test item",
  displayNameSourceMethod: "test",
  itemType: null,
  itemTypeSourceMethod: null,
  descriptionSource: "",
  effectsSource: "",
  effects: [],
  statRows: [],
  requirements: [],
  durability: null,
  stateFacts: [],
  omissions: [],
  value: null,
  weight: null,
  diagnostics: [],
});

const makeRow = (
  fields: Record<string, unknown> = {},
  extras: { diagnostics?: SnapshotDiagnostic[]; presentation?: ItemPresentationSnapshot } = {},
): SnapshotRow => ({ id: "row-1", fields, ...extras });

const makeValidationInputs = (
  entityId: string,
  row: SnapshotRow | null,
  entity?: EntityDescriptor,
  diagnostics: SnapshotDiagnosticArtifactEntry[] = [],
): ValidateInputs => ({
  "load-snapshot": {
    manifest: testManifest,
    envelopes: {
      [entityId]: { entityId, schemaVersion: 1, rows: row ? [row] : [] },
    },
    diagnostics,
    masterTooltip: testMasterTooltip(),
    finalizeTimings: [],
  },
  "load-descriptors": {
    entities: entity ? { [entityId]: entity } : {},
    variants: entity ? { [entityId]: [] } : {},
  },
});

describe("loadSnapshot", () => {
  it("loads manifest + per-entity envelopes", async () => {
    const out = await loadSnapshot.run({}, ctx);
    expect(out.manifest.preflight.passed).toBe(true);
    const items = out.envelopes["item"];
    if (!items) throw new Error("item envelope not loaded");
    expect(items.rows.length).toBe(5);
  });

  it("loads root finalize timings as a typed auxiliary artifact", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ardenfall-finalize-timings-"));
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
        readFileSync("fixtures/synthetic/snapshot/master-tooltip.json", "utf8"),
      );
      writeFileSync(
        join(dir, "finalize-timings.json"),
        JSON.stringify([{ phase: "assets.write", elapsedMs: 42, totalElapsedMs: 50 }]),
      );

      const out = await loadSnapshot.run({}, { ...ctx, snapshotDir: dir });

      expect(out.finalizeTimings).toEqual([
        { phase: "assets.write", elapsedMs: 42, totalElapsedMs: 50 },
      ]);
      expect(out.envelopes.item).toBeDefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects snapshots missing the master tooltip vocabulary", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ardenfall-missing-master-tooltip-"));
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

      expect(() => loadSnapshot.run({}, { ...ctx, snapshotDir: dir })).toThrow(
        /missing master tooltip vocabulary/,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
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
      writeFileSync(
        join(dir, "master-tooltip.json"),
        readFileSync("fixtures/synthetic/snapshot/master-tooltip.json", "utf8"),
      );
      const items = JSON.parse(readFileSync("fixtures/synthetic/snapshot/items.json", "utf8")) as {
        rows: { presentation?: unknown }[];
      };
      const firstItemRow = items.rows[0];
      if (!firstItemRow) throw new Error("fixture item envelope has no rows");
      delete firstItemRow.presentation;
      writeFileSync(join(dir, "items.json"), `${JSON.stringify(items, null, 2)}\n`);

      const snap = await loadSnapshot.run({}, { ...ctx, snapshotDir: dir });
      const desc = await loadDescriptors.run({}, ctx);
      const result = await validate.run({ "load-snapshot": snap, "load-descriptors": desc }, ctx);

      expect(result.countsBySeverity.fatal).toBeGreaterThan(0);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          entity: "item",
          row: "4ed20218.fixture-iron-sword",
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
        join(dir, "master-tooltip.json"),
        readFileSync("fixtures/synthetic/snapshot/master-tooltip.json", "utf8"),
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
    // (lookupAssetGuidMissing for 5ea7beef.fixture-leather-tunic.iconRef),
    // not zero. Validate that non-fatal diagnostics surface but no
    // fatal errors did.
    expect(result.countsBySeverity.fatal).toBe(0);
    expect(result.errors.every((e) => e.code !== "missingFatalField")).toBe(true);
  });

  it("classifies rows from unknown entities as fatal", async () => {
    const result = await validate.run(makeValidationInputs("ghost", makeRow()), ctx);

    expect(result.countsBySeverity).toEqual({ fatal: 1, diagnostic: 0 });
    expect(result.errors).toEqual([
      expect.objectContaining({ entity: "ghost", code: "unknownEntity" }),
    ]);
    expect(result.errors.length).toBe(
      result.countsBySeverity.fatal + result.countsBySeverity.diagnostic,
    );
  });

  it("classifies a missing fatal-policy field as fatal", async () => {
    const entity = makeEntity("test", [
      { name: "requiredField", type: "string", from: "test.required", missingPolicy: "fatal" },
    ]);
    const result = await validate.run(makeValidationInputs(entity.id, makeRow(), entity), ctx);

    expect(result.countsBySeverity).toEqual({ fatal: 1, diagnostic: 0 });
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "missingFatalField", field: "requiredField" }),
    );
    expect(result.errors.length).toBe(1);
  });

  it("classifies a missing diagnostic-policy field as diagnostic without becoming fatal", async () => {
    const entity = makeEntity("test", [
      {
        name: "notableField",
        type: "string",
        from: "test.notable",
        missingPolicy: "diagnostic",
      },
    ]);
    const result = await validate.run(makeValidationInputs(entity.id, makeRow(), entity), ctx);

    expect(result.countsBySeverity).toEqual({ fatal: 0, diagnostic: 1 });
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "missingDiagnosticField", field: "notableField" }),
    );
    expect(result.errors.length).toBe(
      result.countsBySeverity.fatal + result.countsBySeverity.diagnostic,
    );
  });

  it("reports a zero-row public entity as a diagnostic", async () => {
    const entity = { ...makeEntity("public-test", []), site: { route: "/public-test" } };
    const result = await validate.run(makeValidationInputs(entity.id, null, entity), ctx);

    expect(result.countsBySeverity).toEqual({ fatal: 0, diagnostic: 1 });
    expect(result.errors).toEqual([
      {
        entity: "public-test",
        code: "emptyPublicEntity",
        message: "public entity 'public-test' has no rows",
      },
    ]);
    expect(result.errors.length).toBe(
      result.countsBySeverity.fatal + result.countsBySeverity.diagnostic,
    );
  });

  it("does not report a populated public entity as empty", async () => {
    const entity = { ...makeEntity("public-test", []), site: { route: "/public-test" } };
    const result = await validate.run(makeValidationInputs(entity.id, makeRow(), entity), ctx);

    expect(result.errors).toHaveLength(0);
    expect(result.countsBySeverity).toEqual({ fatal: 0, diagnostic: 0 });
  });

  it("does not report a zero-row entity without a public route", async () => {
    const entity = makeEntity("internal-test", []);
    const result = await validate.run(makeValidationInputs(entity.id, null, entity), ctx);

    expect(result.errors).toHaveLength(0);
    expect(result.countsBySeverity).toEqual({ fatal: 0, diagnostic: 0 });
  });
  it("counts row diagnostics by each diagnostic severity", async () => {
    const entity = makeEntity("test", []);
    const result = await validate.run(
      makeValidationInputs(
        entity.id,
        makeRow(
          {},
          {
            diagnostics: [
              { severity: "fatal", code: "rowFatal", field: "ref", message: "fatal row issue" },
              {
                severity: "diagnostic",
                code: "rowDiagnostic",
                field: "name",
                message: "diagnostic row issue",
              },
            ],
          },
        ),
        entity,
      ),
      ctx,
    );

    expect(result.countsBySeverity).toEqual({ fatal: 1, diagnostic: 1 });
    expect(result.errors).toEqual([
      expect.objectContaining({ entity: "test", row: "row-1", code: "rowFatal" }),
      expect.objectContaining({ entity: "test", row: "row-1", code: "rowDiagnostic" }),
    ]);
    expect(result.errors.length).toBe(2);
  });

  it("counts snapshot diagnostics by each diagnostic severity", async () => {
    const entity = makeEntity("test", []);
    const result = await validate.run(
      makeValidationInputs(entity.id, makeRow(), entity, [
        { rowId: null, severity: "fatal", code: "snapshotFatal", field: "refs" },
        { rowId: null, severity: "diagnostic", code: "snapshotDiagnostic", field: "refs" },
      ]),
      ctx,
    );

    expect(result.countsBySeverity).toEqual({ fatal: 1, diagnostic: 1 });
    expect(result.errors).toEqual([
      expect.objectContaining({ entity: "snapshot", code: "snapshotFatal" }),
      expect.objectContaining({ entity: "snapshot", code: "snapshotDiagnostic" }),
    ]);
    expect(result.errors.length).toBe(
      result.countsBySeverity.fatal + result.countsBySeverity.diagnostic,
    );
  });

  it("classifies an item missing presentation as fatal", async () => {
    const entity = makeEntity("item", []);
    const result = await validate.run(makeValidationInputs(entity.id, makeRow(), entity), ctx);

    expect(result.countsBySeverity).toEqual({ fatal: 1, diagnostic: 0 });
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "missingItemPresentation", field: "presentation" }),
    );
  });

  it("classifies an item with an unsupported presentation context as fatal", async () => {
    const entity = makeEntity("item", []);
    const presentation = {
      ...makeItemPresentation(),
      renderContext: "unsupported-context",
    } as unknown as ItemPresentationSnapshot;
    const result = await validate.run(
      makeValidationInputs(entity.id, makeRow({}, { presentation }), entity),
      ctx,
    );

    expect(result.countsBySeverity).toEqual({ fatal: 1, diagnostic: 0 });
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: "invalidItemPresentationContext",
        field: "presentation.renderContext",
      }),
    );
  });
});

describe("emitSqlite validation gate", () => {
  it("rejects a fatal snapshot validation before creating SQLite output", async () => {
    const out = mkdtempSync(join(tmpdir(), "ardenfall-fatal-emission-"));
    try {
      const snap = await loadSnapshot.run({}, ctx);
      const desc = await loadDescriptors.run({}, ctx);
      const fatalSnapshot = {
        ...snap,
        diagnostics: [
          ...snap.diagnostics,
          {
            rowId: null,
            severity: "fatal" as const,
            code: "fatalExportDiagnostic",
            field: "refs",
            message: "fatal export diagnostic",
          },
        ],
      };
      const validation = await validate.run(
        { "load-snapshot": fatalSnapshot, "load-descriptors": desc },
        ctx,
      );

      expect(validation.countsBySeverity.fatal).toBeGreaterThan(0);
      expect(() =>
        emitSqlite.run(
          { "load-descriptors": desc, "load-snapshot": fatalSnapshot, validate: validation },
          { ...ctx, outDir: out },
        ),
      ).toThrow(/pipeline rejected snapshot/);
      expect(existsSync(join(out, "data.sqlite"))).toBe(false);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  it("emits SQLite output when validation has no fatal diagnostics", async () => {
    const out = mkdtempSync(join(tmpdir(), "ardenfall-clean-emission-"));
    try {
      const snap = await loadSnapshot.run({}, ctx);
      const desc = await loadDescriptors.run({}, ctx);
      const validation = await validate.run(
        { "load-snapshot": snap, "load-descriptors": desc },
        ctx,
      );

      expect(validation.countsBySeverity.fatal).toBe(0);
      const emitted = await emitSqlite.run(
        { "load-descriptors": desc, "load-snapshot": snap, validate: validation },
        { ...ctx, outDir: out },
      );

      expect(emitted.outputPath).toBe(join(out, "data.sqlite"));
      expect(emitted.byteSize).toBeGreaterThan(0);
      expect(existsSync(emitted.outputPath)).toBe(true);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});
