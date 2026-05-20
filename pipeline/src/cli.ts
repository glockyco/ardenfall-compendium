#!/usr/bin/env bun
import { rmSync } from "node:fs";
import { join } from "node:path";
import { buildArtifactManifest } from "./artifacts/manifest";
import { runStages } from "./orchestrator";
import { loadDescriptors } from "./stages/load-descriptors";
import { loadSnapshot, type LoadSnapshotOutput } from "./stages/load-snapshot";
import { validate } from "./stages/validate";
import { emitSqlite, type EmitSqliteOutput } from "./stages/emit-sqlite";
import { emitAssets, type EmitAssetsOutput } from "./stages/emit-assets";
import { emitRedirects, type EmitRedirectsOutput } from "./stages/emit-redirects";
import type { ArtifactKind, Stage, StageContext } from "./types.ts";

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
    source?: { kind?: string };
  };
  if (snapshotManifest.source?.kind !== "live-game-export") {
    throw new Error("release artifacts require live-game-export snapshots");
  }
  if (!snapshotManifest.gameVersion || !snapshotManifest.buildIdentifier) {
    throw new Error("release snapshots require gameVersion and buildIdentifier");
  }
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

const stages = [loadDescriptors, loadSnapshot, validate, emitAssets, emitSqlite] as Stage<
  unknown,
  unknown
>[];

const result = await runStages(stages, {}, ctx);

const v = result.validate as {
  errors: unknown[];
  countsBySeverity: { fatal: number; diagnostic: number };
};
if (v.countsBySeverity.fatal > 0) {
  console.error(`pipeline rejected snapshot: ${v.countsBySeverity.fatal} fatal diagnostics`);
  for (const e of v.errors) console.error(JSON.stringify(e));
  process.exit(1);
}
const e = result["emit-sqlite"] as EmitSqliteOutput;
console.warn(`wrote ${e.outputPath} (${e.byteSize} bytes)`);
const a = result["emit-assets"] as EmitAssetsOutput;
console.warn(`wrote ${a.refs.length} asset refs to ${a.assetsDir}`);
const r = emitRedirects({ sqlitePath: e.outputPath, outputDir: join(outDir, "static") });
console.warn(`wrote ${r.count} redirects to ${r.filePath}`);

if (artifactKind) {
  const manifest = await buildArtifactManifest({
    artifactKind,
    artifactId,
    artifactDir: outDir,
    snapshot: result["load-snapshot"] as LoadSnapshotOutput,
    sqliteOutput: e,
    assetsOutput: a,
    redirectsOutput: r as EmitRedirectsOutput,
  });
  console.warn(
    `wrote ${outDir}/artifact-manifest.json (${manifest.artifactKind} ${manifest.artifactId})`,
  );
}
