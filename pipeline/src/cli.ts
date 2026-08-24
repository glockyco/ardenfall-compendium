#!/usr/bin/env bun
import { rmSync } from "node:fs";
import { join } from "node:path";
import { buildArtifactManifest } from "./artifacts/manifest";
import { runStages } from "./orchestrator";
import { assertPublishableSnapshotIdentity } from "./publication-identity";
import { loadDescriptors } from "./stages/load-descriptors";
import { loadSnapshot, type LoadSnapshotOutput } from "./stages/load-snapshot";
import { validate } from "./stages/validate";
import { validateDescriptorFields } from "./stages/validate-descriptor-fields";
import {
  assertSnapshotValidationPassed,
  SnapshotValidationError,
  emitSqlite,
  type EmitSqliteOutput,
} from "./stages/emit-sqlite";
import { emitAssets, type EmitAssetsOutput } from "./stages/emit-assets";
import type { ArtifactKind, Stage, StageContext } from "./types.ts";
import type { ValidateOutput } from "./stages/validate.ts";

const [, , subcommand, firstArg, secondArg] = Bun.argv;

function usage(): never {
  console.error(`usage:
  ardenfall-pipeline build-fixture <fixtureName> <snapshotDir>
  ardenfall-pipeline build-release <snapshotDir>
  ardenfall-pipeline run <snapshotDir> <outDir>`);
  process.exit(2);
}

let snapshotDir: string;
let outDir: string;
let artifactKind: ArtifactKind | null = null;
let artifactId = "debug-run";

if (subcommand === "build-fixture" && firstArg && secondArg) {
  const fixtureName = firstArg;
  snapshotDir = secondArg;
  outDir = `pipeline/artifacts/fixtures/${fixtureName}`;
  artifactKind = "fixture";
  artifactId = fixtureName;
} else if (subcommand === "build-release" && firstArg && !secondArg) {
  snapshotDir = firstArg;
  const snapshotManifest = JSON.parse(await Bun.file(`${snapshotDir}/manifest.json`).text()) as {
    gameVersion?: string;
    buildIdentifier?: string;
    productName?: string;
    buildProfile?: string;
    source?: { kind?: string };
  };
  if (snapshotManifest.source?.kind !== "live-game-export") {
    throw new Error("release artifacts require live-game-export snapshots");
  }
  if (!snapshotManifest.gameVersion || !snapshotManifest.buildIdentifier) {
    throw new Error("release snapshots require gameVersion and buildIdentifier");
  }
  assertPublishableSnapshotIdentity({
    productName: snapshotManifest.productName ?? "",
    buildProfile: snapshotManifest.buildProfile ?? "",
  });
  artifactId = `${snapshotManifest.gameVersion}-${snapshotManifest.buildIdentifier}`;
  outDir = `pipeline/artifacts/releases/${artifactId}`;
  artifactKind = "release";
} else if (subcommand === "run" && firstArg && secondArg) {
  snapshotDir = firstArg;
  outDir = secondArg;
} else {
  usage();
}

if (artifactKind) rmSync(outDir, { recursive: true, force: true });

const ctx: StageContext = {
  workspaceRoot: ".",
  snapshotDir,
  outDir,
  log: (level, msg) => console.warn(`[${level}] ${msg}`),
};

function removeGeneratedOutputs(): void {
  rmSync(join(outDir, "data.sqlite"), { force: true });
  rmSync(join(outDir, "assets"), { recursive: true, force: true });
  rmSync(join(outDir, "static"), { recursive: true, force: true });
  rmSync(join(outDir, "artifact-manifest.json"), { force: true });
}

const gatedEmitAssets: Stage<
  { "load-snapshot": LoadSnapshotOutput; validate: ValidateOutput },
  EmitAssetsOutput
> = {
  id: emitAssets.id,
  inputs: ["load-snapshot", "validate"],
  run: (inputs, stageCtx) => {
    assertSnapshotValidationPassed(inputs.validate);
    return emitAssets.run({ "load-snapshot": inputs["load-snapshot"] }, stageCtx);
  },
};

const stages = [
  loadDescriptors,
  loadSnapshot,
  validateDescriptorFields,
  validate,
  gatedEmitAssets,
  emitSqlite,
] as Stage<unknown, unknown>[];

let result: Record<string, unknown>;
try {
  result = await runStages(stages, {}, ctx);
} catch (error) {
  removeGeneratedOutputs();
  if (error instanceof SnapshotValidationError) {
    const v = error.validation;
    console.error(`pipeline rejected snapshot: ${v.countsBySeverity.fatal} fatal diagnostics`);
    for (const e of v.errors) console.error(JSON.stringify(e));
    process.exit(1);
  }
  throw error;
}

const e = result["emit-sqlite"] as EmitSqliteOutput;
console.warn(`wrote ${e.outputPath} (${e.byteSize} bytes)`);
const a = result["emit-assets"] as EmitAssetsOutput;
console.warn(`wrote ${a.refs.length} asset refs to ${a.assetsDir}`);
if (artifactKind) {
  const manifest = await buildArtifactManifest({
    artifactKind,
    artifactId,
    artifactDir: outDir,
    snapshot: result["load-snapshot"] as LoadSnapshotOutput,
    sqliteOutput: e,
    assetsOutput: a,
  });
  console.warn(
    `wrote ${outDir}/artifact-manifest.json (${manifest.artifactKind} ${manifest.artifactId})`,
  );
}
