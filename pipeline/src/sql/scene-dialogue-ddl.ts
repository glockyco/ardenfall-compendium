export const SCENE_DIALOGUE_DDL = `
-- Where a scene lets a reader start one conversation. The conversation itself is a dialogue row:
-- the same graph is reachable from a character definition or a quest, and it is one conversation.
CREATE TABLE scene_dialogue (
  id              TEXT PRIMARY KEY NOT NULL,
  dialogue_id     TEXT NOT NULL,
  graph_name      TEXT NOT NULL,
  placements_json TEXT NOT NULL
);
CREATE TABLE scene_dialogue_placements (
  id                   TEXT PRIMARY KEY NOT NULL,
  scene_dialogue_id    TEXT NOT NULL REFERENCES scene_dialogue(id),
  placement_ordinal    INTEGER NOT NULL,
  cell                 TEXT NOT NULL,
  map_id               TEXT,
  speaker_name         TEXT,
  interaction_text     TEXT,
  source_position_json TEXT NOT NULL,
  UNIQUE(scene_dialogue_id, placement_ordinal)
);
-- The reader-facing copy. The prose lives with the conversation, so this carries the places.
CREATE TABLE scene_dialogue_presentation_rows (
  id                  TEXT PRIMARY KEY,
  render_context      TEXT NOT NULL,
  dialogue_id         TEXT NOT NULL,
  dialogue_label      TEXT NOT NULL,
  dialogue_route_path TEXT,
  graph_name          TEXT NOT NULL,
  placement_count     INTEGER NOT NULL,
  placements_json     TEXT NOT NULL
);
`;
