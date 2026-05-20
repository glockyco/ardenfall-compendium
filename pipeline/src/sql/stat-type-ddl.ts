export const STAT_TYPE_DDL = `
CREATE TABLE stat_types (
  id                    TEXT PRIMARY KEY,
  is_attribute          INTEGER NOT NULL,
  stat_name             TEXT NOT NULL,
  icon_ref_json         TEXT,
  icon_color_json       TEXT,
  stat_description      TEXT,
  long_stat_description TEXT,
  affects_json          TEXT NOT NULL DEFAULT '[]',
  skill_affects_json    TEXT NOT NULL DEFAULT '[]'
);
`;
