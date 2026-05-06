import { describe, it, expect } from "bun:test";
import fc from "fast-check";
import { Database } from "bun:sqlite";
import { buildDDL } from "$pipeline/sql/ddl";
import { canonicaliseItems } from "$pipeline/entities/item/canonicaliser";
import { loadDescriptors } from "$pipeline/stages/load-descriptors";
import type { SnapshotEnvelope } from "$pipeline/types";

const ctx = { workspaceRoot: ".", snapshotDir: "", outDir: ".", log: () => undefined };

function arbItem(variantPicker: () => string) {
  return fc.record({
    id: fc.uuid(),
    variant: fc.constant(variantPicker()),
    name: fc.string({ minLength: 1, maxLength: 64 }),
    weight: fc.float({ min: 0, max: 1000, noNaN: true }),
    value: fc.integer({ min: 0, max: 10000 }),
    description: fc.string({ maxLength: 200 }),
    equipSlot: fc.constantFrom("Weapon", "AltWeapon", "ChestArmor", "HeadArmor"),
    animationSpeedMultiplier: fc.float({ min: 0, max: 3, noNaN: true }),
    twoHanded: fc.boolean(),
    damage: fc.float({ min: 0, max: 100, noNaN: true }),
    criticalHitChance: fc.float({ min: 0, max: 1, noNaN: true }),
    meleeDurabilityMax: fc.integer({ min: 1, max: 1000 }),
    canBlock: fc.boolean(),
    armorRating: fc.float({ min: 0, max: 100, noNaN: true }),
    armorDurabilityMax: fc.integer({ min: 1, max: 1000 }),
    coverageSlot: fc.constantFrom("ChestArmor", "HeadArmor", "LegsArmor", "FeetArmor"),
  });
}

describe("item canonical invariants", () => {
  it("every item has exactly one items row", async () => {
    const desc = await loadDescriptors.run({}, ctx);
    const itemEntity = desc.entities.item;
    const itemVariants = desc.variants.item;
    if (!itemEntity || !itemVariants) throw new Error("fixture missing item descriptor");
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          arbItem(() => "melee-weapon"),
          { minLength: 1, maxLength: 50 },
        ),
        async (items) => {
          const db = new Database(":memory:");
          db.exec(buildDDL(itemEntity, itemVariants));
          const env: SnapshotEnvelope = {
            entityId: "item",
            schemaVersion: 1,
            rows: items.map((i) => ({
              id: i.id,
              variant: i.variant,
              fields: { ...i, iconRef: { kind: "missing", reason: "test", source: "test" } },
            })),
          };
          canonicaliseItems(db, itemEntity, itemVariants, env);
          const counts = db.query("SELECT id, COUNT(*) c FROM items GROUP BY id").all() as {
            id: string;
            c: number;
          }[];
          expect(counts.every((r) => r.c === 1)).toBe(true);
        },
      ),
      { numRuns: 50 },
    );
  });

  it("variant ancestry has no orphans", async () => {
    const desc = await loadDescriptors.run({}, ctx);
    const itemEntity = desc.entities.item;
    const itemVariants = desc.variants.item;
    if (!itemEntity || !itemVariants) throw new Error("fixture missing item descriptor");
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          arbItem(() => "melee-weapon"),
          { minLength: 1, maxLength: 30 },
        ),
        async (items) => {
          const db = new Database(":memory:");
          db.exec(buildDDL(itemEntity, itemVariants));
          const env: SnapshotEnvelope = {
            entityId: "item",
            schemaVersion: 1,
            rows: items.map((i) => ({
              id: i.id,
              variant: i.variant,
              fields: { ...i, iconRef: { kind: "missing", reason: "test", source: "test" } },
            })),
          };
          canonicaliseItems(db, itemEntity, itemVariants, env);
          // every melee row has matching primary_hand, hand, equipment, items rows
          const orphans = db
            .query(
              `
            SELECT mw.id FROM item_melee_weapons mw
            LEFT JOIN item_primary_hand_items ph ON ph.id = mw.id
            LEFT JOIN item_hand_items         h  ON h.id  = mw.id
            LEFT JOIN item_equipment          e  ON e.id  = mw.id
            LEFT JOIN items                   i  ON i.id  = mw.id
            WHERE ph.id IS NULL OR h.id IS NULL OR e.id IS NULL OR i.id IS NULL
          `,
            )
            .all();
          expect(orphans).toEqual([]);
        },
      ),
      { numRuns: 30 },
    );
  });
});
