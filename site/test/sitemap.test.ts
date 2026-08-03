import { describe, expect, it } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { listingRoutePaths, sitemapRoutePaths } from "../src/lib/server/sitemap-routes";

const routesRoot = join(import.meta.dir, "../src/routes");

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

describe("sitemap routes", () => {
  it("publishes every static page route", () => {
    const declared: string[] = [...listingRoutePaths];
    expect(declared.sort()).toEqual(staticPageRoutes());
  });

  it("adds listing pages and entity page routes", () => {
    const routes = sitemapRoutePaths([
      { route_path: "/items/iron-sword" },
      { route_path: "/terms/strength" },
    ]);

    expect(routes).toContain("/");
    expect(routes).toContain("/locations");
    expect(routes).toContain("/items/iron-sword");
    expect(routes).toContain("/terms/strength");
    expect(routes).not.toContain("/map?map=overworld&sel=portal");
  });
});
