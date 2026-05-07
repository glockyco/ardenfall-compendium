import type { Component } from "svelte";
import { sections as itemSections } from "$lib/entities/item/sections.js";
import { mergeStringMaps } from "$lib/registry-merge.js";

export type SectionRendererProps = {
  title: string;
  fields: { id: string; label: string; value: unknown }[];
  payload?: Record<string, unknown>;
};

export type SectionRenderer = Component<SectionRendererProps>;

export type SectionMap = Record<string, SectionRenderer>;

/**
 * The renderer registry is built at module load by merging per-entity
 * `sections` maps. New entities (Slice 4+) extend the import list above; no
 * call sites mutate the registry at runtime.
 */
export const sectionRegistry: SectionMap = mergeStringMaps<SectionRenderer>([itemSections]);
