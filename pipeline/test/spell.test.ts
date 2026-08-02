import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { canonicaliseSpells } from "../src/entities/spell/canonicaliser.ts";
import { emitSpellReadModels } from "../src/entities/spell/read-models.ts";
import { ENTITY_GRAPH_DDL } from "../src/relationships/relationship-graph.ts";
import { SPELL_DDL } from "../src/sql/spell-ddl.ts";

const spellId = "named;spell;spell_fire-shield";
const namelessSpellId = "named;spell;spell_brawler-fists";
const schoolId = "named;stat-type;Destruction";
const schoolRef = { kind: "namedAsset", entity: "stat-type", name: "Destruction" };

function seedSpell(db: Database, statTypeRef: unknown = schoolRef): void {
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

function seedPublicSchool(db: Database): void {
  db.exec(ENTITY_GRAPH_DDL);
  db.prepare(
    `INSERT INTO entity_nodes (
       entity_type, entity_id, label, route_path, canonical_slug, short_id, is_public
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    "stat-type",
    schoolId,
    "Destruction",
    "/stats/destruction--destruction",
    "destruction--destruction",
    "destruction",
    1,
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
      stat_type_ref_json: JSON.stringify(schoolRef),
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

  it("emits a casts_school edge to a public stat type", () => {
    const db = new Database(":memory:");
    seedSpell(db);
    seedPublicSchool(db);

    expect(emitSpellReadModels(db)).toEqual([]);
    const edge = db
      .query<{ source_id: string; target_id: string; predicate: string }, []>(
        `SELECT source_id, target_id, predicate FROM entity_edges WHERE source_type = 'spell'`,
      )
      .get();
    expect(edge).toEqual({ source_id: spellId, target_id: schoolId, predicate: "casts_school" });
  });

  it("diagnoses a missing public stat type without writing an edge", () => {
    const db = new Database(":memory:");
    seedSpell(db);

    const diagnostics = emitSpellReadModels(db);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.code).toBe("spellSchoolUnresolved");
    expect(diagnostics[0]?.severity).toBe("diagnostic");
    expect(db.query(`SELECT COUNT(*) AS count FROM entity_edges`).get()).toEqual({ count: 0 });
  });
});
