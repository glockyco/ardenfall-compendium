import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";

const defaultSource = resolve(import.meta.dirname, "../../pipeline/dist/data.sqlite");
const defaultTarget = resolve(import.meta.dirname, "../static/data.sqlite");

export function syncDataSqlite({ source = defaultSource, target = defaultTarget } = {}) {
  if (!existsSync(source)) {
    throw new Error(
      `Missing pipeline SQLite output at ${source}. Run controller export or pipeline:run before deploying.`,
    );
  }

  const sourceInfo = statSync(source);
  if (!sourceInfo.isFile() || sourceInfo.size === 0) {
    throw new Error(`Invalid pipeline SQLite output at ${source}. Expected a non-empty file.`);
  }

  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
  return { source, target, bytes: sourceInfo.size };
}

if (import.meta.main) {
  const result = syncDataSqlite();
  process.stdout.write(`synced ${result.source} -> ${result.target} (${result.bytes} bytes)\n`);
}
