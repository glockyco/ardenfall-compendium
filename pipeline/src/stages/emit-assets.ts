import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import type { EmittedAssetRef, SnapshotItemIconMetadata, Stage } from "../types.ts";
import type { LoadSnapshotOutput } from "./load-snapshot.ts";

export interface EmitAssetsInputs {
  "load-snapshot": LoadSnapshotOutput;
}

export interface EmitAssetsOutput {
  assetsDir: string;
  refs: EmittedAssetRef[];
  itemIconMetadata: SnapshotItemIconMetadata[];
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertSnapshotRelativePng(path: string): void {
  if (
    !path.startsWith("assets/") ||
    !path.endsWith(".png") ||
    path.includes("..") ||
    path.includes("\0")
  ) {
    throw new Error(`invalid snapshot asset path: ${path}`);
  }
}

export const emitAssets: Stage<EmitAssetsInputs, EmitAssetsOutput> = {
  id: "emit-assets",
  inputs: ["load-snapshot"],
  async run(inputs, ctx) {
    const manifest = inputs["load-snapshot"].assetManifest;
    const assetsDir = join(ctx.outDir, "assets");
    mkdirSync(assetsDir, { recursive: true });
    if (!manifest) {
      throw new Error(
        `missing snapshot asset manifest at ${join(ctx.snapshotDir, "asset-manifest.json")}`,
      );
    }

    const refs: EmittedAssetRef[] = [];
    const convertedByPngHash = new Map<string, { hash: string; outputPath: string }>();

    for (const asset of manifest.assets) {
      assertSnapshotRelativePng(asset.sourcePath);
      const source = join(ctx.snapshotDir, asset.sourcePath);
      if (!existsSync(source)) throw new Error(`missing snapshot asset: ${asset.sourcePath}`);
      const info = statSync(source);
      if (!info.isFile() || info.size === 0) {
        throw new Error(`invalid empty snapshot asset: ${asset.sourcePath}`);
      }

      let converted = convertedByPngHash.get(asset.pngHash);
      if (!converted) {
        const png = readFileSync(source);
        const webp = await sharp(png).webp({ quality: 82 }).toBuffer();
        const hash = sha256Hex(webp);
        const outputPath = join(assetsDir, `${hash}.webp`);
        if (!existsSync(outputPath)) writeFileSync(outputPath, webp);
        converted = { hash, outputPath };
        convertedByPngHash.set(asset.pngHash, converted);
      }

      refs.push({
        entityId: asset.entityId,
        entityRowId: asset.rowId,
        slot: asset.slot,
        assetKind: asset.kind,
        assetHash: converted.hash,
        outputPath: converted.outputPath,
      });
    }

    return { assetsDir, refs, itemIconMetadata: manifest.itemIconMetadata };
  },
};
