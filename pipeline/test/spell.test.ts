import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { canonicaliseSpells } from "../src/entities/spell/canonicaliser.ts";
import { emitSpellReadModels } from "../src/entities/spell/read-models.ts";
import { ENTITY_GRAPH_DDL } from "../src/relationships/relationship-graph.ts";
import { SPELL_DDL } from "../src/sql/spell-ddl.ts";

const spellId = "named;spell;spell_fire-shield";
const namelessSpellId = "named;spell;spell_brawler-fists";
const skillId = "named;stat-type;Destruction";
const skillRef = { kind: "namedAsset", entity: "stat-type", name: "Destruction" };

function seedSpell(db: Database, statTypeRef: unknown = skillRef): void {
  db.exec(SPELL_DDL);
  canonicaliseSpells(db, {
    entityId: "spell",
    schemaVersion: 1,
    rows: [
      {
        id: spellId,
        fields: {
          id: spellId,
          spellName: "Fire Shield",
          statTypeRef,
          manaCost: 12.5,
          isIllegal: false,
          tooltipSource: "<color=#86FF86>Protects target</color>",
          iconRef: { kind: "engineResource", unityType: "UnityEngine.Sprite", name: "fire" },
        },
      },
    ],
  });
}

function seedNamelessSpell(db: Database): void {
  db.exec(SPELL_DDL);
  canonicaliseSpells(db, {
    entityId: "spell",
    schemaVersion: 1,
    rows: [
      {
        id: namelessSpellId,
        fields: {
          id: namelessSpellId,
          spellName: null,
          statTypeRef: null,
          manaCost: null,
          isIllegal: false,
          iconRef: null,
        },
      },
    ],
  });
}

