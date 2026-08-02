import { listSpells, type SpellOverviewRow } from "$lib/server/read-models";
import type { PageServerLoad } from "./$types";

export const prerender = true;

export type SpellGroup = {
  id: string;
  label: string;
  rows: SpellOverviewRow[];
};

const anchorPart = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "unknown";

export const load: PageServerLoad = () => {
  const spells = listSpells();
  const groupMap = new Map<string, SpellGroup>();
  for (const spell of spells) {
    const label = spell.skill?.trim() || "No governing skill";
    const key = label.toLowerCase();
    const group = groupMap.get(key);
    if (group) {
      group.rows.push(spell);
    } else {
      groupMap.set(key, { id: `skill-${anchorPart(label)}`, label, rows: [spell] });
    }
  }
  const groups = [...groupMap.values()].sort((left, right) =>
    left.label.localeCompare(right.label),
  );
  return { spells, groups };
};
