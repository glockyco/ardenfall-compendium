export const PORTAL_DDL = `
CREATE TABLE portals (
  id                         TEXT PRIMARY KEY NOT NULL,
  record_ref_json            TEXT NOT NULL,
  friendly_name              TEXT,
  map_id                     TEXT,
  source_position_json       TEXT NOT NULL,
  connected_portal_ref_json  TEXT
);
CREATE TABLE portal_presentation_rows (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  render_context        TEXT NOT NULL,
  map_id                TEXT,
  map_x                 REAL,
  map_y                 REAL,
  elevation             REAL,
  connected_portal_id   TEXT,
  connected_portal_name TEXT
);
`;
