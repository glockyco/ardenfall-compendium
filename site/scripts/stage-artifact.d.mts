/**
 * Hand-written declaration for the JavaScript staging script.
 *
 * `stage-artifact.mjs` is plain JavaScript because it runs directly under Node
 * during the site build, before any TypeScript build step exists. It is also the
 * only place artifact tamper detection lives, so the pipeline's manifest tests
 * import it to prove a manipulated artifact is rejected. Declaring its shape here
 * keeps those callers type-checked instead of suppressed.
 */

export interface StageArtifactOptions {
  /** Directory holding `artifact-manifest.json`, `data.sqlite`, assets, and static files. */
  artifactDir: string;
  /** Destination the validated artifact is copied into. */
  targetDir: string;
  /** Which artifact kind the caller expects. A mismatch is rejected. */
  mode: "fixture" | "release";
}

export interface StageArtifactResult {
  /** The parsed and validated manifest. */
  manifest: Record<string, unknown>;
  targetDir: string;
}

/**
 * Validates an artifact against its manifest and copies it to `targetDir`.
 *
 * Throws when the manifest is missing or invalid, the artifact kind does not
 * match `mode`, a recorded file hash or byte size disagrees with the file on
 * disk, a listed asset is absent, a recorded row count disagrees with the
 * database, or the artifact carries fatal diagnostics.
 */
export function stageArtifact(options: StageArtifactOptions): Promise<StageArtifactResult>;
