import { error } from "@sveltejs/kit";
import {
  getEntityField,
  getItemDetail,
  listDetailSections,
  listItemIds,
  listSectionFields,
} from "$lib/server/read-models";
import type { EntryGenerator, PageServerLoad } from "./$types";

export interface ResolvedSection {
  id: string;
  title: string;
  kind: "fieldList" | "custom";
  rendererKey: string | null;
  fields: { id: string; label: string; value: unknown }[];
  payload: Record<string, unknown>;
}

export const prerender = true;

export const entries: EntryGenerator = () => listItemIds().map((id) => ({ id }));

export const load: PageServerLoad = ({ params }) => {
  const detail = getItemDetail(params.id);
  if (!detail) throw error(404, "Item not found");

  const allFields = JSON.parse(detail.fields_json) as Record<string, unknown>;
  const sectionsMeta = listDetailSections("item");

  const sections: ResolvedSection[] = sectionsMeta.map((s): ResolvedSection => {
    const fieldList = listSectionFields("item", s.section_id);
    const fields = fieldList.map((f) => {
      const meta = getEntityField("item", f.field_id);
      return {
        id: f.field_id,
        label: meta?.label ?? f.field_id,
        value: allFields[f.field_id],
      };
    });
    return {
      id: s.section_id,
      title: s.title,
      kind: s.kind,
      rendererKey: s.renderer_key,
      fields,
      payload: s.payload_json ? (JSON.parse(s.payload_json) as Record<string, unknown>) : {},
    };
  });

  return {
    id: detail.id,
    name: detail.name,
    variant: detail.variant,
    displayIconSrc: detail.displayIconSrc,
    sections,
  };
};
