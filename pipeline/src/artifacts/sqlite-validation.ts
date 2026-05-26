import { Database } from "bun:sqlite";
import { existsSync, renameSync, rmSync } from "node:fs";

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

/**
 * Atomically publish a deployable SQLite artifact. Validates `tempPath` for
 * sidecars and integrity before performing the atomic `rename` to
 * `outputPath`. On validation failure, removes `tempPath` and any leftover
 * `-wal`/`-shm` sidecars so the publish path is never reached.
 *
 * This shape preserves the no-partial-artifact guarantee: any error thrown
 * by this function leaves no file at `outputPath`.
 */
export function publishValidatedSqlite(tempPath: string, outputPath: string): void {
  try {
    validateDeployableSqlite(tempPath);
  } catch (error) {
    rmSync(tempPath, { force: true });
    rmSync(`${tempPath}-wal`, { force: true });
    rmSync(`${tempPath}-shm`, { force: true });
    throw error;
  }
  renameSync(tempPath, outputPath);
}
