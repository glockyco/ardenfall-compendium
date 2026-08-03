import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { listingRoutePaths, sitemapRoutePaths } from "../src/lib/server/sitemap-routes";

const routesRoot = join(import.meta.dir, "../src/routes");
const builtOutputRoot = join(import.meta.dir, "../.svelte-kit/cloudflare");

const builtPageRoutes = (): string[] => {
  const routes = new Set<string>();

  const visit = (directory: string, segments: string[]) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        visit(join(directory, entry.name), [...segments, entry.name]);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(".html")) continue;
      const pageName = entry.name.slice(0, -".html".length);
      const pageSegments = pageName === "index" ? segments : [...segments, pageName];
      const route = pageSegments.length === 0 ? "/" : `/${pageSegments.join("/")}`;
      if (route !== "/404") routes.add(route);
    }
  };

  visit(builtOutputRoot, []);
  return [...routes].sort();
};

const builtSitemapRoutes = (): string[] => {
  const sitemap = readFileSync(join(builtOutputRoot, "sitemap.xml"), "utf8");
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => {
    const location = match[1];
    if (!location) throw new Error("built sitemap contains an empty location");
    return decodeURIComponent(new URL(location, "https://ardenfall.compendiums.org").pathname);
  });
  if (locations.length === 0) throw new Error("built sitemap contains no locations");
  return locations.sort();
};

const staticPageRoutes = (): string[] => {
  const routes: string[] = [];

  const visit = (directory: string, segments: string[]) => {
    if (existsSync(join(directory, "+page.svelte"))) {
      routes.push(segments.length === 0 ? "/" : `/${segments.join("/")}`);
    }

    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith("[")) continue;
      visit(join(directory, entry.name), [...segments, entry.name]);
    }
  };

  visit(routesRoot, []);
  return routes.sort();
};

/**
 * Static pages a sitemap must not advertise, each with the reason it is excluded.
 *
 * A sitemap is a claim about what a reader should find. Keeping this list beside the assertion means
 * a new static route fails the test until somebody decides which side it belongs on, rather than
 * being quietly dropped.
 */
const unpublishedRoutes: Record<string, string> = {
  "/404": "Cloudflare serves this for an address that matches no page, and it is marked noindex.",
};

describe("sitemap routes", () => {
  it("accounts for every static page route", () => {
    const declared = [...listingRoutePaths, ...Object.keys(unpublishedRoutes)].sort();
    expect(declared).toEqual(staticPageRoutes());
  });

  it("never advertises a page it excludes on purpose", () => {
    const routes = sitemapRoutePaths([]);
    for (const excluded of Object.keys(unpublishedRoutes)) {
      expect(routes).not.toContain(excluded);
    }
  });

  it("keeps the built sitemap in parity with built pages", () => {
    expect(builtSitemapRoutes()).toEqual(builtPageRoutes());
  });

  it("adds listing pages and entity page routes", () => {
    const routes = sitemapRoutePaths([
      { route_path: "/items/iron-sword" },
      { route_path: "/terms/strength" },
    ]);

    expect(routes).toContain("/");
    expect(routes).toContain("/locations");
    expect(routes).toContain("/quests");
    expect(routes).toContain("/placed-characters");
    expect(routes).toContain("/portals");
    expect(routes).toContain("/items/iron-sword");
    expect(routes).toContain("/terms/strength");
    expect(routes).not.toContain("/map?map=overworld&sel=portal");
  });
});
