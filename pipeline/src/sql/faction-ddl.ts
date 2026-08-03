export const FACTION_DDL = `
CREATE TABLE factions (
  id                   TEXT NOT NULL PRIMARY KEY,
  name                 TEXT,
  faction_id           TEXT,
  description          TEXT,
  icon_ref_json        TEXT,
  alliable             INTEGER NOT NULL,
  enable_reputation    INTEGER NOT NULL,
  always_show_in_ui    INTEGER NOT NULL,
  can_be_disguised     INTEGER NOT NULL,
  enable_bounty        INTEGER NOT NULL
);
CREATE TABLE faction_relationships (
  id                  TEXT NOT NULL PRIMARY KEY,
  source_faction_id   TEXT NOT NULL,
  target_faction_id   TEXT,
  relationship        INTEGER NOT NULL,
  is_enemy            INTEGER NOT NULL
);
`;
