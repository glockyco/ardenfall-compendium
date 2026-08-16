export const CHARACTER_RACE_DDL = `
CREATE TABLE character_races (
  id                TEXT PRIMARY KEY NOT NULL,
  race_name         TEXT,
  name_set_refs_json TEXT NOT NULL,
  parent_ref_json   TEXT
);
CREATE TABLE character_race_value_provenance (
  id         TEXT PRIMARY KEY,
  race_id    TEXT NOT NULL,
  field_name TEXT NOT NULL,
  provenance TEXT NOT NULL,
  owner      TEXT
);
`;
