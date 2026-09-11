import { join } from "node:path";

/**
 * Where a staged artifact and the site built from it live.
 *
 * A fixture build and a live build are different sites made from different data, so they get
 * different directories. One shared slot meant a fixture gate overwrote the live build's database
 * and its pages: a running preview then served live pages against fixture rows until it hit a page
 * the fixture does not have, and every live verification had to be rebuilt from scratch.
 *
 * `SITE_STAGE` selects the slot. It defaults to `fixture`, which is what CI stages.
 */

/** @typedef {"fixture" | "release"} StageKind */

const KINDS = /** @type {const} */ (["fixture", "release"]);

/** @returns {StageKind} */
export function stageKind(env = process.env) {
  const value = env.SITE_STAGE ?? "fixture";
  if (!KINDS.includes(/** @type {StageKind} */ (value))) {
    throw new Error(`SITE_STAGE must be one of ${KINDS.join(", ")}, got '${value}'`);
  }
  return /** @type {StageKind} */ (value);
}

/**
 * @param {StageKind} kind
 * @param {string} siteDir
 */
export function stagePaths(kind, siteDir = process.cwd()) {
  const root = join(siteDir, ".stage", kind);
  return {
    kind,
    /** Everything staged for this kind, and the site built from it. */
    root,
    /** The build-time database the read models query. Never deployed. */
    database: join(root, "data.sqlite"),
    /** The static root this build serves: the tracked files, the artifact assets, `_release.json`. */
    staticDir: join(root, "static"),
    /** The prerendered site. */
    outputDir: join(root, "output"),
  };
}

/** The slot the current process is working in. */
export function currentStagePaths(siteDir = process.cwd()) {
  return stagePaths(stageKind(), siteDir);
}
