import { error } from "@sveltejs/kit";
import { getItemDetail } from "$lib/store/items.js";
import { getEntityField, listDetailSections, listSectionFields } from "$lib/store/site-meta.js";

export interface ResolvedSection {
  id: string;
  title: string;
  kind: "fieldList" | "custom";
  rendererKey: string | null;
  fields: { id: string; label: string; value: unknown }[];
  payload: Record<string, unknown>;
}

export const load = async ({ params }: { params: { id: string } }) => {
  const detail = await getItemDetail(params.id);
  if (!detail) throw error(404, "Item not found");

  const allFields = JSON.parse(detail.fields_json) as Record<string, unknown>;
  const sectionsMeta = await listDetailSections("item");

  const sections: ResolvedSection[] = await Promise.all(
    sectionsMeta.map(async (s): Promise<ResolvedSection> => {
      const fieldList = await listSectionFields("item", s.section_id);
      const fields = await Promise.all(
        fieldList.map(async (f) => {
          const meta = await getEntityField("item", f.field_id);
          return {
            id: f.field_id,
            label: meta?.label ?? f.field_id,
            value: allFields[f.field_id],
          };
        }),
      );
      return {
        id: s.section_id,
        title: s.title,
        kind: s.kind,
        rendererKey: s.renderer_key,
        fields,
        payload: s.payload_json ? (JSON.parse(s.payload_json) as Record<string, unknown>) : {},
      };
    }),
  );

  return {
    id: detail.id,
    name: detail.name,
    variant: detail.variant,
    displayIconSrc: detail.displayIconSrc,
    sections,
  };
};
