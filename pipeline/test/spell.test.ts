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
  db.exec(`CREATE TABLE asset_refs (
    entity_id TEXT NOT NULL,
    entity_row_id TEXT NOT NULL,
    slot TEXT NOT NULL,
    asset_kind TEXT NOT NULL,
    asset_hash TEXT NOT NULL,
    PRIMARY KEY (entity_id, entity_row_id, slot)
  );`);
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
  db.run(
    `INSERT INTO asset_refs (entity_id, entity_row_id, slot, asset_kind, asset_hash)
     VALUES (?, ?, ?, ?, ?)`,
    ["spell", spellId, "iconRef", "image", "e".repeat(64)],
  );
}

function seedNamelessSpell(db: Database): void {
  db.exec(SPELL_DDL);
  db.exec(`CREATE TABLE asset_refs (
    entity_id TEXT NOT NULL,
    entity_row_id TEXT NOT NULL,
    slot TEXT NOT NULL,
    asset_kind TEXT NOT NULL,
    asset_hash TEXT NOT NULL,
    PRIMARY KEY (entity_id, entity_row_id, slot)
  );`);
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

function seedPageStat(db: Database, grouping: "attribute" | "skill" = "skill"): void {
  db.exec(ENTITY_GRAPH_DDL);
  db.exec(`CREATE TABLE stat_type_overview_rows (id TEXT PRIMARY KEY, grouping TEXT NOT NULL);`);
  db.prepare(
    `INSERT INTO entity_nodes (
       entity_type, entity_id, label, display_label, route_path, canonical_slug, short_id, has_page
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    "stat-type",
    skillId,
    "Destruction",
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

  it("canonicalises effects with ordinal keys and preserves status fields", () => {
    const db = new Database(":memory:");
    db.exec(SPELL_DDL);
    const statusRef = {
      kind: "lookupAsset",
      guid: "91a00002.fixture-status-effect-burning",
    } as const;
    canonicaliseSpells(db, {
      entityId: "spell",
      schemaVersion: 1,
      rows: [
        {
          id: spellId,
          fields: {
            id: spellId,
            spellName: "Fire Shield",
            spellEffects: [
              {
                kind: "apply-status-to-self",
                statusEffectRef: statusRef,
                sampleLevel: 1.25,
                sampleLifetimeSeconds: 6,
                appliesToSelf: true,
              },
              { kind: "projectile", damage: 7, damageType: "Fire" },
            ],
          },
        },
      ],
    });
    expect(
      db
        .query<
          {
            id: string;
            spell_id: string;
            effect_ordinal: number;
            kind: string;
            level: number | null;
            lifetime: number | null;
            applies_to_self: number | null;
            damage: number | null;
          },
          []
        >(
          `SELECT id, spell_id, effect_ordinal, kind, level, lifetime, applies_to_self, damage
           FROM spell_effects ORDER BY effect_ordinal`,
        )
        .all(),
    ).toEqual([
      {
        id: `${spellId}:effect:0`,
        spell_id: spellId,
        effect_ordinal: 0,
        kind: "apply-status-to-self",
        level: 1.25,
        lifetime: 6,
        applies_to_self: 1,
        damage: null,
      },
      {
        id: `${spellId}:effect:1`,
        spell_id: spellId,
        effect_ordinal: 1,
        kind: "projectile",
        level: null,
        lifetime: null,
        applies_to_self: null,
        damage: 7,
      },
    ]);
  });

  it("emits spell applies edges with spell effect evidence", () => {
    const db = new Database(":memory:");
    db.exec(SPELL_DDL);
    db.exec(`CREATE TABLE asset_refs (
      entity_id TEXT NOT NULL,
      entity_row_id TEXT NOT NULL,
      slot TEXT NOT NULL,
      asset_kind TEXT NOT NULL,
      asset_hash TEXT NOT NULL,
      PRIMARY KEY (entity_id, entity_row_id, slot)
    );`);
    db.exec(`CREATE TABLE status_effects (id TEXT PRIMARY KEY, status_effect_name TEXT);`);
    db.prepare(`INSERT INTO status_effects (id, status_effect_name) VALUES (?, ?)`).run(
      "91a00002.fixture-status-effect-burning",
      "Burning",
    );
    db.exec(ENTITY_GRAPH_DDL);
    db.prepare(
      `INSERT INTO entity_nodes (
         entity_type, entity_id, label, display_label, route_path, canonical_slug, short_id, has_page
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    ).run(
      "status-effect",
      "91a00002.fixture-status-effect-burning",
      "Burning",
      "Burning",
      "/status-effects/burning--91a00002",
      "burning--91a00002",
      "91a00002",
    );
    canonicaliseSpells(db, {
      entityId: "spell",
      schemaVersion: 1,
      rows: [
        {
          id: spellId,
          fields: {
            id: spellId,
            spellName: "Fire Shield",
            spellEffects: [
              {
                kind: "apply-status-to-self",
                statusEffectRef: {
                  kind: "lookupAsset",
                  guid: "91a00002.fixture-status-effect-burning",
                },
                sampleLevel: 1.25,
                sampleLifetimeSeconds: 6,
                appliesToSelf: true,
              },
            ],
          },
        },
      ],
    });
    const diagnostics = emitSpellReadModels(db);
    expect(diagnostics).toEqual([]);
    const edge = db
      .query<{ evidence_json: string; predicate: string }, []>(
        `SELECT evidence_json, predicate FROM entity_edges WHERE source_type = 'spell' AND predicate = 'applies'`,
      )
      .get();
    expect(edge?.predicate).toBe("applies");
    expect(JSON.parse(edge?.evidence_json ?? "{}")).toEqual({
      source: "spells.spellEffects",
      level: 1.25,
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
    expect(emitSpellReadModels(db)).toEqual([]);

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
      route_path: "/spells/unnamed-spell--5df12e13",
      canonical_slug: "unnamed-spell--5df12e13",
    });
  });
  it("resolves an exported spell icon hash", () => {
    const db = new Database(":memory:");
    seedSpell(db);
    seedPageStat(db);
    expect(emitSpellReadModels(db)).toEqual([]);

    expect(
      db.query(`SELECT display_icon_hash FROM spell_presentation_rows WHERE id = ?`).get(spellId),
    ).toEqual({ display_icon_hash: "e".repeat(64) });
  });

  it("diagnoses an authored spell icon without an exported asset", () => {
    const db = new Database(":memory:");
    seedSpell(db);
    seedPageStat(db);
    db.run(`DELETE FROM asset_refs WHERE entity_id = 'spell' AND entity_row_id = ?`, [spellId]);

    const diagnostics = emitSpellReadModels(db);
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "spellIconUnresolved",
        entityType: "spell",
        entityId: spellId,
      }),
    );
    expect(
      db.query(`SELECT display_icon_hash FROM spell_presentation_rows WHERE id = ?`).get(spellId),
    ).toEqual({ display_icon_hash: null });
  });
  it("treats a whitespace-only spell name as unnamed", () => {
    const db = new Database(":memory:");
    seedNamelessSpell(db);
    db.run(`UPDATE spells SET spell_name = ? WHERE id = ?`, [" \t ", namelessSpellId]);

    expect(emitSpellReadModels(db)).toEqual([]);
    expect(db.query(`SELECT name FROM spell_overview_rows`).get()).toEqual({
      name: "Unnamed spell",
    });
    expect(db.query(`SELECT name FROM spell_presentation_rows`).get()).toEqual({
      name: "Unnamed spell",
    });
  });

  it("emits a page node with a named-asset route and short id", () => {
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
      route_path: "/spells/fire-shield--dc85a4a0",
      canonical_slug: "fire-shield--dc85a4a0",
      short_id: "dc85a4a0",
    });
  });

  it("emits a scales_with edge to a stat type with a page", () => {
    const db = new Database(":memory:");
    seedSpell(db);
    seedPageStat(db);

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
    seedPageStat(db, "attribute");

    expect(emitSpellReadModels(db)).toEqual([]);
    const edge = db
      .query<{ label: string }, []>(
        `SELECT label FROM entity_edges WHERE source_type = 'spell' AND predicate = 'scales_with'`,
      )
      .get();
    expect(edge).toEqual({ label: "Scales with attribute" });
  });

  it("translates tooltip source and rich text", () => {
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
    db.exec(`CREATE TABLE asset_refs (
    entity_id TEXT NOT NULL,
    entity_row_id TEXT NOT NULL,
    slot TEXT NOT NULL,
    asset_kind TEXT NOT NULL,
    asset_hash TEXT NOT NULL,
    PRIMARY KEY (entity_id, entity_row_id, slot)
  );`);
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

  it("diagnoses a missing stat type with a page without writing an edge", () => {
    const db = new Database(":memory:");
    seedSpell(db);

    const diagnostics = emitSpellReadModels(db);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.code).toBe("spellSkillUnresolved");
    expect(diagnostics[0]?.severity).toBe("diagnostic");
    expect(db.query(`SELECT COUNT(*) AS count FROM entity_edges`).get()).toEqual({ count: 0 });
  });

  it("writes an empty effects list for a spell with no effects", () => {
    const db = new Database(":memory:");
    seedNamelessSpell(db);
    emitSpellReadModels(db);
    const row = db
      .query<{ effects_json: string }, [string]>(
        `SELECT effects_json FROM spell_presentation_rows WHERE id = ?`,
      )
      .get(namelessSpellId);
    expect(row).toEqual({ effects_json: "[]" });
  });
});
