import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  listCharacters,
  listCharacterRaces,
  listFactions,
  listLocations,
  listPlacedCharacters,
  listPortals,
  listQuests,
  getEntity,
  getMapView,
  listItemCategories,
  listItemTags,
  listItemsOverview,
  listSpells,
  listPotionRecipes,
  listEnchantments,
  listStatTypes,
  listStatusEffects,
} from "$lib/server/read-models";
import type { LayoutServerLoad } from "./$types";

export interface NavSection {
  id: string;
  href: string;
  /** Plural label as the read model spells it, e.g. "Status Effects". */
  label: string;
  count: number;
  /** What the count counts, lowercase and already agreeing in number. */
  countLabel: string;
}

export interface ReleaseProvenance {
  gameVersion: string;
  buildIdentifier: string;
  snapshotId: string;
  shortCommit: string;
  /** True when the artifact was built from a dirty worktree. */
  isDirty: boolean;
  /** ISO timestamp for a <time datetime>, null until the manifest carries one. */
  snapshotIso: string | null;
  /** Human date such as "15 May 2026", null until the manifest carries one. */
  snapshotDate: string | null;
  /** True for synthetic fixture builds, which are not real game data. */
  isFixture: boolean;
}

/** Everything the header, footer, and landing page need on every route. */
export interface SiteChrome {
  sections: NavSection[];
  release: ReleaseProvenance | null;
  releaseError: string | null;
  mapRoute: string;
  itemRoute: string;
  spellRoute: string;
  potionRecipeRoute: string;
  enchantmentRoute: string;
  questRoute: string;
  statusEffectRoute: string;
  statTypeRoute: string;
  itemCategoryRoute: string;
  itemTagRoute: string;
  characterRoute: string;
  characterRaceRoute: string;
  locationRoute: string;
  placedCharacterRoute: string;
  portalRoute: string;
  factionRoute: string;
}

/** The subset of the deployed `/_release.json` the footer needs. */
interface PublicReleaseManifest {
  artifactKind: string;
  createdAt?: string;
  source: { snapshotId: string; gameVersion: string; buildIdentifier: string };
  git: { commit: string; dirty: boolean };
}

const releasePath = (): string => join(process.cwd(), "static", "_release.json");

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

function isReleaseManifest(value: unknown): value is PublicReleaseManifest {
  if (typeof value !== "object" || value === null) return false;
  const { artifactKind, createdAt, source, git } = value as Record<string, unknown>;
  if (!isNonEmptyString(artifactKind)) return false;
  if (createdAt !== undefined && !isNonEmptyString(createdAt)) return false;
  if (typeof source !== "object" || source === null) return false;
  if (typeof git !== "object" || git === null) return false;
  const { snapshotId, gameVersion, buildIdentifier } = source as Record<string, unknown>;
  const { commit, dirty } = git as Record<string, unknown>;
  return (
    isNonEmptyString(snapshotId) &&
    isNonEmptyString(gameVersion) &&
    isNonEmptyString(buildIdentifier) &&
    isNonEmptyString(commit) &&
    typeof dirty === "boolean"
  );
}

// Pinned locale and UTC keep prerendered output byte-stable across machines.
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatSnapshotDate(createdAt: string | undefined): {
  snapshotIso: string | null;
  snapshotDate: string | null;
} {
  if (createdAt === undefined) return { snapshotIso: null, snapshotDate: null };
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) return { snapshotIso: null, snapshotDate: null };
  return { snapshotIso: parsed.toISOString(), snapshotDate: dateFormat.format(parsed) };
}

/**
 * A compendium that cannot say which game build it came from has no standing,
 * so a missing or malformed manifest surfaces as a visible footer notice rather
 * than a blank footer or a thrown error that takes the whole page down.
 */
