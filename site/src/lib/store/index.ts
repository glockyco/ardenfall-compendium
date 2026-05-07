import { browser } from "$app/environment";
import sqlite3InitModule, {
  type Database,
  type Sqlite3Static,
  type SqlValue,
} from "@sqlite.org/sqlite-wasm";

let db: Database | null = null;
let dbPromise: Promise<Database> | null = null;

/**
 * Open the static `data.sqlite` blob shipped under `static/data.sqlite`.
 *
 * Loads the bytes into a transient in-memory database via
 * `sqlite3_deserialize`. The main-thread variant of `@sqlite.org/sqlite-wasm`
 * does not require COOP/COEP headers — those are only needed for the worker +
 * OPFS variant, which Slice 1 does not use.
 */
export async function getDb(): Promise<Database> {
  if (!browser) throw new Error("getDb only runs in the browser");
  if (db) return db;
  if (dbPromise) return dbPromise;
  dbPromise = (async () => {
    const [sqlite3, response] = await Promise.all([sqlite3InitModule(), fetch("/data.sqlite")]);
    if (!response.ok) {
      throw new Error(`failed to fetch /data.sqlite: ${response.status}`);
    }
    const buffer = new Uint8Array(await response.arrayBuffer());
    db = openDeserialized(sqlite3, buffer);
    return db;
  })();
  return dbPromise;
}

function openDeserialized(sqlite3: Sqlite3Static, bytes: Uint8Array): Database {
  const handle = new sqlite3.oo1.DB();
  const ptr = sqlite3.wasm.allocFromTypedArray(bytes);
  const rc = sqlite3.capi.sqlite3_deserialize(
    handle.pointer!,
    "main",
    ptr,
    bytes.byteLength,
    bytes.byteLength,
    sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE | sqlite3.capi.SQLITE_DESERIALIZE_RESIZEABLE,
  );
  if (rc !== sqlite3.capi.SQLITE_OK) {
    sqlite3.wasm.dealloc(ptr);
    handle.close();
    throw new Error(`sqlite3_deserialize failed: rc=${rc}`);
  }
  return handle;
}

export async function query<T = Record<string, SqlValue>>(
  sql: string,
  params: SqlValue[] = [],
): Promise<T[]> {
  const d = await getDb();
  const rows: T[] = [];
  d.exec({
    sql,
    bind: params,
    rowMode: "object",
    callback: (row) => {
      rows.push(row as T);
    },
  });
  return rows;
}

export async function queryOne<T = Record<string, SqlValue>>(
  sql: string,
  params: SqlValue[] = [],
): Promise<T | undefined> {
  const rows = await query<T>(sql, params);
  return rows[0];
}
