import { describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { canonicaliseItemCategories } from "$pipeline/entities/item-category/canonicaliser";
import { ITEM_CATEGORY_DDL } from "$pipeline/sql/item-category-ddl";

const color = { r: 0.92, g: 0.42, b: 0.42, a: 1 };
const columns = [
  {
    label: "Name",
    iconRef: null,
    preferedWidth: 1.5,
    flexibleWidth: 2,
    itemName: true,
    isItemIconAndCategory: true,
    itemValue: false,
    isAffectedBySkillRequirement: false,
    isAffectedByBrokenDurability: false,
    affectingRedColor: true,
    affectingIconsAfter: false,
    hideIfNegativeOne: false,
    alignment: "MiddleLeft",
    itemDataField: null,
    itemFunctionField: null,
  },
];

describe("canonicaliseItemCategories", () => {
  it("inserts one row per item-category snapshot row", () => {
    const db = new Database(":memory:");
    db.exec(ITEM_CATEGORY_DDL);

    canonicaliseItemCategories(db, {
      entityId: "item-category",
      schemaVersion: 1,
      rows: [
        {
          id: "ca7e60a1.category-weapons",
          fields: {
            id: "ca7e60a1.category-weapons",
            categoryName: "Weapons",
            iconRef: { kind: "lookupAsset", guid: "icon-guid" },
            defaultItemIconRef: { kind: "lookupAsset", guid: "default-icon-guid" },
            categoryColor: color,
            showInAllCategory: true,
            columns,
          },
        },
      ],
    });

    const row = db
      .query<
        {
          id: string;
          category_name: string;
          icon_ref_json: string | null;
          default_item_icon_ref_json: string | null;
          category_color_json: string;
          show_in_all_category: number;
          columns_json: string;
        },
        []
      >("SELECT * FROM item_categories")
      .get();

    expect(row?.id).toBe("ca7e60a1.category-weapons");
    expect(row?.category_name).toBe("Weapons");
    expect(JSON.parse(row?.icon_ref_json ?? "null")).toEqual({
      kind: "lookupAsset",
      guid: "icon-guid",
    });
    expect(JSON.parse(row?.default_item_icon_ref_json ?? "null")).toEqual({
      kind: "lookupAsset",
      guid: "default-icon-guid",
    });
    expect(JSON.parse(row?.category_color_json ?? "null")).toEqual(color);
    expect(row?.show_in_all_category).toBe(1);
    expect(JSON.parse(row?.columns_json ?? "[]")).toEqual(columns);
  });
});
