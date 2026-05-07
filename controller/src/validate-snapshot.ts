import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface SnapshotValidationResult {
  itemCount: number;
}

interface ManifestShape {
  counts?: { item?: number };
  hashes?: { "items.json"?: string };
  diagnostics?: { fatal?: number };
}

interface ItemsShape {
  rows?: unknown[];
}

export async function validateSnapshot(snapshotDir: string): Promise<SnapshotValidationResult> {
  const [manifestText, itemsText] = await Promise.all([
    readFile(join(snapshotDir, "manifest.json"), "utf8"),
    readFile(join(snapshotDir, "items.json"), "utf8"),
  ]);
  const manifest = JSON.parse(manifestText) as ManifestShape;
  const items = JSON.parse(itemsText) as ItemsShape;

  const expectedHash = manifest.hashes?.["items.json"];
  if (!expectedHash) throw new Error("manifest is missing items.json hash");
  const actualHash = new Bun.CryptoHasher("sha256").update(itemsText).digest("hex");
  if (actualHash !== expectedHash)
    throw new Error(`items.json hash mismatch: expected ${expectedHash}, got ${actualHash}`);

  const rows = Array.isArray(items.rows) ? items.rows : undefined;
  if (!rows) throw new Error("items.json rows must be an array");
  if (manifest.counts?.item !== rows.length)
    throw new Error(
      `manifest item count ${manifest.counts?.item ?? "missing"} does not match ${rows.length} rows`,
    );
  if ((manifest.diagnostics?.fatal ?? 0) > 0)
    throw new Error("snapshot contains fatal diagnostics");

  return { itemCount: rows.length };
}
