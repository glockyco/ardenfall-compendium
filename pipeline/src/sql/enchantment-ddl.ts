export const ENCHANTMENT_DDL = `
CREATE TABLE enchantments (
  id                    TEXT PRIMARY KEY NOT NULL,
  enchantment_name      TEXT,
  money_value           REAL,
  hide_effect_tooltips  INTEGER
);
CREATE TABLE enchantment_items (
  id                    TEXT PRIMARY KEY,
  enchantment_id        TEXT NOT NULL REFERENCES enchantments(id),
  item_ordinal          INTEGER NOT NULL,
  item_ref_json         TEXT NOT NULL,
  UNIQUE(enchantment_id, item_ordinal)
);
CREATE TABLE enchantment_effects (
  id                    TEXT PRIMARY KEY,
  enchantment_id       TEXT NOT NULL REFERENCES enchantments(id),
  effect_ordinal       INTEGER NOT NULL,
  kind                 TEXT NOT NULL,
  status_effect_ref_json TEXT,
  UNIQUE(enchantment_id, effect_ordinal)
);
`;
