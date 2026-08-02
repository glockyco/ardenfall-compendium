import type { RequestHandler } from "./$types";

export const prerender = true;

const siteOrigin = "https://ardenfall.compendiums.org";

export const GET: RequestHandler = () => {
  const sitemap = new URL("/sitemap.xml", siteOrigin).href;
  return new Response(`User-agent: *\nAllow: /\nSitemap: ${sitemap}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
