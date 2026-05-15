#!/usr/bin/env bun
import { runStages } from "./orchestrator";
import { loadDescriptors } from "./stages/load-descriptors";
import { loadSnapshot } from "./stages/load-snapshot";
import { validate } from "./stages/validate";
import { emitSqlite } from "./stages/emit-sqlite";
import { emitAssets } from "./stages/emit-assets";
import type { Stage, StageContext } from "./types.ts";

const [, , subcommand, snapshotDir, outDir] = Bun.argv;
if (subcommand !== "run" || !snapshotDir || !outDir) {
  console.error(`usage: ardenfall-pipeline run <snapshotDir> <outDir>`);
  process.exit(2);
}

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
const e = result["emit-sqlite"] as { outputPath: string; byteSize: number };
console.warn(`wrote ${e.outputPath} (${e.byteSize} bytes)`);
const a = result["emit-assets"] as { refs: unknown[]; assetsDir: string };
console.warn(`wrote ${a.refs.length} asset refs to ${a.assetsDir}`);
