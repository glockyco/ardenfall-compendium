export const NAME_SET_DDL = `
CREATE TABLE name_sets (
  id               TEXT PRIMARY KEY NOT NULL,
  seeds_json       TEXT NOT NULL,
  generation_order INTEGER NOT NULL
);
`;
