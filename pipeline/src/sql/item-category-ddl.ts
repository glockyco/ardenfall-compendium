export const ITEM_CATEGORY_DDL = `
CREATE TABLE item_categories (
  id                         TEXT PRIMARY KEY NOT NULL,
  category_name              TEXT,
  icon_ref_json              TEXT,
  default_item_icon_ref_json TEXT,
  category_color_json        TEXT NOT NULL,
  show_in_all_category       INTEGER NOT NULL,
  columns_json               TEXT NOT NULL DEFAULT '[]'
);
`;
