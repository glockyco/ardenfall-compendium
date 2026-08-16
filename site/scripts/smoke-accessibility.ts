#!/usr/bin/env bun
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

/**
 * This check uses the built HTML instead of a browser or a DOM dependency.
 * It catches the site defects that static markup checks cannot catch.
 * It cannot inspect client-side updates, focus behavior, or final browser layout.
 */
const outputDir = resolve(
  process.env.A11Y_OUTPUT_DIR ?? join(import.meta.dirname, "..", ".svelte-kit", "cloudflare"),
);
if (!existsSync(outputDir)) {
  throw new Error(`missing built site output: ${outputDir}`);
}

const pages = collectHtmlFiles(outputDir);
if (pages.length === 0) {
  throw new Error(`built site output contains no HTML pages: ${outputDir}`);
}

let linkCount = 0;
let targetCount = 0;
let liveRegionCount = 0;
for (const pagePath of pages) {
  const html = readFileSync(pagePath, "utf8");
  const route = routeFor(pagePath);
  const links = parseElements(html, "a");
  linkCount += links.length;
  checkLinkPurpose(route, links, html);

  for (const link of links) {
    if (isHidden(link.attributes) || !hasTargetBox(link)) continue;
    checkTargetSize(route, "link", link);
    targetCount += 1;
  }

  for (const tag of ["button", "input", "select", "textarea"]) {
    const controls = parseElements(html, tag);
    for (const control of controls) {
      if (isHidden(control.attributes)) continue;
      checkTargetSize(route, tag, control);
      targetCount += 1;
    }
  }

  const liveRegions = parseLiveRegions(html);
  liveRegionCount += liveRegions;
  if (/<form\b/i.test(html) && liveRegions === 0) {
    throw new Error(
      `a11y: ${route} contains a form but no status message with role="status" or aria-live`,
    );
  }
}

process.stdout.write(
  `Accessibility smoke passed: ${pages.length} pages, ${linkCount} links, ${targetCount} targets, ${liveRegionCount} live regions\n`,
);

function collectHtmlFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectHtmlFiles(path));
    } else if (entry.isFile() && extname(entry.name) === ".html") {
      files.push(path);
    }
  }
  return files.sort();
}

function routeFor(pagePath: string): string {
  const pathname = relative(outputDir, pagePath).replaceAll("\\\\", "/");
  if (pathname === "index.html") return "/";
  if (pathname.endsWith("/index.html")) return `/${pathname.slice(0, -"/index.html".length)}`;
  return `/${pathname.slice(0, -".html".length)}`;
}

interface Element {
  attributes: Record<string, string | true>;
  body: string;
  start: number;
}

function parseElements(html: string, tagName: string): Element[] {
  const elements: Element[] = [];
  const pattern = new RegExp(`<${tagName}\\b([^>]*)>([\\s\\S]*?)<\\/${tagName}\\s*>`, "gi");
  for (const match of html.matchAll(pattern)) {
    elements.push({
      attributes: parseAttributes(match[1] ?? ""),
      body: match[2] ?? "",
      start: match.index ?? 0,
    });
  }

  if (tagName === "input") {
    const inputPattern = /<input\b([^>]*)>/gi;
    for (const match of html.matchAll(inputPattern)) {
      elements.push({
        attributes: parseAttributes(match[1] ?? ""),
        body: "",
        start: match.index ?? 0,
      });
    }
  }
  return elements;
}

function parseAttributes(source: string): Record<string, string | true> {
  const attributes: Record<string, string | true> = {};
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of source.matchAll(pattern)) {
    const name = (match[1] ?? "").toLowerCase();
    if (!name) continue;
    attributes[name] = decodeHtml(match[2] ?? match[3] ?? match[4] ?? true);
  }
  return attributes;
}

