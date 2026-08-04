export const CHARACTER_DDL = `
CREATE TABLE characters (
  id              TEXT PRIMARY KEY NOT NULL,
  character_name  TEXT,
  parent_ref_json TEXT NOT NULL,
  drop_refs_json  TEXT NOT NULL
);
CREATE TABLE character_faction_refs (
  id                TEXT NOT NULL PRIMARY KEY,
  character_id      TEXT NOT NULL,
  target_faction_id TEXT,
  ref_json          TEXT NOT NULL
);
`;
