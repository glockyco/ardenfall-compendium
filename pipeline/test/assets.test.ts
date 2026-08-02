import { describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import sharp from "sharp";
import { emitAssets } from "$pipeline/stages/emit-assets";
import { emitSqlite } from "$pipeline/stages/emit-sqlite";
import { loadDescriptors } from "$pipeline/stages/load-descriptors";
import { loadSnapshot } from "$pipeline/stages/load-snapshot";
import type { StageContext } from "$pipeline/types";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

function isWebP(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    Buffer.from(bytes.subarray(0, 4)).toString("ascii") === "RIFF" &&
    Buffer.from(bytes.subarray(8, 12)).toString("ascii") === "WEBP"
  );
}

const ctx: StageContext = {
  workspaceRoot: ".",
  snapshotDir: "fixtures/synthetic/snapshot",
  outDir: "pipeline/test/.tmp",
  log: () => undefined,
};

function tempOut(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

describe("asset conversion", () => {
  it("converts PNG to WebP through the pinned sharp dependency", async () => {
    const webp = await sharp(tinyPng).webp({ quality: 82 }).toBuffer();

    expect(isWebP(webp)).toBe(true);
  });
});

describe("asset manifest loading", () => {
  it("loads item asset slot manifests beside snapshot envelopes", async () => {
    const snap = await loadSnapshot.run({}, ctx);

    expect(snap.assetManifest?.schemaVersion).toBe(1);
    expect(snap.assetManifest?.assets).toContainEqual({
      entityId: "item",
      rowId: "4ed20218.fixture-iron-sword",
      slot: "displayIcon",
      kind: "image",
      pngHash: "fixture-red-png",
      sourcePath: "assets/items/fixture-icon-red.png",
    });
    expect(snap.assetManifest?.itemIconMetadata).toContainEqual({
      entityId: "item",
      rowId: "4ed20218.fixture-iron-sword",
      displayIconColor: { r: 1, g: 1, b: 1, a: 1 },
      secondaryIconColor: null,
    });
  });

  it("rejects invalid asset manifests", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ardenfall-asset-manifest-"));
    try {
      writeFileSync(
        join(dir, "manifest.json"),
        readFileSync("fixtures/synthetic/snapshot/manifest.json"),
      );
      writeFileSync(
        join(dir, "items.json"),
        readFileSync("fixtures/synthetic/snapshot/items.json"),
      );
      writeFileSync(
        join(dir, "asset-manifest.json"),
        JSON.stringify({ schemaVersion: 1, assets: [{ entityId: "item" }] }),
      );

      expect(() => loadSnapshot.run({}, { ...ctx, snapshotDir: dir })).toThrow(
        /invalid snapshot asset manifest/,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("emitAssets", () => {
  it("converts manifest PNGs to content-addressed WebP files", async () => {
    const outDir = tempOut("ardenfall-assets-");
    try {
      const snap = await loadSnapshot.run({}, ctx);
      const result = await emitAssets.run({ "load-snapshot": snap }, { ...ctx, outDir });

      expect(result.refs).toHaveLength(7);
      expect(result.refs.every((ref) => ref.assetHash.match(/^[a-f0-9]{64}$/))).toBe(true);
      for (const ref of result.refs) {
        expect(existsSync(join(outDir, "assets", `${ref.assetHash}.webp`))).toBe(true);
      }
      expect(result.refs).toContainEqual(
        expect.objectContaining({
          entityId: "item",
          entityRowId: "4ed20218.fixture-iron-sword",
          slot: "displayIcon",
          assetKind: "image",
        }),
      );
      expect(result.refs).toContainEqual(
        expect.objectContaining({
          entityId: "item",
          entityRowId: "8c0ffee0.fixture-throwing-potion",
          slot: "secondaryIcon",
          assetKind: "image",
        }),
      );
      expect(result.refs).toContainEqual(
        expect.objectContaining({
          entityId: "stat-type",
          entityRowId: "named;stat-type;att_strength",
          slot: "iconRef",
          assetKind: "image",
        }),
      );
      expect(result.refs).toContainEqual(
        expect.objectContaining({
          entityId: "item-category",
          entityRowId: "named;item-category;itemcat_weapons",
          slot: "defaultItemIconRef",
          assetKind: "image",
        }),
      );
      const uniqueHashes = new Set(result.refs.map((ref) => ref.assetHash));
      expect(uniqueHashes.size).toBe(2);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it("fails loudly when a referenced PNG is missing", async () => {
    const outDir = tempOut("ardenfall-assets-missing-");
    try {
      const snap = await loadSnapshot.run({}, ctx);
      const badSnap = {
        ...snap,
        assetManifest: {
          schemaVersion: 1,
          assets: [
            {
              entityId: "item",
              rowId: "4ed20218.fixture-iron-sword",
              slot: "displayIcon",
              kind: "image" as const,
              pngHash: "missing",
              sourcePath: "assets/items/missing.png",
            },
          ],
          itemIconMetadata: [],
        },
      };

      await expect(
        emitAssets.run({ "load-snapshot": badSnap }, { ...ctx, outDir }),
      ).rejects.toThrow(/missing snapshot asset/);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});

describe("asset_refs", () => {
  it("persists emitted asset references into SQLite", async () => {
    const outDir = tempOut("ardenfall-asset-refs-");
    try {
      const desc = await loadDescriptors.run({}, ctx);
      const snap = await loadSnapshot.run({}, ctx);
      const emitted = await emitAssets.run({ "load-snapshot": snap }, { ...ctx, outDir });

      await emitSqlite.run(
        {
          "load-descriptors": desc,
          "load-snapshot": snap,
          "emit-assets": emitted,
          validate: { errors: [], countsBySeverity: { fatal: 0, diagnostic: 0 } },
        },
        { ...ctx, outDir },
      );

      const db = new Database(join(outDir, "data.sqlite"), { readonly: true });
      try {
        const refs = db
          .query(
            "SELECT entity_id, entity_row_id, slot, asset_kind, asset_hash FROM asset_refs ORDER BY entity_row_id, slot",
          )
          .all();
        expect(refs).toContainEqual(
          expect.objectContaining({
            entity_id: "item",
            entity_row_id: "4ed20218.fixture-iron-sword",
            slot: "displayIcon",
            asset_kind: "image",
          }),
        );
        expect(refs).toContainEqual(
          expect.objectContaining({
            entity_id: "item",
            entity_row_id: "8c0ffee0.fixture-throwing-potion",
            slot: "secondaryIcon",
            asset_kind: "image",
          }),
        );
        expect(refs).toContainEqual(
          expect.objectContaining({
            entity_id: "item-category",
            entity_row_id: "named;item-category;itemcat_weapons",
            slot: "defaultItemIconRef",
            asset_kind: "image",
          }),
        );
      } finally {
        db.close();
      }
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});
