import { Database } from "bun:sqlite";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_SQLITE_PATH = resolve(import.meta.dirname, "../../pipeline/dist/data.sqlite");
const DEFAULT_MIN_ITEM_ROWS = 1000;

function parseMinimum(value) {
  if (value === undefined || value === null || value === "") return DEFAULT_MIN_ITEM_ROWS;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Invalid ARDENFALL_MIN_PRODUCTION_ITEMS value: ${value}`);
  }
  return parsed;
}

function assertReadableFile(path) {
  if (!existsSync(path)) throw new Error(`Missing generated SQLite database at ${path}.`);
  const info = statSync(path);
  if (!info.isFile() || info.size === 0) {
    throw new Error(`Invalid generated SQLite database at ${path}: expected a non-empty file.`);
  }
}

export function assertProductionData({
  sqlitePath = DEFAULT_SQLITE_PATH,
  minItemRows = parseMinimum(process.env.ARDENFALL_MIN_PRODUCTION_ITEMS),
} = {}) {
  assertReadableFile(sqlitePath);

  const db = new Database(sqlitePath, { readonly: true });
  try {
    const row = db.query("SELECT COUNT(*) AS count FROM item_overview_rows").get();
    const count = row?.count;
    if (!Number.isInteger(count)) {
      throw new Error(`Invalid generated SQLite database at ${sqlitePath}: item count missing.`);
    }
    if (count < minItemRows) {
      throw new Error(
        `Refusing production deploy: expected at least ${minItemRows} item overview rows, found ${count}. Regenerate pipeline/dist from a real snapshot, not fixtures/synthetic.`,
      );
    }
    return { sqlitePath, itemOverviewRows: count, minItemRows };
  } finally {
    db.close();
  }
}

if (import.meta.main) {
  const result = assertProductionData();
  process.stdout.write(
    `production data guard passed (${result.itemOverviewRows} item overview rows; minimum ${result.minItemRows})\n`,
  );
}
