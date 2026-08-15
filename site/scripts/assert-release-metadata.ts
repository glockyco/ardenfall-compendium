import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const releasePath = join(import.meta.dirname, "..", "static", "_release.json");
const releaseStageCommand =
  "bun run --cwd site stage:artifact ../pipeline/artifacts/releases/<snapshot-id> --mode release";

let metadata: Record<string, unknown> | null = null;
let readFailure: string | null = null;

if (!existsSync(releasePath)) {
  readFailure = "static/_release.json is missing";
} else {
  try {
    const parsed: unknown = JSON.parse(readFileSync(releasePath, "utf8"));
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      metadata = parsed as Record<string, unknown>;
    } else {
      readFailure = "static/_release.json does not contain a JSON object";
    }
  } catch {
    readFailure = "static/_release.json is not valid JSON";
  }
}

const artifactId = typeof metadata?.artifactId === "string" ? metadata.artifactId : "unknown";
const artifactKind = typeof metadata?.artifactKind === "string" ? metadata.artifactKind : "missing";
const source = metadata?.source;
const sourceKind =
  typeof source === "object" && source !== null && !Array.isArray(source)
    ? typeof (source as Record<string, unknown>).kind === "string"
      ? (source as Record<string, unknown>).kind
      : "missing"
    : "missing";

if (readFailure || artifactKind !== "release" || sourceKind !== "live-game-export") {
  const stagedArtifact = readFailure
    ? `${readFailure} (artifact ${artifactId})`
    : `artifact ${artifactId} (artifactKind=${artifactKind}, source.kind=${sourceKind})`;

  throw new Error(
    `Cannot deploy ${stagedArtifact}. Wrangler requires artifactKind=release and source.kind=live-game-export. Stage a real release with: ${releaseStageCommand}`,
  );
}

process.stdout.write(`Verified release artifact ${artifactId} for Wrangler deployment.\n`);
