import { describe, expect, test } from "bun:test";
import { join } from "node:path";

const demoRoot = join(import.meta.dir, "..");
const readDemoFile = async (fileName: string) => await Bun.file(join(demoRoot, fileName)).text();

describe("homepage mockup demo", () => {
  test("renders the primary mockup regions as static, accessible landmarks", async () => {
    const html = await readDemoFile("index.html");

    for (const region of [
      "primary-navigation",
      "hero-search",
      "status-strip",
      "category-grid",
      "content-panels",
      "demo-footer",
    ]) {
      expect(html).toContain(`data-region="${region}"`);
    }

    for (const navItem of [
      "Home",
      "Quests",
      "NPCs",
      "Locations",
      "Factions",
      "Items",
      "Skills",
      "Lore",
      "Map",
    ]) {
      expect(html).toContain(`>${navItem}<`);
    }

    expect(html).toContain('aria-label="Search the compendium"');
    expect(html).toContain("Welcome to the");
    expect(html).toContain("Ardenfall Compendium");
  });

  test("keeps the mockup category labels and counts visible in the card grid", async () => {
    const html = await readDemoFile("index.html");

    for (const expected of [
      "144 Quests",
      "612 NPCs",
      "158 Locations",
      "27 Factions",
      "1,248 Items",
      "178 Skills",
      "342 Pages",
      "Interactive World",
    ]) {
      expect(html).toContain(expected);
    }

    expect(html.match(/data-category-card/g)?.length).toBe(8);
  });

  test("defines the visual systems needed for the mockup: atmospheric hero, parchment cards, glass panels, and responsive layout", async () => {
    const css = await readDemoFile("styles.css");

    for (const token of ["--ink", "--amber", "--parchment", "--glass", "--line"]) {
      expect(css).toContain(token);
    }

    for (const selector of [".hero::before", ".category-card", ".glass-panel", ".content-grid"]) {
      expect(css).toContain(selector);
    }

    expect(css).toContain("@media (max-width: 900px)");

    expect(css).not.toContain(".hero::after");
  });

  test("matches the friendlier draft palette and category framing", async () => {
    const html = await readDemoFile("index.html");
    const css = await readDemoFile("styles.css");

    for (const token of [
      "--friendly-ink: #171a18",
      "--friendly-panel: rgb(28 27 23 / 82%)",
      "--friendly-parchment: #ead3a6",
      "--friendly-sun: #ffd78e",
      "--friendly-gold: #c99652",
    ]) {
      expect(css).toContain(token);
    }

    expect(html).toContain("Browse by category");
    expect(css).toContain("rgba(255, 215, 142");
  });

  test("keeps the title inside the hero safe zone", async () => {
    const css = await readDemoFile("styles.css");

    expect(css).toContain("font-size: clamp(2.8rem, 3.55vw, 3.45rem)");
    expect(css).toContain("background-position: center center");
    expect(css).toContain("background-size: 100% 100%");
    expect(css).toContain("hero-ardenfall-valley-wide.avif");
    expect(css).toContain("--topbar-surface: rgb(25 25 23 / 72%)");
    expect(css).toContain("mask-image: linear-gradient(");
    expect(css).toContain("-webkit-mask-image: linear-gradient(");
    expect(css).toContain("transparent 100%");
  });

  test("uses generated hero assets with provenance", async () => {
    const css = await readDemoFile("styles.css");

    expect(css).toContain("hero-ardenfall-valley-wide.avif");
    expect(css).toContain("hero-ardenfall-valley-wide.webp");

    for (const assetPath of [
      "assets/hero-ardenfall-valley-wide.png",
      "assets/hero-ardenfall-valley-wide.webp",
      "assets/hero-ardenfall-valley-wide.avif",
    ]) {
      expect(await Bun.file(join(demoRoot, assetPath)).exists()).toBe(true);
    }

    const provenance = JSON.parse(
      await readDemoFile("assets/hero-ardenfall-valley.provenance.json"),
    ) as {
      generatedAsset: string;
      recommendedUse: string;
      reviewNotes: string;
      prompt: string;
      directionReference: string;
      earlierDraft: string;
      sourceCanvas: {
        width: number;
        height: number;
      };
      composition: {
        titleSafeZone: string;
        requiredElements: string[];
        negativeConstraints: string[];
      };
    };

    expect(provenance.generatedAsset).toBe("assets/hero-ardenfall-valley-wide.png");
    expect(provenance.directionReference).toBe("assets/references/hero-composition-reference.png");
    expect(provenance.earlierDraft).toBe("assets/references/page-early-draft.png");
    for (const refPath of [provenance.directionReference, provenance.earlierDraft]) {
      expect(await Bun.file(join(demoRoot, refPath)).exists()).toBe(true);
    }
    expect(provenance.prompt).toContain("paths");
    expect(provenance.prompt).toContain("hamlet");
    expect(provenance.prompt).toContain("sun");
    expect(provenance.prompt).toContain("3-5 distinct tall spires");
    expect(provenance.prompt).toContain("right-side sky");
    expect(provenance.reviewNotes).toContain("inviting, friendly, alive");
    expect(provenance.recommendedUse).toBe("decorative hero background");
    expect(provenance.sourceCanvas).toEqual({ width: 1536, height: 720 });
    expect(provenance.composition.titleSafeZone).toBe(
      "upper center stays open; castle, tree, and mountains do not overlap the h1/lede area",
    );
    expect(provenance.composition.requiredElements).toEqual([
      "visible left tree crown and trunk framing the sun",
      "winding river and paths receding through the valley",
      "small hamlet and farms in the midground",
      "castle on the right third, below and beside the title safe area",
      "3-5 distinct tall castle spires of varied heights on the right ridge",
      "warm friendly sunrise palette",
    ]);
    expect(provenance.composition.negativeConstraints).toContain(
      "no castle silhouette behind or touching the page title",
    );
    expect(provenance.composition.negativeConstraints).toContain(
      "no right-side towers crossing into the title safe rectangle",
    );
  });
});
