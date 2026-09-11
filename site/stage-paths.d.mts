/**
 * Hand-written declaration for `stage-paths.mjs`.
 *
 * The module is plain JavaScript because `svelte.config.js` imports it while Node loads the
 * SvelteKit config, before any TypeScript step exists. Declaring its shape here keeps the
 * TypeScript callers, which are the scripts, the read models and the layout, type-checked.
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
