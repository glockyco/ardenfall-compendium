export interface RelationshipDescriptor {
  forwardTitle: string | null;
  inverseTitle: string | null;
  sortOrder: number;
}

/** Every emitted edge predicate must be declared here. */
export const relationshipRegistry = {
  variant_of: {
    forwardTitle: "Variant",
    inverseTitle: null,
    sortOrder: 10,
  },
  categorised_as: {
    forwardTitle: "Category",
    inverseTitle: null,
    sortOrder: 20,
  },
  tagged: {
    forwardTitle: "Tags",
    inverseTitle: null,
    sortOrder: 30,
  },
  applies: {
    forwardTitle: null,
    inverseTitle: "Applied by items",
    sortOrder: 40,
  },
  casts: {
    forwardTitle: null,
    inverseTitle: "Carried by items",
    sortOrder: 50,
  },
  references_term: {
    forwardTitle: "Referenced terms",
    inverseTitle: null,
    sortOrder: 90,
  },
  leads_to: {
    forwardTitle: null,
    inverseTitle: null,
    sortOrder: 0,
  },
  scales_with: {
    forwardTitle: null,
    inverseTitle: null,
    sortOrder: 0,
  },
} satisfies Record<string, RelationshipDescriptor>;

export type RelationshipPredicate = keyof typeof relationshipRegistry;
