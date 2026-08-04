import { describe, expect, it } from "bun:test";
import { effectRoleLabel } from "../src/lib/components/items/itemEffect";

describe("item effect role labels", () => {
  it("distinguishes a stave primary cast from its secondary cast", () => {
    const staveEffects = [
      { kind: "spell", source: "spellDataJson" },
      { kind: "spell", source: "secondarySpellDataJson" },
    ];

    expect(staveEffects.map((effect) => effectRoleLabel(effect.source, effect.kind))).toEqual([
      "Primary cast",
      "Secondary cast",
    ]);
  });

  it("labels the three status-effect mechanisms", () => {
    const effects = [
      { kind: "status-effect", source: "statusEffectsJson" },
      { kind: "status-effect", source: "areaOfEffectJson" },
      { kind: "status-effect", source: "bleedStatusEffectJson" },
    ];

    expect(effects.map((effect) => effectRoleLabel(effect.source, effect.kind))).toEqual([
      "Applies when consumed",
      "Applies where potion lands",
      "Weapon-inflicted bleed",
    ]);
  });

  it("falls back to the effect kind when the role is absent or unrecognised", () => {
    expect(effectRoleLabel(undefined, "spell")).toBe("Spell");
    expect(effectRoleLabel("futureEffectRole", "status-effect")).toBe("Status effect");
  });
});
