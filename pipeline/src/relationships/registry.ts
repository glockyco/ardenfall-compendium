export type RelationshipTitle = string | Readonly<Record<string, string>>;
export type RelationshipPagePresentation = "inline" | "section";
export interface RelationshipDirectionPresentation {
  forward?: RelationshipPagePresentation;
  inverse?: RelationshipPagePresentation;
}

type RelationshipDescriptorBase = {
  pagePresentation?: RelationshipDirectionPresentation;
};

export type RelationshipDescriptor = RelationshipDescriptorBase &
  (
    | {
        forwardTitle: RelationshipTitle;
        inverseTitle: RelationshipTitle | null;
        sortOrder: number;
      }
    | {
        forwardTitle: RelationshipTitle | null;
        inverseTitle: RelationshipTitle;
        sortOrder: number;
      }
    | {
        forwardTitle: null;
        inverseTitle: null;
        sortOrder?: never;
      }
  );

/** Every emitted edge predicate must be declared here. */
export const relationshipRegistry = {
  variant_of: {
    forwardTitle: "Variant",
    inverseTitle: null,
    sortOrder: 10,
  },
  derives_from: {
    forwardTitle: "Derives from",
    inverseTitle: "Variants of this",
    sortOrder: 11,
  },
  instance_of: {
    forwardTitle: "Character type",
    inverseTitle: "Placements",
    pagePresentation: { forward: "inline", inverse: "inline" },
    sortOrder: 12,
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
    inverseTitle: {
      item: "Applied by items",
      spell: "Applied by spells",
      enchantment: "Applied by enchantments",
    },
    sortOrder: 40,
  },
  casts: {
    forwardTitle: null,
    inverseTitle: "Carried by items",
    sortOrder: 50,
  },
  can_drop: {
    forwardTitle: "Can drop",
    inverseTitle: "Dropped by",
    sortOrder: 60,
  },
  sold_by: {
    forwardTitle: "Sold by",
    inverseTitle: "Sells",
    sortOrder: 61,
  },
  starts_in_faction: {
    forwardTitle: "Factions",
    inverseTitle: "Starting members",
    sortOrder: 70,
  },
  starts_opposed_to: {
    forwardTitle: "Opposed at the start",
    inverseTitle: "Opposed by at the start",
    sortOrder: 80,
  },
  references_term: {
    forwardTitle: "Referenced terms",
    inverseTitle: null,
    sortOrder: 90,
  },
  found_at: {
    forwardTitle: "Found at",
    inverseTitle: "Characters found here",
    sortOrder: 100,
  },
  leads_to: {
    forwardTitle: null,
    inverseTitle: null,
  },
  scales_with: {
    forwardTitle: null,
    inverseTitle: null,
  },
  features_character: {
    forwardTitle: "Characters",
    inverseTitle: "Appears in quests",
    sortOrder: 110,
  },
  speaks_about_quest: {
    forwardTitle: null,
    inverseTitle: null,
  },
  rewards_faction_reputation: {
    forwardTitle: "Faction reputation",
    inverseTitle: "Reputation from quests",
    sortOrder: 120,
  },
  rewards_item: {
    forwardTitle: "Item rewards",
    inverseTitle: "Rewarded by quests",
    sortOrder: 130,
  },
  brews_into: {
    forwardTitle: null,
    inverseTitle: "Brewed by",
    sortOrder: 135,
  },
  requires_tag: {
    forwardTitle: null,
    inverseTitle: "Used in recipes",
    sortOrder: 136,
  },
  enchants: {
    forwardTitle: "Can enchant",
    inverseTitle: "Enchantments",
    sortOrder: 137,
  },
  grants_effect: {
    forwardTitle: "Effect",
    inverseTitle: "Potion recipes",
    sortOrder: 138,
  },
} satisfies Record<string, RelationshipDescriptor>;

export type RelationshipPredicate = keyof typeof relationshipRegistry;
