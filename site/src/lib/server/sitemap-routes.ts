/**
 * Which pages the sitemap publishes.
 *
 * A sitemap is a claim about what exists, so this module owns the set and the sitemap route
 * only renders it. The listing pages are named here because no table holds them. The test
 * reads the route tree and fails when someone adds a static page and forgets this list.
 */

export interface PublicEntityRoute {
  route_path: string;
}

/** Static pages the sitemap publishes beside every public entity page. */
export const listingRoutePaths = [
  "/",
  "/items",
  "/spells",
  "/status-effects",
  "/stats",
  "/categories",
  "/tags",
  "/characters",
  "/locations",
  "/map",
  "/search",
] as const;

export const sitemapRoutePaths = (publicRoutes: readonly PublicEntityRoute[]): string[] =>
  [...new Set<string>([...listingRoutePaths, ...publicRoutes.map((row) => row.route_path)])].sort();
