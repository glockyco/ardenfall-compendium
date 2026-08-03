import { all } from "$lib/server/db";
import { sitemapRoutePaths, type EntityPageRoute } from "$lib/server/sitemap-routes";
import type { RequestHandler } from "./$types";

export const prerender = true;

const escapeXml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const siteOrigin = "https://ardenfall.compendiums.org";

export const GET: RequestHandler = () => {
  const routes = all<EntityPageRoute>(
    "SELECT route_path FROM entity_nodes WHERE has_page = 1 ORDER BY route_path",
  );
  const urls = sitemapRoutePaths(routes)
    .map((routePath) => `  <url><loc>${escapeXml(new URL(routePath, siteOrigin).href)}</loc></url>`)
    .join("\n");
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
