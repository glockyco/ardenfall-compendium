export const QUEST_DDL = `
CREATE TABLE quests (
  id                           TEXT PRIMARY KEY NOT NULL,
  quest_game_id                TEXT NOT NULL,
  name                         TEXT,
  subname                      TEXT,
  disabled                     INTEGER NOT NULL,
  hidden_in_quest_ui           INTEGER NOT NULL,
  journal_on_start             TEXT,
  journal_on_succeed           TEXT,
  journal_on_failure           TEXT,
  required_character_refs_json TEXT
);
CREATE TABLE quest_phases (
  id                      TEXT PRIMARY KEY NOT NULL,
  quest_id                TEXT NOT NULL REFERENCES quests(id),
  phase_ordinal            INTEGER NOT NULL,
  phase_game_id            INTEGER NOT NULL,
  name                    TEXT,
  journal_entry           TEXT,
  completed_journal_entry TEXT,
  UNIQUE(quest_id, phase_ordinal)
);
CREATE TABLE quest_objectives (
  id                      TEXT PRIMARY KEY NOT NULL,
  quest_id                TEXT NOT NULL REFERENCES quests(id),
  phase_ordinal            INTEGER NOT NULL,
  objective_ordinal        INTEGER NOT NULL,
  objective_game_id        INTEGER NOT NULL,
  name                    TEXT,
  info                    TEXT,
  journal_entry           TEXT,
  success_journal_entry   TEXT,
  failure_journal_entry   TEXT,
  objective_type          TEXT NOT NULL,
  hidden                  INTEGER NOT NULL,
  attached_object_game_id INTEGER,
  enable_map_marker       INTEGER NOT NULL,
  UNIQUE(quest_id, phase_ordinal, objective_ordinal)
);
CREATE TABLE quest_characters (
  id                 TEXT PRIMARY KEY NOT NULL,
  quest_id           TEXT NOT NULL REFERENCES quests(id),
  object_ordinal     INTEGER NOT NULL,
  object_game_id     INTEGER NOT NULL,
  object_name        TEXT,
  category           TEXT,
  character_ref_json TEXT NOT NULL,
  UNIQUE(quest_id, object_ordinal)
);
-- A quest owns the dialogue it attaches to one of its character objects, so this
-- keys on that object exactly as quest_objectives keys on its phase. The character
-- alone is not the owner: the same character speaks different lines for different
-- quests. Resolving the object to a character page is a mapping concern and happens
-- in the after-map phase, not here.
CREATE TABLE quest_character_dialogue (
  id             TEXT PRIMARY KEY NOT NULL,
  quest_id       TEXT NOT NULL REFERENCES quests(id),
  object_ordinal INTEGER NOT NULL,
  line_ordinal   INTEGER NOT NULL,
  kind           TEXT NOT NULL,
  text           TEXT NOT NULL,
  importance     INTEGER NOT NULL,
  UNIQUE(quest_id, object_ordinal, line_ordinal)
);
CREATE TABLE quest_journal_entries (
  id             TEXT PRIMARY KEY NOT NULL,
  quest_id       TEXT NOT NULL REFERENCES quests(id),
  object_ordinal INTEGER NOT NULL,
  object_game_id INTEGER NOT NULL,
  object_name    TEXT,
  journal_entry  TEXT,
  UNIQUE(quest_id, object_ordinal)
);
CREATE TABLE quest_rewards (
  id                    TEXT PRIMARY KEY NOT NULL,
  quest_id              TEXT NOT NULL REFERENCES quests(id),
  set_ordinal           INTEGER NOT NULL,
  set_game_id           INTEGER NOT NULL,
  set_name              TEXT,
  set_type              TEXT NOT NULL,
  reward_ordinal        INTEGER NOT NULL,
  kind                  TEXT NOT NULL,
  is_positive           INTEGER,
  amount_label          TEXT,
  custom_amount          INTEGER,
  faction_ref_json      TEXT,
  items_json            TEXT,
  item_list_refs_json   TEXT,
  target_object_game_id INTEGER,
  UNIQUE(quest_id, set_ordinal, reward_ordinal)
);
`;