function loadRelease(): { release: ReleaseProvenance | null; releaseError: string | null } {
  const path = releasePath();
  if (!existsSync(path)) {
    return {
      release: null,
      releaseError: "Build provenance is unavailable, static/_release.json was not staged.",
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {
      release: null,
      releaseError: "Build provenance is unavailable, static/_release.json is not valid JSON.",
    };
  }

  if (!isReleaseManifest(parsed)) {
    return {
      release: null,
      releaseError:
        "Build provenance is unavailable, static/_release.json is missing its source identity.",
    };
  }

  return {
    release: {
      gameVersion: parsed.source.gameVersion,
      buildIdentifier: parsed.source.buildIdentifier,
      snapshotId: parsed.source.snapshotId,
      shortCommit: parsed.git.commit.slice(0, 7),
      isDirty: parsed.git.dirty,
      isFixture: parsed.artifactKind !== "release",
      ...formatSnapshotDate(parsed.createdAt),
    },
    releaseError: null,
  };
}

function entitySection(entityId: string, count: number): NavSection {
  const entity = getEntity(entityId);
  if (!entity) {
    throw new Error(
      `site_entities has no row for "${entityId}", so the site cannot resolve its route or label`,
    );
  }
  const noun = count === 1 ? entity.singular_label : entity.plural_label;
  return {
    id: entityId,
    href: entity.route_path,
    label: entity.plural_label,
    count,
    countLabel: noun.toLowerCase(),
  };
}

function mapSection(): NavSection {
  const view = getMapView();
  const count = view.points.length + view.volumes.length;
  return {
    id: "map",
    // The map is a view over placed locations rather than an entity with its
    // own site_entities row, so this is the one route the site names directly.
    href: "/map",
    label: "Map",
    count,
    countLabel: count === 1 ? "placed location" : "placed locations",
  };
}

function buildLayoutData(): SiteChrome {
  const item = entitySection("item", listItemsOverview().length);
  const spell = entitySection("spell", listSpells().length);
  const potionRecipe = entitySection("potion-recipe", listPotionRecipes().length);
  const enchantment = entitySection("enchantment", listEnchantments().length);
  const quest = entitySection("quest", listQuests().length);
  const statusEffect = entitySection("status-effect", listStatusEffects().length);
  const statType = entitySection("stat-type", listStatTypes().length);
  const itemCategory = entitySection("item-category", listItemCategories().length);
  const itemTag = entitySection("item-tag", listItemTags().length);
  const character = entitySection("character", listCharacters().length);
  const characterRace = entitySection("character-race", listCharacterRaces().length);
  const location = entitySection("location", listLocations().length);
  const placedCharacter = entitySection("npc", listPlacedCharacters().length);
  const portal = entitySection("portal", listPortals().length);
  const faction = entitySection("faction", listFactions().length);
  const map = mapSection();

  return {
    sections: [
      item,
      spell,
      potionRecipe,
      enchantment,
      quest,
      statusEffect,
      statType,
      itemCategory,
      itemTag,
      character,
      characterRace,
      location,
      placedCharacter,
      portal,
      faction,
      map,
    ],
    ...loadRelease(),
    mapRoute: map.href,
    itemRoute: item.href,
    spellRoute: spell.href,
    potionRecipeRoute: potionRecipe.href,
    enchantmentRoute: enchantment.href,
    questRoute: quest.href,
    statusEffectRoute: statusEffect.href,
    statTypeRoute: statType.href,
    itemCategoryRoute: itemCategory.href,
    itemTagRoute: itemTag.href,
    characterRoute: character.href,
    characterRaceRoute: characterRace.href,
    locationRoute: location.href,
    placedCharacterRoute: placedCharacter.href,
    portalRoute: portal.href,
    factionRoute: faction.href,
  };
}

// Every section count reads a whole overview table, and this load runs once per
// prerendered page. The artifact is immutable for the lifetime of the process,
// so compute it once. Restart the dev server after staging a new artifact.
let layoutData: SiteChrome | null = null;

export const load: LayoutServerLoad = () => (layoutData ??= buildLayoutData());
