import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const dbPath = () => join(process.cwd(), ".data", "data.sqlite");
const require = createRequire(import.meta.url);

type SqlParams = readonly unknown[] | Record<string, unknown>;
type SqliteStatement = {
  all: (...params: unknown[]) => unknown[];
  get: (...params: unknown[]) => unknown | null;
};
type SqliteDatabase = {
  close: () => void;
  query?: (sql: string) => SqliteStatement;
  prepare?: (sql: string) => SqliteStatement;
};

let db: { path: string; handle: SqliteDatabase } | null = null;

export const assetSrc = (hash: string | null): string | null =>
  hash ? `/assets/${hash}.webp` : null;

export const colorCss = (json: string | null): string | null => {
  if (!json) return null;
  let color: { r?: unknown; g?: unknown; b?: unknown; a?: unknown };
  try {
    color = JSON.parse(json) as { r?: unknown; g?: unknown; b?: unknown; a?: unknown };
  } catch (error) {
    throw new Error(`invalid generated color JSON: ${json}`, { cause: error });
  }
  if (
    typeof color.r !== "number" ||
    !Number.isFinite(color.r) ||
    typeof color.g !== "number" ||
    !Number.isFinite(color.g) ||
    typeof color.b !== "number" ||
    !Number.isFinite(color.b)
  ) {
    throw new Error(`invalid generated color channels: ${json}`);
  }
  const alpha = typeof color.a === "number" && Number.isFinite(color.a) ? color.a : 1;
  return `rgba(${colorChannel(color.r)}, ${colorChannel(color.g)}, ${colorChannel(color.b)}, ${alpha})`;
};

export const colorChannel = (value: number): number =>
  Math.round(Math.max(0, Math.min(1, value)) * 255);

function getDb(): SqliteDatabase {
  const path = dbPath();
  if (db?.path !== path) {
    db?.handle.close();
    if (!existsSync(path)) throw new Error(`missing site SQLite database: ${path}`);
    db = { path, handle: openReadonlyDatabase(path) };
  }
  return db.handle;
}

function openReadonlyDatabase(path: string): SqliteDatabase {
  if ((process.versions as { bun?: string }).bun) {
    const { Database } = require("bun:sqlite") as {
      Database: new (
        filename: string,
        options: { readonly: boolean; create: boolean },
      ) => SqliteDatabase;
    };
    return new Database(path, { readonly: true, create: false });
  }

  const Database = require("better-sqlite3") as new (
    filename: string,
    options: { readonly: boolean; fileMustExist: boolean },
  ) => SqliteDatabase;
  return new Database(path, { readonly: true, fileMustExist: true });
}

export function prepareStatement(sql: string): SqliteStatement {
  const database = getDb();
  if (database.query) return database.query(sql);
  if (database.prepare) return database.prepare(sql);
  throw new Error("unsupported SQLite database adapter");
}

export function all<T>(sql: string, params: SqlParams = []): T[] {
  const query = prepareStatement(sql);
  return (Array.isArray(params) ? query.all(...params) : query.all(params)) as T[];
}

export function get<T>(sql: string, params: SqlParams = []): T | undefined {
  const query = prepareStatement(sql);
  return (
    ((Array.isArray(params) ? query.get(...params) : query.get(params)) as T | null) ?? undefined
  );
}
