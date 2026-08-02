export const PORTAL_DDL = `
CREATE TABLE portals (
  id                         TEXT PRIMARY KEY,
  record_ref_json            TEXT NOT NULL,
  name                       TEXT NOT NULL,
  is_accessible              INTEGER NOT NULL,
  map_id                     TEXT,
  source_position_json       TEXT NOT NULL,
  connected_portal_ref_json  TEXT
);
`;
