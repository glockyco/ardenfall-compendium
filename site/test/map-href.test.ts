import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const withDatabase = async (
  callback: (mapHref: typeof import("../src/lib/server/map-href")) => void,
) => {
  const originalCwd = process.cwd();
  const root = mkdtempSync(join(tmpdir(), "ardenfall-site-map-href-"));
  mkdirSync(join(root, ".data"), { recursive: true });
  const db = new Database(join(root, ".data", "data.sqlite"));
  db.exec(`
    CREATE TABLE entity_nodes (
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      short_id TEXT NOT NULL,
      has_page INTEGER NOT NULL,
      PRIMARY KEY (entity_type, entity_id)
    );
    CREATE TABLE map_points (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      instance_id TEXT NOT NULL,
      map_id TEXT,
      enabled INTEGER NOT NULL
    );
    CREATE TABLE map_volumes (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      instance_id TEXT NOT NULL,
      map_id TEXT
    );
    INSERT INTO entity_nodes (entity_type, entity_id, short_id, has_page) VALUES
      ('location', 'location-point', 'locpoint', 1),
      ('location', 'location-volume', 'locvolume', 1),
      ('portal', 'portal-point', 'portalpoint', 1),
      ('npc', 'npc-point', 'npcpoint', 1),
      ('npc', 'npc-missing', 'npcmissing', 1);
    INSERT INTO map_points VALUES
      ('location-point:point', 'location', 'location-point', 'overworld', 1),
      ('portal-point:point', 'portal', 'portal-point', 'overworld', 1),
      ('npc-point:point', 'npc', 'npc-point', 'overworld', 1);
    INSERT INTO map_volumes VALUES
      ('location-point:volume', 'location', 'location-point', 'dungeon'),
      ('location-volume:volume', 'location', 'location-volume', 'dungeon');
  `);
  db.close();
  try {
    process.chdir(root);
    callback(await import("../src/lib/server/map-href"));
  } finally {
    process.chdir(originalCwd);
    rmSync(root, { recursive: true, force: true });
  }
};

describe("map href helper", () => {
  it("builds the map selection href for location, portal, and placed character pages", async () => {
    await withDatabase(({ getMapHref }) => {
      expect(getMapHref("location", "location-point")).toBe("/map?map=overworld&sel=locpoint");
      expect(getMapHref("portal", "portal-point")).toBe("/map?map=overworld&sel=portalpoint");
      expect(getMapHref("npc", "npc-point")).toBe("/map?map=overworld&sel=npcpoint");
    });
  });

  it("uses the volume map only when a location has no map point", async () => {
    await withDatabase(({ getMapHref }) => {
      expect(getMapHref("location", "location-volume")).toBe("/map?map=dungeon&sel=locvolume");
      expect(getMapHref("location", "location-point")).toBe("/map?map=overworld&sel=locpoint");
    });
  });

  it("returns no href when an entity has no map presence", async () => {
    await withDatabase(({ getMapHref }) => {
      expect(getMapHref("npc", "npc-missing")).toBeNull();
      expect(getMapHref("npc", "unknown")).toBeNull();
    });
  });
});
