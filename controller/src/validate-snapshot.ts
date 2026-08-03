import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export interface SnapshotValidationResult {
  itemCount: number;
  counts: Record<string, number>;
}

interface ManifestShape {
  counts?: Record<string, number>;
  hashes?: Record<string, string>;
  diagnostics?: { fatal?: number };
}

interface EnvelopeShape {
  entityId?: unknown;
  rows?: unknown[];
}

export async function validateSnapshot(snapshotDir: string): Promise<SnapshotValidationResult> {
  const manifestText = await readRequiredText(snapshotDir, "manifest.json");
  const manifest = parseJson<ManifestShape>("manifest.json", manifestText);
  const hashes = manifest.hashes ?? {};
  const counts = manifest.counts ?? {};
  const parsedArtifacts = new Map<string, unknown>();

  if (Object.keys(hashes).length === 0) throw new Error("manifest is missing hashes");

  await Promise.all(
    Object.entries(hashes).map(async ([file, expectedHash]) => {
      if (typeof expectedHash !== "string" || expectedHash.length === 0)
        throw new Error(`manifest has invalid ${file} hash`);
      const text = await readRequiredText(snapshotDir, file);
      const actualHash = new Bun.CryptoHasher("sha256").update(text).digest("hex");
      if (actualHash !== expectedHash)
        throw new Error(`${file} hash mismatch: expected ${expectedHash}, got ${actualHash}`);
      parsedArtifacts.set(file, parseJson(file, text));
    }),
  );

  for (const file of await readdir(snapshotDir)) {
    if (!file.endsWith(".json") || parsedArtifacts.has(file)) continue;
    parsedArtifacts.set(file, parseJson(file, await readRequiredText(snapshotDir, file)));
  }

  // Envelope identity is derived from its own entityId, so controller does not duplicate the pipeline's non-entity skip list.
  const envelopes = new Map<string, { file: string; artifact: EnvelopeShape }>();
  for (const [file, artifact] of parsedArtifacts) {
    if (!isRecord(artifact) || typeof artifact.entityId !== "string") continue;
    const previous = envelopes.get(artifact.entityId);
    if (previous !== undefined)
      throw new Error(
        `duplicate snapshot entity '${artifact.entityId}' declared by ${previous.file} and ${file}`,
      );
    envelopes.set(artifact.entityId, { file, artifact });
  }

  const expectedEntities = Object.keys(counts).sort();
  const discoveredEntities = [...envelopes.keys()].sort();
  if (
    expectedEntities.length !== discoveredEntities.length ||
    expectedEntities.some((entity, index) => entity !== discoveredEntities[index])
  ) {
    const missing = expectedEntities.filter((entity) => !envelopes.has(entity));
    const unexpected = discoveredEntities.filter((entity) => counts[entity] === undefined);
    const details = [
      ...(missing.length > 0 ? [`missing envelopes for ${missing.join(", ")}`] : []),
      ...(unexpected.length > 0 ? [`unexpected envelopes for ${unexpected.join(", ")}`] : []),
    ];
    throw new Error(`manifest counts do not match snapshot envelopes: ${details.join("; ")}`);
  }

  const resultCounts: Record<string, number> = {};
  for (const entity of discoveredEntities) {
    const { file, artifact } = envelopes.get(entity)!;
    const expectedCount = counts[entity];
    if (expectedCount === undefined) throw new Error(`manifest is missing ${entity} count`);
    if (!Number.isInteger(expectedCount) || expectedCount < 0)
      throw new Error(`manifest ${entity} count must be a non-negative integer`);

    const rows = artifact.rows;
    if (!Array.isArray(rows)) throw new Error(`${file} rows must be an array`);
    if (expectedCount !== rows.length)
      throw new Error(
        `manifest ${entity} count ${expectedCount} does not match ${rows.length} rows`,
      );
    resultCounts[entity] = rows.length;
  }

  if (resultCounts.item === undefined) throw new Error("manifest is missing item count");
  if (resultCounts.item === 0) throw new Error("snapshot contains no items");

  const diagnostics = parsedArtifacts.get("diagnostics.json");
  if (diagnostics !== undefined && !Array.isArray(diagnostics))
    throw new Error("diagnostics.json must be an array");
  if ((manifest.diagnostics?.fatal ?? 0) > 0)
    throw new Error("snapshot contains fatal diagnostics");

  return { itemCount: resultCounts.item ?? 0, counts: resultCounts };
}

function isRecord(value: unknown): value is EnvelopeShape {
  return typeof value === "object" && value !== null;
}

async function readRequiredText(snapshotDir: string, file: string): Promise<string> {
  try {
    return await readFile(join(snapshotDir, file), "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT")
      throw new Error(`${file} is missing`, { cause: error });
    throw error;
  }
}

function parseJson<T>(file: string, text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`${file} is not valid JSON: ${reason}`, { cause: error });
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
