import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const out = join(process.cwd(), ".svelte-kit", "cloudflare", "map.html");
const html = readFileSync(out, "utf8");

/**
 * Takes the marker to look for from the staged database rather than naming a
 * fixture location, so this smoke judges a synthetic artifact and a live export
 * alike. The no-script marker list is the map's accessible fallback, so a reader
 * without WebGL still reaches every marked place.
 */
function firstMarkerLabel(): string {
  const db = new Database(join(process.cwd(), ".data", "data.sqlite"), {
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

const must: string[] = [firstMarkerLabel(), "Loading map", ">Map<"];
for (const needle of must) {
  if (!html.includes(needle)) {
    throw new Error(`map.html is missing expected content: ${needle}`);
  }
}

// deck.gl must be a lazily-loaded client chunk, never inlined in the prerendered HTML.
if (/@deck\.gl\/core/.test(html)) {
  throw new Error("deck.gl appears inlined in the prerendered map HTML");
}
