import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import validateAssetManifest from "../../dist/validate-asset-manifest.mjs";
import validateDiagnostics from "../../dist/validate-diagnostics.mjs";
import validateManifest from "../../dist/validate-manifest.mjs";
import validateSnapshot from "../../dist/validate-snapshot.mjs";
import type {
  SnapshotAssetManifest,
  SnapshotDiagnosticArtifactEntry,
  SnapshotEnvelope,
  MasterTooltipDictionary,
  SnapshotManifest,
  Stage,
} from "../types.ts";

export interface LoadSnapshotOutput {
  manifest: SnapshotManifest;
  envelopes: Record<string, SnapshotEnvelope>;
  diagnostics: SnapshotDiagnosticArtifactEntry[];
  assetManifest?: SnapshotAssetManifest;
  masterTooltip?: MasterTooltipDictionary;
}

export const loadSnapshot: Stage<unknown, LoadSnapshotOutput> = {
  id: "load-snapshot",
  inputs: [],
  run: (_inputs, ctx) => {
    const dir = ctx.snapshotDir;
    const manifestPath = join(dir, "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as SnapshotManifest;
    if (!validateManifest(manifest)) {
      const detail = (validateManifest.errors ?? [])
        .map((e) => `${manifestPath}#${e.instancePath} — ${e.message}`)
        .join("\n");
      throw new Error(`invalid snapshot manifest at ${manifestPath}:\n${detail}`);
    }

    const envelopes: Record<string, SnapshotEnvelope> = {};
    const diagnosticsPath = join(dir, "diagnostics.json");
    const masterTooltipPath = join(dir, "master-tooltip.json");
    let masterTooltip: MasterTooltipDictionary | undefined;
    let diagnostics: SnapshotDiagnosticArtifactEntry[] = [];
    for (const fileName of readdirSync(dir)) {
      if (
        fileName === "manifest.json" ||
        fileName === "diagnostics.json" ||
        fileName === "asset-manifest.json" ||
        fileName === "master-tooltip.json"
      ) {
        continue;
      }
      if (!fileName.endsWith(".json")) continue;
      const path = join(dir, fileName);
      const env = JSON.parse(readFileSync(path, "utf8")) as SnapshotEnvelope;
      if (!validateSnapshot(env)) {
        const detail = (validateSnapshot.errors ?? [])
          .map((e) => `${path}#${e.instancePath} — ${e.message}`)
          .join("\n");
        throw new Error(`invalid snapshot envelope at ${path}:\n${detail}`);
      }
      envelopes[env.entityId] = env;
    }

    if (readdirSync(dir).includes("diagnostics.json")) {
      diagnostics = JSON.parse(
        readFileSync(diagnosticsPath, "utf8"),
      ) as SnapshotDiagnosticArtifactEntry[];
      if (!validateDiagnostics(diagnostics)) {
        const detail = (validateDiagnostics.errors ?? [])
          .map((e) => `${diagnosticsPath}#${e.instancePath} — ${e.message}`)
          .join("\n");
        throw new Error(`invalid snapshot diagnostics at ${diagnosticsPath}:\n${detail}`);
      }
    }

    const assetManifestPath = join(dir, "asset-manifest.json");
    let assetManifest: SnapshotAssetManifest | undefined;
    if (existsSync(assetManifestPath)) {
      assetManifest = JSON.parse(readFileSync(assetManifestPath, "utf8")) as SnapshotAssetManifest;
      if (!validateAssetManifest(assetManifest)) {
        const detail = (validateAssetManifest.errors ?? [])
          .map((e) => `${assetManifestPath}#${e.instancePath} — ${e.message}`)
          .join("\n");
        throw new Error(`invalid snapshot asset manifest at ${assetManifestPath}:\n${detail}`);
      }
    }
    if (existsSync(masterTooltipPath)) {
      masterTooltip = JSON.parse(
        readFileSync(masterTooltipPath, "utf8"),
      ) as MasterTooltipDictionary;
      if (masterTooltip.schemaVersion !== 1) {
        throw new Error(
          `invalid master tooltip dictionary at ${masterTooltipPath}: unsupported schemaVersion`,
        );
      }
    }
    return { manifest, envelopes, diagnostics, assetManifest, masterTooltip };
  },
};
