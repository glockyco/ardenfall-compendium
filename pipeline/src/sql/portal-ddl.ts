export const PORTAL_DDL = `
CREATE TABLE portals (
  id                         TEXT PRIMARY KEY,
  record_ref_json            TEXT NOT NULL,
  name                       TEXT,
  map_id                     TEXT,
  source_position_json       TEXT NOT NULL,
  connected_portal_ref_json  TEXT
);
`;
