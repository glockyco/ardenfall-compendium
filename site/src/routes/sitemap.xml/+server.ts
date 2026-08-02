import { all } from "$lib/server/db";
import type { RequestHandler } from "./$types";

export const prerender = true;

interface PublicEntityRoute {
  route_path: string;
}

const escapeXml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const siteOrigin = "https://ardenfall.compendiums.org";

export const GET: RequestHandler = () => {
  const routes = all<PublicEntityRoute>(
    "SELECT route_path FROM entity_nodes WHERE is_public = 1 ORDER BY route_path",
  );
  const urls = routes
    .map((row) => `  <url><loc>${escapeXml(new URL(row.route_path, siteOrigin).href)}</loc></url>`)
    .join("\n");
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
