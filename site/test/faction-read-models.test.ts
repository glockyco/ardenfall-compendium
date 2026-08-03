import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const seed = () => {
  const root = mkdtempSync(join(tmpdir(), "ardenfall-site-faction-models-"));
  mkdirSync(join(root, ".data"), { recursive: true });
  const db = new Database(join(root, ".data", "data.sqlite"));
  db.exec(`
    CREATE TABLE faction_overview_rows (
      id TEXT PRIMARY KEY,
      name TEXT,
      description TEXT NOT NULL
    );
    CREATE TABLE faction_presentation_rows (
      id TEXT PRIMARY KEY,
      name TEXT,
      render_context TEXT NOT NULL,
      description TEXT NOT NULL,
      display_icon_hash TEXT,
      alliable INTEGER NOT NULL,
      enable_reputation INTEGER NOT NULL,
      always_show_in_ui INTEGER NOT NULL,
      can_be_disguised INTEGER NOT NULL,
      enable_bounty INTEGER NOT NULL
    );
    CREATE TABLE entity_nodes (
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      label TEXT NOT NULL,
      route_path TEXT NOT NULL,
      canonical_slug TEXT NOT NULL,
      short_id TEXT NOT NULL,
      has_page INTEGER NOT NULL,
      PRIMARY KEY (entity_type, entity_id)
    );
    INSERT INTO faction_overview_rows VALUES
      ('faction-nameless', NULL, ''),
      ('faction-black-moth-a', 'Black Moth', 'A hidden order.'),
      ('faction-black-moth-b', 'Black Moth', 'A second order.');
    INSERT INTO faction_presentation_rows VALUES
      ('faction-nameless', NULL, 'faction-presentation-v1', '', NULL, 0, 1, 1, 0, 1),
      ('faction-black-moth-a', 'Black Moth', 'faction-presentation-v1', 'A hidden order.', 'faction-icon-hash', 1, 1, 0, 1, 0),
      ('faction-black-moth-b', 'Black Moth', 'faction-presentation-v1', 'A second order.', NULL, 1, 0, 1, 0, 0);
    INSERT INTO entity_nodes VALUES
      ('faction', 'faction-nameless', 'Unnamed faction', '/factions/unnamed-faction--aaaa1111', 'unnamed-faction--aaaa1111', 'aaaa1111', 1),
      ('faction', 'faction-black-moth-a', 'Black Moth', '/factions/black-moth--bbbb2222', 'black-moth--bbbb2222', 'bbbb2222', 1),
      ('faction', 'faction-black-moth-b', 'Black Moth', '/factions/black-moth--cccc3333', 'black-moth--cccc3333', 'cccc3333', 1);
  `);
  db.close();
  return root;
};

const withSeed = async (
  callback: (readModels: typeof import("../src/lib/server/read-models")) => void,
) => {
  const originalCwd = process.cwd();
  const root = seed();
  try {
    process.chdir(root);
    const readModels = await import("../src/lib/server/read-models");
    callback(readModels);
  } finally {
    process.chdir(originalCwd);
    rmSync(root, { recursive: true, force: true });
  }
};

describe("faction read-model accessors", () => {
  it("lists factions and disambiguates repeated names while naming missing entries", async () => {
    await withSeed((readModels) => {
      expect(readModels.listFactions()).toEqual([
        {
          id: "faction-nameless",
          name: null,
          displayName: "Unnamed faction",
          description: "",
          routePath: "/factions/unnamed-faction--aaaa1111",
        },
        {
          id: "faction-black-moth-a",
          name: "Black Moth",
          displayName: "Black Moth · bbbb2222",
          description: "A hidden order.",
          routePath: "/factions/black-moth--bbbb2222",
        },
        {
          id: "faction-black-moth-b",
          name: "Black Moth",
          displayName: "Black Moth · cccc3333",
          description: "A second order.",
          routePath: "/factions/black-moth--cccc3333",
        },
      ]);
    });
  });

  it("reads faction facts and returns undefined for an unknown slug", async () => {
    await withSeed((readModels) => {
      expect(readModels.getFactionPresentation("unnamed-faction--aaaa1111")).toEqual({
        id: "faction-nameless",
        name: null,
        renderContext: "faction-presentation-v1",
        displayName: "Unnamed faction",
        description: "",
        alliable: false,
        enableReputation: true,
        alwaysShowInUI: true,
        canBeDisguised: false,
        enableBounty: true,
        displayIconSrc: null,
        routePath: "/factions/unnamed-faction--aaaa1111",
      });
      expect(readModels.getFactionPresentation("black-moth--bbbb2222")).toEqual({
        id: "faction-black-moth-a",
        name: "Black Moth",
        renderContext: "faction-presentation-v1",
        displayName: "Black Moth",
        description: "A hidden order.",
        alliable: true,
        enableReputation: true,
        alwaysShowInUI: false,
        canBeDisguised: true,
        enableBounty: false,
        displayIconSrc: "/assets/faction-icon-hash.webp",
        routePath: "/factions/black-moth--bbbb2222",
      });
      expect(readModels.getFactionPresentation("missing--99999999")).toBeUndefined();
    });
  });
});
