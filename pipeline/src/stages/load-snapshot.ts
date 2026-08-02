import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import validateAssetManifest from "../../dist/validate-asset-manifest.mjs";
import validateDiagnostics from "../../dist/validate-diagnostics.mjs";
import validateFinalizeTimings from "../../dist/validate-finalize-timings.mjs";
import validateManifest from "../../dist/validate-manifest.mjs";
import validateMasterTooltip from "../../dist/validate-master-tooltip.mjs";
import validateSnapshot from "../../dist/validate-snapshot.mjs";
import type {
  SnapshotAssetManifest,
  FinalizeTiming,
  SnapshotDiagnosticArtifactEntry,
  SnapshotEnvelope,
  MasterTooltipVocabulary,
  SnapshotManifest,
  Stage,
} from "../types.ts";

export interface LoadSnapshotOutput {
  manifest: SnapshotManifest;
  envelopes: Record<string, SnapshotEnvelope>;
  diagnostics: SnapshotDiagnosticArtifactEntry[];
  assetManifest?: SnapshotAssetManifest;
  masterTooltip: MasterTooltipVocabulary;
  finalizeTimings: FinalizeTiming[];
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
    const envelopePaths = new Map<string, string>();
    const diagnosticsPath = join(dir, "diagnostics.json");
    const finalizeTimingsPath = join(dir, "finalize-timings.json");
    const masterTooltipPath = join(dir, "master-tooltip.json");
    let diagnostics: SnapshotDiagnosticArtifactEntry[] = [];
    let finalizeTimings: FinalizeTiming[] = [];
    for (const fileName of readdirSync(dir)) {
      if (
        fileName === "manifest.json" ||
        fileName === "diagnostics.json" ||
        fileName === "asset-manifest.json" ||
        fileName === "master-tooltip.json" ||
        fileName === "finalize-timings.json"
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
      const previousPath = envelopePaths.get(env.entityId);
      if (previousPath) {
        throw new Error(
          `duplicate snapshot entity '${env.entityId}' declared by ${previousPath} and ${path}`,
        );
      }
      envelopes[env.entityId] = env;
      envelopePaths.set(env.entityId, path);
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

    if (existsSync(finalizeTimingsPath)) {
      finalizeTimings = JSON.parse(readFileSync(finalizeTimingsPath, "utf8")) as FinalizeTiming[];
      if (!validateFinalizeTimings(finalizeTimings)) {
        const detail = (validateFinalizeTimings.errors ?? [])
          .map((e) => `${finalizeTimingsPath}#${e.instancePath} — ${e.message}`)
          .join("\n");
        throw new Error(`invalid finalize timings at ${finalizeTimingsPath}:\n${detail}`);
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
    if (!existsSync(masterTooltipPath)) {
      throw new Error(`missing master tooltip vocabulary at ${masterTooltipPath}`);
    }
    const rawMasterTooltip = JSON.parse(readFileSync(masterTooltipPath, "utf8")) as unknown;
    if (!validateMasterTooltip(rawMasterTooltip)) {
      const detail = (validateMasterTooltip.errors ?? [])
        .map((e) => `${masterTooltipPath}#${e.instancePath} — ${e.message}`)
        .join("\n");
      throw new Error(
        `invalid master tooltip vocabulary at ${masterTooltipPath} (expected schemaVersion 2):\n${detail}`,
      );
    }
    const masterTooltip = rawMasterTooltip as MasterTooltipVocabulary;
    return {
      manifest,
      envelopes,
      diagnostics,
      finalizeTimings,
      ...(assetManifest === undefined ? {} : { assetManifest }),
      masterTooltip,
    };
  },
};
