import { describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { canonicaliseItemTags } from "$pipeline/entities/item-tag/canonicaliser";
import { ITEM_TAG_DDL } from "$pipeline/sql/item-tag-ddl";

describe("canonicaliseItemTags", () => {
  it("inserts one row per item-tag snapshot row", () => {
    const db = new Database(":memory:");
    db.exec(ITEM_TAG_DDL);

    canonicaliseItemTags(db, {
      entityId: "item-tag",
      schemaVersion: 1,
      rows: [
        {
          id: "tag-valuable-remedy",
          fields: {
            id: "tag-valuable-remedy",
            tagName: "Valuable remedy",
            description: "Incredibly valuable remedy",
          },
        },
      ],
    });

    const row = db
      .query<{ id: string; tag_name: string; description: string }, []>(
        "SELECT id, tag_name, description FROM item_tags",
      )
      .get();

    expect(row).toEqual({
      id: "tag-valuable-remedy",
      tag_name: "Valuable remedy",
      description: "Incredibly valuable remedy",
    });
  });
});
