export const DIALOGUE_DDL = `
-- One authored conversation, identified by the dialogue graph asset that holds it. The JSON columns
-- are what the walk harvested; the tables below are this canonicaliser's index of the same fact, the
-- way quest phases sit beside quests.phases_json.
CREATE TABLE dialogues (
  id               TEXT PRIMARY KEY NOT NULL,
  graph_name       TEXT NOT NULL,
  nodes_json       TEXT NOT NULL,
  edges_json       TEXT NOT NULL,
  entry_nodes_json TEXT NOT NULL,
  holders_json     TEXT NOT NULL
);
-- A node a reader cares about. Routing nodes never reach this table: the walk joins their edges.
CREATE TABLE dialogue_nodes (
  id             TEXT PRIMARY KEY NOT NULL,
  dialogue_id    TEXT NOT NULL REFERENCES dialogues(id),
  node_id        INTEGER NOT NULL,
  role           TEXT NOT NULL,
  authored_type  TEXT NOT NULL,
  -- Which opener the game prefers. Greetings are alternatives ordered by this.
  importance     INTEGER,
  single_screen  INTEGER NOT NULL,
  is_entry       INTEGER NOT NULL,
  jump_target    INTEGER,
  speaker_json   TEXT,
  UNIQUE(dialogue_id, node_id)
);
CREATE INDEX idx_dialogue_nodes_dialogue ON dialogue_nodes (dialogue_id, node_id);
-- An authored edge. The port names the option or the branch output it leaves from.
CREATE TABLE dialogue_edges (
  id           TEXT PRIMARY KEY NOT NULL,
  dialogue_id  TEXT NOT NULL REFERENCES dialogues(id),
  from_node    INTEGER NOT NULL,
  to_node      INTEGER NOT NULL,
  ordinal      INTEGER NOT NULL,
  port         TEXT
);
CREATE INDEX idx_dialogue_edges_from ON dialogue_edges (dialogue_id, from_node);
-- A screen of speech. A speech node holds a sequence, not a line: 1,092 nodes in this build carry
-- continuation screens.
CREATE TABLE dialogue_statements (
  id             TEXT PRIMARY KEY NOT NULL,
  dialogue_id    TEXT NOT NULL REFERENCES dialogues(id),
  node_id        INTEGER NOT NULL,
  screen_ordinal INTEGER NOT NULL,
  text           TEXT NOT NULL,
  UNIQUE(dialogue_id, node_id, screen_ordinal)
);
-- An option of a choice node, with the port an edge leaves from and the gate on the option.
CREATE TABLE dialogue_options (
  id          TEXT PRIMARY KEY NOT NULL,
  dialogue_id TEXT NOT NULL REFERENCES dialogues(id),
  node_id     INTEGER NOT NULL,
  ordinal     INTEGER NOT NULL,
  port        TEXT NOT NULL,
  text        TEXT NOT NULL,
  gate_json   TEXT,
  UNIQUE(dialogue_id, node_id, ordinal)
);
-- A gate: what the game reads before it offers an opener or an option. Never a result.
CREATE TABLE dialogue_conditions (
  id            TEXT PRIMARY KEY NOT NULL,
  dialogue_id   TEXT NOT NULL REFERENCES dialogues(id),
  node_id       INTEGER NOT NULL,
  -- Null for a gate on the node itself, set for a gate on one of its options.
  option_port   TEXT,
  kind          TEXT NOT NULL,
  compare       TEXT,
  value         TEXT,
  invert        INTEGER NOT NULL,
  authored_type TEXT NOT NULL,
  subjects_json TEXT NOT NULL,
  participants_json TEXT NOT NULL
);
-- An outcome: what a conversation does to the world.
CREATE TABLE dialogue_effects (
  id            TEXT PRIMARY KEY NOT NULL,
  dialogue_id   TEXT NOT NULL REFERENCES dialogues(id),
  node_id       INTEGER NOT NULL,
  ordinal       INTEGER NOT NULL,
  kind          TEXT NOT NULL,
  amount        INTEGER,
  amount_label  TEXT,
  authored_type TEXT NOT NULL,
  target_json   TEXT,
  participant_json TEXT
);
-- Which objects reach a conversation. A graph two holders reach is one conversation.
CREATE TABLE dialogue_holders (
  id          TEXT PRIMARY KEY NOT NULL,
  dialogue_id TEXT NOT NULL REFERENCES dialogues(id),
  ordinal     INTEGER NOT NULL,
  kind        TEXT NOT NULL,
  label       TEXT,
  ref_json    TEXT
);
`;

const DIALOGUE_PRESENTATION_TABLES = `
-- The reader-facing copy. The script is the reading order of a cyclic graph, computed once here so
-- no page walks edges at request time.
CREATE TABLE dialogue_presentation_rows (
  id              TEXT PRIMARY KEY,
  render_context  TEXT NOT NULL,
  graph_name      TEXT NOT NULL,
  label           TEXT NOT NULL,
  statement_count INTEGER NOT NULL,
  node_count      INTEGER NOT NULL,
  option_count    INTEGER NOT NULL,
  script_json     TEXT NOT NULL,
  holders_json    TEXT NOT NULL
);
`;

export const DIALOGUE_ALL_DDL = DIALOGUE_DDL + DIALOGUE_PRESENTATION_TABLES;
