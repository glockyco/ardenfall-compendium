import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import validateAssetManifest from "../../dist/validate-asset-manifest.mjs";
import validateDiagnostics from "../../dist/validate-diagnostics.mjs";
import validateFinalizeTimings from "../../dist/validate-finalize-timings.mjs";
import validateManifest from "../../dist/validate-manifest.mjs";
import validateMasterTooltip from "../../dist/validate-master-tooltip.mjs";
import validateSnapshot from "../../dist/validate-snapshot.mjs";
import type { LoadDescriptorsOutput } from "./load-descriptors.ts";
import type {
  SnapshotAssetManifest,
  FinalizeTiming,
  SnapshotDiagnosticArtifactEntry,
  SnapshotEnvelope,
  MasterTooltipVocabulary,
  SnapshotManifest,
  Stage,
} from "../types.ts";

interface LoadSnapshotInputs {
  "load-descriptors"?: LoadDescriptorsOutput;
}

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
  inputs: ["load-descriptors"],
  run: (_inputs, ctx) => {
    const snapshotInputs = _inputs as LoadSnapshotInputs;
    const descriptors = snapshotInputs["load-descriptors"];
    if (descriptors === undefined) {
      throw new Error("stage load-snapshot requires load-descriptors input");
    }
    const dir = ctx.snapshotDir;
    const manifestPath = join(dir, "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as SnapshotManifest;
    if (!validateManifest(manifest)) {
      const detail = (validateManifest.errors ?? [])
        .map((e) => `${manifestPath}#${e.instancePath} — ${e.message}`)
        .join("\n");
      throw new Error(`invalid snapshot manifest at ${manifestPath}:\n${detail}`);
    }

    const snapshotFiles = new Set(readdirSync(dir));
    for (const entity of Object.values(descriptors.entities).sort((left, right) =>
      left.id.localeCompare(right.id),
    )) {
      if (entity.extraction?.source === undefined) continue;
      const file = entity.extraction.file;
      if (!snapshotFiles.has(file)) {
        throw new Error(
          `descriptor '${entity.id}' is missing expected snapshot file '${file}' in directory '${dir}'`,
        );
      }
      if (!Object.hasOwn(manifest.counts, entity.id)) {
        throw new Error(
          `snapshot manifest is missing count for descriptor '${entity.id}' (expected file '${file}') in directory '${dir}'`,
        );
      }
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
