export const SCENE_DIALOGUE_DDL = `
-- One authored dialogue, identified by the graph asset that holds it. The placements that start it
-- are rows of their own, because a graph the game places twice is one conversation.
CREATE TABLE scene_dialogue (
  id              TEXT PRIMARY KEY NOT NULL,
  graph_name      TEXT NOT NULL,
  lines_json      TEXT NOT NULL,
  placements_json TEXT NOT NULL
);
-- The placements again, one row each, the way quest phases sit beside quests.phases_json: the
-- canonical row carries what the walk harvested and this is the same canonicaliser's index of it,
-- which the map projection and the page read.
CREATE TABLE scene_dialogue_placements (
  id                   TEXT PRIMARY KEY NOT NULL,
  dialogue_id          TEXT NOT NULL REFERENCES scene_dialogue(id),
  placement_ordinal    INTEGER NOT NULL,
  cell                 TEXT NOT NULL,
  map_id               TEXT,
  speaker_name         TEXT,
  interaction_text     TEXT,
  source_position_json TEXT NOT NULL,
  UNIQUE(dialogue_id, placement_ordinal)
);
-- The reader-facing copy. Lines are rich text by the time they reach a page, so the translated
-- documents live here rather than being translated per request.
CREATE TABLE scene_dialogue_presentation_rows (
  id              TEXT PRIMARY KEY,
  render_context  TEXT NOT NULL,
  graph_name      TEXT NOT NULL,
  line_count      INTEGER NOT NULL,
  lines_json      TEXT NOT NULL,
  placement_count INTEGER NOT NULL,
  placements_json TEXT NOT NULL
);
`;
