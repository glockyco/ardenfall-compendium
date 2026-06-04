import { readFile } from "node:fs/promises";
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
  rows?: unknown[];
}

export const ENTITY_FILES: Record<string, string> = {
  item: "items.json",
  "stat-type": "stat-types.json",
  "item-category": "item-categories.json",
  "item-tag": "item-tags.json",
  location: "locations.json",
};

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

  const resultCounts: Record<string, number> = {};
  for (const [entity, file] of Object.entries(ENTITY_FILES)) {
    const expectedCount = counts[entity];
    if (expectedCount === undefined) throw new Error(`manifest is missing ${entity} count`);
    if (!Number.isInteger(expectedCount) || expectedCount < 0)
      throw new Error(`manifest ${entity} count must be a non-negative integer`);

    const artifact = parsedArtifacts.get(file);
    if (artifact === undefined) throw new Error(`manifest is missing ${file} hash`);
    const rows = (artifact as EnvelopeShape).rows;
    if (!Array.isArray(rows)) throw new Error(`${file} rows must be an array`);
    if (expectedCount !== rows.length)
      throw new Error(
        `manifest ${entity} count ${expectedCount} does not match ${rows.length} rows`,
      );
    resultCounts[entity] = rows.length;
  }

  const diagnostics = parsedArtifacts.get("diagnostics.json");
  if (diagnostics !== undefined && !Array.isArray(diagnostics))
    throw new Error("diagnostics.json must be an array");
  if ((manifest.diagnostics?.fatal ?? 0) > 0)
    throw new Error("snapshot contains fatal diagnostics");

  return { itemCount: resultCounts.item ?? 0, counts: resultCounts };
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
