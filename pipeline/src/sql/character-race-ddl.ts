export const CHARACTER_RACE_DDL = `
CREATE TABLE character_races (
  id                TEXT PRIMARY KEY NOT NULL,
  race_name         TEXT,
  name_set_refs_json TEXT NOT NULL
);
`;
