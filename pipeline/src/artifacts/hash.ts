import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export function sha256Bytes(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function sha256Json(value: unknown): string {
  return sha256Bytes(JSON.stringify(value));
}

export async function sha256File(path: string): Promise<string> {
  return sha256Bytes(readFileSync(path));
}

export async function sha256Tree(root: string): Promise<string> {
  const entries = listFiles(root).map((path) => {
    const rel = relative(root, path).replaceAll("\\", "/");
    const hash = sha256Bytes(readFileSync(path));
    return `${rel}\0${hash}`;
  });
  return sha256Bytes(entries.join("\n"));
}

function listFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...listFiles(path));
    else if (entry.isFile()) {
      const info = statSync(path);
      if (info.size === 0) throw new Error(`refusing to hash empty artifact file: ${path}`);
      results.push(path);
    }
  }
  return results.sort();
}
