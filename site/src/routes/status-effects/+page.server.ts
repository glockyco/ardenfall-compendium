import { listStatusEffects, type StatusEffectOverviewRow } from "$lib/server/read-models";
import type { PageServerLoad } from "./$types";

export const prerender = true;

export type StatusEffectGroup = {
  id: "hostile" | "non-hostile";
  label: string;
  rows: StatusEffectOverviewRow[];
};

export const load: PageServerLoad = () => {
  const statusEffects = listStatusEffects();
  const groups: StatusEffectGroup[] = [
    {
      id: "hostile",
      label: "Hostile",
      rows: statusEffects.filter((statusEffect) => statusEffect.isHostile),
    },
    {
      id: "non-hostile",
      label: "Non-hostile",
      rows: statusEffects.filter((statusEffect) => !statusEffect.isHostile),
    },
  ];
  return { statusEffects, groups };
};
