export const SPELL_DDL = `
CREATE TABLE spells (
  id              TEXT PRIMARY KEY,
  spell_name      TEXT,
  stat_type_ref_json TEXT,
  mana_cost       REAL,
  is_illegal      INTEGER,
  tooltip_source  TEXT,
  icon_ref_json   TEXT
);
`;
