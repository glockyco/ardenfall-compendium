export const ITEM_TAG_DDL = `
CREATE TABLE item_tags (
  id          TEXT PRIMARY KEY NOT NULL,
  tag_name    TEXT,
  description TEXT NOT NULL DEFAULT ''
);
`;
