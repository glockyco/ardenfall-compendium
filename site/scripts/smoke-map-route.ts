import { Database } from "bun:sqlite";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { currentStagePaths } from "../stage-paths.mjs";

const out = join(currentStagePaths(process.cwd()).outputDir, "map.html");
const html = readFileSync(out, "utf8");

/**
 * Takes the marker to look for from the staged database rather than naming a
 * fixture location, so this smoke judges a synthetic artifact and a live export
 * alike. The no-script marker list is the map's accessible fallback, so a reader
 * without WebGL still reaches every marked place.
 */
function firstMarkerLabel(): string {
  const db = new Database(currentStagePaths(process.cwd()).database, {
    readonly: true,
    create: false,
  });
  try {
    const row = db
      .query<{ label: string }, []>(
        `SELECT COALESCE(NULLIF(TRIM(n.display_label), ''), NULLIF(TRIM(p.name), '')) AS label
         FROM map_points p
         JOIN entity_nodes n
           ON n.entity_type = p.entity_id AND n.entity_id = p.instance_id AND n.has_page = 1
         WHERE COALESCE(NULLIF(TRIM(n.display_label), ''), NULLIF(TRIM(p.name), '')) IS NOT NULL
         ORDER BY label
         LIMIT 1`,
      )
      .get();
    if (!row) throw new Error("staged artifact has no map marker with a label to probe");
    return row.label;
  } finally {
    db.close();
  }
}

function firstBasemapAssetHash(): string {
  const db = new Database(currentStagePaths(process.cwd()).database, {
    readonly: true,
    create: false,
  });
  try {
    const row = db
      .query<{ asset_hash: string }, []>(
        `SELECT t.asset_hash
         FROM map_tiles t
         JOIN map_basemaps b ON b.map_id = t.map_id
         WHERE t.empty = 0 AND t.asset_hash IS NOT NULL
         ORDER BY t.zoom DESC, t.tile_y, t.tile_x
         LIMIT 1`,
      )
      .get();
    if (!row) throw new Error("staged artifact has no published basemap tile to probe");
    return row.asset_hash;
  } finally {
    db.close();
  }
}

const basemapHash = firstBasemapAssetHash();
const basemapUrl = `/assets/${basemapHash}.webp`;
const must: string[] = [firstMarkerLabel(), basemapUrl, "Loading map", ">Map<"];
for (const needle of must) {
  if (!html.includes(needle)) {
    throw new Error(`map.html is missing expected content: ${needle}`);
  }
}

const basemapPath = join(currentStagePaths(process.cwd()).outputDir, basemapUrl);
if (!existsSync(basemapPath)) {
  throw new Error(`published basemap tile is missing from the built site: ${basemapUrl}`);
}

// deck.gl must be a lazily-loaded client chunk, never inlined in the prerendered HTML.
if (/@deck\.gl\/core/.test(html)) {
  throw new Error("deck.gl appears inlined in the prerendered map HTML");
}
