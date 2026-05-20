import { describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { canonicaliseStatTypes } from "$pipeline/entities/stat-type/canonicaliser";
import { STAT_TYPE_DDL } from "$pipeline/sql/stat-type-ddl";

const strengthId = "4ed202185a05d98439595e3fcab021c8.11400000";

describe("canonicaliseStatTypes", () => {
  it("inserts one row per generic snapshot row", () => {
    const db = new Database(":memory:");
    db.exec(STAT_TYPE_DDL);

    canonicaliseStatTypes(db, {
      entityId: "stat-type",
      schemaVersion: 1,
      rows: [
        {
          id: strengthId,
          fields: {
            id: strengthId,
            isAttribute: true,
            statName: "Strength",
            iconRef: { kind: "missing", reason: "nullAsset", source: "StatType.icon" },
            iconColor: { r: 1, g: 0.6, b: 0.2, a: 1 },
            statDescription: "Raw power.",
            longStatDescription: "Raw power. Affects melee damage and carry weight.",
            affects: ["melee-damage"],
            skillAffects: ["heavy-armor", "blade"],
          },
        },
      ],
    });

    const row = db
      .query<
        {
          id: string;
          is_attribute: number;
          stat_name: string;
          icon_color_json: string | null;
          affects_json: string;
        },
        []
      >("SELECT id, is_attribute, stat_name, icon_color_json, affects_json FROM stat_types")
      .get();

    expect(row?.id).toBe(strengthId);
    expect(row?.is_attribute).toBe(1);
    expect(row?.stat_name).toBe("Strength");
    expect(JSON.parse(row?.icon_color_json ?? "null")).toEqual({ r: 1, g: 0.6, b: 0.2, a: 1 });
    expect(JSON.parse(row?.affects_json ?? "[]")).toEqual(["melee-damage"]);
  });
});
