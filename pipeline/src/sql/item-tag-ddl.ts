export const ITEM_TAG_DDL = `
CREATE TABLE item_tags (
  id          TEXT PRIMARY KEY,
  tag_name    TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);
`;
