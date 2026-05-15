import { describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
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
      rowId: "fixture-iron-sword",
      slot: "displayIcon",
      kind: "image",
      pngHash: "fixture-red-png",
      sourcePath: "assets/items/fixture-icon-red.png",
    });
    expect(snap.assetManifest?.itemIconMetadata).toContainEqual({
      entityId: "item",
      rowId: "fixture-iron-sword",
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
