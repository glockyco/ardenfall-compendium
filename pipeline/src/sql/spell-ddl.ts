export const SPELL_DDL = `
CREATE TABLE spells (
  id              TEXT PRIMARY KEY NOT NULL,
  spell_name      TEXT,
  stat_type_ref_json TEXT,
  mana_cost       REAL,
  is_illegal      INTEGER,
  tooltip_source  TEXT,
  icon_ref_json   TEXT
);
CREATE TABLE spell_effects (
  id                    TEXT PRIMARY KEY,
  spell_id              TEXT NOT NULL REFERENCES spells(id),
  effect_ordinal        INTEGER NOT NULL,
  kind                  TEXT NOT NULL,
  status_effect_ref_json TEXT,
  level                 REAL,
  lifetime              REAL,
  applies_to_self       INTEGER,
  damage                REAL,
  damage_type           TEXT,
  UNIQUE(spell_id, effect_ordinal)
);
`;