function checkLinkPurpose(route: string, links: Element[], html: string): void {
  const destinations = new Map<string, { href: string }>();
  for (const link of links) {
    // A screen reader announces the accessible name, and `aria-label` overrides the
    // content. Judging the content alone would fail a link that is correctly named.
    const label = link.attributes["aria-label"];
    const text =
      typeof label === "string" && label.trim().length > 0 ? label.trim() : visibleText(link.body);
    const href = typeof link.attributes.href === "string" ? link.attributes.href.trim() : "";
    if (
      !text ||
      !href ||
      href.startsWith("javascript:") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:")
    ) {
      continue;
    }
    const destination = normalizeDestination(route, href);
    const context = linkContext(html, link.start);
    const key = `${context}\u0000${text}`;
    const previous = destinations.get(key);
    if (previous && previous.href !== destination) {
      throw new Error(
        `a11y: duplicate link text "${text}" points to ${previous.href} and ${destination} in ${route}`,
      );
    }
    if (!previous) destinations.set(key, { href: destination });
  }
}

function linkContext(html: string, position: number): string {
  const navStart = enclosingStart(html, position, "nav");
  if (navStart !== null) return `nav:${navStart}`;
  const sectionStart = enclosingStart(html, position, "section");
  return `section:${sectionStart ?? 0}`;
}

function enclosingStart(html: string, position: number, tagName: string): number | null {
  const stack: number[] = [];
  const pattern = new RegExp(`<\\/?${tagName}\\b[^>]*>`, "gi");
  for (const match of html.slice(0, position).matchAll(pattern)) {
    if (match[0]?.startsWith("</")) stack.pop();
    else stack.push(match.index ?? 0);
  }
  return stack.at(-1) ?? null;
}

function normalizeDestination(route: string, href: string): string {
  try {
    return new URL(href, `https://ardenfall.invalid${route}`).href;
  } catch {
    return href;
  }
}

function hasTargetBox(element: Element): boolean {
  const classes =
    typeof element.attributes.class === "string" ? element.attributes.class.split(/\s+/) : [];
  const style = typeof element.attributes.style === "string" ? element.attributes.style : "";
  return (
    classes.some(
      (name) =>
        /^(?:inline-)?flex$/.test(name) ||
        /^(?:inline-)?block$/.test(name) ||
        /^(?:min-)?h-/.test(name) ||
        /^(?:min-)?w-/.test(name) ||
        /^size-/.test(name) ||
        /^(?:p|py|pt|pb)-/.test(name),
    ) || /(?:^|;)\s*(?:height|min-height|width|min-width|display)\s*:/.test(style)
  );
}

function checkTargetSize(route: string, kind: string, element: Element): void {
  const classes =
    typeof element.attributes.class === "string" ? element.attributes.class.split(/\s+/) : [];
  if (classes.includes("sr-only")) return;

  const style = typeof element.attributes.style === "string" ? element.attributes.style : "";
  const declarations = parseDeclarations(style);
  const height = targetHeight(classes, declarations);
  if (height < 24) {
    const text =
      visibleText(element.body) ||
      (typeof element.attributes.type === "string" ? element.attributes.type : kind);
    throw new Error(
      `a11y: target under 24px in ${route}: ${kind} "${text}" has ${height}px height`,
    );
  }
  const width = targetWidth(classes, declarations);
  if (width !== null && width < 24) {
    const text =
      visibleText(element.body) ||
      (typeof element.attributes.type === "string" ? element.attributes.type : kind);
    throw new Error(`a11y: target under 24px in ${route}: ${kind} "${text}" has ${width}px width`);
  }
}

function targetWidth(classes: string[], declarations: Record<string, string>): number | null {
  const explicit = [declarations["width"], declarations["min-width"]]
    .map(cssPixels)
    .filter((value): value is number => value !== null);
  const classWidth = classes
    .map((name) => {
      if (name.startsWith("min-w-")) return cssSpacing(name.slice("min-w-".length));
      if (name.startsWith("w-")) return cssSpacing(name.slice("w-".length));
      if (name.startsWith("size-")) return cssSpacing(name.slice("size-".length));
      return null;
    })
    .filter((value): value is number => value !== null);
  const known = [...explicit, ...classWidth];
  return known.length > 0 ? Math.max(...known) : null;
}

