export const STATUS_EFFECT_DDL = `
CREATE TABLE status_effects (
  id                    TEXT PRIMARY KEY NOT NULL,
  status_effect_name    TEXT,
  tooltip_source        TEXT,
  icon_ref_json         TEXT,
  is_hostile            INTEGER
);
`;