function seedPublicStat(db: Database, grouping: "attribute" | "skill" = "skill"): void {
  db.exec(ENTITY_GRAPH_DDL);
  db.exec(`CREATE TABLE stat_type_overview_rows (id TEXT PRIMARY KEY, grouping TEXT NOT NULL);`);
  db.prepare(
    `INSERT INTO entity_nodes (
       entity_type, entity_id, label, route_path, canonical_slug, short_id, is_public
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    "stat-type",
    skillId,
    "Destruction",
    "/stats/destruction--destruction",
    "destruction--destruction",
    "destruction",
    1,
  );
  db.prepare(`INSERT INTO stat_type_overview_rows (id, grouping) VALUES (?, ?)`).run(
    skillId,
    grouping,
  );
}

describe("spell pipeline", () => {
  it("canonicalises spell rows and stores references as JSON", () => {
    const db = new Database(":memory:");
    seedSpell(db);

    const row = db
      .query<{ id: string; spell_name: string; stat_type_ref_json: string; mana_cost: number }, []>(
        `SELECT id, spell_name, stat_type_ref_json, mana_cost FROM spells`,
      )
      .get();
    expect(row).toEqual({
      id: spellId,
      spell_name: "Fire Shield",
      stat_type_ref_json: JSON.stringify(skillRef),
      mana_cost: 12.5,
    });
  });

  it("canonicalises a nameless spell with a null spell name", () => {
    const db = new Database(":memory:");
    seedNamelessSpell(db);

    const row = db
      .query<{ id: string; spell_name: string | null }, []>(`SELECT id, spell_name FROM spells`)
      .get();
    expect(row).toEqual({ id: namelessSpellId, spell_name: null });
  });

  it("uses a presentation label and usable slug for a nameless spell", () => {
    const db = new Database(":memory:");
    seedNamelessSpell(db);
    emitSpellReadModels(db);

    const overview = db
      .query<{ id: string; name: string }, [string]>(
        `SELECT id, name FROM spell_overview_rows WHERE id = ?`,
      )
      .get(namelessSpellId);
    expect(overview).toEqual({ id: namelessSpellId, name: "Unnamed spell" });

    const presentation = db
      .query<{ id: string; name: string }, [string]>(
        `SELECT id, name FROM spell_presentation_rows WHERE id = ?`,
      )
      .get(namelessSpellId);
    expect(presentation).toEqual({ id: namelessSpellId, name: "Unnamed spell" });

    const node = db
      .query<{ route_path: string; canonical_slug: string }, [string]>(
        `SELECT route_path, canonical_slug FROM entity_nodes
         WHERE entity_type = 'spell' AND entity_id = ?`,
      )
      .get(namelessSpellId);
    expect(node).toEqual({
      route_path: "/spells/unnamed-spell--spell-brawler-fists",
      canonical_slug: "unnamed-spell--spell-brawler-fists",
    });
  });
  it("emits a public node with a named-asset route and short id", () => {
    const db = new Database(":memory:");
    seedSpell(db);
    emitSpellReadModels(db);

    const node = db
      .query<{ route_path: string; canonical_slug: string; short_id: string }, [string]>(
        `SELECT route_path, canonical_slug, short_id FROM entity_nodes
         WHERE entity_type = 'spell' AND entity_id = ?`,
      )
      .get(spellId);
    expect(node).toEqual({
      route_path: "/spells/fire-shield--spell-fire-shield",
      canonical_slug: "fire-shield--spell-fire-shield",
      short_id: "spell-fire-shield",
    });
  });

  it("emits a scales_with edge to a public stat type", () => {
    const db = new Database(":memory:");
    seedSpell(db);
    seedPublicStat(db);

    expect(emitSpellReadModels(db)).toEqual([]);
    const edge = db
      .query<{ source_id: string; target_id: string; predicate: string; label: string }, []>(
        `SELECT source_id, target_id, predicate, label FROM entity_edges WHERE source_type = 'spell'`,
      )
      .get();
    expect(edge).toEqual({
      source_id: spellId,
      target_id: skillId,
      predicate: "scales_with",
      label: "Scales with skill",
    });
  });

  it("labels an attribute scaling edge as an attribute", () => {
    const db = new Database(":memory:");
    seedSpell(db);
    seedPublicStat(db, "attribute");

    expect(emitSpellReadModels(db)).toEqual([]);
    const edge = db
      .query<{ label: string }, []>(
        `SELECT label FROM entity_edges WHERE source_type = 'spell' AND predicate = 'scales_with'`,
      )
      .get();
    expect(edge).toEqual({ label: "Scales with attribute" });
  });

  const db = new Database(":memory:");
  seedSpell(db);
  emitSpellReadModels(db);

  const row = db
    .query<{ tooltip_source: string | null; tooltip_rich_text_json: string | null }, [string]>(
      `SELECT tooltip_source, tooltip_rich_text_json
         FROM spell_presentation_rows WHERE id = ?`,
    )
    .get(spellId);
  expect(row?.tooltip_source).toBe("<color=#86FF86>Protects target</color>");
  expect(JSON.parse(row?.tooltip_rich_text_json ?? "null").nodes).toEqual([
    {
      type: "color",
      token: null,
      color: "#86FF86",
      children: [{ type: "text", text: "Protects target" }],
    },
  ]);
});

it("keeps plain and absent tooltips distinguishable", () => {
  const db = new Database(":memory:");
  db.exec(SPELL_DDL);
  canonicaliseSpells(db, {
    entityId: "spell",
    schemaVersion: 1,
    rows: [
      {
        id: "named;spell;plain",
        fields: {
          id: "named;spell;plain",
          spellName: "Plain",
          tooltipSource: "No markup here",
        },
      },
      {
        id: "named;spell;missing",
        fields: {
          id: "named;spell;missing",
          spellName: "Missing",
          tooltipSource: null,
        },
      },
    ],
  });
  emitSpellReadModels(db);

  const rows = db
    .query<
      { id: string; tooltip_source: string | null; tooltip_rich_text_json: string | null },
      []
    >(
      `SELECT id, tooltip_source, tooltip_rich_text_json
         FROM spell_presentation_rows ORDER BY id`,
    )
    .all();
  const plain = rows.find((row) => row.id === "named;spell;plain");
  expect(plain?.tooltip_source).toBe("No markup here");
  expect(JSON.parse(plain?.tooltip_rich_text_json ?? "null").nodes).toEqual([
    { type: "text", text: "No markup here" },
  ]);
  expect(rows.find((row) => row.id === "named;spell;missing")).toEqual({
    id: "named;spell;missing",
    tooltip_source: null,
    tooltip_rich_text_json: null,
  });
});

it("diagnoses a missing public stat type without writing an edge", () => {
  const db = new Database(":memory:");
  seedSpell(db);

  const diagnostics = emitSpellReadModels(db);
  expect(diagnostics).toHaveLength(1);
  expect(diagnostics[0]?.code).toBe("spellSkillUnresolved");
  expect(diagnostics[0]?.severity).toBe("diagnostic");
  expect(db.query(`SELECT COUNT(*) AS count FROM entity_edges`).get()).toEqual({ count: 0 });
});
