import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";

export interface DeployableSqliteValidation {
  ok: true;
}

export function validateDeployableSqlite(sqlitePath: string): DeployableSqliteValidation {
  const walPath = `${sqlitePath}-wal`;
  const shmPath = `${sqlitePath}-shm`;
  if (existsSync(walPath)) {
    throw new Error(`SQLite artifact has unexpected WAL sidecar: ${walPath}`);
  }
  if (existsSync(shmPath)) {
    throw new Error(`SQLite artifact has unexpected SHM sidecar: ${shmPath}`);
  }

  const db = new Database(sqlitePath, { readonly: true });
  try {
    const row = db.query("PRAGMA integrity_check").get() as { integrity_check: string } | null;
    if (row?.integrity_check !== "ok") {
      throw new Error(`SQLite integrity_check failed: ${row?.integrity_check ?? "no result"}`);
    }
  } finally {
    db.close();
  }

  return { ok: true };
}