function targetHeight(classes: string[], declarations: Record<string, string>): number {
  const explicit = [declarations["height"], declarations["min-height"]]
    .map(cssPixels)
    .filter((value): value is number => value !== null);
  const explicitHeight = explicit.length > 0 ? Math.max(...explicit) : null;
  if (explicitHeight !== null) return explicitHeight;

  const classHeight = classes
    .map((name) => {
      if (name.startsWith("min-h-")) return cssSpacing(name.slice("min-h-".length));
      if (name.startsWith("h-")) return cssSpacing(name.slice("h-".length));
      if (name.startsWith("size-")) return cssSpacing(name.slice("size-".length));
      return null;
    })
    .find((value): value is number => value !== null);
  if (classHeight !== undefined) return classHeight;

  const padding =
    (cssPixels(declarations["padding-top"]) ?? 0) +
    (cssPixels(declarations["padding-bottom"]) ?? 0);
  const classPadding = classes.reduce((total, name) => {
    if (name.startsWith("py-")) return total + 2 * (cssSpacing(name.slice(3)) ?? 0);
    if (name.startsWith("pt-")) return total + (cssSpacing(name.slice(3)) ?? 0);
    if (name.startsWith("pb-")) return total + (cssSpacing(name.slice(3)) ?? 0);
    if (name === "p-0") return total;
    return total;
  }, 0);
  const lineHeight = cssPixels(declarations["line-height"]) ?? classLineHeight(classes) ?? 24;
  return padding + classPadding + lineHeight;
}

function parseDeclarations(style: string): Record<string, string> {
  const declarations: Record<string, string> = {};
  for (const declaration of style.split(";")) {
    const [name, ...value] = declaration.split(":");
    if (name && value.length > 0) declarations[name.trim().toLowerCase()] = value.join(":").trim();
  }
  return declarations;
}

function classLineHeight(classes: string[]): number | null {
  const textLineHeights: Record<string, number> = {
    "text-xs": 16,
    "text-sm": 20,
    "text-base": 24,
    "text-lg": 28,
    "text-xl": 28,
    "text-2xl": 32,
    "text-3xl": 36,
    "text-4xl": 40,
    "text-5xl": 48,
    "text-6xl": 60,
  };
  for (const className of classes) {
    const lineHeight = textLineHeights[className];
    if (lineHeight !== undefined) return lineHeight;
  }
  for (const className of classes) {
    if (className.startsWith("leading-")) {
      const value = cssSpacing(className.slice("leading-".length));
      if (value !== null) return value;
    }
  }
  return null;
}

function cssSpacing(value: string): number | null {
  if (value.startsWith("[")) return cssPixels(value.slice(1, -1));
  const spacing = Number(value);
  if (Number.isFinite(spacing)) return spacing * 4;
  return null;
}

function cssPixels(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.trim().match(/^(-?[\d.]+)(px|rem)?$/);
  if (!match) return null;
  const number = Number(match[1]);
  return match[2] === "rem" ? number * 16 : number;
}

function parseLiveRegions(html: string): number {
  const matches = html.match(
    /<(?:[a-z][\w:-]*)(?:\s[^>]*)?(?:role\s*=\s*["']status["']|aria-live\s*=\s*["'][^"']+["'])[^>]*>/gi,
  );
  return matches?.length ?? 0;
}

function isHidden(attributes: Record<string, string | true>): boolean {
  if (attributes.hidden === true || attributes["aria-hidden"] === "true") return true;
  const classes = typeof attributes.class === "string" ? attributes.class.split(/\s+/) : [];
  if (classes.includes("hidden") || classes.includes("invisible")) return true;
  const style =
    typeof attributes.style === "string" ? attributes.style.replace(/\s/g, "").toLowerCase() : "";
  return style.includes("display:none") || style.includes("visibility:hidden");
}

function visibleText(value: string): string {
  return decodeHtml(value.replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]*>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(value: string | true): string {
  if (value === true) return "";
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    );
}
