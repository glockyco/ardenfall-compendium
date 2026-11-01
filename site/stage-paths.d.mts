/**
 * Hand-written declaration for `stage-paths.mjs`.
 *
 * The module is plain JavaScript so build configuration and Bun scripts can share staging
 * paths without a TypeScript loader. This declaration keeps their callers type-checked.
 */
export type StageKind = "fixture" | "release";

export interface StagePaths {
  kind: StageKind;
  root: string;
  database: string;
  staticDir: string;
  outputDir: string;
}

export function stageKind(env?: Record<string, string | undefined>): StageKind;
export function stagePaths(kind: StageKind, siteDir?: string): StagePaths;
export function currentStagePaths(siteDir?: string): StagePaths;
