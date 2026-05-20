export interface ParsedSlug {
  slug: string;
  humanSlug: string;
  shortId: string | null;
  hasShortId: boolean;
}

const SLUG_RE = /^([a-z0-9-]*)--([0-9a-f]{8})$/;

export function parseSlugParam(slug: string): ParsedSlug {
  const match = SLUG_RE.exec(slug);
  if (!match) {
    return {
      slug,
      humanSlug: slug.toLowerCase().replaceAll(/[^a-z0-9-]+/g, "-"),
      shortId: null,
      hasShortId: false,
    };
  }
  return {
    slug,
    humanSlug: match[1] ?? "",
    shortId: match[2] ?? null,
    hasShortId: true,
  };
}
