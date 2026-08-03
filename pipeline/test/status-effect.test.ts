import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { canonicaliseStatusEffects } from "../src/entities/status-effect/canonicaliser.ts";
import { emitStatusEffectReadModels } from "../src/entities/status-effect/read-models.ts";
import { STATUS_EFFECT_DDL } from "../src/sql/status-effect-ddl.ts";

const bleedId = "deadbeef.status-bleed";
const namelessId = "cafebabe.status-unknown";

function seedStatusEffects(db: Database): void {
  db.exec(STATUS_EFFECT_DDL);
  canonicaliseStatusEffects(db, {
    entityId: "status-effect",
    schemaVersion: 1,
    rows: [
      {
        id: bleedId,
        fields: {
          id: bleedId,
          statusEffectName: "Bleeding",
          tooltipSource: "<color=#86FF86>Adds 1% Bleed Resistance</color>",
          iconRef: { kind: "engineResource", unityType: "UnityEngine.Sprite", name: "bleed" },
          isHostile: true,
        },
      },
      {
        id: namelessId,
        fields: {
          id: namelessId,
          statusEffectName: null,
          tooltipSource: null,
          iconRef: null,
          isHostile: false,
        },
      },
    ],
  });
}

describe("status-effect pipeline", () => {
  it("canonicalises status effects and emits GUID-derived public nodes", () => {
    const db = new Database(":memory:");
    seedStatusEffects(db);
    emitStatusEffectReadModels(db);

    const node = db
      .query<{ route_path: string; canonical_slug: string; short_id: string }, [string]>(
        `SELECT route_path, canonical_slug, short_id FROM entity_nodes
         WHERE entity_type = 'status-effect' AND entity_id = ?`,
      )
      .get(bleedId);
    expect(node).toEqual({
      route_path: "/status-effects/bleeding--deadbeef",
      canonical_slug: "bleeding--deadbeef",
      short_id: "deadbeef",
    });
  });

  it("translates tooltip text and keeps absent tooltip columns null", () => {
    const db = new Database(":memory:");
    seedStatusEffects(db);
    emitStatusEffectReadModels(db);

    const rows = db
      .query<
        { id: string; tooltip_source: string | null; tooltip_rich_text_json: string | null },
        []
      >(
        `SELECT id, tooltip_source, tooltip_rich_text_json
         FROM status_effect_presentation_rows ORDER BY id`,
      )
      .all();
    const bleed = rows.find((row) => row.id === bleedId);
    expect(bleed?.tooltip_source).toBe("<color=#86FF86>Adds 1% Bleed Resistance</color>");
    expect(JSON.parse(bleed?.tooltip_rich_text_json ?? "null").nodes[0]).toEqual({
      type: "color",
      token: null,
      color: "#86FF86",
      children: [{ type: "text", text: "Adds 1% Bleed Resistance" }],
    });
    expect(rows.find((row) => row.id === namelessId)).toMatchObject({
      tooltip_source: null,
      tooltip_rich_text_json: null,
    });
  });

  it("ships nameless status effects under a presentation label", () => {
    const db = new Database(":memory:");
    seedStatusEffects(db);
    expect(emitStatusEffectReadModels(db)).toEqual([]);

    const rows = db
      .query<{ name: string | null }, [string]>(
        `SELECT name FROM status_effect_overview_rows WHERE id = ?`,
      )
      .get(namelessId);
    expect(rows).toEqual({ name: "Unnamed status effect" });

    const presentation = db
      .query<{ name: string }, [string]>(
        `SELECT name FROM status_effect_presentation_rows WHERE id = ?`,
      )
      .get(namelessId);
    expect(presentation).toEqual({ name: "Unnamed status effect" });
  });

  it("treats a whitespace-only status effect name as unnamed", () => {
    const db = new Database(":memory:");
    seedStatusEffects(db);
    db.run(`UPDATE status_effects SET status_effect_name = ? WHERE id = ?`, [" \t ", namelessId]);

    expect(emitStatusEffectReadModels(db)).toEqual([]);
    expect(
      db.query(`SELECT name FROM status_effect_overview_rows WHERE id = ?`).get(namelessId),
    ).toEqual({
      name: "Unnamed status effect",
    });
    expect(
      db.query(`SELECT name FROM status_effect_presentation_rows WHERE id = ?`).get(namelessId),
    ).toEqual({ name: "Unnamed status effect" });
  });
});
