export const CHARACTER_DDL = `
CREATE TABLE characters (
  id              TEXT PRIMARY KEY,
  character_name  TEXT,
  drop_refs_json  TEXT NOT NULL
);
`;
